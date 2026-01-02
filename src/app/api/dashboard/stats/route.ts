import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const robloxId = session.user.robloxId;

  try {
    const db = getDb();
    
    // Get user's groups from Roblox API
    const groupsResponse = await fetch(
      `https://groups.roblox.com/v2/users/${robloxId}/groups/roles`,
      { headers: { Accept: "application/json" } }
    );
    
    let totalGroups = 0;
    let managedGroups = 0;
    let managedGroupIds: string[] = [];
    
    if (groupsResponse.ok) {
      const groupsData = await groupsResponse.json();
      totalGroups = groupsData.data?.length || 0;
      // Count groups where user has management rank (rank >= 200 or is owner)
      const managedGroupsData = groupsData.data?.filter((g: { role: { rank: number } }) => 
        g.role.rank >= 200
      ) || [];
      managedGroups = managedGroupsData.length;
      managedGroupIds = managedGroupsData.map((g: { group: { id: number } }) => g.group.id.toString());
    }

    // Get organizations count
    const orgsSnapshot = await db.collection(COLLECTIONS.ORGANIZATIONS)
      .where("ownerRobloxId", "==", robloxId.toString())
      .get();
    const organizationsCount = orgsSnapshot.size;

    // Get total role syncs across all user's organizations
    let totalSyncs = 0;
    for (const orgDoc of orgsSnapshot.docs) {
      const orgData = orgDoc.data();
      totalSyncs += orgData.syncs?.length || 0;
    }

    // Get recent audit log actions (last 24 hours) across all groups
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let recentActions = 0;
    
    // Get audit logs from groups the user manages
    if (managedGroupIds.length > 0) {
      // Query audit logs for managed groups (limit to first 10 groups to avoid too many queries)
      const groupsToCheck = managedGroupIds.slice(0, 10);
      for (const groupId of groupsToCheck) {
        try {
          const auditSnapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
            .where("groupId", "==", groupId)
            .where("timestamp", ">=", twentyFourHoursAgo)
            .limit(100)
            .get();
          recentActions += auditSnapshot.size;
        } catch {
          // Group might not have audit logs collection
        }
      }
    }

    // Get recent activity for the activity feed
    const recentActivitySnapshot = await db.collection(COLLECTIONS.AUDIT_LOGS)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();
    
    const recentActivity = recentActivitySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        action: data.action,
        groupName: data.groupName,
        targetUser: data.targetUser,
        performedBy: data.performedBy,
        details: data.details,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      stats: {
        totalGroups,
        managedGroups,
        organizations: organizationsCount,
        roleSyncs: totalSyncs,
        recentActions,
      },
      recentActivity,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
