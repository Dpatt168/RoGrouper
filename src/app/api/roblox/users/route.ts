import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  try {
    // Search for users using Roblox API
    const response = await fetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(query)}&limit=10`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to search users");
    }

    const data = await response.json();
    
    // Transform the response to match expected format
    const users = (data.data || []).map((user: { id: number; name: string; displayName: string }) => ({
      id: user.id,
      name: user.name,
      displayName: user.displayName,
    }));

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
