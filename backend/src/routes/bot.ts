import { Router, Request, Response } from "express";
import { db, COLLECTIONS } from "../lib/firebase";
import { robloxBotRequest } from "../lib/roblox";

const router = Router();

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

// Get bot info
router.get("/info", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!BOT_COOKIE) {
    return res.status(500).json({ error: "Bot not configured" });
  }

  try {
    const response = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers: {
        Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return res.status(500).json({ error: "Failed to get bot info" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Error fetching bot info:", error);
    return res.status(500).json({ error: "Failed to get bot info" });
  }
});

// Request bot to join group
router.post("/:groupId/bot-join", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;

  try {
    // Check if there's already a pending request
    const existingDoc = await db
      .collection(COLLECTIONS.PENDING_BOT_JOINS)
      .doc(groupId)
      .get();

    if (existingDoc.exists) {
      const data = existingDoc.data();
      if (data?.status === "pending" || data?.status === "captcha_needed") {
        return res.json({ status: data.status, message: "Request already pending" });
      }
    }

    // Try to join the group
    const response = await robloxBotRequest(
      `https://groups.roblox.com/v1/groups/${groupId}/users`,
      "POST"
    );

    if (response.ok) {
      return res.json({ status: "joined", message: "Bot joined successfully" });
    }

    const errorData = await response.json().catch(() => ({})) as { errors?: Array<{ code: number; message: string }> };
    const errorCode = errorData.errors?.[0]?.code;

    // Captcha required
    if (response.status === 403 || errorCode === 12) {
      await db.collection(COLLECTIONS.PENDING_BOT_JOINS).doc(groupId).set({
        status: "captcha_needed",
        requestedBy: req.user.robloxId,
        requestedAt: Date.now(),
        groupId: parseInt(groupId),
      });

      return res.json({ status: "captcha_needed", message: "Captcha required - admin will process" });
    }

    // Other error
    await db.collection(COLLECTIONS.PENDING_BOT_JOINS).doc(groupId).set({
      status: "pending",
      requestedBy: req.user.robloxId,
      requestedAt: Date.now(),
      groupId: parseInt(groupId),
      error: errorData.errors?.[0]?.message || "Unknown error",
    });

    return res.json({ status: "pending", message: "Request submitted for admin review" });
  } catch (error) {
    console.error("Error requesting bot join:", error);
    return res.status(500).json({ error: "Failed to request bot join" });
  }
});

// Get bot role in group
router.get("/:groupId/bot-role", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;

  if (!BOT_COOKIE) {
    return res.status(500).json({ error: "Bot not configured" });
  }

  try {
    const response = await fetch(
      "https://groups.roblox.com/v1/users/me/groups/roles",
      {
        headers: {
          Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return res.status(500).json({ error: "Failed to get bot role" });
    }

    const data = await response.json() as { data: Array<{ group: { id: number }; role: { rank: number; name: string } }> };
    const membership = data.data?.find((g) => g.group.id === parseInt(groupId));

    if (!membership) {
      return res.json({ inGroup: false });
    }

    return res.json({
      inGroup: true,
      rank: membership.role.rank,
      roleName: membership.role.name,
    });
  } catch (error) {
    console.error("Error fetching bot role:", error);
    return res.status(500).json({ error: "Failed to get bot role" });
  }
});

export default router;
