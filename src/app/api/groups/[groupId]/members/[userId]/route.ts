import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;
const DATA_DIR = path.join(process.cwd(), "data");

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

  // First request to get XSRF token
  let response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // If we get a 403 with x-csrf-token header, retry with that token
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

interface RoleSync {
  id: string;
  sourceGroupId: number;
  sourceRoleId: number | null; // null means "any role" in the group
  targetGroupId: number;
  targetRoleId: number;
}

interface Organization {
  id: string;
  groupIds: number[];
  roleSyncs: RoleSync[];
}

interface OrganizationsData {
  organizations: Organization[];
}

async function getOrganizationsData(userId: string): Promise<OrganizationsData> {
  const filePath = path.join(DATA_DIR, `organizations-${userId}.json`);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return { organizations: [] };
  }
}

async function applyRoleSyncs(
  ownerId: string,
  sourceGroupId: number,
  sourceRoleId: number,
  targetUserId: string
) {
  const orgsData = await getOrganizationsData(ownerId);
  const appliedSyncs: string[] = [];

  for (const org of orgsData.organizations) {
    // Find syncs where this group/role is the source
    // Also match syncs where sourceRoleId is null (any role in group)
    const matchingSyncs = org.roleSyncs.filter(
      (sync) => sync.sourceGroupId === sourceGroupId && 
        (sync.sourceRoleId === sourceRoleId || sync.sourceRoleId === null)
    );

    for (const sync of matchingSyncs) {
      try {
        // Apply the target role in the target group
        const response = await robloxBotRequest(
          `https://groups.roblox.com/v1/groups/${sync.targetGroupId}/users/${targetUserId}`,
          "PATCH",
          { roleId: sync.targetRoleId }
        );

        if (response.ok) {
          appliedSyncs.push(`${sync.targetGroupId}:${sync.targetRoleId}`);
        }
      } catch (error) {
        console.error(`Error applying role sync to group ${sync.targetGroupId}:`, error);
      }
    }
  }

  return appliedSyncs;
}

// Change user's role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string; userId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId, userId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { roleId, triggerSync = true } = await request.json();

    const response = await robloxBotRequest(
      `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
      "PATCH",
      { roleId }
    );

    if (!response.ok) {
      const error = await response.json();
      const message = error.errors?.[0]?.message || "Failed to update role";
      // Provide clearer error messages
      if (message.includes("roleset is invalid")) {
        throw new Error("Cannot assign this role - it may be at or above the bot's rank");
      }
      throw new Error(message);
    }

    // Apply role syncs if enabled
    let appliedSyncs: string[] = [];
    if (triggerSync && session.user.robloxId) {
      appliedSyncs = await applyRoleSyncs(
        session.user.robloxId,
        parseInt(groupId),
        roleId,
        userId
      );
    }

    return NextResponse.json({ success: true, appliedSyncs });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update role" },
      { status: 500 }
    );
  }
}

// Kick user from group
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ groupId: string; userId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId, userId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await robloxBotRequest(
      `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
      "DELETE"
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || "Failed to kick user");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error kicking user:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to kick user" },
      { status: 500 }
    );
  }
}
