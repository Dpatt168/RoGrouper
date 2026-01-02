"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Building2, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Loader2,
  Users,
  Link2,
  Settings,
  RefreshCw,
  Award
} from "lucide-react";
import { toast } from "sonner";
import { AwardsPanel } from "./awards-panel";
import type { Organization, RoleSync } from "@/app/api/organizations/route";
import type { RobloxGroup } from "@/app/api/groups/route";

interface Role {
  id: number;
  name: string;
  rank: number;
}

interface OrganizationManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization;
  allGroups: RobloxGroup[];
  onUpdate: (org: Organization) => void;
}

export function OrganizationManagementDialog({
  open,
  onOpenChange,
  organization,
  allGroups,
  onUpdate,
}: OrganizationManagementDialogProps) {
  const [orgName, setOrgName] = useState(organization.name);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(
    new Set(organization.groupIds)
  );
  const [groupRoles, setGroupRoles] = useState<Map<number, Role[]>>(new Map());
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; applied: number } | null>(null);

  // New role sync form
  const [sourceGroupId, setSourceGroupId] = useState("");
  const [sourceRoleId, setSourceRoleId] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [targetRoleId, setTargetRoleId] = useState("");

  // Fetch roles for all groups in the organization
  const fetchRoles = useCallback(async () => {
    setLoadingRoles(true);
    const rolesMap = new Map<number, Role[]>();

    for (const groupId of organization.groupIds) {
      try {
        const response = await fetch(`/api/groups/${groupId}/roles`);
        if (response.ok) {
          const data = await response.json();
          rolesMap.set(groupId, data.roles || []);
        }
      } catch (error) {
        console.error(`Error fetching roles for group ${groupId}:`, error);
      }
    }

    setGroupRoles(rolesMap);
    setLoadingRoles(false);
  }, [organization.groupIds]);

  useEffect(() => {
    if (open) {
      fetchRoles();
      setOrgName(organization.name);
      setSelectedGroupIds(new Set(organization.groupIds));
    }
  }, [open, fetchRoles, organization]);

  const handleToggleGroup = (groupId: number) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleUpdateGroups = async () => {
    if (selectedGroupIds.size < 2) {
      toast.error("Organization must have at least 2 groups");
      return;
    }

    setActionLoading(true);
    try {
      const selectedGroups = allGroups
        .filter((g) => selectedGroupIds.has(g.group.id))
        .map((g) => ({
          id: g.group.id,
          name: g.group.name,
          iconUrl: g.group.iconUrl,
        }));

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateGroups",
          orgId: organization.id,
          groupIds: Array.from(selectedGroupIds),
          groups: selectedGroups,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedOrg = data.organizations.find((o: Organization) => o.id === organization.id);
        if (updatedOrg) {
          onUpdate(updatedOrg);
          toast.success("Groups updated");
          fetchRoles();
        }
      } else {
        toast.error("Failed to update groups");
      }
    } catch (error) {
      console.error("Error updating groups:", error);
      toast.error("Failed to update groups");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRename = async () => {
    if (!orgName.trim()) return;

    setActionLoading(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename",
          orgId: organization.id,
          name: orgName.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedOrg = data.organizations.find((o: Organization) => o.id === organization.id);
        if (updatedOrg) {
          onUpdate(updatedOrg);
          toast.success("Organization renamed");
        }
      } else {
        toast.error("Failed to rename organization");
      }
    } catch (error) {
      console.error("Error renaming organization:", error);
      toast.error("Failed to rename organization");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddRoleSync = async () => {
    if (!sourceGroupId || !targetGroupId || !targetRoleId) {
      toast.error("Please fill in all fields");
      return;
    }

    if (sourceGroupId === targetGroupId) {
      toast.error("Source and target groups must be different");
      return;
    }

    // sourceRoleId "any" means any role in the group
    const isAnyRole = sourceRoleId === "any" || !sourceRoleId;
    const sourceRoleIdValue = isAnyRole ? null : parseInt(sourceRoleId);

    // Check for duplicate: same source role syncing to the same target group
    const existingSync = organization.roleSyncs.find(
      (sync) =>
        sync.sourceGroupId === parseInt(sourceGroupId) &&
        sync.sourceRoleId === sourceRoleIdValue &&
        sync.targetGroupId === parseInt(targetGroupId)
    );
    if (existingSync) {
      toast.error("This sync already exists");
      return;
    }

    const sourceGroup = organization.groups.find((g) => g.id.toString() === sourceGroupId);
    const targetGroup = organization.groups.find((g) => g.id.toString() === targetGroupId);
    const sourceRole = !isAnyRole
      ? groupRoles.get(parseInt(sourceGroupId))?.find((r) => r.id.toString() === sourceRoleId)
      : null;
    const targetRole = groupRoles.get(parseInt(targetGroupId))?.find((r) => r.id.toString() === targetRoleId);

    if (!sourceGroup || !targetGroup || !targetRole) {
      toast.error("Invalid selection");
      return;
    }

    if (!isAnyRole && !sourceRole) {
      toast.error("Invalid source role");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addRoleSync",
          orgId: organization.id,
          sourceGroupId: parseInt(sourceGroupId),
          sourceGroupName: sourceGroup.name,
          sourceRoleId: sourceRoleIdValue,
          sourceRoleName: isAnyRole ? "Any Role" : sourceRole!.name,
          targetGroupId: parseInt(targetGroupId),
          targetGroupName: targetGroup.name,
          targetRoleId: parseInt(targetRoleId),
          targetRoleName: targetRole.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedOrg = data.organizations.find((o: Organization) => o.id === organization.id);
        if (updatedOrg) {
          onUpdate(updatedOrg);
          toast.success("Role sync added");
          setSourceGroupId("");
          setSourceRoleId("");
          setTargetGroupId("");
          setTargetRoleId("");
        }
      } else {
        toast.error("Failed to add role sync");
      }
    } catch (error) {
      console.error("Error adding role sync:", error);
      toast.error("Failed to add role sync");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRoleSync = async (syncId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteRoleSync",
          orgId: organization.id,
          syncId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedOrg = data.organizations.find((o: Organization) => o.id === organization.id);
        if (updatedOrg) {
          onUpdate(updatedOrg);
          toast.success("Role sync deleted");
        }
      } else {
        toast.error("Failed to delete role sync");
      }
    } catch (error) {
      console.error("Error deleting role sync:", error);
      toast.error("Failed to delete role sync");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (organization.roleSyncs.length === 0) {
      toast.error("No role syncs configured");
      return;
    }

    setSyncing(true);
    setSyncProgress({ current: 0, total: 0, applied: 0 });

    try {
      let totalMembers = 0;
      let processedMembers = 0;
      let appliedSyncs = 0;

      // For each source group in the syncs, fetch members and check syncs
      const sourceGroupIds = [...new Set(organization.roleSyncs.map(s => s.sourceGroupId))];

      // First, count total members
      for (const groupId of sourceGroupIds) {
        const response = await fetch(`/api/groups/${groupId}/members?limit=100`);
        if (response.ok) {
          const data = await response.json();
          totalMembers += (data.data || []).length;
        }
      }

      setSyncProgress({ current: 0, total: totalMembers, applied: 0 });

      // Now process each group
      for (const groupId of sourceGroupIds) {
        // Get syncs for this source group
        const syncsForGroup = organization.roleSyncs.filter(s => s.sourceGroupId === groupId);
        
        // Fetch members
        const response = await fetch(`/api/groups/${groupId}/members?limit=100`);
        if (!response.ok) continue;

        const data = await response.json();
        const members = data.data || [];

        for (const member of members) {
          processedMembers++;
          setSyncProgress({ current: processedMembers, total: totalMembers, applied: appliedSyncs });

          // Check each sync rule
          for (const sync of syncsForGroup) {
            // Check if this member matches the sync rule
            const matchesRole = sync.sourceRoleId === null || sync.sourceRoleId === member.role.id;
            
            if (matchesRole) {
              // Apply the target role
              try {
                const applyResponse = await fetch(
                  `/api/groups/${sync.targetGroupId}/members/${member.user.userId}`,
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ roleId: sync.targetRoleId, triggerSync: false }),
                  }
                );

                if (applyResponse.ok) {
                  appliedSyncs++;
                  setSyncProgress({ current: processedMembers, total: totalMembers, applied: appliedSyncs });
                }
              } catch (error) {
                // User might not be in target group, that's okay
                console.error("Error applying sync:", error);
              }
            }
          }
        }
      }

      toast.success(`Sync complete! Applied ${appliedSyncs} role change${appliedSyncs !== 1 ? "s" : ""}`);
    } catch (error) {
      console.error("Error syncing:", error);
      toast.error("Failed to sync roles");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const sourceRoles = sourceGroupId ? groupRoles.get(parseInt(sourceGroupId)) || [] : [];
  const targetRoles = targetGroupId ? groupRoles.get(parseInt(targetGroupId)) || [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px]! w-[90vw] h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Manage {organization.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="syncs" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="syncs" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Role Syncs
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="awards" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Awards
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Role Syncs Tab */}
          <TabsContent value="syncs" className="flex-1 flex flex-col min-h-0 mt-4">
            {/* Sync Now Button */}
            <div className="shrink-0 mb-4">
              <Button
                onClick={handleSyncNow}
                disabled={syncing || organization.roleSyncs.length === 0}
                className="w-full"
                variant="outline"
              >
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {syncProgress ? (
                      `Syncing... ${syncProgress.current}/${syncProgress.total} (${syncProgress.applied} applied)`
                    ) : (
                      "Starting sync..."
                    )}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Scan all members and apply role syncs
              </p>
            </div>

            <Card className="shrink-0 mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add Role Sync</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingRoles ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">When user is in group:</p>
                        <Select value={sourceGroupId} onValueChange={(v) => { setSourceGroupId(v); setSourceRoleId(""); }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source group" />
                          </SelectTrigger>
                          <SelectContent>
                            {organization.groups.map((group) => (
                              <SelectItem key={group.id} value={group.id.toString()}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={sourceRoleId} onValueChange={setSourceRoleId} disabled={!sourceGroupId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">
                              <span className="font-medium text-primary">Any Role (just in group)</span>
                            </SelectItem>
                            {sourceRoles.filter(r => r.rank > 0).map((role) => (
                              <SelectItem key={role.id} value={role.id.toString()}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">Give them this role in:</p>
                        <Select value={targetGroupId} onValueChange={(v) => { setTargetGroupId(v); setTargetRoleId(""); }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select target group" />
                          </SelectTrigger>
                          <SelectContent>
                            {organization.groups.map((group) => (
                              <SelectItem key={group.id} value={group.id.toString()}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={targetRoleId} onValueChange={setTargetRoleId} disabled={!targetGroupId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {targetRoles.filter(r => r.rank > 0).map((role) => (
                              <SelectItem key={role.id} value={role.id.toString()}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      onClick={handleAddRoleSync}
                      disabled={actionLoading || !sourceGroupId || !sourceRoleId || !targetGroupId || !targetRoleId}
                      className="w-full"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Role Sync
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {organization.roleSyncs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No role syncs configured yet. Add one above to automatically sync roles between groups.
                  </p>
                ) : (
                  organization.roleSyncs.map((sync) => (
                    <div
                      key={sync.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{sync.sourceGroupName}</Badge>
                        <Badge>{sync.sourceRoleName}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">{sync.targetGroupName}</Badge>
                        <Badge>{sync.targetRoleName}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRoleSync(sync.id)}
                        disabled={actionLoading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="flex-1 flex flex-col min-h-0 mt-4">
            <ScrollArea className="flex-1 border rounded-lg p-2">
              <div className="space-y-2">
                {allGroups.map((item) => (
                  <div
                    key={item.group.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleGroup(item.group.id)}
                  >
                    <Checkbox
                      checked={selectedGroupIds.has(item.group.id)}
                      onCheckedChange={() => handleToggleGroup(item.group.id)}
                    />
                    <Avatar className="h-10 w-10 rounded-lg">
                      <AvatarImage src={item.group.iconUrl || undefined} alt={item.group.name} />
                      <AvatarFallback className="rounded-lg">{item.group.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Your role: {item.role.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {selectedGroupIds.size} group{selectedGroupIds.size !== 1 ? "s" : ""} selected (minimum 2)
              </p>
              <Button
                onClick={handleUpdateGroups}
                disabled={actionLoading || selectedGroupIds.size < 2}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Groups
              </Button>
            </div>
          </TabsContent>

          {/* Awards Tab */}
          <TabsContent value="awards" className="flex-1 mt-4">
            <AwardsPanel
              scopeType="organization"
              scopeId={organization.id}
              scopeName={organization.name}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Organization Name</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organization name"
                />
                <Button
                  onClick={handleRename}
                  disabled={actionLoading || !orgName.trim() || orgName === organization.name}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Rename
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
