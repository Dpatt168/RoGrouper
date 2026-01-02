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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Trash2, 
  Plus, 
  Loader2, 
  Users, 
  ChevronRight,
  Edit2,
  UserPlus,
  UserMinus,
  FolderTree
} from "lucide-react";
import { toast } from "sonner";

interface Role {
  id: number;
  name: string;
  rank: number;
}

interface SubGroupRule {
  id: string;
  points: number;
  roleId: number;
  roleName: string;
}

interface SubGroup {
  id: string;
  name: string;
  color: string;
  rules: SubGroupRule[];
  excludeFromGeneralAutomation?: boolean;
}

interface UserPoints {
  userId: number;
  username: string;
  points: number;
  subGroupId?: string;
}

interface Member {
  user: {
    userId: number;
    username: string;
    displayName: string;
  };
  role: {
    id: number;
    name: string;
    rank: number;
  };
}

interface SubGroupsPanelProps {
  groupId: number;
  availableRoles: Role[];
  members: Member[];
  onSubGroupsChange?: (subGroups: SubGroup[], userPoints: UserPoints[]) => void;
}

const COLORS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
  { name: "Purple", value: "#a855f7" },
];

export function SubGroupsPanel({ 
  groupId, 
  availableRoles, 
  members,
  onSubGroupsChange 
}: SubGroupsPanelProps) {
  const [subGroups, setSubGroups] = useState<SubGroup[]>([]);
  const [userPoints, setUserPoints] = useState<UserPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Create sub-group dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSubGroupName, setNewSubGroupName] = useState("");
  const [newSubGroupColor, setNewSubGroupColor] = useState("#6366f1");
  
  // Edit sub-group dialog
  const [editSubGroup, setEditSubGroup] = useState<SubGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  
  // Selected sub-group for viewing
  const [selectedSubGroup, setSelectedSubGroup] = useState<SubGroup | null>(null);
  
  // Add rule form
  const [newRulePoints, setNewRulePoints] = useState("");
  const [newRuleRoleId, setNewRuleRoleId] = useState("");
  
  // Assign user dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignSubGroupId, setAssignSubGroupId] = useState("");

  // Use ref to avoid re-creating callback when onSubGroupsChange changes
  const onSubGroupsChangeRef = useRef(onSubGroupsChange);
  onSubGroupsChangeRef.current = onSubGroupsChange;

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`);
      if (response.ok) {
        const data = await response.json();
        setSubGroups(data.subGroups || []);
        setUserPoints(data.userPoints || []);
        onSubGroupsChangeRef.current?.(data.subGroups || [], data.userPoints || []);
      }
    } catch (error) {
      console.error("Error fetching sub-groups:", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSubGroup = async () => {
    if (!newSubGroupName.trim()) {
      toast.error("Please enter a name");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createSubGroup",
          name: newSubGroupName.trim(),
          color: newSubGroupColor,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubGroups(data.subGroups || []);
        setUserPoints(data.userPoints || []);
        onSubGroupsChange?.(data.subGroups || [], data.userPoints || []);
        toast.success("Sub-group created");
        setShowCreateDialog(false);
        setNewSubGroupName("");
        setNewSubGroupColor("#6366f1");
      }
    } catch (error) {
      console.error("Error creating sub-group:", error);
      toast.error("Failed to create sub-group");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubGroup = async (subGroupId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteSubGroup",
          subGroupId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubGroups(data.subGroups || []);
        setUserPoints(data.userPoints || []);
        onSubGroupsChange?.(data.subGroups || [], data.userPoints || []);
        if (selectedSubGroup?.id === subGroupId) {
          setSelectedSubGroup(null);
        }
        toast.success("Sub-group deleted");
      }
    } catch (error) {
      console.error("Error deleting sub-group:", error);
      toast.error("Failed to delete sub-group");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubGroup = async () => {
    if (!editSubGroup || !editName.trim()) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renameSubGroup",
          subGroupId: editSubGroup.id,
          name: editName.trim(),
          color: editColor,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubGroups(data.subGroups || []);
        const updated = (data.subGroups || []).find((sg: SubGroup) => sg.id === editSubGroup.id);
        if (updated && selectedSubGroup?.id === editSubGroup.id) {
          setSelectedSubGroup(updated);
        }
        onSubGroupsChange?.(data.subGroups || [], data.userPoints || []);
        toast.success("Sub-group updated");
        setEditSubGroup(null);
      }
    } catch (error) {
      console.error("Error updating sub-group:", error);
      toast.error("Failed to update sub-group");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!selectedSubGroup || !newRulePoints || !newRuleRoleId) {
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
          action: "addSubGroupRule",
          subGroupId: selectedSubGroup.id,
          points: parseInt(newRulePoints),
          roleId: role.id,
          roleName: role.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubGroups(data.subGroups || []);
        const updated = (data.subGroups || []).find((sg: SubGroup) => sg.id === selectedSubGroup.id);
        if (updated) setSelectedSubGroup(updated);
        onSubGroupsChange?.(data.subGroups || [], data.userPoints || []);
        toast.success("Rule added");
        setNewRulePoints("");
        setNewRuleRoleId("");
      }
    } catch (error) {
      console.error("Error adding rule:", error);
      toast.error("Failed to add rule");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!selectedSubGroup) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteSubGroupRule",
          subGroupId: selectedSubGroup.id,
          ruleId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubGroups(data.subGroups || []);
        const updated = (data.subGroups || []).find((sg: SubGroup) => sg.id === selectedSubGroup.id);
        if (updated) setSelectedSubGroup(updated);
        onSubGroupsChange?.(data.subGroups || [], data.userPoints || []);
        toast.success("Rule deleted");
      }
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Failed to delete rule");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleExcludeFromGeneral = async (exclude: boolean) => {
    if (!selectedSubGroup) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateSubGroupSettings",
          subGroupId: selectedSubGroup.id,
          excludeFromGeneralAutomation: exclude,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubGroups(data.subGroups || []);
        const updated = (data.subGroups || []).find((sg: SubGroup) => sg.id === selectedSubGroup.id);
        if (updated) setSelectedSubGroup(updated);
        onSubGroupsChangeRef.current?.(data.subGroups || [], data.userPoints || []);
        toast.success(exclude ? "Excluded from general automation" : "Included in general automation");
      }
    } catch (error) {
      console.error("Error updating sub-group settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignUser = async (userId: number, username: string, overrideSubGroupId?: string | null) => {
    // If overrideSubGroupId is explicitly passed (even as null), use it; otherwise use the selected assignSubGroupId
    const targetSubGroupId = overrideSubGroupId !== undefined ? overrideSubGroupId : assignSubGroupId;
    
    // Allow null (for unassign) or a valid sub-group ID - only block empty string when no override was passed
    // When overrideSubGroupId is passed as null, we want to unassign, so skip validation
    if (overrideSubGroupId === undefined && targetSubGroupId === "") {
      toast.error("Please select a sub-group");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assignUserToSubGroup",
          userId,
          username,
          subGroupId: targetSubGroupId === "none" || targetSubGroupId === null ? null : targetSubGroupId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserPoints(data.userPoints || []);
        onSubGroupsChangeRef.current?.(data.subGroups || [], data.userPoints || []);
        const isUnassign = targetSubGroupId === "none" || targetSubGroupId === null;
        toast.success(isUnassign ? "User removed from sub-group" : "User assigned to sub-group");
      }
    } catch (error) {
      console.error("Error assigning user:", error);
      toast.error("Failed to assign user");
    } finally {
      setActionLoading(false);
    }
  };

  const getUserSubGroup = (userId: number): SubGroup | undefined => {
    const user = userPoints.find((u) => u.userId === userId);
    if (!user?.subGroupId) return undefined;
    return subGroups.find((sg) => sg.id === user.subGroupId);
  };

  const getSubGroupMembers = (subGroupId: string): UserPoints[] => {
    return userPoints.filter((u) => u.subGroupId === subGroupId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5" />
          <h3 className="font-medium">Sub-Groups</h3>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sub-groups list */}
        <div className="w-1/3 flex flex-col min-h-0">
          <ScrollArea className="flex-1 h-0 border rounded-lg">
            <div className="p-2 space-y-1">
              {subGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No sub-groups yet
                </p>
              ) : (
                subGroups.map((sg) => (
                  <div
                    key={sg.id}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-muted/50 ${
                      selectedSubGroup?.id === sg.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedSubGroup(sg)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: sg.color }}
                      />
                      <span className="text-sm font-medium">{sg.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {getSubGroupMembers(sg.id).length}
                      </Badge>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Sub-group details */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {selectedSubGroup ? (
            <div className="flex flex-col h-full min-h-0">
              {/* Sub-group header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedSubGroup.color }}
                  />
                  <h4 className="font-medium">{selectedSubGroup.name}</h4>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditSubGroup(selectedSubGroup);
                      setEditName(selectedSubGroup.name);
                      setEditColor(selectedSubGroup.color);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSubGroup(selectedSubGroup.id)}
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {/* Rules */}
              <Card className="mb-3">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm">Point Rules</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {selectedSubGroup.rules.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No rules configured</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedSubGroup.rules
                        .sort((a, b) => a.points - b.points)
                        .map((rule) => (
                          <div
                            key={rule.id}
                            className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1"
                          >
                            <span>
                              <Badge variant="outline" className="mr-2">
                                {rule.points} pts
                              </Badge>
                              → {rule.roleName}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleDeleteRule(rule.id)}
                              disabled={actionLoading}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Add rule form */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Input
                      type="number"
                      placeholder="Points"
                      value={newRulePoints}
                      onChange={(e) => setNewRulePoints(e.target.value)}
                      className="w-20 h-8"
                    />
                    <Select value={newRuleRoleId} onValueChange={setNewRuleRoleId}>
                      <SelectTrigger className="flex-1 h-8">
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
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={handleAddRule}
                      disabled={actionLoading || !newRulePoints || !newRuleRoleId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Settings */}
              <div className="flex items-center gap-2 mb-3 p-2 border rounded-lg bg-muted/30">
                <Checkbox
                  id="exclude-general"
                  checked={selectedSubGroup.excludeFromGeneralAutomation || false}
                  onCheckedChange={(checked) => handleToggleExcludeFromGeneral(checked === true)}
                  disabled={actionLoading}
                />
                <label 
                  htmlFor="exclude-general" 
                  className="text-sm cursor-pointer select-none"
                >
                  Exclude from general automation
                </label>
              </div>
              <p className="text-xs text-muted-foreground mb-3 -mt-2">
                Sub-group rules always take priority. If unchecked, general rules apply when no sub-group rule matches.
              </p>

              {/* Members in this sub-group */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium">Members</h5>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssignSubGroupId(selectedSubGroup.id);
                      setShowAssignDialog(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Assign
                  </Button>
                </div>
                <ScrollArea className="flex-1 h-0 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {getSubGroupMembers(selectedSubGroup.id).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No members assigned
                      </p>
                    ) : (
                      getSubGroupMembers(selectedSubGroup.id).map((user) => (
                        <div
                          key={user.userId}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded"
                        >
                          <div>
                            <p className="text-sm font-medium">{user.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.points} points
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAssignUser(user.userId, user.username, null)}
                            disabled={actionLoading}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">Select a sub-group to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Sub-Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sub-Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newSubGroupName}
                onChange={(e) => setNewSubGroupName(e.target.value)}
                placeholder="e.g., Protection Division"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 mt-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newSubGroupColor === color.value
                        ? "border-foreground"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setNewSubGroupColor(color.value)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubGroup} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sub-Group Dialog */}
      <Dialog open={!!editSubGroup} onOpenChange={(open) => !open && setEditSubGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sub-Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 mt-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-8 h-8 rounded-full border-2 ${
                      editColor === color.value
                        ? "border-foreground"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setEditColor(color.value)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSubGroup(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubGroup} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Member to Sub-Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Sub-Group</label>
              <Select value={assignSubGroupId} onValueChange={setAssignSubGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">No sub-group</span>
                  </SelectItem>
                  {subGroups.map((sg) => (
                    <SelectItem key={sg.id} value={sg.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: sg.color }}
                        />
                        {sg.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {members.map((member) => {
                  const currentSubGroup = getUserSubGroup(member.user.userId);
                  const isInSelectedSubGroup = currentSubGroup?.id === assignSubGroupId;
                  return (
                    <div
                      key={member.user.userId}
                      className="flex items-center justify-between p-2 hover:bg-muted/50 rounded"
                    >
                      <div>
                        <p className="text-sm font-medium">{member.user.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          @{member.user.username}
                          {currentSubGroup && (
                            <Badge
                              variant="outline"
                              className="ml-2"
                              style={{ borderColor: currentSubGroup.color, color: currentSubGroup.color }}
                            >
                              {currentSubGroup.name}
                            </Badge>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={isInSelectedSubGroup ? "destructive" : "outline"}
                        onClick={() => {
                          if (isInSelectedSubGroup) {
                            // Unassign - pass null to remove from sub-group
                            handleAssignUser(member.user.userId, member.user.username, null);
                          } else {
                            handleAssignUser(member.user.userId, member.user.username);
                          }
                        }}
                        disabled={actionLoading}
                      >
                        {isInSelectedSubGroup ? "Unassign" : "Assign"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
