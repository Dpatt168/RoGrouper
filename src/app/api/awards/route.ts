import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

export interface Award {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or icon name
  color: string;
  createdAt: number;
  // Scope: either a specific group or an organization
  scope: {
    type: "group" | "organization";
    id: number | string; // groupId or organizationId
    name: string;
  };
}

export interface UserAward {
  id: string;
  awardId: string;
  awardName: string;
  awardIcon: string;
  awardColor: string;
  userId: number;
  username: string;
  awardedAt: number;
  awardedBy: string;
  reason?: string;
}

interface AwardsData {
  awards: Award[];
  userAwards: UserAward[];
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function getAwardsData(): Promise<AwardsData> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "awards.json");
  
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return { awards: [], userAwards: [] };
  }
}

async function saveAwardsData(data: AwardsData) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "awards.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scopeType = searchParams.get("scopeType");
  const scopeId = searchParams.get("scopeId");
  const userId = searchParams.get("userId");

  const data = await getAwardsData();

  // Filter by scope if provided
  let awards = data.awards;
  if (scopeType && scopeId) {
    awards = awards.filter(
      (a) => a.scope.type === scopeType && a.scope.id.toString() === scopeId
    );
  }

  // Filter user awards by userId if provided
  let userAwards = data.userAwards;
  if (userId) {
    userAwards = userAwards.filter((ua) => ua.userId.toString() === userId);
  }

  // If scopeType and scopeId provided, also filter userAwards to those awards
  if (scopeType && scopeId) {
    const awardIds = new Set(awards.map((a) => a.id));
    userAwards = userAwards.filter((ua) => awardIds.has(ua.awardId));
  }

  return NextResponse.json({ awards, userAwards });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = await getAwardsData();

    if (body.action === "createAward") {
      const newAward: Award = {
        id: crypto.randomUUID(),
        name: body.name,
        description: body.description || "",
        icon: body.icon || "🏆",
        color: body.color || "#fbbf24",
        createdAt: Date.now(),
        scope: {
          type: body.scopeType,
          id: body.scopeId,
          name: body.scopeName,
        },
      };
      data.awards.push(newAward);
    } else if (body.action === "deleteAward") {
      data.awards = data.awards.filter((a) => a.id !== body.awardId);
      // Also remove all user awards for this award
      data.userAwards = data.userAwards.filter((ua) => ua.awardId !== body.awardId);
    } else if (body.action === "giveAward") {
      const award = data.awards.find((a) => a.id === body.awardId);
      if (!award) {
        return NextResponse.json({ error: "Award not found" }, { status: 404 });
      }

      const newUserAward: UserAward = {
        id: crypto.randomUUID(),
        awardId: award.id,
        awardName: award.name,
        awardIcon: award.icon,
        awardColor: award.color,
        userId: body.userId,
        username: body.username,
        awardedAt: Date.now(),
        awardedBy: session.user.name || "Unknown",
        reason: body.reason,
      };
      data.userAwards.push(newUserAward);
    } else if (body.action === "revokeAward") {
      data.userAwards = data.userAwards.filter((ua) => ua.id !== body.userAwardId);
    }

    await saveAwardsData(data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating awards:", error);
    return NextResponse.json(
      { error: "Failed to update awards" },
      { status: 500 }
    );
  }
}
