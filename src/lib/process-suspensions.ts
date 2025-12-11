import { getDb, COLLECTIONS } from "@/lib/firebase";

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

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

// Helper to make Roblox API requests with bot cookie and XSRF token handling
async function robloxBotRequest(
  url: string,
  method: string,
  body?: object
): Promise<Response> {
  if (!BOT_COOKIE) {
    throw new Error("Bot token not configured");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
  };

  let response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 403) {
    const xsrfToken = response.headers.get("x-csrf-token");
    if (xsrfToken) {
      headers["x-csrf-token"] = xsrfToken;
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  return response;
}

// Process ALL expired suspensions across all groups
// This should be called periodically (on API requests, cron, etc.)
export async function processAllExpiredSuspensions(): Promise<{ processed: number; restored: number }> {
  let processed = 0;
  let restored = 0;

  try {
    const db = getDb();
    const now = Date.now();
    const snapshot = await db.collection(COLLECTIONS.GROUP_AUTOMATION).get();

    for (const doc of snapshot.docs) {
      const groupId = doc.id;
      const data = doc.data() as GroupAutomation;

      if (!data.suspensions || data.suspensions.length === 0) {
        continue;
      }

      const expiredSuspensions = data.suspensions.filter((s) => s.expiresAt <= now);
      
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
          console.error(`[Auto-unsuspend] Error restoring ${suspension.username}:`, error);
        }
      }

      // Remove expired suspensions
      const remainingSuspensions = data.suspensions.filter((s) => s.expiresAt > now);
      await db.collection(COLLECTIONS.GROUP_AUTOMATION).doc(groupId).update({
        suspensions: remainingSuspensions,
      });
    }
  } catch (error) {
    console.error("[Auto-unsuspend] Error processing all groups:", error);
  }

  return { processed, restored };
}
