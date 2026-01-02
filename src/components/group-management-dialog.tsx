"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, UserMinus, Users, Loader2, ChevronDown, Settings, Plus, Minus, ShieldBan, Clock, ClipboardList, FolderTree, Award, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { AutomationPanel, Rule, UserPoints, SuspendedRole, Suspension } from "./automation-panel";
import { AuditLogPanel } from "./audit-log-panel";
import { SubGroupsPanel } from "./sub-groups-panel";
import { AwardsPanel } from "./awards-panel";
import { GroupAccessPanel } from "./group-access-panel";
import { UserProfileDialog } from "./user-profile-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { SuspendDialog } from "./suspend-dialog";

interface SubGroup {
  id: string;
  name: string;
  color: string;
  rules: Array<{
    id: string;
    points: number;
    roleId: number;
    roleName: string;
  }>;
  excludeFromGeneralAutomation?: boolean;
}

interface Role {
  id: number;
  name: string;
  rank: number;
  memberCount?: number;
}

interface Member {
  user: {
    userId: number;
    username: string;
    displayName: string;
  };
  role: Role;
}

interface SearchedUser {
  id: number;
  name: string;
  displayName: string;
  inGroup: boolean;
  role: Role | null;
}

// Cache for avatar URLs
const avatarCache = new Map<number, string>();

async function fetchAvatarUrls(userIds: number[]): Promise<Map<number, string>> {
  const uncachedIds = userIds.filter((id) => !avatarCache.has(id));
  
  if (uncachedIds.length > 0) {
    try {
      const response = await fetch(`/api/users/avatars?userIds=${uncachedIds.join(",")}`);
      if (response.ok) {
        const data = await response.json();
        data.data?.forEach((item: { targetId: number; imageUrl: string; state: string }) => {
          if (item.state === "Completed" && item.imageUrl) {
            avatarCache.set(item.targetId, item.imageUrl);
          }
        });
      }
    } catch (error) {
      console.error("Error fetching avatars:", error);
    }
  }

  const result = new Map<number, string>();
  userIds.forEach((id) => {
    const url = avatarCache.get(id);
    if (url) result.set(id, url);
  });
  return result;
}

interface GroupManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: {
    id: number;
    name: string;
    iconUrl?: string | null;
  };
  isAdminMode?: boolean; // When true, allows changing own rank
}

