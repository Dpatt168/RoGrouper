import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDb, COLLECTIONS, getSiteAdmins, isSiteAdmin, SiteAdmin } from "@/lib/firebase";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is a site admin
  const isAdmin = await isSiteAdmin(session.user.robloxId);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admins = await getSiteAdmins();
    return NextResponse.json({ admins });
  } catch (error) {
    console.error("Error fetching site admins:", error);
    return NextResponse.json({ error: "Failed to fetch site admins" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is a site admin
  const isAdmin = await isSiteAdmin(session.user.robloxId);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const db = getDb();
    const admins = await getSiteAdmins();

    if (body.action === "add") {
      // Check if already an admin
      if (admins.some(a => a.robloxId === body.robloxId)) {
        return NextResponse.json({ error: "User is already a site admin" }, { status: 400 });
      }

      const newAdmin: SiteAdmin = {
        robloxId: body.robloxId,
      };

      const updatedAdmins = [...admins, newAdmin];
      await db.collection(COLLECTIONS.SITE_CONFIG).doc("admins").set({ admins: updatedAdmins });

      return NextResponse.json({ admins: updatedAdmins });
    } else if (body.action === "remove") {
      // Prevent removing the last admin
      if (admins.length <= 1) {
        return NextResponse.json({ error: "Cannot remove the last site admin" }, { status: 400 });
      }

      // Prevent removing yourself
      if (body.robloxId === session.user.robloxId) {
        return NextResponse.json({ error: "Cannot remove yourself as admin" }, { status: 400 });
      }

      const updatedAdmins = admins.filter(a => a.robloxId !== body.robloxId);
      await db.collection(COLLECTIONS.SITE_CONFIG).doc("admins").set({ admins: updatedAdmins });

      return NextResponse.json({ admins: updatedAdmins });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating site admins:", error);
    return NextResponse.json({ error: "Failed to update site admins" }, { status: 500 });
  }
}
