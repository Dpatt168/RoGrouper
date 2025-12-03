import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

export interface RoleSync {
  id: string;
  sourceGroupId: number;
  sourceGroupName: string;
  sourceRoleId: number | null; // null means "any role" (just being in the group)
  sourceRoleName: string; // "Any Role" when sourceRoleId is null
  targetGroupId: number;
  targetGroupName: string;
  targetRoleId: number;
  targetRoleName: string;
}

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  groupIds: number[];
  groups: Array<{
    id: number;
    name: string;
    iconUrl?: string;
  }>;
  roleSyncs: RoleSync[];
  createdAt: number;
}

interface OrganizationsData {
  organizations: Organization[];
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function getOrganizationsData(userId: string): Promise<OrganizationsData> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `organizations-${userId}.json`);
  
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return { organizations: [] };
  }
}

async function saveOrganizationsData(userId: string, data: OrganizationsData) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `organizations-${userId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getOrganizationsData(session.user.robloxId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = await getOrganizationsData(session.user.robloxId);

    if (body.action === "create") {
      const newOrg: Organization = {
        id: crypto.randomUUID(),
        name: body.name,
        ownerId: session.user.robloxId,
        groupIds: body.groupIds || [],
        groups: body.groups || [],
        roleSyncs: [],
        createdAt: Date.now(),
      };
      data.organizations.push(newOrg);
    } else if (body.action === "delete") {
      data.organizations = data.organizations.filter((o) => o.id !== body.orgId);
    } else if (body.action === "updateGroups") {
      const org = data.organizations.find((o) => o.id === body.orgId);
      if (org) {
        org.groupIds = body.groupIds;
        org.groups = body.groups;
      }
    } else if (body.action === "addRoleSync") {
      const org = data.organizations.find((o) => o.id === body.orgId);
      if (org) {
        const newSync: RoleSync = {
          id: crypto.randomUUID(),
          sourceGroupId: body.sourceGroupId,
          sourceGroupName: body.sourceGroupName,
          sourceRoleId: body.sourceRoleId,
          sourceRoleName: body.sourceRoleName,
          targetGroupId: body.targetGroupId,
          targetGroupName: body.targetGroupName,
          targetRoleId: body.targetRoleId,
          targetRoleName: body.targetRoleName,
        };
        org.roleSyncs.push(newSync);
      }
    } else if (body.action === "deleteRoleSync") {
      const org = data.organizations.find((o) => o.id === body.orgId);
      if (org) {
        org.roleSyncs = org.roleSyncs.filter((s) => s.id !== body.syncId);
      }
    } else if (body.action === "rename") {
      const org = data.organizations.find((o) => o.id === body.orgId);
      if (org) {
        org.name = body.name;
      }
    }

    await saveOrganizationsData(session.user.robloxId, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating organizations:", error);
    return NextResponse.json(
      { error: "Failed to update organizations" },
      { status: 500 }
    );
  }
}
