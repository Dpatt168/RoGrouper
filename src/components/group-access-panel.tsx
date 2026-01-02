"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Users, 
  Loader2, 
  Crown,
  X,
  Plus,
  Info,
  ChevronDown,
  Settings
} from "lucide-react";
import { toast } from "sonner";

interface Role {
  id: number;
  name: string;
  rank: number;
}

interface AccessPermissions {
  canKick: boolean;
  canSuspend: boolean;
  canChangeRole: boolean;
  canManagePoints: boolean;
  canManageDivisions: boolean;
  canViewAuditLog: boolean;
  canManageAutomation: boolean;
  canManageAwards: boolean;
}

const DEFAULT_PERMISSIONS: AccessPermissions = {
  canKick: false,
  canSuspend: false,
  canChangeRole: false,
  canManagePoints: false,
  canManageDivisions: false,
  canViewAuditLog: false,
  canManageAutomation: false,
  canManageAwards: false,
};

const PERMISSION_LABELS: Record<keyof AccessPermissions, { label: string; description: string }> = {
  canKick: { label: "Kick Members", description: "Remove members from the group" },
  canSuspend: { label: "Suspend Members", description: "Temporarily suspend members" },
  canChangeRole: { label: "Change Roles", description: "Manually change member roles" },
  canManagePoints: { label: "Manage Points", description: "Add or remove points from members" },
  canManageDivisions: { label: "Manage Divisions", description: "Assign members to sub-groups/divisions" },
  canViewAuditLog: { label: "View Audit Log", description: "View the group audit log" },
  canManageAutomation: { label: "Manage Automation", description: "Configure automation rules" },
  canManageAwards: { label: "Manage Awards", description: "Give and manage awards" },
};

interface AllowedRole {
  roleId: number;
  roleName: string;
  rank: number;
  permissions: AccessPermissions;
}

interface AllowedUser {
  robloxId: string;
  username: string;
  displayName?: string;
  addedAt: number;
  addedBy: string;
  permissions: AccessPermissions;
}

interface AccessAdmin {
  robloxId: string;
  username: string;
  displayName?: string;
  addedAt: number;
  addedBy: string;
}

interface AdminRole {
  roleId: number;
  roleName: string;
  rank: number;
}

interface GroupAccess {
  groupId: number;
  ownerId: string;
  allowedRoles: AllowedRole[];
  allowedUsers: AllowedUser[];
  adminUsers: AccessAdmin[];
  adminRoles: AdminRole[];
  updatedAt: number;
}

interface GroupAccessPanelProps {
  groupId: number;
  availableRoles: Role[];
}

