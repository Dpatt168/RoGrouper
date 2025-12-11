import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/firebase";

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

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

  // First request to get XSRF token
  let response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // If we get a 403 with x-csrf-token header, retry with that token
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

// This endpoint processes expired suspensions across all groups
// It should be called by a cron job every minute
export async function GET(request: Request) {
  // Skip auth check for internal calls (from SuspensionProcessor component)
  // Only require auth for external cron services
  const authHeader = request.headers.get("authorization");
  const isInternalCall = request.headers.get("origin") || request.headers.get("referer");
  if (CRON_SECRET && !isInternalCall && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const now = Date.now();
    let processedCount = 0;
    let restoredCount = 0;
    const errors: string[] = [];

    // Get all group automation documents
    const snapshot = await db.collection(COLLECTIONS.GROUP_AUTOMATION).get();

    for (const doc of snapshot.docs) {
      const groupId = doc.id;
      const data = doc.data() as GroupAutomation;

      if (!data.suspensions || data.suspensions.length === 0) {
        continue;
      }

      // Find expired suspensions
      const expiredSuspensions = data.suspensions.filter((s) => s.expiresAt <= now);
      
      if (expiredSuspensions.length === 0) {
        continue;
      }

      processedCount += expiredSuspensions.length;

      // Restore roles for expired suspensions
      for (const suspension of expiredSuspensions) {
        try {
          const response = await robloxBotRequest(
            `https://groups.roblox.com/v1/groups/${groupId}/users/${suspension.userId}`,
            "PATCH",
            { roleId: suspension.previousRoleId }
          );

          if (response.ok) {
            restoredCount++;
            console.log(
              `[Cron] Restored ${suspension.username} (${suspension.userId}) to role ${suspension.previousRoleName} in group ${groupId}`
            );
          } else {
            const errorText = await response.text();
            errors.push(
              `Failed to restore ${suspension.username} in group ${groupId}: ${errorText}`
            );
          }
        } catch (error) {
          errors.push(
            `Error restoring ${suspension.username} in group ${groupId}: ${error}`
          );
        }
      }

      // Remove expired suspensions from the list
      const remainingSuspensions = data.suspensions.filter((s) => s.expiresAt > now);
      
      // Update the document
      await db.collection(COLLECTIONS.GROUP_AUTOMATION).doc(groupId).update({
        suspensions: remainingSuspensions,
      });
    }

    return NextResponse.json({
      success: true,
      processedCount,
      restoredCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Error processing suspensions:", error);
    return NextResponse.json(
      { error: "Failed to process suspensions" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: Request) {
  return GET(request);
}
