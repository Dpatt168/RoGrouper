import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase";

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

interface PendingBotJoin {
  groupId: number;
  groupName: string;
  groupIconUrl?: string;
  requestedBy: {
    id: string;
    name: string;
  };
  status: "pending_captcha" | "captcha_completed" | "joined" | "failed";
  createdAt: number;
  updatedAt: number;
  error?: string;
}

async function createPendingJoinRequest(
  groupId: number,
  groupName: string,
  groupIconUrl: string | undefined,
  requestedBy: { id: string; name: string },
  status: PendingBotJoin["status"],
  error?: string
) {
  const db = getDb();
  const docRef = db.collection(COLLECTIONS.PENDING_BOT_JOINS).doc(`group-${groupId}`);
  
  // Firestore doesn't accept undefined values, so we need to filter them out
  const data: Record<string, unknown> = {
    groupId,
    groupName,
    requestedBy,
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  // Only add optional fields if they have values
  if (groupIconUrl) {
    data.groupIconUrl = groupIconUrl;
  }
  if (error) {
    data.error = error;
  }
  
  await docRef.set(data);
  return docRef.id;
}

async function fetchGroupInfo(groupId: string): Promise<{ name: string; iconUrl?: string }> {
  try {
    const response = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`);
    if (response.ok) {
      const data = await response.json();
      return { name: data.name || `Group ${groupId}` };
    }
  } catch (e) {
    console.error("Error fetching group info:", e);
  }
  return { name: `Group ${groupId}` };
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

// POST - Request bot to join the group
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BOT_COOKIE) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
  }

  // Get group info for the pending request
  const groupInfo = await fetchGroupInfo(groupId);

  try {
    // Request to join the group
    const response = await robloxBotRequest(
      `https://groups.roblox.com/v1/groups/${groupId}/users`,
      "POST",
      {}
    );

    if (response.ok) {
      return NextResponse.json({ 
        success: true, 
        message: "Join request sent successfully" 
      });
    }

    const error = await response.json();
    const errorMessage = error.errors?.[0]?.message || "Failed to join group";
    const errorCode = error.errors?.[0]?.code;
    
    // Handle specific error cases
    if (errorMessage.includes("already")) {
      return NextResponse.json({ 
        success: true, 
        message: "Bot is already in the group or has a pending request" 
      });
    }

    // If the group requires approval, that's expected
    if (response.status === 400 && errorMessage.includes("pending")) {
      return NextResponse.json({ 
        success: true, 
        message: "Join request is pending approval" 
      });
    }

    // Check if captcha is required (usually 403 with captcha-related error)
    // Roblox returns 403 or 429 when captcha is needed
    if (response.status === 403 || response.status === 429 || 
        errorMessage.toLowerCase().includes("captcha") ||
        errorMessage.toLowerCase().includes("challenge") ||
        errorCode === 2) {
      // Create a pending request for admin to handle
      await createPendingJoinRequest(
        parseInt(groupId),
        groupInfo.name,
        groupInfo.iconUrl,
        {
          id: session.user.robloxId,
          name: session.user.name || "Unknown",
        },
        "pending_captcha",
        errorMessage
      );

      return NextResponse.json({ 
        success: false,
        pendingCaptcha: true,
        message: "Captcha required. An admin will manually process this request." 
      });
    }

    // For other errors, still create a pending request so admin can see it
    await createPendingJoinRequest(
      parseInt(groupId),
      groupInfo.name,
      groupInfo.iconUrl,
      {
        id: session.user.robloxId,
        name: session.user.name || "Unknown",
      },
      "pending_captcha",
      errorMessage
    );

    return NextResponse.json({ 
      success: false,
      pendingCaptcha: true,
      message: "Request requires manual processing. An admin will handle this." 
    });
  } catch (error) {
    console.error("Error requesting bot to join group:", error);
    
    // Create pending request for any error
    await createPendingJoinRequest(
      parseInt(groupId),
      groupInfo.name,
      groupInfo.iconUrl,
      {
        id: session.user.robloxId,
        name: session.user.name || "Unknown",
      },
      "pending_captcha",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json({
      success: false,
      pendingCaptcha: true,
      message: "Request requires manual processing. An admin will handle this."
    });
  }
}

// GET - Check status of a pending join request
export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const docRef = db.collection(COLLECTIONS.PENDING_BOT_JOINS).doc(`group-${groupId}`);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ exists: false });
    }

    const data = doc.data() as PendingBotJoin;
    return NextResponse.json({ 
      exists: true, 
      status: data.status,
      updatedAt: data.updatedAt 
    });
  } catch (error) {
    console.error("Error checking pending join status:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
