import { Router, Request, Response } from "express";

const router = Router();

// Search users
router.get("/users", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { query } = req.query;

  if (!query || typeof query !== "string" || query.length < 3) {
    return res.status(400).json({ error: "Query must be at least 3 characters" });
  }

  try {
    const response = await fetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(query)}&limit=10`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      console.error("Roblox API error:", response.status);
      return res.json({ data: [] });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Error searching users:", error);
    return res.json({ data: [] });
  }
});

// Get user by ID
router.get("/user/:userId", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { userId } = req.params;

  try {
    // Get user info
    const userResponse = await fetch(
      `https://users.roblox.com/v1/users/${userId}`,
      { headers: { Accept: "application/json" } }
    );

    if (!userResponse.ok) {
      return res.status(404).json({ error: "User not found" });
    }

    const userInfo = await userResponse.json();

    // Get user's groups
    const groupsResponse = await fetch(
      `https://groups.roblox.com/v1/users/${userId}/groups/roles`,
      { headers: { Accept: "application/json" } }
    );

    let groups: unknown[] = [];
    if (groupsResponse.ok) {
      const groupsData = await groupsResponse.json() as { data: unknown[] };
      groups = groupsData.data || [];
    }

    return res.json({ userInfo, groups });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Get user avatars
router.post("/avatars", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "Invalid userIds" });
  }

  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds.join(",")}&size=150x150&format=Png`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      return res.json({ data: [] });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("Error fetching avatars:", error);
    return res.json({ data: [] });
  }
});

export default router;
