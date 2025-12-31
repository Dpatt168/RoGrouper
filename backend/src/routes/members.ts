import { Router, Request, Response } from "express";
import { db, COLLECTIONS, isSiteAdmin, getDocument, setDocument } from "../lib/firebase";
import { robloxBotRequest, getUserGroupRole, getRoleInfo } from "../lib/roblox";

const router = Router();

// Get group members
router.get("/:groupId/members", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;
  const { cursor, limit = "10" } = req.query;

  try {
    let url = `https://groups.roblox.com/v1/groups/${groupId}/users?sortOrder=Desc&limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch members");
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Error fetching members:", error);
    return res.status(500).json({ error: "Failed to fetch members" });
  }
});

// Update member (role change, kick)
router.patch("/:groupId/members/:userId", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId, userId } = req.params;
  const { roleId, action } = req.body;

  try {
    // Handle kick action
    if (action === "kick") {
      const response = await robloxBotRequest(
        `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
        "DELETE"
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { errors?: Array<{ message: string }> };
        throw new Error(errorData.errors?.[0]?.message || "Failed to kick user");
      }

      return res.json({ success: true });
    }

    // Handle role change
    if (roleId) {
      // Check if user is site admin
      const isAdmin = await isSiteAdmin(req.user.robloxId);

      if (!isAdmin) {
        // Get the requesting user's rank
        const userRole = await getUserGroupRole(groupId, req.user.robloxId);
        const targetRole = await getRoleInfo(groupId, roleId);

        if (!userRole) {
          return res.status(403).json({ error: "You must be a member of this group" });
        }

        if (!targetRole) {
          return res.status(400).json({ error: "Invalid target role" });
        }

        // Users can only assign roles lower than their own
        if (targetRole.rank >= userRole.rank) {
          return res.status(403).json({
            error: `You cannot assign roles at or above your rank (${userRole.rank})`,
          });
        }
      }

      const response = await robloxBotRequest(
        `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
        "PATCH",
        { roleId }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { errors?: Array<{ message: string }> };
        throw new Error(errorData.errors?.[0]?.message || "Failed to change role");
      }

      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Invalid request" });
  } catch (error) {
    console.error("Error updating member:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update member" });
  }
});

// Get group roles
router.get("/:groupId/roles", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;

  try {
    const response = await fetch(
      `https://groups.roblox.com/v1/groups/${groupId}/roles`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch roles");
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({ error: "Failed to fetch roles" });
  }
});

export default router;
