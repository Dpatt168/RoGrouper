import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDb, COLLECTIONS, isSiteAdmin } from "@/lib/firebase";

export interface PendingBotJoin {
  id: string;
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

// GET - List all pending bot join requests (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  if (!(await isSiteAdmin(session.user.robloxId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getDb();
    const snapshot = await db
      .collection(COLLECTIONS.PENDING_BOT_JOINS)
      .orderBy("createdAt", "desc")
      .get();

    const requests: PendingBotJoin[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PendingBotJoin[];

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Error fetching pending joins:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending joins" },
      { status: 500 }
    );
  }
}

// POST - Update a pending join request status (admin only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  if (!(await isSiteAdmin(session.user.robloxId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: "Missing requestId or action" },
        { status: 400 }
      );
    }

    const db = getDb();
    const docRef = db.collection(COLLECTIONS.PENDING_BOT_JOINS).doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (action === "mark_captcha_completed") {
      await docRef.update({
        status: "captcha_completed",
        updatedAt: Date.now(),
      });
      return NextResponse.json({ success: true, status: "captcha_completed" });
    } else if (action === "mark_joined") {
      await docRef.update({
        status: "joined",
        updatedAt: Date.now(),
      });
      return NextResponse.json({ success: true, status: "joined" });
    } else if (action === "mark_failed") {
      await docRef.update({
        status: "failed",
        error: body.error || "Manual failure",
        updatedAt: Date.now(),
      });
      return NextResponse.json({ success: true, status: "failed" });
    } else if (action === "delete") {
      await docRef.delete();
      return NextResponse.json({ success: true, deleted: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating pending join:", error);
    return NextResponse.json(
      { error: "Failed to update pending join" },
      { status: 500 }
    );
  }
}
