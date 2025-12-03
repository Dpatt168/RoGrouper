import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { userId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch user info
    const userInfoRes = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!userInfoRes.ok) {
      return NextResponse.json({ error: "Failed to fetch user info" }, { status: userInfoRes.status });
    }

    const userInfo = await userInfoRes.json();

    // Fetch user's groups
    const userGroupsRes = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`, {
      headers: {
        "Accept": "application/json",
      },
    });

    let userGroups = [];
    if (userGroupsRes.ok) {
      const groupsData = await userGroupsRes.json();
      userGroups = groupsData.data || [];
    }

    return NextResponse.json({
      userInfo,
      userGroups,
    });
  } catch (error) {
    console.error("Error fetching Roblox user data:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
