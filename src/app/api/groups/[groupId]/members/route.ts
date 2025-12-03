import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") || "";
  // Roblox API only accepts 10, 25, 50, or 100
  const requestedLimit = parseInt(searchParams.get("limit") || "50");
  const limit = [10, 25, 50, 100].includes(requestedLimit) ? requestedLimit : 50;

  try {
    const url = `https://groups.roblox.com/v1/groups/${groupId}/users?limit=${limit}&sortOrder=Asc${cursor ? `&cursor=${cursor}` : ""}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Roblox API error:", response.status, errorText);
      throw new Error(`Failed to fetch members: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}
