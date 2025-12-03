"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2, ShieldBan, X } from "lucide-react";
import { toast } from "sonner";

interface Role {
  id: number;
  name: string;
  rank: number;
}

export interface Rule {
  id: string;
  points: number;
  roleId: number;
  roleName: string;
}

export interface UserPoints {
  userId: number;
  username: string;
  points: number;
  subGroupId?: string;
}

export interface SuspendedRole {
  roleId: number;
  roleName: string;
}

export interface Suspension {
  id: string;
  userId: number;
  username: string;
  previousRoleId: number;
  previousRoleName: string;
  suspendedAt: number;
  expiresAt: number;
}

interface AutomationPanelProps {
  groupId: number;
  availableRoles: Role[];
  onDataLoad: (rules: Rule[], userPoints: UserPoints[], suspendedRole?: SuspendedRole, suspensions?: Suspension[]) => void;
}

export function AutomationPanel({ groupId, availableRoles, onDataLoad }: AutomationPanelProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [suspendedRole, setSuspendedRole] = useState<SuspendedRole | undefined>();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // New rule form
  const [newRulePoints, setNewRulePoints] = useState("");
  const [newRuleRoleId, setNewRuleRoleId] = useState("");
  const [selectedSuspendRoleId, setSelectedSuspendRoleId] = useState("");

  // Use ref to avoid re-fetching when onDataLoad changes
  const onDataLoadRef = useRef(onDataLoad);
  onDataLoadRef.current = onDataLoad;

  const fetchAutomationData = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`);
      if (response.ok) {
        const data = await response.json();
        setRules(data.rules || []);
        setSuspendedRole(data.suspendedRole);
        if (data.suspendedRole) {
          setSelectedSuspendRoleId(data.suspendedRole.roleId.toString());
        }
        onDataLoadRef.current(data.rules || [], data.userPoints || [], data.suspendedRole, data.suspensions || []);
      }
    } catch (error) {
      console.error("Error fetching automation data:", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchAutomationData();
  }, [fetchAutomationData]);

  const handleAddRule = async () => {
    if (!newRulePoints || !newRuleRoleId) {
      toast.error("Please fill in all fields");
      return;
    }

    const role = availableRoles.find((r) => r.id.toString() === newRuleRoleId);
    if (!role) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addRule",
          points: parseInt(newRulePoints),
          roleId: role.id,
          roleName: role.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRules(data.rules);
        onDataLoad(data.rules, data.userPoints || [], data.suspendedRole, data.suspensions || []);
        setNewRulePoints("");
        setNewRuleRoleId("");
        toast.success("Rule added successfully");
      } else {
        toast.error("Failed to add rule");
      }
    } catch (error) {
      console.error("Error adding rule:", error);
      toast.error("Failed to add rule");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetSuspendedRole = async (roleId: string) => {
    const role = availableRoles.find((r) => r.id.toString() === roleId);
    if (!role) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setSuspendedRole",
          roleId: role.id,
          roleName: role.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuspendedRole(data.suspendedRole);
        setSelectedSuspendRoleId(roleId);
        onDataLoad(data.rules, data.userPoints || [], data.suspendedRole, data.suspensions || []);
        toast.success("Suspended role set successfully");
      } else {
        toast.error("Failed to set suspended role");
      }
    } catch (error) {
      console.error("Error setting suspended role:", error);
      toast.error("Failed to set suspended role");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearSuspendedRole = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clearSuspendedRole",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuspendedRole(undefined);
        setSelectedSuspendRoleId("");
        onDataLoad(data.rules, data.userPoints || [], undefined, data.suspensions || []);
        toast.success("Suspended role cleared");
      } else {
        toast.error("Failed to clear suspended role");
      }
    } catch (error) {
      console.error("Error clearing suspended role:", error);
      toast.error("Failed to clear suspended role");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteRule",
          ruleId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRules(data.rules);
        onDataLoad(data.rules, data.userPoints || [], data.suspendedRole, data.suspensions || []);
        toast.success("Rule deleted");
      } else {
        toast.error("Failed to delete rule");
      }
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Failed to delete rule");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Suspended Role Setting */}
      <Card className="shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldBan className="h-4 w-4" />
            Bind Suspended Role
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suspendedRole ? (
            <div className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">{suspendedRole.roleName}</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearSuspendedRole}
                disabled={actionLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={selectedSuspendRoleId} onValueChange={handleSetSuspendedRole}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select suspended role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Members suspended will be given this role temporarily
          </p>
        </CardContent>
      </Card>

      {/* Add Rule Form */}
      <Card className="shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Add New Rule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Points"
              value={newRulePoints}
              onChange={(e) => setNewRulePoints(e.target.value)}
              className="w-20"
            />
            <Select value={newRuleRoleId} onValueChange={setNewRuleRoleId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAddRule}
            disabled={actionLoading}
            className="w-full"
            size="sm"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add Rule
          </Button>
        </CardContent>
      </Card>

      {/* Rules List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2">
          {rules.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No rules configured yet
            </p>
          ) : (
            rules
              .sort((a, b) => a.points - b.points)
              .map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{rule.points} pts</Badge>
                    <span className="text-sm">→</span>
                    <Badge>{rule.roleName}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteRule(rule.id)}
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
