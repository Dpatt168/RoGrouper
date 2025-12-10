import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

export type BotStatus = "ready" | "not_in_group" | "needs_rank" | "pending";

export interface RobloxGroup {
  group: {
    id: number;
    name: string;
    description: string;
    owner: {
      id: number;
      type: string;
    } | null;
    memberCount: number;
    created: string;
    hasVerifiedBadge: boolean;
    iconUrl?: string;
  };
  role: {
    id: number;
    name: string;
    rank: number;
  };
  botStatus?: BotStatus;
  botRank?: number;
  botRoleName?: string;
}

interface GroupIconData {
  targetId: number;
  state: string;
  imageUrl: string;
}

async function fetchGroupIcons(groupIds: number[]): Promise<Map<number, string>> {
  const iconMap = new Map<number, string>();
  if (groupIds.length === 0) return iconMap;

  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupIds.join(",")}&size=150x150&format=Png&isCircular=false`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (response.ok) {
      const data = await response.json();
      data.data?.forEach((icon: GroupIconData) => {
        if (icon.state === "Completed" && icon.imageUrl) {
          iconMap.set(icon.targetId, icon.imageUrl);
        }
      });
    }
  } catch (error) {
    console.error("Error fetching group icons:", error);
  }

  return iconMap;
}

interface BotGroupMembership {
  group: { id: number };
  role: { id: number; name: string; rank: number };
}

interface RolePermissions {
  groupId: number;
  role: {
    id: number;
    name: string;
    rank: number;
  };
  permissions: {
    groupPostsPermissions: {
      viewWall: boolean;
      postToWall: boolean;
      deleteFromWall: boolean;
      viewStatus: boolean;
      postToStatus: boolean;
    };
    groupMembershipPermissions: {
      changeRank: boolean;
      inviteMembers: boolean;
      removeMembers: boolean;
    };
    groupManagementPermissions: {
      manageRelationships: boolean;
      manageClan: boolean;
      viewAuditLogs: boolean;
    };
    groupEconomyPermissions: {
      spendGroupFunds: boolean;
      advertiseGroup: boolean;
      createItems: boolean;
      manageItems: boolean;
      addGroupPlaces: boolean;
      manageGroupGames: boolean;
      viewGroupPayouts: boolean;
      viewAnalytics: boolean;
    };
    groupOpenCloudPermissions: {
      useCloudAuthentication: boolean;
      administerCloudAuthentication: boolean;
    };
  };
}

async function checkBotRolePermissions(
  groupId: number,
  roleId: number
): Promise<boolean> {
  try {
    // Fetch role permissions for the group
    const response = await fetch(
      `https://groups.roblox.com/v1/groups/${groupId}/roles/permissions`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch role permissions for group ${groupId}`);
      return false;
    }

    const data = await response.json();
    const roles: RolePermissions[] = data.data || [];

    // Find the bot's role and check if it has changeRank permission
    const botRolePermissions = roles.find((r) => r.role.id === roleId);
    if (!botRolePermissions) {
      return false;
    }

    // Check if the role has "Manage lower-ranked member ranks" permission (changeRank)
    return botRolePermissions.permissions.groupMembershipPermissions.changeRank === true;
  } catch (error) {
    console.error(`Error checking role permissions for group ${groupId}:`, error);
    return false;
  }
}

async function fetchBotGroupStatus(
  groupIds: number[]
): Promise<Map<number, { status: BotStatus; rank: number; roleName: string }>> {
  const statusMap = new Map<number, { status: BotStatus; rank: number; roleName: string }>();
  
  if (!BOT_COOKIE || groupIds.length === 0) {
    // If no bot configured, mark all as not_in_group
    groupIds.forEach((id) => statusMap.set(id, { status: "not_in_group", rank: 0, roleName: "" }));
    return statusMap;
  }

  try {
    // Get bot's user ID first
    const authResponse = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers: {
        Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
      },
    });

    if (!authResponse.ok) {
      groupIds.forEach((id) => statusMap.set(id, { status: "not_in_group", rank: 0, roleName: "" }));
      return statusMap;
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
      groupIds.forEach((id) => statusMap.set(id, { status: "not_in_group", rank: 0, roleName: "" }));
      return statusMap;
    }

    const botGroupsData = await groupsResponse.json();
    const botGroups: BotGroupMembership[] = botGroupsData.data || [];

    // Create a map of group ID to bot's role info in that group
    const botGroupMap = new Map<number, { roleId: number; rank: number; roleName: string }>();
    botGroups.forEach((bg) => {
      botGroupMap.set(bg.group.id, { roleId: bg.role.id, rank: bg.role.rank, roleName: bg.role.name });
    });

    // Determine status for each requested group
    // Check permissions in parallel for all groups where bot is a member
    const permissionChecks = await Promise.all(
      groupIds.map(async (groupId) => {
        const botRole = botGroupMap.get(groupId);
        
        if (!botRole) {
          // Bot is not in this group
          return { groupId, status: "not_in_group" as BotStatus, rank: 0, roleName: "" };
        }

        // Check if the bot's role has the "changeRank" permission
        const hasChangeRankPermission = await checkBotRolePermissions(groupId, botRole.roleId);
        
        return {
          groupId,
          status: hasChangeRankPermission ? "ready" as BotStatus : "needs_rank" as BotStatus,
          rank: botRole.rank,
          roleName: botRole.roleName,
        };
      })
    );

    // Populate the status map
    permissionChecks.forEach(({ groupId, status, rank, roleName }) => {
      statusMap.set(groupId, { status, rank, roleName });
    });
  } catch (error) {
    console.error("Error fetching bot group status:", error);
    groupIds.forEach((id) => statusMap.set(id, { status: "not_in_group", rank: 0, roleName: "" }));
  }

  return statusMap;
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(
      `https://groups.roblox.com/v2/users/${session.user.robloxId}/groups/roles`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch groups");
    }

    const data = await response.json();
    const groups: RobloxGroup[] = data.data || [];

    // Filter to only groups where user can manage roles (rank >= 254)
    const manageableGroups = groups.filter((g) => g.role.rank >= 254);

    // Fetch icons and bot status for filtered groups
    const groupIds = manageableGroups.map((g) => g.group.id);
    const [iconMap, botStatusMap] = await Promise.all([
      fetchGroupIcons(groupIds),
      fetchBotGroupStatus(groupIds),
    ]);

    // Add icon URLs and bot status to groups
    const groupsWithData = manageableGroups.map((g) => {
      const botInfo = botStatusMap.get(g.group.id);
      return {
        ...g,
        group: {
          ...g.group,
          iconUrl: iconMap.get(g.group.id) || null,
        },
        botStatus: botInfo?.status || "not_in_group",
        botRank: botInfo?.rank || 0,
        botRoleName: botInfo?.roleName || "",
      };
    });

    return NextResponse.json({ data: groupsWithData });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