export function GroupManagementDialog({
  open,
  onOpenChange,
  group,
  isAdminMode = false,
}: GroupManagementDialogProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.robloxId ? parseInt(session.user.robloxId) : null;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [botRank, setBotRank] = useState<number>(255);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [avatarUrls, setAvatarUrls] = useState<Map<number, string>>(new Map());
  const [kickConfirm, setKickConfirm] = useState<{ userId: number; username: string } | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [userPoints, setUserPoints] = useState<UserPoints[]>([]);
  const [suspendedRole, setSuspendedRole] = useState<SuspendedRole | undefined>();
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [suspendTarget, setSuspendTarget] = useState<{ userId: number; username: string; roleId: number; roleName: string } | null>(null);
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<{ userId: number; username: string; newRoleId: string } | null>(null);
  const [demotionConfirm, setDemotionConfirm] = useState<{ 
    userId: number; 
    username: string; 
    currentRoleName: string; 
    newRoleName: string; 
    newRoleId: number;
    newPoints: number;
  } | null>(null);
  const [subGroups, setSubGroups] = useState<SubGroup[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<{
    userId: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
  } | null>(null);
  const [userAwardsMap, setUserAwardsMap] = useState<Map<number, Array<{ icon: string; name: string }>>>(new Map());
  const [userPermissions, setUserPermissions] = useState({
    canKick: true,
    canSuspend: true,
    canChangeRole: true,
    canManagePoints: true,
    canManageDivisions: true,
    canViewAuditLog: true,
    canManageAutomation: true,
    canManageAwards: true,
  });
  const [isFullAccess, setIsFullAccess] = useState(true);
  const [userRank, setUserRank] = useState<number>(255); // Default to max rank, will be updated

  // Fetch user permissions for this group
  useEffect(() => {
    if (!open) return;
    
    const fetchPermissions = async () => {
      try {
        const response = await fetch(`/api/groups/${group.id}/access`);
        if (response.ok) {
          const data = await response.json();
          if (data.userPermissions) {
            setUserPermissions(data.userPermissions);
            // Set default tab based on first available permission
            if (!activeTab) {
              if (data.userPermissions.canManageAutomation) setActiveTab("automation");
              else if (data.userPermissions.canManageDivisions) setActiveTab("subgroups");
              else if (data.userPermissions.canManageAwards) setActiveTab("awards");
              else if (data.isFullAccess) setActiveTab("access");
              else if (data.userPermissions.canViewAuditLog) setActiveTab("audit");
            }
          }
          setIsFullAccess(data.isFullAccess ?? true);
          // Set user's rank if provided
          if (data.userRank !== undefined) {
            setUserRank(data.userRank);
          }
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
      }
    };
    
    fetchPermissions();
  }, [open, group.id, activeTab]);

  // Fetch awards for the group
  useEffect(() => {
    if (!open) return;
    
    const fetchAwards = async () => {
      try {
        const response = await fetch(`/api/awards?scopeType=group&scopeId=${group.id}`);
        if (response.ok) {
          const data = await response.json();
          const awardsMap = new Map<number, Array<{ icon: string; name: string }>>();
          for (const ua of data.userAwards || []) {
            const existing = awardsMap.get(ua.userId) || [];
            existing.push({ icon: ua.awardIcon, name: ua.awardName });
            awardsMap.set(ua.userId, existing);
          }
          setUserAwardsMap(awardsMap);
        }
      } catch (error) {
        console.error("Error fetching awards:", error);
      }
    };
    
    fetchAwards();
  }, [open, group.id]);

  // Helper to log audit events
  const logAuditEvent = useCallback(async (
    logAction: string,
    targetUser?: { userId: number; username: string },
    details?: Record<string, unknown>
  ) => {
    try {
      await fetch(`/api/groups/${group.id}/audit-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log",
          logAction,
          targetUser,
          details,
          groupName: group.name,
        }),
      });
    } catch (error) {
      console.error("Error logging audit event:", error);
    }
  }, [group.id, group.name]);

  const fetchBotRole = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${group.id}/bot-role`);
      if (response.ok) {
        const data = await response.json();
        setBotRank(data.rank || 0);
      }
    } catch (error) {
      console.error("Error fetching bot role:", error);
    }
  }, [group.id]);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${group.id}/roles`);
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  }, [group.id]);

  const fetchMembers = useCallback(async (newCursor?: string) => {
    if (newCursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `/api/groups/${group.id}/members?limit=50${newCursor ? `&cursor=${newCursor}` : ""}`
      );
      if (response.ok) {
        const data = await response.json();
        const newMembers = data.data || [];
        if (newCursor) {
          setMembers((prev) => [...prev, ...newMembers]);
        } else {
          setMembers(newMembers);
        }
        setCursor(data.nextPageCursor || null);

        // Fetch avatars for new members
        const userIds = newMembers.map((m: Member) => m.user.userId);
        const avatars = await fetchAvatarUrls(userIds);
        setAvatarUrls((prev) => new Map([...prev, ...avatars]));
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [group.id]);

  // Fetch sub-groups data for member badges
  const fetchSubGroups = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${group.id}/automation`);
      if (response.ok) {
        const data = await response.json();
        setSubGroups(data.subGroups || []);
        setUserPoints(data.userPoints || []);
      }
    } catch (error) {
      console.error("Error fetching sub-groups:", error);
    }
  }, [group.id]);

  useEffect(() => {
    if (open) {
      fetchBotRole();
      fetchRoles();
      fetchMembers();
      fetchSubGroups();
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open, fetchBotRole, fetchRoles, fetchMembers, fetchSubGroups]);

  // Filter members based on search query (partial match on username or display name)
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase().trim();
    return members.filter(
      (member) =>
        member.user.username.toLowerCase().includes(query) ||
        member.user.displayName.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const handleRoleChange = async (userId: number, roleId: string, skipSuspensionCheck = false) => {
    // Check if user is suspended and show confirmation
    const suspension = getUserSuspension(userId);
    if (suspension && !skipSuspensionCheck) {
      const member = members.find((m) => m.user.userId === userId);
      setRoleChangeConfirm({ userId, username: member?.user.username || "", newRoleId: roleId });
      return;
    }

    setActionLoading(userId);
    try {
      const response = await fetch(`/api/groups/${group.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: parseInt(roleId) }),
      });

      if (response.ok) {
        // Get the role name for logging
        const newRole = roles.find(r => r.id === parseInt(roleId));
        const member = members.find(m => m.user.userId === userId);
        const username = member?.user.username || "Unknown";

        // Log the role change
        await logAuditEvent("role_change", 
          { userId, username },
          { newRoleId: parseInt(roleId), newRoleName: newRole?.name || "Unknown" }
        );

        // If user was suspended, remove the suspension
        if (suspension) {
          await fetch(`/api/groups/${group.id}/automation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "unsuspendUser",
              userId,
            }),
          }).then(res => res.json()).then(data => {
            setSuspensions(data.suspensions || []);
          });
        }
        toast.success("Role updated successfully");
        // Refresh members list
        await fetchMembers();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    } finally {
      setActionLoading(null);
    }
  };

  const confirmKick = (userId: number, username: string) => {
    setKickConfirm({ userId, username });
  };

  const getUserSuspension = (userId: number) => {
    return suspensions.find((s) => s.userId === userId);
  };

  const formatTimeRemaining = (expiresAt: number) => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return "Expired";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleSuspend = async (userId: number, username: string, roleId: number, roleName: string, durationMs: number) => {
    if (!suspendedRole) return;

    setActionLoading(userId);
    try {
      // First, change the user's role to the suspended role
      const roleResponse = await fetch(`/api/groups/${group.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: suspendedRole.roleId }),
      });

      if (!roleResponse.ok) {
        toast.error("Failed to apply suspended role");
        return;
      }

      // Then, record the suspension
      const response = await fetch(`/api/groups/${group.id}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suspendUser",
          userId,
          username,
          previousRoleId: roleId,
          previousRoleName: roleName,
          durationMs,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuspensions(data.suspensions || []);

        // Format duration for logging
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        const durationStr = days > 0 ? `${days} day(s)` : `${hours} hour(s)`;

        // Log the suspension
        await logAuditEvent("user_suspend", 
          { userId, username },
          { duration: durationStr, previousRole: roleName }
        );

        toast.success(`${username} has been suspended`);
        fetchMembers();
      } else {
        toast.error("Failed to record suspension");
      }
    } catch (error) {
      console.error("Error suspending user:", error);
      toast.error("Failed to suspend user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (userId: number, username: string, previousRoleId: number) => {
    setActionLoading(userId);
    try {
      // First, restore the user's previous role
      const roleResponse = await fetch(`/api/groups/${group.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: previousRoleId }),
      });

      if (!roleResponse.ok) {
        toast.error("Failed to restore role");
        return;
      }

      // Then, remove the suspension record
      const response = await fetch(`/api/groups/${group.id}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unsuspendUser",
          userId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuspensions(data.suspensions || []);

        // Log the unsuspension
        await logAuditEvent("user_unsuspend", { userId, username }, {});

        toast.success(`${username}'s suspension has been lifted`);
        fetchMembers();
      } else {
        toast.error("Failed to remove suspension record");
      }
    } catch (error) {
      console.error("Error unsuspending user:", error);
      toast.error("Failed to unsuspend user");
    } finally {
      setActionLoading(null);
    }
  };

  // Check for expired suspensions periodically
  useEffect(() => {
    if (!open || suspensions.length === 0) return;

    const checkExpiredSuspensions = async () => {
      const now = Date.now();
      const expired = suspensions.filter((s) => s.expiresAt <= now);
      
      for (const suspension of expired) {
        await handleUnsuspend(suspension.userId, suspension.username, suspension.previousRoleId);
      }
    };

    // Check immediately and then every 30 seconds
    checkExpiredSuspensions();
    const interval = setInterval(checkExpiredSuspensions, 30000);
    
    return () => clearInterval(interval);
  }, [open, suspensions]);

  const getUserPoints = (userId: number) => {
    return userPoints.find((u) => u.userId === userId)?.points || 0;
  };

  const getUserSubGroup = (userId: number): SubGroup | undefined => {
    const user = userPoints.find((u) => u.userId === userId);
    if (!user?.subGroupId) return undefined;
    return subGroups.find((sg) => sg.id === user.subGroupId);
  };

  const checkAndApplyRules = async (userId: number, username: string, newPoints: number, skipDemotionCheck = false) => {
    // Don't auto-promote if user is suspended
    if (getUserSuspension(userId)) return;

    // Check if user is in a sub-group and use sub-group rules if so
    const userPointsEntry = userPoints.find((u) => u.userId === userId);
    const userSubGroupId = userPointsEntry?.subGroupId;
    
    let matchingRule: { roleId: number; roleName: string; points: number } | undefined;
    let subGroup: SubGroup | undefined;
    
    if (userSubGroupId) {
      // User is in a sub-group - sub-group rules always take priority
      subGroup = subGroups.find((sg) => sg.id === userSubGroupId);
      if (subGroup && subGroup.rules.length > 0) {
        matchingRule = subGroup.rules
          .filter((r) => newPoints >= r.points)
          .sort((a, b) => b.points - a.points)[0];
      }
    }
    
    // Fall back to global rules only if:
    // 1. User is not in a sub-group, OR
    // 2. No sub-group rule matched AND sub-group doesn't exclude from general automation
    if (!matchingRule && (!subGroup || !subGroup.excludeFromGeneralAutomation)) {
      matchingRule = rules
        .filter((r) => newPoints >= r.points)
        .sort((a, b) => b.points - a.points)[0];
    }

    if (!matchingRule) return;

    const member = members.find((m) => m.user.userId === userId);
    if (!member || member.role.id === matchingRule.roleId) return;

    // Check if this is a demotion (new role has lower rank)
    const currentRole = roles.find(r => r.id === member.role.id);
    const newRole = roles.find(r => r.id === matchingRule.roleId);
    
    if (currentRole && newRole && newRole.rank < currentRole.rank && !skipDemotionCheck) {
      // This is a demotion - ask for confirmation
      setDemotionConfirm({
        userId,
        username,
        currentRoleName: currentRole.name,
        newRoleName: newRole.name,
        newRoleId: matchingRule.roleId,
        newPoints,
      });
      return;
    }

    try {
      const response = await fetch(`/api/groups/${group.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: matchingRule.roleId }),
      });

      if (response.ok) {
        toast.success(`${username}'s role updated to ${matchingRule.roleName}!`);
        fetchMembers();
      }
    } catch (error) {
      console.error("Error applying rule:", error);
    }
  };

  const applyDemotion = async () => {
    if (!demotionConfirm) return;

    const { userId, username, newRoleId, newRoleName } = demotionConfirm;
    setDemotionConfirm(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: newRoleId }),
      });

      if (response.ok) {
        // Log the role change
        await logAuditEvent("role_change", 
          { userId, username },
          { newRoleId, newRoleName }
        );
        toast.success(`${username}'s role updated to ${newRoleName}!`);
        fetchMembers();
      }
    } catch (error) {
      console.error("Error applying demotion:", error);
      toast.error("Failed to apply demotion");
    }
  };

  const handleUpdatePoints = async (userId: number, username: string, delta: number) => {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/groups/${group.id}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePoints",
          userId,
          username,
          pointsDelta: delta,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserPoints(data.userPoints);
        const newPoints = getUserPoints(userId) + delta;

        // Log the points change
        await logAuditEvent(
          delta > 0 ? "points_add" : "points_remove",
          { userId, username },
          { points: Math.abs(delta), newTotal: newPoints }
        );

        await checkAndApplyRules(userId, username, newPoints);
        toast.success(`${delta > 0 ? "Added" : "Removed"} 1 point`);
      }
    } catch (error) {
      console.error("Error updating points:", error);
      toast.error("Failed to update points");
    } finally {
      setActionLoading(null);
    }
  };

  const handleKick = async () => {
    if (!kickConfirm) return;
    
    const { userId, username } = kickConfirm;
    setKickConfirm(null);
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/groups/${group.id}/members/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Log the kick
        await logAuditEvent("user_kick", { userId, username }, {});

        toast.success(`${username} has been kicked from the group`);
        // Remove from members list
        setMembers((prev) =>
          prev.filter((m) => m.user.userId !== userId)
        );
        // Update search results
        setSearchResults((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, inGroup: false, role: null } : u
          )
        );
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to kick user");
      }
    } catch (error) {
      console.error("Error kicking user:", error);
      toast.error("Failed to kick user");
    } finally {
      setActionLoading(null);
    }
  };

  // Filter roles to only show those below bot's rank AND below user's rank (unless full access)
  const availableRoles = roles
    .filter((role) => {
      // Must be below bot's rank and above Guest (rank 0)
      if (role.rank >= botRank || role.rank <= 0) return false;
      // If user has full access (site admin/owner), show all roles below bot
      if (isFullAccess) return true;
      // Otherwise, only show roles below user's rank
      return role.rank < userRank;
    })
    .sort((a, b) => b.rank - a.rank);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px]! w-[90vw] h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={group.iconUrl || undefined} alt={group.name} />
              <AvatarFallback className="rounded-lg">
                <Users className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            Manage {group.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
          {/* Left Panel - Members (hidden when sub-groups or access tab is active) */}
          <div 
            className={`flex flex-col min-w-0 space-y-4 transition-all duration-300 ease-in-out ${
              activeTab === "subgroups" || activeTab === "access"
                ? "w-0 opacity-0 overflow-hidden" 
                : "flex-1 opacity-100"
            }`}
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Members List */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <h4 className="text-sm font-medium mb-2 shrink-0">
                {searchQuery.trim() 
                  ? `Showing ${filteredMembers.length} of ${members.length} members`
                  : `Group Members (${members.length}${cursor ? "+" : ""})`}
              </h4>
              <ScrollArea className="flex-1 border rounded-lg h-0">
                {loading ? (
                  <div className="p-3 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-8 w-[140px]" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.user.userId}
                        className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md"
                      >
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedUser({
                            userId: member.user.userId,
                            username: member.user.username,
                            displayName: member.user.displayName,
                            avatarUrl: avatarUrls.get(member.user.userId),
                          })}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={avatarUrls.get(member.user.userId)}
                              alt={member.user.username}
                            />
                            <AvatarFallback>{member.user.username[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{member.user.displayName}</p>
                              {getUserSubGroup(member.user.userId) && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] px-1.5 py-0"
                                  style={{ 
                                    borderColor: getUserSubGroup(member.user.userId)!.color,
                                    color: getUserSubGroup(member.user.userId)!.color 
                                  }}
                                >
                                  {getUserSubGroup(member.user.userId)!.name}
                                </Badge>
                              )}
                              {/* User Awards */}
                              {userAwardsMap.get(member.user.userId)?.slice(0, 3).map((award, idx) => (
                                <span 
                                  key={idx} 
                                  className="text-sm" 
                                  title={award.name}
                                >
                                  {award.icon}
                                </span>
                              ))}
                              {(userAwardsMap.get(member.user.userId)?.length || 0) > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{(userAwardsMap.get(member.user.userId)?.length || 0) - 3}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">@{member.user.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Suspension Status */}
                          {getUserSuspension(member.user.userId) && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeRemaining(getUserSuspension(member.user.userId)!.expiresAt)}
                            </Badge>
                          )}
                          {/* All action controls - hidden for current user unless in admin mode */}
                          {(member.user.userId !== currentUserId || isAdminMode) && (
                            <>
                              {/* Points Controls */}
                              {userPermissions.canManagePoints && (
                                <div className="flex items-center gap-1 mr-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleUpdatePoints(member.user.userId, member.user.username, -1)}
                                    disabled={actionLoading === member.user.userId}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center text-sm font-medium">
                                    {getUserPoints(member.user.userId)}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleUpdatePoints(member.user.userId, member.user.username, 1)}
                                    disabled={actionLoading === member.user.userId}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              {userPermissions.canChangeRole && (
                                <Select
                                  value={member.role.id.toString()}
                                  onValueChange={(value) => handleRoleChange(member.user.userId, value)}
                                  disabled={actionLoading === member.user.userId}
                                >
                                  <SelectTrigger className="w-[120px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableRoles.map((role) => (
                                      <SelectItem key={role.id} value={role.id.toString()}>
                                        {role.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {/* Suspend/Unsuspend Button */}
                              {userPermissions.canSuspend && suspendedRole && (
                                getUserSuspension(member.user.userId) ? (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      const suspension = getUserSuspension(member.user.userId)!;
                                      handleUnsuspend(member.user.userId, member.user.username, suspension.previousRoleId);
                                    }}
                                    disabled={actionLoading === member.user.userId}
                                    title="Lift suspension"
                                  >
                                    {actionLoading === member.user.userId ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <ShieldBan className="h-4 w-4 text-green-500" />
                                    )}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setSuspendTarget({
                                      userId: member.user.userId,
                                      username: member.user.username,
                                      roleId: member.role.id,
                                      roleName: member.role.name,
                                    })}
                                    disabled={actionLoading === member.user.userId}
                                    title="Suspend user"
                                  >
                                    <ShieldBan className="h-4 w-4 text-destructive" />
                                  </Button>
                                )
                              )}
                              {/* Kick button */}
                              {userPermissions.canKick && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => confirmKick(member.user.userId, member.user.username)}
                                  disabled={actionLoading === member.user.userId}
                                >
                                  {actionLoading === member.user.userId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <UserMinus className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    {cursor ? (
                      <Button
                        variant="ghost"
                        className="w-full mt-2"
                        onClick={() => fetchMembers(cursor)}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        )}
                        Load more
                      </Button>
                    ) : members.length > 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-2">
                        All members loaded
                      </p>
                    ) : null}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Right Panel - Automation, Sub-Groups, Access & Audit Log */}
          <div 
            className={`shrink-0 border-l pl-4 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
              activeTab === "subgroups" || activeTab === "access" ? "flex-1" : "w-[450px]"
            }`}
          >
            <Tabs 
              defaultValue="automation" 
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="grid w-full grid-cols-5 mb-4">
                {userPermissions.canManageAutomation && (
                  <TabsTrigger value="automation" className="flex items-center gap-1 text-xs">
                    <Settings className="h-3 w-3" />
                    Automation
                  </TabsTrigger>
                )}
                {userPermissions.canManageDivisions && (
                  <TabsTrigger value="subgroups" className="flex items-center gap-1 text-xs">
                    <FolderTree className="h-3 w-3" />
                    Sub-Groups
                  </TabsTrigger>
                )}
                {userPermissions.canManageAwards && (
                  <TabsTrigger value="awards" className="flex items-center gap-1 text-xs">
                    <Award className="h-3 w-3" />
                    Awards
                  </TabsTrigger>
                )}
                {isFullAccess && (
                  <TabsTrigger value="access" className="flex items-center gap-1 text-xs">
                    <KeyRound className="h-3 w-3" />
                    Access
                  </TabsTrigger>
                )}
                {userPermissions.canViewAuditLog && (
                  <TabsTrigger value="audit" className="flex items-center gap-1 text-xs">
                    <ClipboardList className="h-3 w-3" />
                    Audit Log
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="automation" className="flex-1 min-h-0 mt-0">
                <AutomationPanel 
                  groupId={group.id} 
                  availableRoles={availableRoles} 
                  onDataLoad={(newRules, newPoints, newSuspendedRole, newSuspensions) => {
                    setRules(newRules);
                    setUserPoints(newPoints);
                    setSuspendedRole(newSuspendedRole);
                    setSuspensions(newSuspensions || []);
                  }}
                />
              </TabsContent>

              <TabsContent value="subgroups" className="flex-1 min-h-0 mt-0">
                <SubGroupsPanel
                  groupId={group.id}
                  availableRoles={availableRoles}
                  members={members}
                  onSubGroupsChange={(newSubGroups, newUserPoints) => {
                    setSubGroups(newSubGroups);
                    setUserPoints(newUserPoints);
                  }}
                />
              </TabsContent>

              <TabsContent value="awards" className="flex-1 min-h-0 mt-0">
                <AwardsPanel
                  scopeType="group"
                  scopeId={group.id}
                  scopeName={group.name}
                  members={members}
                />
              </TabsContent>

              <TabsContent value="access" className="flex-1 min-h-0 mt-0">
                <GroupAccessPanel
                  groupId={group.id}
                  availableRoles={roles}
                />
              </TabsContent>

              <TabsContent value="audit" className="flex-1 min-h-0 mt-0">
                <AuditLogPanel groupId={group.id.toString()} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>

      <UserProfileDialog
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        userId={selectedUser?.userId || 0}
        username={selectedUser?.username || ""}
        displayName={selectedUser?.displayName || ""}
        avatarUrl={selectedUser?.avatarUrl}
        currentGroupId={group.id}
      />

      <ConfirmDialog
        open={!!kickConfirm}
        onOpenChange={(open) => !open && setKickConfirm(null)}
        title="Kick Member"
        description={`Are you sure you want to kick ${kickConfirm?.username} from the group? This action cannot be undone.`}
        confirmText="Kick"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleKick}
      />

      <SuspendDialog
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        username={suspendTarget?.username || ""}
        onConfirm={async (durationMs) => {
          if (suspendTarget) {
            await handleSuspend(
              suspendTarget.userId,
              suspendTarget.username,
              suspendTarget.roleId,
              suspendTarget.roleName,
              durationMs
            );
          }
        }}
      />

      <ConfirmDialog
        open={!!roleChangeConfirm}
        onOpenChange={(open) => !open && setRoleChangeConfirm(null)}
        title="Remove Suspension?"
        description={`Changing ${roleChangeConfirm?.username}'s role will remove their suspension. Are you sure?`}
        confirmText="Continue"
        cancelText="Cancel"
        variant="default"
        onConfirm={() => {
          if (roleChangeConfirm) {
            handleRoleChange(roleChangeConfirm.userId, roleChangeConfirm.newRoleId, true);
            setRoleChangeConfirm(null);
          }
        }}
      />

      <ConfirmDialog
        open={!!demotionConfirm}
        onOpenChange={(open) => !open && setDemotionConfirm(null)}
        title="Confirm Demotion"
        description={`${demotionConfirm?.username} will be demoted from ${demotionConfirm?.currentRoleName} to ${demotionConfirm?.newRoleName}. Do you want to change their rank?`}
        confirmText="Demote"
        cancelText="Keep Current Rank"
        variant="destructive"
        onConfirm={applyDemotion}
      />
    </Dialog>
  );
}