// Permission card for roles
function RolePermissionCard({ 
  role, 
  onRemove, 
  onUpdatePermission, 
  disabled 
}: { 
  role: AllowedRole; 
  onRemove: () => void; 
  onUpdatePermission: (permission: keyof AccessPermissions, value: boolean) => void;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const permissions = role.permissions || DEFAULT_PERMISSIONS;
  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{role.roleName}</Badge>
          <span className="text-xs text-muted-foreground">Rank {role.rank}</span>
          <Badge variant="outline" className="text-xs">
            {enabledCount}/{Object.keys(PERMISSION_LABELS).length} permissions
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="p-3 border-t bg-background">
          <p className="text-xs text-muted-foreground mb-3">Select what this role can do:</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PERMISSION_LABELS) as Array<keyof AccessPermissions>).map((key) => (
              <label 
                key={key}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={permissions[key]}
                  onCheckedChange={(checked) => onUpdatePermission(key, !!checked)}
                  disabled={disabled}
                />
                <div>
                  <p className="text-sm font-medium">{PERMISSION_LABELS[key].label}</p>
                  <p className="text-xs text-muted-foreground">{PERMISSION_LABELS[key].description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Permission card for users
function UserPermissionCard({ 
  user, 
  onRemove, 
  onUpdatePermission, 
  disabled 
}: { 
  user: AllowedUser; 
  onRemove: () => void; 
  onUpdatePermission: (permission: keyof AccessPermissions, value: boolean) => void;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const permissions = user.permissions || DEFAULT_PERMISSIONS;
  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{user.username[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{user.displayName || user.username}</p>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
          <Badge variant="outline" className="text-xs ml-2">
            {enabledCount}/{Object.keys(PERMISSION_LABELS).length} permissions
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="p-3 border-t bg-background">
          <p className="text-xs text-muted-foreground mb-3">Select what this user can do:</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PERMISSION_LABELS) as Array<keyof AccessPermissions>).map((key) => (
              <label 
                key={key}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={permissions[key]}
                  onCheckedChange={(checked) => onUpdatePermission(key, !!checked)}
                  disabled={disabled}
                />
                <div>
                  <p className="text-sm font-medium">{PERMISSION_LABELS[key].label}</p>
                  <p className="text-xs text-muted-foreground">{PERMISSION_LABELS[key].description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function GroupAccessPanel({ groupId, availableRoles }: GroupAccessPanelProps) {
  const [accessData, setAccessData] = useState<GroupAccess | null>(null);
  const [permissions, setPermissions] = useState({
    canManage: false,
    isOwner: false,
    isSiteAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<Array<{
    id: number;
    name: string;
    displayName: string;
  }>>([]);
  const [searching, setSearching] = useState(false);
  const [addingUserType, setAddingUserType] = useState<"access" | "admin" | null>(null);

  // Role selection state
  const [selectedRoleForAccess, setSelectedRoleForAccess] = useState<string>("");
  const [selectedRoleForAdmin, setSelectedRoleForAdmin] = useState<string>("");

  const fetchAccessData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/groups/${groupId}/access`);
      if (response.ok) {
        const data = await response.json();
        setAccessData(data.access);
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error("Error fetching access data:", error);
      toast.error("Failed to load access settings");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchAccessData();
  }, [fetchAccessData]);

  const handleAction = async (action: string, payload: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });

      if (response.ok) {
        const data = await response.json();
        setAccessData(data.access);
        setPermissions(data.permissions);
        toast.success("Access settings updated");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update access settings");
      }
    } catch (error) {
      console.error("Error updating access:", error);
      toast.error("Failed to update access settings");
    } finally {
      setActionLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!userSearchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await fetch(`/api/roblox/users?query=${encodeURIComponent(userSearchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setUserSearchResults(data.data || []);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setSearching(false);
    }
  };

  const addAllowedRole = () => {
    if (!selectedRoleForAccess) return;
    const role = availableRoles.find(r => r.id.toString() === selectedRoleForAccess);
    if (role) {
      handleAction("addAllowedRole", {
        roleId: role.id,
        roleName: role.name,
        rank: role.rank,
      });
      setSelectedRoleForAccess("");
    }
  };

  const addAdminRole = () => {
    if (!selectedRoleForAdmin) return;
    const role = availableRoles.find(r => r.id.toString() === selectedRoleForAdmin);
    if (role) {
      handleAction("addAdminRole", {
        roleId: role.id,
        roleName: role.name,
        rank: role.rank,
      });
      setSelectedRoleForAdmin("");
    }
  };

  const addUser = (user: { id: number; name: string; displayName: string }, type: "access" | "admin") => {
    const action = type === "access" ? "addAllowedUser" : "addAdminUser";
    handleAction(action, {
      robloxId: user.id.toString(),
      username: user.name,
      displayName: user.displayName,
    });
    setUserSearchResults([]);
    setUserSearchQuery("");
    setAddingUserType(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!permissions.canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
        <p className="text-muted-foreground">
          You don&apos;t have permission to manage access settings for this group.
          Only the group owner, site admins, or designated access admins can modify these settings.
        </p>
      </div>
    );
  }

  const canManageAdmins = permissions.isOwner || permissions.isSiteAdmin;

  return (
    <div className="flex flex-col h-full">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-4">
        <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-blue-500 mb-1">About Access Control</p>
          <p className="text-muted-foreground">
            Users with allowed roles or who are individually added can access this group&apos;s management page.
            {canManageAdmins && " You can also designate admins who can manage these access settings."}
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Column - Access Settings */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 h-0 border rounded-lg p-4">
            <div className="space-y-6">
              {/* Allowed Roles Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Allowed Roles
                  </CardTitle>
                  <CardDescription>
                    Members with these roles can access the group management page
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
            {/* Add Role */}
            <div className="flex gap-2">
              <Select value={selectedRoleForAccess} onValueChange={setSelectedRoleForAccess}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a role to add..." />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles
                    .filter(r => !accessData?.allowedRoles.some(ar => ar.roleId === r.id))
                    .map(role => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name} (Rank {role.rank})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={addAllowedRole} 
                disabled={!selectedRoleForAccess || actionLoading}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Role List */}
            {accessData?.allowedRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No roles added yet
              </p>
            ) : (
              <div className="space-y-3">
                {accessData?.allowedRoles.map(role => (
                  <RolePermissionCard
                    key={role.roleId}
                    role={role}
                    onRemove={() => handleAction("removeAllowedRole", { roleId: role.roleId })}
                    onUpdatePermission={(permission, value) => 
                      handleAction("updateRolePermissions", { 
                        roleId: role.roleId, 
                        permissions: { [permission]: value } 
                      })
                    }
                    disabled={actionLoading}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allowed Users Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Allowed Users
            </CardTitle>
            <CardDescription>
              Individual users who can access the group management page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Add User */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for a user..."
                  value={addingUserType === "access" ? userSearchQuery : ""}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setAddingUserType("access");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && addingUserType === "access" && searchUsers()}
                  className="pl-9"
                />
              </div>
              <Button 
                onClick={() => {
                  setAddingUserType("access");
                  searchUsers();
                }}
                disabled={searching || !userSearchQuery.trim()}
                size="sm"
              >
                {searching && addingUserType === "access" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {/* Search Results */}
            {addingUserType === "access" && userSearchResults.length > 0 && (
              <div className="border rounded-lg p-2 space-y-1 bg-background">
                {userSearchResults.slice(0, 5).map(user => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                    onClick={() => addUser(user, "access")}
                  >
                    <div>
                      <p className="text-sm font-medium">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{user.name}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* User List */}
            {accessData?.allowedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users added yet
              </p>
            ) : (
              <div className="space-y-3">
                {accessData?.allowedUsers.map(user => (
                  <UserPermissionCard
                    key={user.robloxId}
                    user={user}
                    onRemove={() => handleAction("removeAllowedUser", { robloxId: user.robloxId })}
                    onUpdatePermission={(permission, value) => 
                      handleAction("updateUserPermissions", { 
                        robloxId: user.robloxId, 
                        permissions: { [permission]: value } 
                      })
                    }
                    disabled={actionLoading}
                  />
                ))}
              </div>
            )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>

        {/* Right Column - Admin Settings (Only visible to owner/site admin) */}
        {canManageAdmins && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Crown className="h-4 w-4" />
              <span>Admin Settings (Owner/Site Admin only)</span>
            </div>
            <ScrollArea className="flex-1 h-0 border rounded-lg p-4">
              <div className="space-y-6">
                {/* Admin Roles Section */}
                <Card>
                  <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Admin Roles
                </CardTitle>
                <CardDescription>
                  Members with these roles can manage access settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Add Admin Role */}
                <div className="flex gap-2">
                  <Select value={selectedRoleForAdmin} onValueChange={setSelectedRoleForAdmin}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a role to add as admin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles
                        .filter(r => !accessData?.adminRoles.some(ar => ar.roleId === r.id))
                        .map(role => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name} (Rank {role.rank})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={addAdminRole} 
                    disabled={!selectedRoleForAdmin || actionLoading}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Admin Role List */}
                {accessData?.adminRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No admin roles added yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {accessData?.adminRoles.map(role => (
                      <div 
                        key={role.roleId}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-amber-500">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {role.roleName}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Rank {role.rank}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleAction("removeAdminRole", { roleId: role.roleId })}
                          disabled={actionLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Users Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Admin Users
                </CardTitle>
                <CardDescription>
                  Individual users who can manage access settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Add Admin User */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search for a user..."
                      value={addingUserType === "admin" ? userSearchQuery : ""}
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value);
                        setAddingUserType("admin");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && addingUserType === "admin" && searchUsers()}
                      className="pl-9"
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      setAddingUserType("admin");
                      searchUsers();
                    }}
                    disabled={searching || !userSearchQuery.trim()}
                    size="sm"
                  >
                    {searching && addingUserType === "admin" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Search"
                    )}
                  </Button>
                </div>

                {/* Search Results */}
                {addingUserType === "admin" && userSearchResults.length > 0 && (
                  <div className="border rounded-lg p-2 space-y-1 bg-background">
                    {userSearchResults.slice(0, 5).map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                        onClick={() => addUser(user, "admin")}
                      >
                        <div>
                          <p className="text-sm font-medium">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">@{user.name}</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Admin User List */}
                {accessData?.adminUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No admin users added yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {accessData?.adminUsers.map(user => (
                      <div 
                        key={user.robloxId}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{user.username[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{user.displayName || user.username}</p>
                              <Badge variant="outline" className="text-amber-500 border-amber-500">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleAction("removeAdminUser", { robloxId: user.robloxId })}
                          disabled={actionLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
        )}
      </div>
    </div>
  );
}
