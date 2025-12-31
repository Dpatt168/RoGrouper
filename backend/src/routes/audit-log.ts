import { Router, Request, Response } from "express";
import { db, COLLECTIONS } from "../lib/firebase";

const router = Router();

interface AuditLogEntry {
  id: string;
  action: string;
  targetUserId: number;
  targetUsername: string;
  performedBy: string;
  performedByUsername: string;
  details?: string;
  timestamp: number;
}

// Get audit log
router.get("/:groupId/audit-log", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;

  try {
    const docRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc(groupId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.json({ entries: [] });
    }

    const data = doc.data() as { entries: AuditLogEntry[] };
    return res.json({ entries: data.entries || [] });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// Add audit log entry
router.post("/:groupId/audit-log", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;
  const { action, targetUserId, targetUsername, details } = req.body;

  try {
    const docRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc(groupId);
    const doc = await docRef.get();

    const entries: AuditLogEntry[] = doc.exists
      ? (doc.data() as { entries: AuditLogEntry[] }).entries || []
      : [];

    const newEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      action,
      targetUserId,
      targetUsername,
      performedBy: req.user.robloxId,
      performedByUsername: req.user.name || "Unknown",
      details,
      timestamp: Date.now(),
    };

    entries.unshift(newEntry);

    // Keep only last 100 entries
    const trimmedEntries = entries.slice(0, 100);

    await docRef.set({ entries: trimmedEntries });
    return res.json({ success: true, entry: newEntry });
  } catch (error) {
    console.error("Error adding audit log entry:", error);
    return res.status(500).json({ error: "Failed to add audit log entry" });
  }
});

export default router;
