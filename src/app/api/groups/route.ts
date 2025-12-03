import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export interface RobloxGroup {
  group: {
    id: number;
    name: string;
    description: string;
    owner: {
      id: number;
      type: string;
    } | null;
    memberCount: number;
    created: string;
    hasVerifiedBadge: boolean;
    iconUrl?: string;
  };
  role: {
    id: number;
    name: string;
    rank: number;
  };
}

interface GroupIconData {
  targetId: number;
  state: string;
  imageUrl: string;
}

async function fetchGroupIcons(groupIds: number[]): Promise<Map<number, string>> {
  const iconMap = new Map<number, string>();
  if (groupIds.length === 0) return iconMap;

  try {
    const response = await fetch(
      `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupIds.join(",")}&size=150x150&format=Png&isCircular=false`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (response.ok) {
      const data = await response.json();
      data.data?.forEach((icon: GroupIconData) => {
        if (icon.state === "Completed" && icon.imageUrl) {
          iconMap.set(icon.targetId, icon.imageUrl);
        }
      });
    }
  } catch (error) {
    console.error("Error fetching group icons:", error);
  }

  return iconMap;
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(
      `https://groups.roblox.com/v2/users/${session.user.robloxId}/groups/roles`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch groups");
    }

    const data = await response.json();
    const groups: RobloxGroup[] = data.data || [];

    // Filter to only groups where user can manage roles (rank >= 254)
    const manageableGroups = groups.filter((g) => g.role.rank >= 254);

    // Fetch icons for filtered groups
    const groupIds = manageableGroups.map((g) => g.group.id);
    const iconMap = await fetchGroupIcons(groupIds);

    // Add icon URLs to groups
    const groupsWithIcons = manageableGroups.map((g) => ({
      ...g,
      group: {
        ...g.group,
        iconUrl: iconMap.get(g.group.id) || null,
      },
    }));

    return NextResponse.json({ data: groupsWithIcons });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
