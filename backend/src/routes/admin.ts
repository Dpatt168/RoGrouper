import { Router, Request, Response } from "express";
import { db, COLLECTIONS, isSiteAdmin, getSiteAdmins, SiteAdmin } from "../lib/firebase";
import { robloxBotRequest } from "../lib/roblox";

const router = Router();

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

// Check if user is admin
router.get("/check", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = await isSiteAdmin(req.user.robloxId);
  return res.json({ isAdmin });
});

// Get site admins
router.get("/site-admins", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = await isSiteAdmin(req.user.robloxId);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const admins = await getSiteAdmins();
  return res.json({ admins });
});

// Add/remove site admin
router.post("/site-admins", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = await isSiteAdmin(req.user.robloxId);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { action, robloxId } = req.body;
  const admins = await getSiteAdmins();

  if (action === "add") {
    if (admins.some((a) => a.robloxId === robloxId)) {
      return res.status(400).json({ error: "User is already an admin" });
    }

    const newAdmin: SiteAdmin = { robloxId };
    const updatedAdmins = [...admins, newAdmin];
    await db.collection(COLLECTIONS.SITE_CONFIG).doc("admins").set({ admins: updatedAdmins });

    return res.json({ admins: updatedAdmins });
  }

  if (action === "remove") {
    if (admins.length <= 1) {
      return res.status(400).json({ error: "Cannot remove the last admin" });
    }

    const updatedAdmins = admins.filter((a) => a.robloxId !== robloxId);
    await db.collection(COLLECTIONS.SITE_CONFIG).doc("admins").set({ admins: updatedAdmins });

    return res.json({ admins: updatedAdmins });
  }

  return res.status(400).json({ error: "Invalid action" });
});

// Get pending bot joins
router.get("/pending-joins", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = await isSiteAdmin(req.user.robloxId);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const snapshot = await db.collection(COLLECTIONS.PENDING_BOT_JOINS).get();
    const requests = snapshot.docs.map((doc) => ({
      groupId: doc.id,
      ...doc.data(),
    }));

    return res.json({ requests });
  } catch (error) {
    console.error("Error fetching pending joins:", error);
    return res.status(500).json({ error: "Failed to fetch pending joins" });
  }
});

// Update pending bot join
router.post("/pending-joins", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = await isSiteAdmin(req.user.robloxId);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { groupId, action } = req.body;

  try {
    const docRef = db.collection(COLLECTIONS.PENDING_BOT_JOINS).doc(groupId.toString());

    if (action === "delete") {
      await docRef.delete();
      return res.json({ success: true });
    }

    if (action === "captcha_done") {
      await docRef.update({ status: "captcha_done" });
      return res.json({ success: true });
    }

    if (action === "joined") {
      await docRef.delete();
      return res.json({ success: true });
    }

    if (action === "failed") {
      await docRef.update({ status: "failed" });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    console.error("Error updating pending join:", error);
    return res.status(500).json({ error: "Failed to update pending join" });
  }
});

// Get connected groups (for admin)
router.get("/groups", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = await isSiteAdmin(req.user.robloxId);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

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
      throw new Error("Failed to fetch bot groups");
    }

    const data = await response.json() as { data: Array<{ group: { id: number; name: string }; role: { rank: number; name: string } }> };
    return res.json({ groups: data.data || [] });
  } catch (error) {
    console.error("Error fetching admin groups:", error);
    return res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Leave group (admin action)
router.post("/groups/leave", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = await isSiteAdmin(req.user.robloxId);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { groupId } = req.body;

  try {
    const response = await robloxBotRequest(
      `https://groups.roblox.com/v1/groups/${groupId}/users/me`,
      "DELETE"
    );

    if (!response.ok) {
      throw new Error("Failed to leave group");
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error leaving group:", error);
    return res.status(500).json({ error: "Failed to leave group" });
  }
});

export default router;
