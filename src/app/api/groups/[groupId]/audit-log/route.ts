import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDocument, setDocument, COLLECTIONS } from "@/lib/firebase";

export type AuditAction = 
  | "role_change"
  | "points_add"
  | "points_remove"
  | "user_suspend"
  | "user_unsuspend"
  | "user_kick"
  | "rule_add"
  | "rule_delete"
  | "suspended_role_set"
  | "suspended_role_clear"
  | "webhook_set"
  | "webhook_clear";

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: AuditAction;
  performedBy: {
    userId: string;
    username: string;
  };
  targetUser?: {
    userId: number;
    username: string;
  };
  details: Record<string, unknown>;
}

interface AuditLogData {
  entries: AuditLogEntry[];
  discordWebhook?: string;
}

async function getAuditLogData(groupId: string): Promise<AuditLogData> {
  return getDocument<AuditLogData>(
    COLLECTIONS.AUDIT_LOGS,
    groupId,
    { entries: [] }
  );
}

async function saveAuditLogData(groupId: string, data: AuditLogData) {
  await setDocument(COLLECTIONS.AUDIT_LOGS, groupId, data);
}

function getActionDescription(entry: AuditLogEntry): string {
  const performer = entry.performedBy.username;
  const target = entry.targetUser?.username || "Unknown";
  const reason = entry.details.reason as string | undefined;

  switch (entry.action) {
    case "role_change":
      return `${performer} changed ${target}'s role to ${entry.details.newRoleName}`;
    case "points_add":
      return `${performer} added ${entry.details.points} point(s) to ${target}`;
    case "points_remove":
      return `${performer} removed ${entry.details.points} point(s) from ${target}`;
    case "user_suspend":
      return `${performer} suspended ${target} for ${entry.details.duration}${reason ? ` - Reason: ${reason}` : ""}`;
    case "user_unsuspend":
      return `${performer} lifted ${target}'s suspension`;
    case "user_kick":
      return `${performer} kicked ${target} from the group${reason ? ` - Reason: ${reason}` : ""}`;
    case "rule_add":
      return `${performer} added automation rule: ${entry.details.points} points → ${entry.details.roleName}`;
    case "rule_delete":
      return `${performer} deleted automation rule: ${entry.details.points} points → ${entry.details.roleName}`;
    case "suspended_role_set":
      return `${performer} set suspended role to ${entry.details.roleName}`;
    case "suspended_role_clear":
      return `${performer} cleared the suspended role`;
    case "webhook_set":
      return `${performer} configured Discord webhook`;
    case "webhook_clear":
      return `${performer} removed Discord webhook`;
    default:
      return `${performer} performed an action`;
  }
}

function getActionColor(action: AuditAction): number {
  switch (action) {
    case "role_change":
      return 0x3498db; // Blue
    case "points_add":
      return 0x2ecc71; // Green
    case "points_remove":
      return 0xe67e22; // Orange
    case "user_suspend":
      return 0xe74c3c; // Red
    case "user_unsuspend":
      return 0x2ecc71; // Green
    case "user_kick":
      return 0xe74c3c; // Red
    case "rule_add":
      return 0x9b59b6; // Purple
    case "rule_delete":
      return 0x95a5a6; // Gray
    case "suspended_role_set":
    case "suspended_role_clear":
      return 0xf39c12; // Yellow
    case "webhook_set":
    case "webhook_clear":
      return 0x1abc9c; // Teal
    default:
      return 0x95a5a6; // Gray
  }
}

async function sendDiscordWebhook(webhookUrl: string, entry: AuditLogEntry, groupName?: string) {
  try {
    const description = getActionDescription(entry);
    const color = getActionColor(entry.action);
    const reason = entry.details.reason as string | undefined;

    const embed: {
      title: string;
      description: string;
      color: number;
      fields: Array<{ name: string; value: string; inline: boolean }>;
      timestamp: string;
      footer: { text: string };
    } = {
      title: "📋 Audit Log",
      description,
      color,
      fields: [
        {
          name: "Action",
          value: entry.action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          inline: true,
        },
        {
          name: "Performed By",
          value: entry.performedBy.username,
          inline: true,
        },
      ],
      timestamp: new Date(entry.timestamp).toISOString(),
      footer: {
        text: groupName || "Bloxmesh",
      },
    };

    if (entry.targetUser) {
      embed.fields.push({
        name: "Target User",
        value: entry.targetUser.username,
        inline: true,
      });
    }

    // Add reason field if provided
    if (reason) {
      embed.fields.push({
        name: "Reason",
        value: reason,
        inline: false,
      });
    }

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (error) {
    console.error("Error sending Discord webhook:", error);
  }
}

// GET - Retrieve audit logs
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
    const data = await getAuditLogData(groupId);
    // Return most recent first, limit to 100 entries
    const entries = data.entries.slice(-100).reverse();
    return NextResponse.json({ 
      entries, 
      discordWebhook: data.discordWebhook ? "configured" : null 
    });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    );
  }
}

// POST - Add audit log entry or configure webhook
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = await getAuditLogData(groupId);

    if (body.action === "setWebhook") {
      data.discordWebhook = body.webhookUrl || undefined;
      
      // Log the webhook change
      const entry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: body.webhookUrl ? "webhook_set" : "webhook_clear",
        performedBy: {
          userId: session.user.robloxId,
          username: session.user.name || "Unknown",
        },
        details: {},
      };
      data.entries.push(entry);
      
      await saveAuditLogData(groupId, data);
      return NextResponse.json({ success: true });
    }

    if (body.action === "log") {
      const entry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: body.logAction,
        performedBy: {
          userId: session.user.robloxId,
          username: session.user.name || "Unknown",
        },
        targetUser: body.targetUser,
        details: body.details || {},
      };

      data.entries.push(entry);

      // Keep only last 500 entries
      if (data.entries.length > 500) {
        data.entries = data.entries.slice(-500);
      }

      await saveAuditLogData(groupId, data);

      // Send to Discord webhook if configured
      if (data.discordWebhook) {
        await sendDiscordWebhook(data.discordWebhook, entry, body.groupName);
      }

      return NextResponse.json({ success: true, entry });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating audit log:", error);
    return NextResponse.json(
      { error: "Failed to update audit log" },
      { status: 500 }
    );
  }
}
