import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/firebase";

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

export interface ConnectedGroup {
  groupId: number;
  groupName: string;
  groupIconUrl?: string;
  memberCount: number;
  botRole: {
    id: number;
    name: string;
    rank: number;
  };
  hasChangeRankPermission: boolean;
  owner: {
    id: number;
    name: string;
  } | null;
}

interface RolePermissions {
  groupId: number;
  role: {
    id: number;
    name: string;
    rank: number;
  };
  permissions: {
    groupMembershipPermissions: {
      changeRank: boolean;
      inviteMembers: boolean;
      removeMembers: boolean;
    };
  };
}

async function checkRolePermissions(groupId: number, roleId: number): Promise<boolean> {
  try {
    const response = await fetch(
      `https://groups.roblox.com/v1/groups/${groupId}/roles/permissions`,
      {
        headers: { 
          Accept: "application/json",
          Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const roles: RolePermissions[] = data.data || [];
    const rolePermissions = roles.find((r) => r.role.id === roleId);
    
    return rolePermissions?.permissions?.groupMembershipPermissions?.changeRank === true;
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId || !(await isSiteAdmin(session.user.robloxId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BOT_COOKIE) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
  }

  try {
    // Get bot's user ID
    const authResponse = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers: {
        Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
      },
    });

    if (!authResponse.ok) {
      return NextResponse.json({ error: "Failed to authenticate bot" }, { status: 500 });
    }

    const botUser = await authResponse.json();
    const botUserId = botUser.id;

    // Get all groups the bot is in
    const groupsResponse = await fetch(
      `https://groups.roblox.com/v1/users/${botUserId}/groups/roles`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!groupsResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch bot groups" }, { status: 500 });
    }

    const botGroupsData = await groupsResponse.json();
    const botGroups = botGroupsData.data || [];

    // Fetch group icons
    const groupIds = botGroups.map((g: { group: { id: number } }) => g.group.id);
    const iconMap = new Map<number, string>();
    
    if (groupIds.length > 0) {
      try {
        const iconsResponse = await fetch(
          `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupIds.join(",")}&size=150x150&format=Png&isCircular=false`,
          { headers: { Accept: "application/json" } }
        );
        if (iconsResponse.ok) {
          const iconsData = await iconsResponse.json();
          iconsData.data?.forEach((icon: { targetId: number; state: string; imageUrl: string }) => {
            if (icon.state === "Completed" && icon.imageUrl) {
              iconMap.set(icon.targetId, icon.imageUrl);
            }
          });
        }
      } catch {
        // Ignore icon fetch errors
      }
    }

    // Check permissions for each group in parallel
    const connectedGroups: ConnectedGroup[] = await Promise.all(
      botGroups.map(async (bg: { group: { id: number; name: string; memberCount: number; owner?: { id: number; name: string } }; role: { id: number; name: string; rank: number } }) => {
        const hasChangeRankPermission = await checkRolePermissions(bg.group.id, bg.role.id);
        
        return {
          groupId: bg.group.id,
          groupName: bg.group.name,
          groupIconUrl: iconMap.get(bg.group.id),
          memberCount: bg.group.memberCount,
          botRole: {
            id: bg.role.id,
            name: bg.role.name,
            rank: bg.role.rank,
          },
          hasChangeRankPermission,
          owner: bg.group.owner || null,
        };
      })
    );

    // Sort by group name
    connectedGroups.sort((a, b) => a.groupName.localeCompare(b.groupName));

    return NextResponse.json({ 
      groups: connectedGroups,
      botInfo: {
        id: botUserId,
        name: botUser.name,
        displayName: botUser.displayName,
      }
    });
  } catch (error) {
    console.error("Error fetching connected groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch connected groups" },
      { status: 500 }
    );
  }
}

// POST to leave a group
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId || !(await isSiteAdmin(session.user.robloxId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BOT_COOKIE) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, groupId } = body;

    if (action === "leave" && groupId) {
      // Get CSRF token first
      const csrfResponse = await fetch("https://auth.roblox.com/v2/logout", {
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
        },
      });
      
      const csrfToken = csrfResponse.headers.get("x-csrf-token");
      
      if (!csrfToken) {
        return NextResponse.json({ error: "Failed to get CSRF token" }, { status: 500 });
      }

      // Get bot user ID
      const authResponse = await fetch("https://users.roblox.com/v1/users/authenticated", {
        headers: {
          Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
        },
      });
      
      if (!authResponse.ok) {
        return NextResponse.json({ error: "Failed to authenticate bot" }, { status: 500 });
      }
      
      const botUser = await authResponse.json();

      // Leave the group
      const leaveResponse = await fetch(
        `https://groups.roblox.com/v1/groups/${groupId}/users/${botUser.id}`,
        {
          method: "DELETE",
          headers: {
            Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
            "X-CSRF-TOKEN": csrfToken,
          },
        }
      );

      if (!leaveResponse.ok) {
        const errorText = await leaveResponse.text();
        console.error("Failed to leave group:", errorText);
        return NextResponse.json({ error: "Failed to leave group", details: errorText }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: `Left group ${groupId}` });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error performing action:", error);
    return NextResponse.json(
      { error: "Failed to perform action" },
      { status: 500 }
    );
  }
}
