import { db, COLLECTIONS } from "../lib/firebase";
import { robloxBotRequest } from "../lib/roblox";

interface Suspension {
  id: string;
  userId: number;
  username: string;
  previousRoleId: number;
  previousRoleName: string;
  suspendedAt: number;
  expiresAt: number;
}

interface GroupAutomation {
  rules: unknown[];
  userPoints: unknown[];
  suspendedRole?: { roleId: number; roleName: string };
  suspensions: Suspension[];
  subGroups?: unknown[];
}

// Process all expired suspensions across all groups
export async function processExpiredSuspensions(): Promise<{
  processed: number;
  restored: number;
}> {
  let processed = 0;
  let restored = 0;

  try {
    const now = Date.now();
    const snapshot = await db.collection(COLLECTIONS.GROUP_AUTOMATION).get();

    for (const doc of snapshot.docs) {
      const groupId = doc.id;
      const data = doc.data() as GroupAutomation;

      if (!data.suspensions || data.suspensions.length === 0) {
        continue;
      }

      const expiredSuspensions = data.suspensions.filter(
        (s) => s.expiresAt <= now
      );

      if (expiredSuspensions.length === 0) {
        continue;
      }

      processed += expiredSuspensions.length;

      // Restore roles for expired suspensions
      for (const suspension of expiredSuspensions) {
        try {
          const response = await robloxBotRequest(
            `https://groups.roblox.com/v1/groups/${groupId}/users/${suspension.userId}`,
            "PATCH",
            { roleId: suspension.previousRoleId }
          );

          if (response.ok) {
            restored++;
            console.log(
              `[Auto-unsuspend] Restored ${suspension.username} (${suspension.userId}) to role ${suspension.previousRoleName} in group ${groupId}`
            );
          } else {
            const errorText = await response.text();
            console.error(
              `[Auto-unsuspend] Failed to restore ${suspension.username} in group ${groupId}: ${errorText}`
            );
          }
        } catch (error) {
          console.error(
            `[Auto-unsuspend] Error restoring ${suspension.username}:`,
            error
          );
        }
      }

      // Remove expired suspensions
      const remainingSuspensions = data.suspensions.filter(
        (s) => s.expiresAt > now
      );
      await db.collection(COLLECTIONS.GROUP_AUTOMATION).doc(groupId).update({
        suspensions: remainingSuspensions,
      });
    }
  } catch (error) {
    console.error("[Auto-unsuspend] Error processing all groups:", error);
  }

  return { processed, restored };
}

// Start the suspension worker
export function startSuspensionWorker(intervalMs: number = 60000) {
  console.log(
    `[SuspensionWorker] Starting - checking every ${intervalMs / 1000} seconds`
  );

  // Run immediately
  processExpiredSuspensions().then((result) => {
    if (result.restored > 0) {
      console.log(
        `[SuspensionWorker] Initial run: restored ${result.restored} users`
      );
    }
  });

  // Then run on interval
  setInterval(async () => {
    const result = await processExpiredSuspensions();
    if (result.restored > 0) {
      console.log(
        `[SuspensionWorker] Restored ${result.restored} users from suspension`
      );
    }
  }, intervalMs);
}
