import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase";

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
    // Fetch role permissions for the group - requires authentication to see all permissions
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
      console.error(`[Bot Permissions] Failed to fetch role permissions for group ${groupId}, status: ${response.status}`);
      const errorText = await response.text();
      console.error(`[Bot Permissions] Error response: ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log(`[Bot Permissions] Group ${groupId} - Raw API response structure:`, JSON.stringify(data, null, 2).substring(0, 500));
    
    const roles: RolePermissions[] = data.data || [];
    console.log(`[Bot Permissions] Group ${groupId} - Found ${roles.length} roles with permissions`);

    // Find the bot's role and check if it has changeRank permission
    const botRolePermissions = roles.find((r) => r.role.id === roleId);
    if (!botRolePermissions) {
      console.error(`[Bot Permissions] Group ${groupId} - Bot role ID ${roleId} not found in permissions response`);
      console.log(`[Bot Permissions] Available role IDs: ${roles.map(r => `${r.role.id} (${r.role.name})`).join(', ')}`);
      return false;
    }

    console.log(`[Bot Permissions] Group ${groupId} - Bot role "${botRolePermissions.role.name}" permissions:`, 
      JSON.stringify(botRolePermissions.permissions?.groupMembershipPermissions, null, 2));

    // Check if the role has "Manage lower-ranked member ranks" permission (changeRank)
    const hasChangeRank = botRolePermissions.permissions?.groupMembershipPermissions?.changeRank === true;
    console.log(`[Bot Permissions] Group ${groupId} - changeRank permission: ${hasChangeRank}`);
    
    return hasChangeRank;
  } catch (error) {
    console.error(`[Bot Permissions] Error checking role permissions for group ${groupId}:`, error);
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
      console.log(`[Bot Status] Bot is in group ${bg.group.id} with role: ${bg.role.name} (ID: ${bg.role.id}, Rank: ${bg.role.rank})`);
      botGroupMap.set(bg.group.id, { roleId: bg.role.id, rank: bg.role.rank, roleName: bg.role.name });
    });

    // Determine status for each requested group
    // Check permissions in parallel for all groups where bot is a member
    const permissionChecks = await Promise.all(
      groupIds.map(async (groupId) => {
        const botRole = botGroupMap.get(groupId);
        
        if (!botRole) {
          // Bot is not in this group
          console.log(`[Bot Status] Bot is NOT in group ${groupId}`);
          return { groupId, status: "not_in_group" as BotStatus, rank: 0, roleName: "" };
        }

        console.log(`[Bot Status] Checking permissions for group ${groupId}, bot role ID: ${botRole.roleId}`);
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

// Get groups where user has custom access (via allowed roles or allowed users)
async function getCustomAccessGroups(robloxId: string, userGroups: RobloxGroup[]): Promise<number[]> {
  try {
    const db = getDb();
    const accessSnapshot = await db.collection(COLLECTIONS.GROUP_ACCESS).get();
    const accessibleGroupIds: number[] = [];

    for (const doc of accessSnapshot.docs) {
      const accessData = doc.data();
      const groupId = parseInt(doc.id);

      // Check if user is in allowed users list
      if (accessData.allowedUsers?.some((u: { robloxId: string }) => u.robloxId === robloxId)) {
        accessibleGroupIds.push(groupId);
        continue;
      }

      // Check if user's role in this group is in allowed roles list
      const userMembership = userGroups.find(g => g.group.id === groupId);
      if (userMembership && accessData.allowedRoles?.some((r: { roleId: number }) => r.roleId === userMembership.role.id)) {
        accessibleGroupIds.push(groupId);
      }
    }

    return accessibleGroupIds;
  } catch (error) {
    console.error("Error fetching custom access groups:", error);
    return [];
  }
}

// Fetch group details for groups where user has custom access but isn't high rank
async function fetchGroupDetails(groupIds: number[]): Promise<RobloxGroup[]> {
  if (groupIds.length === 0) return [];
  
  const groups: RobloxGroup[] = [];
  
  for (const groupId of groupIds) {
    try {
      const response = await fetch(
        `https://groups.roblox.com/v1/groups/${groupId}`,
        { headers: { Accept: "application/json" } }
      );
      if (response.ok) {
        const groupData = await response.json();
        groups.push({
          group: {
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            owner: groupData.owner,
            memberCount: groupData.memberCount,
            created: groupData.created,
            hasVerifiedBadge: groupData.hasVerifiedBadge,
          },
          role: {
            id: 0,
            name: "Custom Access",
            rank: 0,
          },
        });
      }
    } catch (error) {
      console.error(`Error fetching group ${groupId}:`, error);
    }
  }
  
  return groups;
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
    const allUserGroups: RobloxGroup[] = data.data || [];

    // Filter to only groups where user can manage roles (rank >= 254)
    const manageableGroups = allUserGroups.filter((g) => g.role.rank >= 254);
    const manageableGroupIds = new Set(manageableGroups.map(g => g.group.id));

    // Get groups where user has custom access
    const customAccessGroupIds = await getCustomAccessGroups(session.user.robloxId, allUserGroups);
    
    // Filter out groups user already has high rank access to
    const additionalGroupIds = customAccessGroupIds.filter(id => !manageableGroupIds.has(id));
    
    // For custom access groups where user is a member but not high rank, use their existing membership data
    const customAccessGroupsFromMembership = allUserGroups.filter(
      g => additionalGroupIds.includes(g.group.id)
    ).map(g => ({
      ...g,
      role: {
        ...g.role,
        name: `${g.role.name} (Custom Access)`,
      },
    }));
    
    // For custom access groups where user is not a member, fetch group details
    const memberGroupIds = new Set(allUserGroups.map(g => g.group.id));
    const nonMemberCustomAccessIds = additionalGroupIds.filter(id => !memberGroupIds.has(id));
    const nonMemberCustomAccessGroups = await fetchGroupDetails(nonMemberCustomAccessIds);

    // Combine all accessible groups
    const allAccessibleGroups = [
      ...manageableGroups,
      ...customAccessGroupsFromMembership,
      ...nonMemberCustomAccessGroups,
    ];

    // Fetch icons and bot status for all groups
    const groupIds = allAccessibleGroups.map((g) => g.group.id);
    const [iconMap, botStatusMap] = await Promise.all([
      fetchGroupIcons(groupIds),
      fetchBotGroupStatus(groupIds),
    ]);

    // Add icon URLs and bot status to groups
    const groupsWithData = allAccessibleGroups.map((g) => {
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
        hasCustomAccess: customAccessGroupIds.includes(g.group.id),
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
