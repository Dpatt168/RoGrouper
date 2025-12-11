import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDocument, setDocument, COLLECTIONS, getDb } from "@/lib/firebase";

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

// Helper to make Roblox API requests with bot cookie and XSRF token handling
async function robloxBotRequest(
  url: string,
  method: string,
  body?: object
): Promise<Response> {
  if (!BOT_COOKIE) {
    throw new Error("Bot token not configured");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
  };

  let response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 403) {
    const xsrfToken = response.headers.get("x-csrf-token");
    if (xsrfToken) {
      headers["x-csrf-token"] = xsrfToken;
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  return response;
}

// Process expired suspensions for a specific group
async function processExpiredSuspensions(groupId: string, data: GroupAutomation): Promise<GroupAutomation> {
  if (!data.suspensions || data.suspensions.length === 0) {
    return data;
  }

  const now = Date.now();
  const expiredSuspensions = data.suspensions.filter((s) => s.expiresAt <= now);
  
  if (expiredSuspensions.length === 0) {
    return data;
  }

  // Restore roles for expired suspensions
  for (const suspension of expiredSuspensions) {
    try {
      const response = await robloxBotRequest(
        `https://groups.roblox.com/v1/groups/${groupId}/users/${suspension.userId}`,
        "PATCH",
        { roleId: suspension.previousRoleId }
      );

      if (response.ok) {
        console.log(
          `[Auto-unsuspend] Restored ${suspension.username} (${suspension.userId}) to role ${suspension.previousRoleName} in group ${groupId}`
        );
      } else {
        console.error(
          `[Auto-unsuspend] Failed to restore ${suspension.username} in group ${groupId}`
        );
      }
    } catch (error) {
      console.error(`[Auto-unsuspend] Error restoring ${suspension.username}:`, error);
    }
  }

  // Remove expired suspensions
  data.suspensions = data.suspensions.filter((s) => s.expiresAt > now);
  
  // Save updated data
  await saveAutomationData(groupId, data);
  
  return data;
}

// Background job to process ALL groups' expired suspensions (runs on any group access)
async function processAllExpiredSuspensions() {
  try {
    const db = getDb();
    const now = Date.now();
    const snapshot = await db.collection(COLLECTIONS.GROUP_AUTOMATION).get();

    for (const doc of snapshot.docs) {
      const groupId = doc.id;
      const data = doc.data() as GroupAutomation;

      if (!data.suspensions || data.suspensions.length === 0) {
        continue;
      }

      const expiredSuspensions = data.suspensions.filter((s) => s.expiresAt <= now);
      
      if (expiredSuspensions.length === 0) {
        continue;
      }

      // Restore roles for expired suspensions
      for (const suspension of expiredSuspensions) {
        try {
          const response = await robloxBotRequest(
            `https://groups.roblox.com/v1/groups/${groupId}/users/${suspension.userId}`,
            "PATCH",
            { roleId: suspension.previousRoleId }
          );

          if (response.ok) {
            console.log(
              `[Auto-unsuspend] Restored ${suspension.username} (${suspension.userId}) to role ${suspension.previousRoleName} in group ${groupId}`
            );
          }
        } catch (error) {
          console.error(`[Auto-unsuspend] Error:`, error);
        }
      }

      // Remove expired suspensions
      const remainingSuspensions = data.suspensions.filter((s) => s.expiresAt > now);
      await db.collection(COLLECTIONS.GROUP_AUTOMATION).doc(groupId).update({
        suspensions: remainingSuspensions,
      });
    }
  } catch (error) {
    console.error("[Auto-unsuspend] Error processing all groups:", error);
  }
}

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

async function getAutomationData(groupId: string): Promise<GroupAutomation> {
  return getDocument<GroupAutomation>(
    COLLECTIONS.GROUP_AUTOMATION,
    groupId,
    { rules: [], userPoints: [], suspensions: [] }
  );
}

async function saveAutomationData(groupId: string, data: GroupAutomation) {
  // Clean up undefined values from userPoints to avoid Firestore errors
  const cleanedData = {
    ...data,
    userPoints: data.userPoints.map((user) => {
      const cleanUser: Record<string, unknown> = {
        userId: user.userId,
        username: user.username,
        points: user.points,
      };
      // Only include subGroupId if it has a value
      if (user.subGroupId) {
        cleanUser.subGroupId = user.subGroupId;
      }
      return cleanUser;
    }),
  };
  await setDocument(COLLECTIONS.GROUP_AUTOMATION, groupId, cleanedData);
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
    // Process ALL expired suspensions across all groups (background task)
    // This runs whenever any group's automation data is accessed
    processAllExpiredSuspensions().catch(err => 
      console.error("[Auto-unsuspend] Background processing error:", err)
    );

    const data = await getAutomationData(groupId);
    
    // Also process this specific group's suspensions immediately for accurate data
    const processedData = await processExpiredSuspensions(groupId, data);
    
    return NextResponse.json(processedData);
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
        // If subGroupId is null or empty, remove the field entirely; otherwise set it
        if (body.subGroupId) {
          user.subGroupId = body.subGroupId;
        } else {
          delete user.subGroupId;
        }
      } else if (body.subGroupId) {
        // Only create user entry if assigning to a sub-group
        data.userPoints.push({
          userId: body.userId,
          username: body.username,
          points: 0,
          subGroupId: body.subGroupId,
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
