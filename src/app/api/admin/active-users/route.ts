import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDb, COLLECTIONS, isSiteAdmin } from "@/lib/firebase";

// Active users are stored with a timestamp and expire after 5 minutes of inactivity
const ACTIVE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const isAdmin = await isSiteAdmin(session.user.robloxId);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getDb();
    // Get active users from the database
    const activeUsersDoc = await db.collection(COLLECTIONS.SITE_CONFIG).doc("activeUsers").get();
    const activeUsersData = activeUsersDoc.exists ? activeUsersDoc.data()?.users || {} : {};
    
    const now = Date.now();
    const activeUsers: Array<{
      robloxId: string;
      username: string;
      displayName: string;
      avatarUrl?: string;
      lastSeen: number;
      currentPage?: string;
    }> = [];

    // Filter out expired users
    for (const [robloxId, userData] of Object.entries(activeUsersData)) {
      const user = userData as {
        username: string;
        displayName: string;
        avatarUrl?: string;
        lastSeen: number;
        currentPage?: string;
      };
      if (now - user.lastSeen < ACTIVE_TIMEOUT_MS) {
        activeUsers.push({
          robloxId,
          ...user,
        });
      }
    }

    // Sort by most recently active
    activeUsers.sort((a, b) => b.lastSeen - a.lastSeen);

    return NextResponse.json({ 
      activeUsers,
      count: activeUsers.length,
    });
  } catch (error) {
    console.error("Error fetching active users:", error);
    return NextResponse.json({ error: "Failed to fetch active users" }, { status: 500 });
  }
}

// POST to update user's active status (heartbeat)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPage } = body;

    const db = getDb();
    const activeUsersRef = db.collection(COLLECTIONS.SITE_CONFIG).doc("activeUsers");
    
    // Get current active users
    const activeUsersDoc = await activeUsersRef.get();
    const activeUsersData = activeUsersDoc.exists ? activeUsersDoc.data()?.users || {} : {};
    
    // Update this user's entry
    activeUsersData[session.user.robloxId] = {
      username: session.user.name || "Unknown",
      displayName: session.user.name || "Unknown",
      avatarUrl: session.user.image,
      lastSeen: Date.now(),
      currentPage: currentPage || "Dashboard",
    };

    // Clean up expired users while we're at it
    const now = Date.now();
    for (const robloxId of Object.keys(activeUsersData)) {
      if (now - activeUsersData[robloxId].lastSeen > ACTIVE_TIMEOUT_MS) {
        delete activeUsersData[robloxId];
      }
    }

    // Save back to database
    await activeUsersRef.set({ users: activeUsersData }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating active status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
