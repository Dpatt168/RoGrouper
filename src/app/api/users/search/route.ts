import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword");
  const groupId = searchParams.get("groupId");

  if (!keyword || !groupId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    // Search for users
    const searchResponse = await fetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=10`,
      {
        headers: { 
          "Accept": "application/json",
          "User-Agent": "RoGrouper/1.0",
        },
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Roblox search API error:", searchResponse.status, errorText);
      
      // If the search API fails, try to get user by exact username
      const exactUserResponse = await fetch(
        `https://users.roblox.com/v1/usernames/users`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            usernames: [keyword],
            excludeBannedUsers: false,
          }),
        }
      );
      
      if (exactUserResponse.ok) {
        const exactData = await exactUserResponse.json();
        if (exactData.data && exactData.data.length > 0) {
          const user = exactData.data[0];
          // Get group membership for this user
          const membershipResponse = await fetch(
            `https://groups.roblox.com/v1/users/${user.id}/groups/roles`,
            { headers: { "Accept": "application/json" } }
          );
          
          if (membershipResponse.ok) {
            const membershipData = await membershipResponse.json();
            const groupMembership = membershipData.data?.find(
              (g: { group: { id: number } }) => g.group.id === parseInt(groupId)
            );
            
            // Only return if user is in the group
            if (groupMembership) {
              return NextResponse.json({ 
                data: [{
                  id: user.id,
                  name: user.name,
                  displayName: user.displayName || user.name,
                  inGroup: true,
                  role: groupMembership.role,
                }] 
              });
            }
          }
        }
      }
      
      return NextResponse.json({ data: [] });
    }

    const searchData = await searchResponse.json();
    const users = searchData.data || [];

    if (users.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get group membership for each user and filter to only group members
    const usersWithRoles = await Promise.all(
      users.map(async (user: { id: number; name: string; displayName: string }) => {
        try {
          const membershipResponse = await fetch(
            `https://groups.roblox.com/v1/users/${user.id}/groups/roles`,
            {
              headers: { Accept: "application/json" },
            }
          );

          if (membershipResponse.ok) {
            const membershipData = await membershipResponse.json();
            const groupMembership = membershipData.data?.find(
              (g: { group: { id: number } }) => g.group.id === parseInt(groupId)
            );

            if (groupMembership) {
              return {
                ...user,
                inGroup: true,
                role: groupMembership.role,
              };
            }
          }
        } catch {
          // Ignore errors for individual users
        }

        return null; // Not in group
      })
    );

    // Filter out users not in the group
    const groupMembers = usersWithRoles.filter((user) => user !== null);

    return NextResponse.json({ data: groupMembers });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
