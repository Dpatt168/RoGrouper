import { Router, Request, Response } from "express";
import { db } from "../lib/firebase";

const router = Router();

const AWARDS_COLLECTION = "awards";

interface Award {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  createdAt: number;
}

interface UserAward {
  odId: string;
  awardId: string;
  awardedAt: number;
  awardedBy: string;
}

// Get all awards
router.get("/", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const snapshot = await db.collection(AWARDS_COLLECTION).get();
    const awards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({ awards });
  } catch (error) {
    console.error("Error fetching awards:", error);
    return res.status(500).json({ error: "Failed to fetch awards" });
  }
});

// Create award
router.post("/", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name, description, imageUrl } = req.body;

  try {
    const newAward: Award = {
      id: crypto.randomUUID(),
      name,
      description,
      imageUrl,
      createdAt: Date.now(),
    };

    await db.collection(AWARDS_COLLECTION).doc(newAward.id).set(newAward);
    return res.json(newAward);
  } catch (error) {
    console.error("Error creating award:", error);
    return res.status(500).json({ error: "Failed to create award" });
  }
});

// Delete award
router.delete("/:awardId", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { awardId } = req.params;

  try {
    await db.collection(AWARDS_COLLECTION).doc(awardId).delete();
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting award:", error);
    return res.status(500).json({ error: "Failed to delete award" });
  }
});

// Get user awards
router.get("/user/:userId", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { odId } = req.params;

  try {
    const doc = await db.collection("userAwards").doc(odId).get();
    if (!doc.exists) {
      return res.json({ awards: [] });
    }

    const data = doc.data() as { awards: UserAward[] };
    return res.json({ awards: data.awards || [] });
  } catch (error) {
    console.error("Error fetching user awards:", error);
    return res.status(500).json({ error: "Failed to fetch user awards" });
  }
});

// Award user
router.post("/user/:userId", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { odId } = req.params;
  const { awardId } = req.body;

  try {
    const docRef = db.collection("userAwards").doc(odId);
    const doc = await docRef.get();

    const awards: UserAward[] = doc.exists
      ? (doc.data() as { awards: UserAward[] }).awards || []
      : [];

    // Check if user already has this award
    if (awards.some((a) => a.awardId === awardId)) {
      return res.status(400).json({ error: "User already has this award" });
    }

    awards.push({
      odId,
      awardId,
      awardedAt: Date.now(),
      awardedBy: req.user.robloxId,
    });

    await docRef.set({ awards });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error awarding user:", error);
    return res.status(500).json({ error: "Failed to award user" });
  }
});

// Remove award from user
router.delete("/user/:userId/:awardId", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { odId, awardId } = req.params;

  try {
    const docRef = db.collection("userAwards").doc(odId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "User has no awards" });
    }

    const data = doc.data() as { awards: UserAward[] };
    const awards = data.awards.filter((a) => a.awardId !== awardId);

    await docRef.set({ awards });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error removing award:", error);
    return res.status(500).json({ error: "Failed to remove award" });
  }
});

export default router;
