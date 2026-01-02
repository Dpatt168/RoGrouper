"use client";

import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Settings, UserMinus, ShieldBan, ArrowUpDown } from "lucide-react";

interface GroupSettings {
  requireKickReason: boolean;
  requireSuspendReason: boolean;
  requireRoleChangeReason: boolean;
}

interface GroupSettingsPanelProps {
  groupId: number;
  onSettingsChange?: (settings: GroupSettings) => void;
}

export function GroupSettingsPanel({ groupId, onSettingsChange }: GroupSettingsPanelProps) {
  const [settings, setSettings] = useState<GroupSettings>({
    requireKickReason: false,
    requireSuspendReason: false,
    requireRoleChangeReason: false,
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/groups/${groupId}/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        onSettingsChange?.(data.settings);
      }
    } catch (error) {
      console.error("Error fetching group settings:", error);
    } finally {
      setLoading(false);
    }
  }, [groupId, onSettingsChange]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (setting: keyof GroupSettings, value: boolean) => {
    setUpdating(setting);
    try {
      const response = await fetch(`/api/groups/${groupId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting, value }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        onSettingsChange?.(data.settings);
        toast.success("Setting updated");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update setting");
      }
    } catch (error) {
      console.error("Error updating setting:", error);
      toast.error("Failed to update setting");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pr-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Group Settings</h3>
        </div>

        <div className="space-y-4">
          {/* Kick Reason Setting */}
          <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <UserMinus className="h-4 w-4 text-red-500" />
                <span className="font-medium">Kick Reason</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Prompt for a reason when kicking members. The reason will be shown in the audit log and Discord webhook.
              </p>
            </div>
            <Switch
              checked={settings.requireKickReason}
              onCheckedChange={(checked: boolean) => updateSetting("requireKickReason", checked)}
              disabled={updating === "requireKickReason"}
            />
          </div>

          {/* Suspension Reason Setting */}
          <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <ShieldBan className="h-4 w-4 text-orange-500" />
                <span className="font-medium">Suspension Reason</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Prompt for a reason when suspending members. The reason will be shown in the audit log and Discord webhook.
              </p>
            </div>
            <Switch
              checked={settings.requireSuspendReason}
              onCheckedChange={(checked: boolean) => updateSetting("requireSuspendReason", checked)}
              disabled={updating === "requireSuspendReason"}
            />
          </div>

          {/* Role Change Reason Setting */}
          <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Promotion/Demotion Reason</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Prompt for a reason when promoting or demoting members. The reason will be shown in the audit log and Discord webhook.
              </p>
            </div>
            <Switch
              checked={settings.requireRoleChangeReason}
              onCheckedChange={(checked: boolean) => updateSetting("requireRoleChangeReason", checked)}
              disabled={updating === "requireRoleChangeReason"}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          These settings are managed by group admins and apply to all users with access to this group.
        </p>
      </div>
    </ScrollArea>
  );
}
