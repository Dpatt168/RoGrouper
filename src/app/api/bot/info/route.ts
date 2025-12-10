import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

export interface BotInfo {
  id: number;
  name: string;
  displayName: string;
}

// Cache bot info to avoid repeated API calls
let cachedBotInfo: BotInfo | null = null;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BOT_COOKIE) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
  }

  try {
    // Return cached info if available
    if (cachedBotInfo) {
      return NextResponse.json(cachedBotInfo);
    }

    const response = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers: {
        Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Roblox API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Bot token may be invalid or expired", details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    if (!data.id) {
      console.error("Unexpected response from Roblox:", data);
      return NextResponse.json(
        { error: "Invalid response from Roblox API" },
        { status: 500 }
      );
    }
    
    cachedBotInfo = {
      id: data.id,
      name: data.name,
      displayName: data.displayName,
    };

    return NextResponse.json(cachedBotInfo);
  } catch (error) {
    console.error("Error fetching bot info:", error);
    return NextResponse.json(
      { error: "Failed to fetch bot info", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
