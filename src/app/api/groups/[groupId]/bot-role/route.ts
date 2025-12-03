import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

async function getBotUserId(): Promise<string | null> {
  if (!BOT_COOKIE) return null;

  try {
    const response = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers: {
        Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.id?.toString();
    }
  } catch (error) {
    console.error("Error getting bot user ID:", error);
  }

  return null;
}

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
    const botUserId = await getBotUserId();
    if (!botUserId) {
      return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
    }

    // Get bot's role in this group
    const response = await fetch(
      `https://groups.roblox.com/v1/users/${botUserId}/groups/roles`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch bot role");
    }

    const data = await response.json();
    const groupMembership = data.data?.find(
      (g: { group: { id: number } }) => g.group.id === parseInt(groupId)
    );

    if (!groupMembership) {
      return NextResponse.json({ 
        error: "Bot is not a member of this group",
        rank: 0 
      });
    }

    return NextResponse.json({ 
      role: groupMembership.role,
      rank: groupMembership.role.rank 
    });
  } catch (error) {
    console.error("Error fetching bot role:", error);
    return NextResponse.json(
      { error: "Failed to fetch bot role", rank: 0 },
      { status: 500 }
    );
  }
}
