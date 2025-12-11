import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isSiteAdmin, getSiteAdmins } from "@/lib/firebase";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ isAdmin: false });
  }

  const admins = await getSiteAdmins();
  const isAdmin = await isSiteAdmin(session.user.robloxId);
  
  // Debug logging
  console.log("[Admin Check] User robloxId:", session.user.robloxId);
  console.log("[Admin Check] Site admins in DB:", admins.map(a => a.robloxId));
  console.log("[Admin Check] Is admin:", isAdmin);
  
  return NextResponse.json({ isAdmin, debug: { userRobloxId: session.user.robloxId, admins: admins.map(a => a.robloxId) } });
}
