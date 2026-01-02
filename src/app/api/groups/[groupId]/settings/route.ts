import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDb, COLLECTIONS, isSiteAdmin } from "@/lib/firebase";

export interface GroupSettings {
  requireKickReason: boolean;
  requireSuspendReason: boolean;
  requireRoleChangeReason: boolean;
}

const DEFAULT_SETTINGS: GroupSettings = {
  requireKickReason: false,
  requireSuspendReason: false,
  requireRoleChangeReason: false,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;

  try {
    const db = getDb();
    const settingsDoc = await db
      .collection(COLLECTIONS.GROUP_AUTOMATION)
      .doc(groupId)
      .get();

    if (!settingsDoc.exists) {
      return NextResponse.json({ settings: DEFAULT_SETTINGS });
    }

    const data = settingsDoc.data();
    const settings: GroupSettings = {
      requireKickReason: data?.requireKickReason ?? false,
      requireSuspendReason: data?.requireSuspendReason ?? false,
      requireRoleChangeReason: data?.requireRoleChangeReason ?? false,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching group settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;

  try {
    const body = await request.json();
    const { setting, value } = body;

    // Validate setting name
    const validSettings = ["requireKickReason", "requireSuspendReason", "requireRoleChangeReason"];
    if (!validSettings.includes(setting)) {
      return NextResponse.json({ error: "Invalid setting" }, { status: 400 });
    }

    // Check if user is a site admin first
    const userIsSiteAdmin = await isSiteAdmin(session.user.robloxId);
    console.log(`[Settings] User ${session.user.robloxId} isSiteAdmin: ${userIsSiteAdmin}`);
    
    if (!userIsSiteAdmin) {
      // Check if user has admin access to this group
      const db = getDb();
      const accessDoc = await db.collection(COLLECTIONS.GROUP_ACCESS).doc(groupId).get();
      
      if (accessDoc.exists) {
        const accessData = accessDoc.data();
        const adminRoles = accessData?.adminRoles || [];
        const adminUsers = accessData?.adminUsers || [];
        
        console.log(`[Settings] Group ${groupId} adminUsers:`, adminUsers);
        console.log(`[Settings] Group ${groupId} adminRoles:`, adminRoles);
        
        // Get user's role in the group
        const userRoleResponse = await fetch(
          `https://groups.roblox.com/v1/users/${session.user.robloxId}/groups/roles`,
          { headers: { Accept: "application/json" } }
        );
        
        let hasAdminAccess = false;
        
        // Check if user is in adminUsers list (compare as strings)
        const userRobloxId = String(session.user.robloxId);
        if (adminUsers.some((u: { robloxId: string | number }) => String(u.robloxId) === userRobloxId)) {
          hasAdminAccess = true;
          console.log(`[Settings] User found in adminUsers list`);
        }
        
        // Check if user's role is in adminRoles list
        if (userRoleResponse.ok) {
          const userRoleData = await userRoleResponse.json();
          const userGroupRole = userRoleData.data?.find(
            (g: { group: { id: number } }) => g.group.id.toString() === groupId
          );
          
          if (userGroupRole) {
            // Owner always has access
            if (userGroupRole.role.rank === 255) {
              hasAdminAccess = true;
            }
            // Check if role is in admin roles
            if (adminRoles.some((r: { roleId: number }) => r.roleId === userGroupRole.role.id)) {
              hasAdminAccess = true;
            }
          }
        }
        
        if (!hasAdminAccess) {
          return NextResponse.json({ error: "You don't have admin access to this group" }, { status: 403 });
        }
      } else {
        // No access settings - check if user is owner or high rank
        const userRoleResponse = await fetch(
          `https://groups.roblox.com/v1/users/${session.user.robloxId}/groups/roles`,
          { headers: { Accept: "application/json" } }
        );
        
        if (userRoleResponse.ok) {
          const userRoleData = await userRoleResponse.json();
          const userGroupRole = userRoleData.data?.find(
            (g: { group: { id: number } }) => g.group.id.toString() === groupId
          );
          
          if (!userGroupRole || userGroupRole.role.rank < 255) {
            return NextResponse.json({ error: "Only the group owner can change settings" }, { status: 403 });
          }
        }
      }
    }
    
    const db = getDb();

    // Update the setting
    await db.collection(COLLECTIONS.GROUP_AUTOMATION).doc(groupId).set(
      { [setting]: Boolean(value) },
      { merge: true }
    );

    // Fetch and return updated settings
    const updatedDoc = await db.collection(COLLECTIONS.GROUP_AUTOMATION).doc(groupId).get();
    const data = updatedDoc.data();
    const settings: GroupSettings = {
      requireKickReason: data?.requireKickReason ?? false,
      requireSuspendReason: data?.requireSuspendReason ?? false,
      requireRoleChangeReason: data?.requireRoleChangeReason ?? false,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating group settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
