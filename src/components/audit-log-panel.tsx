"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  Loader2, 
  RefreshCw,
  UserCog,
  Plus,
  Minus,
  ShieldBan,
  ShieldCheck,
  UserMinus,
  Webhook,
  Settings,
  Check,
  X
} from "lucide-react";
import { toast } from "sonner";
import type { AuditLogEntry, AuditAction } from "@/app/api/groups/[groupId]/audit-log/route";

interface AuditLogPanelProps {
  groupId: string;
}

function getActionIcon(action: AuditAction) {
  switch (action) {
    case "role_change":
      return <UserCog className="h-4 w-4" />;
    case "points_add":
      return <Plus className="h-4 w-4" />;
    case "points_remove":
      return <Minus className="h-4 w-4" />;
    case "user_suspend":
      return <ShieldBan className="h-4 w-4" />;
    case "user_unsuspend":
      return <ShieldCheck className="h-4 w-4" />;
    case "user_kick":
      return <UserMinus className="h-4 w-4" />;
    case "rule_add":
    case "rule_delete":
    case "suspended_role_set":
    case "suspended_role_clear":
      return <Settings className="h-4 w-4" />;
    case "webhook_set":
    case "webhook_clear":
      return <Webhook className="h-4 w-4" />;
    default:
      return <ClipboardList className="h-4 w-4" />;
  }
}

function getActionVariant(action: AuditAction): "default" | "secondary" | "destructive" | "outline" {
  switch (action) {
    case "points_add":
    case "user_unsuspend":
      return "default";
    case "points_remove":
    case "user_suspend":
    case "user_kick":
      return "destructive";
    case "role_change":
      return "secondary";
    default:
      return "outline";
  }
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

  return date.toLocaleDateString();
}

function getActionDescription(entry: AuditLogEntry): string {
  const performer = entry.performedBy.username;
  const target = entry.targetUser?.username || "Unknown";

  switch (entry.action) {
    case "role_change":
      return `${performer} changed ${target}'s role to ${entry.details.newRoleName}`;
    case "points_add":
      return `${performer} added ${entry.details.points} point(s) to ${target}`;
    case "points_remove":
      return `${performer} removed ${entry.details.points} point(s) from ${target}`;
    case "user_suspend":
      return `${performer} suspended ${target} for ${entry.details.duration}`;
    case "user_unsuspend":
      return `${performer} lifted ${target}'s suspension`;
    case "user_kick":
      return `${performer} kicked ${target} from the group`;
    case "rule_add":
      return `${performer} added rule: ${entry.details.points} pts → ${entry.details.roleName}`;
    case "rule_delete":
      return `${performer} deleted rule: ${entry.details.points} pts → ${entry.details.roleName}`;
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

export function AuditLogPanel({ groupId }: AuditLogPanelProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [editingWebhook, setEditingWebhook] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);

  const fetchAuditLog = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/audit-log`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        setWebhookConfigured(!!data.discordWebhook);
      }
    } catch (error) {
      console.error("Error fetching audit log:", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/audit-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setWebhook",
          webhookUrl: webhookUrl.trim() || null,
        }),
      });

      if (response.ok) {
        setWebhookConfigured(!!webhookUrl.trim());
        setEditingWebhook(false);
        toast.success(webhookUrl.trim() ? "Webhook configured" : "Webhook removed");
        fetchAuditLog();
      } else {
        toast.error("Failed to save webhook");
      }
    } catch (error) {
      console.error("Error saving webhook:", error);
      toast.error("Failed to save webhook");
    } finally {
      setSavingWebhook(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Discord Webhook Config */}
      <Card className="shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Discord Webhook
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editingWebhook ? (
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={handleSaveWebhook}
                disabled={savingWebhook}
              >
                {savingWebhook ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  setEditingWebhook(false);
                  setWebhookUrl("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {webhookConfigured ? (
                  <Badge variant="default" className="bg-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not configured</Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingWebhook(true)}
              >
                {webhookConfigured ? "Change" : "Configure"}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Audit log events will be sent to this Discord webhook
          </p>
        </CardContent>
      </Card>

      {/* Audit Log Entries */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Recent Activity
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchAuditLog}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0">
          <ScrollArea className="h-full px-6 pb-6">
            {entries.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No audit log entries yet
              </p>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 border rounded-lg"
                  >
                    <div className="shrink-0 mt-0.5">
                      <Badge variant={getActionVariant(entry.action)} className="h-7 w-7 p-0 flex items-center justify-center">
                        {getActionIcon(entry.action)}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{getActionDescription(entry)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
