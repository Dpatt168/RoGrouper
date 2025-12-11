"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GroupManagementDialog } from "@/components/group-management-dialog";
import { 
  Shield, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Users,
  ArrowLeft,
  Search,
  LogOut,
  Crown,
  Bot,
  Hash,
  Settings,
} from "lucide-react";

const ADMIN_USER_ID = "3857050833";

interface ConnectedGroup {
  groupId: number;
  groupName: string;
  groupIconUrl?: string;
  memberCount: number;
  botRole: {
    id: number;
    name: string;
    rank: number;
  };
  hasChangeRankPermission: boolean;
  owner: {
    id: number;
    name: string;
  } | null;
}

interface BotInfo {
  id: number;
  name: string;
  displayName: string;
}

export default function AdminGroupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<ConnectedGroup[]>([]);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [groupToLeave, setGroupToLeave] = useState<ConnectedGroup | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ConnectedGroup | null>(null);

  const isAdmin = session?.user?.robloxId === ADMIN_USER_ID;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && !isAdmin) {
      router.push("/");
    } else if (status === "authenticated" && isAdmin) {
      fetchGroups();
    }
  }, [status, isAdmin, router]);

  async function fetchGroups() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/groups");
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
        setBotInfo(data.botInfo || null);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLeaveGroup(groupId: number) {
    setActionLoading(groupId);
    try {
      const response = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", groupId }),
      });

      if (response.ok) {
        await fetchGroups();
      } else {
        const error = await response.json();
        alert(`Failed to leave group: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error leaving group:", error);
      alert("Failed to leave group");
    } finally {
      setActionLoading(null);
      setLeaveDialogOpen(false);
      setGroupToLeave(null);
    }
  }

  const filteredGroups = groups.filter((group) =>
    group.groupName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.groupId.toString().includes(searchQuery)
  );

  const readyGroups = filteredGroups.filter((g) => g.hasChangeRankPermission);
  const needsPermissionGroups = filteredGroups.filter((g) => !g.hasChangeRankPermission);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Back button */}
      <Button 
        variant="ghost" 
        className="mb-4 gap-2" 
        onClick={() => router.push("/admin")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin Panel
      </Button>
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Connected Groups</h1>
            <p className="text-muted-foreground">
              Manage all groups where {botInfo?.displayName || "the bot"} is a member
            </p>
          </div>
        </div>
        <Button onClick={fetchGroups} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Bot Info Card */}
      {botInfo && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{botInfo.displayName}</h3>
                <p className="text-sm text-muted-foreground">@{botInfo.name} • ID: {botInfo.id}</p>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold">{groups.length}</p>
                  <p className="text-xs text-muted-foreground">Total Groups</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-500">{readyGroups.length}</p>
                  <p className="text-xs text-muted-foreground">Ready</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-500">{needsPermissionGroups.length}</p>
                  <p className="text-xs text-muted-foreground">Need Permission</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by group name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Groups List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Connected Groups ({filteredGroups.length})
          </CardTitle>
          <CardDescription>
            Groups where the bot is currently a member
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? (
                <>
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No groups match your search</p>
                </>
              ) : (
                <>
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Bot is not in any groups</p>
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredGroups.map((group) => (
                  <Card 
                    key={group.groupId} 
                    className={`border-l-4 ${group.hasChangeRankPermission ? "border-l-green-500" : "border-l-amber-500"}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Group Icon */}
                        <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {group.groupIconUrl ? (
                            <Image
                              src={group.groupIconUrl}
                              alt={group.groupName}
                              width={56}
                              height={56}
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Users className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Group Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{group.groupName}</h3>
                            {group.hasChangeRankPermission ? (
                              <Badge variant="default" className="bg-green-500 gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Ready
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 gap-1">
                                <XCircle className="h-3 w-3" />
                                Needs Permission
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              {group.groupId}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {group.memberCount.toLocaleString()} members
                            </span>
                            {group.owner && (
                              <span className="flex items-center gap-1">
                                <Crown className="h-3 w-3" />
                                {group.owner.name}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-sm">
                            <span className="text-muted-foreground">Bot Role:</span>{" "}
                            <span className="font-medium">{group.botRole.name}</span>
                            <span className="text-muted-foreground ml-1">(Rank {group.botRole.rank})</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {group.hasChangeRankPermission && (
                            <Button
                              variant="default"
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                setSelectedGroup(group);
                                setManageDialogOpen(true);
                              }}
                            >
                              <Settings className="h-3 w-3" />
                              Manage
                            </Button>
                          )}
                          <a
                            href={`https://www.roblox.com/groups/${group.groupId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm" className="gap-1">
                              <ExternalLink className="h-3 w-3" />
                              View
                            </Button>
                          </a>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setGroupToLeave(group);
                              setLeaveDialogOpen(true);
                            }}
                            disabled={actionLoading === group.groupId}
                          >
                            {actionLoading === group.groupId ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <LogOut className="h-3 w-3" />
                            )}
                            Leave
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the bot from{" "}
              <strong>{groupToLeave?.groupName}</strong>? This action cannot be undone
              and the bot will need to be re-invited to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => groupToLeave && handleLeaveGroup(groupToLeave.groupId)}
            >
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group Management Dialog */}
      {selectedGroup && (
        <GroupManagementDialog
          open={manageDialogOpen}
          onOpenChange={setManageDialogOpen}
          group={{
            id: selectedGroup.groupId,
            name: selectedGroup.groupName,
            iconUrl: selectedGroup.groupIconUrl,
          }}
        />
      )}
    </div>
  );
}
