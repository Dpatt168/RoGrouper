import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

interface Rule {
  id: string;
  points: number;
  roleId: number;
  roleName: string;
}

interface SuspendedRole {
  roleId: number;
  roleName: string;
}

interface Suspension {
  id: string;
  userId: number;
  username: string;
  previousRoleId: number;
  previousRoleName: string;
  suspendedAt: number;
  expiresAt: number;
}

interface UserPoints {
  userId: number;
  username: string;
  points: number;
  subGroupId?: string; // Which sub-group the user belongs to
}

interface SubGroupRule {
  id: string;
  points: number;
  roleId: number;
  roleName: string;
}

interface SubGroup {
  id: string;
  name: string;
  color: string; // For visual distinction
  rules: SubGroupRule[];
  excludeFromGeneralAutomation?: boolean; // If true, members won't fall back to general rules
}

interface GroupAutomation {
  rules: Rule[];
  userPoints: UserPoints[];
  suspendedRole?: SuspendedRole;
  suspensions: Suspension[];
  subGroups?: SubGroup[];
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function getAutomationData(groupId: string): Promise<GroupAutomation> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `group-${groupId}.json`);
  
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return { rules: [], userPoints: [], suspensions: [] };
  }
}

async function saveAutomationData(groupId: string, data: GroupAutomation) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `group-${groupId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getAutomationData(groupId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching automation data:", error);
    return NextResponse.json(
      { error: "Failed to fetch automation data" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = await getAutomationData(groupId);

    if (body.action === "addRule") {
      const newRule: Rule = {
        id: crypto.randomUUID(),
        points: body.points,
        roleId: body.roleId,
        roleName: body.roleName,
      };
      data.rules.push(newRule);
    } else if (body.action === "deleteRule") {
      data.rules = data.rules.filter((r) => r.id !== body.ruleId);
    } else if (body.action === "updatePoints") {
      const existingUser = data.userPoints.find((u) => u.userId === body.userId);
      if (existingUser) {
        existingUser.points = Math.max(0, existingUser.points + body.pointsDelta);
        existingUser.username = body.username;
      } else {
        data.userPoints.push({
          userId: body.userId,
          username: body.username,
          points: Math.max(0, body.pointsDelta),
        });
      }
    } else if (body.action === "setPoints") {
      const existingUser = data.userPoints.find((u) => u.userId === body.userId);
      if (existingUser) {
        existingUser.points = Math.max(0, body.points);
        existingUser.username = body.username;
      } else {
        data.userPoints.push({
          userId: body.userId,
          username: body.username,
          points: Math.max(0, body.points),
        });
      }
    } else if (body.action === "setSuspendedRole") {
      data.suspendedRole = {
        roleId: body.roleId,
        roleName: body.roleName,
      };
    } else if (body.action === "clearSuspendedRole") {
      delete data.suspendedRole;
    } else if (body.action === "suspendUser") {
      // Ensure suspensions array exists
      if (!data.suspensions) data.suspensions = [];
      // Remove any existing suspension for this user
      data.suspensions = data.suspensions.filter((s) => s.userId !== body.userId);
      
      const newSuspension: Suspension = {
        id: crypto.randomUUID(),
        userId: body.userId,
        username: body.username,
        previousRoleId: body.previousRoleId,
        previousRoleName: body.previousRoleName,
        suspendedAt: Date.now(),
        expiresAt: Date.now() + body.durationMs,
      };
      data.suspensions.push(newSuspension);
    } else if (body.action === "unsuspendUser") {
      if (!data.suspensions) data.suspensions = [];
      data.suspensions = data.suspensions.filter((s) => s.userId !== body.userId);
    } else if (body.action === "cleanExpiredSuspensions") {
      if (!data.suspensions) data.suspensions = [];
      const now = Date.now();
      const expired = data.suspensions.filter((s) => s.expiresAt <= now);
      data.suspensions = data.suspensions.filter((s) => s.expiresAt > now);
      // Return expired suspensions so caller can restore roles
      await saveAutomationData(groupId, data);
      return NextResponse.json({ ...data, expiredSuspensions: expired });
    } else if (body.action === "createSubGroup") {
      if (!data.subGroups) data.subGroups = [];
      const newSubGroup: SubGroup = {
        id: crypto.randomUUID(),
        name: body.name,
        color: body.color || "#6366f1",
        rules: [],
      };
      data.subGroups.push(newSubGroup);
    } else if (body.action === "deleteSubGroup") {
      if (!data.subGroups) data.subGroups = [];
      data.subGroups = data.subGroups.filter((sg) => sg.id !== body.subGroupId);
      // Remove sub-group assignment from users
      data.userPoints = data.userPoints.map((u) => {
        if (u.subGroupId === body.subGroupId) {
          const { subGroupId, ...rest } = u;
          return rest;
        }
        return u;
      });
    } else if (body.action === "renameSubGroup") {
      if (!data.subGroups) data.subGroups = [];
      const subGroup = data.subGroups.find((sg) => sg.id === body.subGroupId);
      if (subGroup) {
        subGroup.name = body.name;
        if (body.color) subGroup.color = body.color;
      }
    } else if (body.action === "updateSubGroupSettings") {
      if (!data.subGroups) data.subGroups = [];
      const subGroup = data.subGroups.find((sg) => sg.id === body.subGroupId);
      if (subGroup) {
        if (body.excludeFromGeneralAutomation !== undefined) {
          subGroup.excludeFromGeneralAutomation = body.excludeFromGeneralAutomation;
        }
      }
    } else if (body.action === "addSubGroupRule") {
      if (!data.subGroups) data.subGroups = [];
      const subGroup = data.subGroups.find((sg) => sg.id === body.subGroupId);
      if (subGroup) {
        const newRule: SubGroupRule = {
          id: crypto.randomUUID(),
          points: body.points,
          roleId: body.roleId,
          roleName: body.roleName,
        };
        subGroup.rules.push(newRule);
      }
    } else if (body.action === "deleteSubGroupRule") {
      if (!data.subGroups) data.subGroups = [];
      const subGroup = data.subGroups.find((sg) => sg.id === body.subGroupId);
      if (subGroup) {
        subGroup.rules = subGroup.rules.filter((r) => r.id !== body.ruleId);
      }
    } else if (body.action === "assignUserToSubGroup") {
      const user = data.userPoints.find((u) => u.userId === body.userId);
      if (user) {
        user.subGroupId = body.subGroupId || undefined;
      } else {
        // Create user entry if doesn't exist
        data.userPoints.push({
          userId: body.userId,
          username: body.username,
          points: 0,
          subGroupId: body.subGroupId || undefined,
        });
      }
    } else if (body.action === "removeUserFromSubGroup") {
      const user = data.userPoints.find((u) => u.userId === body.userId);
      if (user) {
        delete user.subGroupId;
      }
    }

    await saveAutomationData(groupId, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating automation data:", error);
    return NextResponse.json(
      { error: "Failed to update automation data" },
      { status: 500 }
    );
  }
}
