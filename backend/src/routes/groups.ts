import { Router, Request, Response } from "express";
import { db, COLLECTIONS, isSiteAdmin } from "../lib/firebase";
import { robloxBotRequest, getUserGroupRole, isGroupOwner } from "../lib/roblox";

const router = Router();

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

// Get user's groups
router.get("/", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const response = await fetch(
      `https://groups.roblox.com/v2/users/${req.user.robloxId}/groups/roles`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch groups from Roblox");
    }

    const data = await response.json() as { data: Array<{ group: { id: number; name: string }; role: { id: number; name: string; rank: number } }> };
    const groups = data.data || [];

    // Filter to groups where user has rank >= 200 or is site admin
    const isAdmin = await isSiteAdmin(req.user.robloxId);
    const filteredGroups = isAdmin
      ? groups
      : groups.filter((g: { role: { rank: number } }) => g.role.rank >= 200);

    // Get custom access groups
    const customAccessGroups = await getCustomAccessGroups(
      req.user.robloxId,
      groups
    );

    // Fetch additional group details for custom access
    const additionalGroups = await fetchGroupDetails(
      customAccessGroups.filter(
        (id) => !filteredGroups.some((g: { group: { id: number } }) => g.group.id === id)
      )
    );

    const allGroups = [...filteredGroups, ...additionalGroups];

    // Fetch group icons
    const groupIds = allGroups.map((g: { group: { id: number } }) => g.group.id);
    const iconMap = await fetchGroupIcons(groupIds);

    // Add icons to groups
    const groupsWithIcons = allGroups.map((g: { group: { id: number } }) => ({
      ...g,
      group: {
        ...g.group,
        iconUrl: iconMap.get(g.group.id),
      },
    }));

    // Check bot status for each group
    const groupsWithBotStatus = await Promise.all(
      groupsWithIcons.map(async (g: { group: { id: number } }) => {
        const botStatus = await checkBotStatus(g.group.id);
        return { ...g, ...botStatus };
      })
    );

    return res.json({ data: groupsWithBotStatus });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Helper functions
async function getCustomAccessGroups(
  robloxId: string,
  userGroups: Array<{ group: { id: number }; role: { id: number } }>
): Promise<number[]> {
  const accessSnapshot = await db.collection(COLLECTIONS.GROUP_ACCESS).get();
  const accessibleGroupIds: number[] = [];

  for (const doc of accessSnapshot.docs) {
    const accessData = doc.data();
    const groupId = parseInt(doc.id);

    if (
      accessData.allowedUsers?.some(
        (u: { robloxId: string }) => u.robloxId === robloxId
      )
    ) {
      accessibleGroupIds.push(groupId);
      continue;
    }

    const userMembership = userGroups.find((g) => g.group.id === groupId);
    if (
      userMembership &&
      accessData.allowedRoles?.some(
        (r: { roleId: number }) => r.roleId === userMembership.role.id
      )
    ) {
      accessibleGroupIds.push(groupId);
    }
  }

  return accessibleGroupIds;
}

async function fetchGroupDetails(
  groupIds: number[]
): Promise<Array<{ group: { id: number; name: string }; role: { id: number; name: string; rank: number } }>> {
  if (groupIds.length === 0) return [];

  const groups = [];
  for (const groupId of groupIds) {
    try {
      const response = await fetch(
        `https://groups.roblox.com/v1/groups/${groupId}`,
        { headers: { Accept: "application/json" } }
      );
      if (response.ok) {
        const groupData = await response.json() as { id: number; name: string; description: string; owner: unknown; memberCount: number; created: string; hasVerifiedBadge: boolean };
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

async function fetchGroupIcons(groupIds: number[]): Promise<Map<number, string>> {
  const iconMap = new Map<number, string>();
  if (groupIds.length === 0) return iconMap;

  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupIds.join(",")}&size=150x150&format=Png&isCircular=false`,
      { headers: { Accept: "application/json" } }
    );

    if (response.ok) {
      const data = await response.json() as { data: Array<{ targetId: number; state: string; imageUrl: string }> };
      for (const icon of data.data || []) {
        if (icon.state === "Completed" && icon.imageUrl) {
          iconMap.set(icon.targetId, icon.imageUrl);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching group icons:", error);
  }

  return iconMap;
}

async function checkBotStatus(groupId: number) {
  if (!BOT_COOKIE) {
    return { botStatus: "not_in_group" };
  }

  try {
    // Check if there's a pending join request
    const pendingDoc = await db
      .collection(COLLECTIONS.PENDING_BOT_JOINS)
      .doc(groupId.toString())
      .get();

    if (pendingDoc.exists) {
      const data = pendingDoc.data();
      if (data?.status === "pending" || data?.status === "captcha_needed") {
        return { botStatus: "pending" };
      }
    }

    // Check bot's membership
    const response = await fetch(
      `https://groups.roblox.com/v1/users/me/groups/roles`,
      {
        headers: {
          Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return { botStatus: "not_in_group" };
    }

    const data = await response.json() as { data: Array<{ group: { id: number }; role: { rank: number; name: string } }> };
    const botMembership = data.data?.find(
      (g: { group: { id: number } }) => g.group.id === groupId
    );

    if (!botMembership) {
      return { botStatus: "not_in_group" };
    }

    const botRank = botMembership.role.rank;
    if (botRank < 255) {
      return {
        botStatus: "ready",
        botRank,
        botRoleName: botMembership.role.name,
      };
    }

    return { botStatus: "needs_rank", botRank, botRoleName: botMembership.role.name };
  } catch (error) {
    console.error("Error checking bot status:", error);
    return { botStatus: "not_in_group" };
  }
}

export default router;
