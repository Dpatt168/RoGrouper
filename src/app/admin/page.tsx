"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Shield, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Trash2,
  ExternalLink,
  Users,
  ArrowLeft,
  FolderOpen,
  UserPlus,
  Search,
  Crown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PendingBotJoin {
  id: string;
  groupId: number;
  groupName: string;
  groupIconUrl?: string;
  requestedBy: {
    id: string;
    name: string;
  };
  status: "pending_captcha" | "captcha_completed" | "joined" | "failed";
  createdAt: number;
  updatedAt: number;
  error?: string;
}

interface SiteAdmin {
  robloxId: string;
}

interface SiteAdminWithInfo extends SiteAdmin {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface ActiveUser {
  robloxId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  lastSeen: number;
  currentPage?: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<PendingBotJoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [siteAdmins, setSiteAdmins] = useState<SiteAdminWithInfo[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminSearchResults, setAdminSearchResults] = useState<Array<{ id: number; name: string; displayName: string }>>([]);
  const [searchingAdmin, setSearchingAdmin] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [activeUsersLoading, setActiveUsersLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/pending-joins");
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActiveUsers = useCallback(async () => {
    try {
      setActiveUsersLoading(true);
      const response = await fetch("/api/admin/active-users");
      if (response.ok) {
        const data = await response.json();
        setActiveUsers(data.activeUsers || []);
      }
    } catch (error) {
      console.error("Error fetching active users:", error);
    } finally {
      setActiveUsersLoading(false);
    }
  }, []);

  const fetchSiteAdmins = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/site-admins");
      if (response.ok) {
        const data = await response.json();
        const admins: SiteAdmin[] = data.admins || [];
        
        // Fetch user info for each admin
        const adminsWithInfo: SiteAdminWithInfo[] = await Promise.all(
          admins.map(async (admin) => {
            try {
              const userResponse = await fetch(`/api/roblox/user/${admin.robloxId}`);
              if (userResponse.ok) {
                const userData = await userResponse.json();
                // Get avatar thumbnail
                let avatarUrl: string | undefined;
                try {
                  const avatarRes = await fetch(
                    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${admin.robloxId}&size=150x150&format=Png`
                  );
                  if (avatarRes.ok) {
                    const avatarData = await avatarRes.json();
                    avatarUrl = avatarData.data?.[0]?.imageUrl;
                  }
                } catch {
                  // Ignore avatar fetch errors
                }
                return {
                  ...admin,
                  username: userData.userInfo?.name,
                  displayName: userData.userInfo?.displayName,
                  avatarUrl,
                };
              }
            } catch {
              // Ignore errors fetching user info
            }
            return admin;
          })
        );
        
        setSiteAdmins(adminsWithInfo);
      }
    } catch (error) {
      console.error("Error fetching site admins:", error);
    }
  }, []);

  const searchUsers = async () => {
    if (!adminSearchQuery.trim()) return;
    setSearchingAdmin(true);
    try {
      const response = await fetch(`/api/roblox/users?query=${encodeURIComponent(adminSearchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setAdminSearchResults(data.data || []);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setSearchingAdmin(false);
    }
  };

  const addSiteAdmin = async (user: { id: number; name: string; displayName: string }) => {
    setAdminActionLoading(user.id.toString());
    try {
      const response = await fetch("/api/admin/site-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          robloxId: user.id.toString(),
          username: user.name,
          displayName: user.displayName,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSiteAdmins(data.admins || []);
        setAdminSearchResults([]);
        setAdminSearchQuery("");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add admin");
      }
    } catch (error) {
      console.error("Error adding admin:", error);
    } finally {
      setAdminActionLoading(null);
    }
  };

  const removeSiteAdmin = async (robloxId: string) => {
    if (!confirm("Are you sure you want to remove this site admin?")) return;
    setAdminActionLoading(robloxId);
    try {
      const response = await fetch("/api/admin/site-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", robloxId }),
      });
      if (response.ok) {
        const data = await response.json();
        setSiteAdmins(data.admins || []);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to remove admin");
      }
    } catch (error) {
      console.error("Error removing admin:", error);
    } finally {
      setAdminActionLoading(null);
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/admin/check");
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
          if (data.isAdmin) {
            fetchRequests();
            fetchSiteAdmins();
            fetchActiveUsers();
          }
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };

    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      checkAdmin();
    }
  }, [status, router, fetchRequests]);

  async function handleAction(requestId: string, action: string, error?: string) {
    setActionLoading(requestId);
    try {
      const response = await fetch("/api/admin/pending-joins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action, error }),
      });

      if (response.ok) {
        await fetchRequests();
      }
    } catch (error) {
      console.error("Error performing action:", error);
    } finally {
      setActionLoading(null);
    }
  }

  function getStatusBadge(status: PendingBotJoin["status"]) {
    switch (status) {
      case "pending_captcha":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Captcha Required</Badge>;
      case "captcha_completed":
        return <Badge variant="default" className="gap-1 bg-blue-500"><Clock className="h-3 w-3" />Captcha Done</Badge>;
      case "joined":
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />Joined</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleString();
  }

  function formatTimeSince(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

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
        onClick={() => router.push("/")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Manage bot join requests and captchas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/admin/groups")} variant="outline" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Manage Groups
          </Button>
          <Button onClick={fetchRequests} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pending Bot Join Requests
          </CardTitle>
          <CardDescription>
            Requests that need manual captcha completion or verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending requests</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card key={request.id} className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{request.groupName}</h3>
                            {getStatusBadge(request.status)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Group ID:</span>{" "}
                              <code className="bg-muted px-1.5 py-0.5 rounded">{request.groupId}</code>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Requested by:</span>{" "}
                              <span className="font-medium">{request.requestedBy.name}</span>
                              <span className="text-muted-foreground ml-1">({request.requestedBy.id})</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Created:</span>{" "}
                              {formatDate(request.createdAt)}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Updated:</span>{" "}
                              {formatDate(request.updatedAt)}
                            </div>
                          </div>

                          {request.error && (
                            <div className="bg-destructive/10 text-destructive text-sm p-2 rounded mt-2">
                              <strong>Error:</strong> {request.error}
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-2">
                            <a
                              href={`https://www.roblox.com/groups/${request.groupId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open Group on Roblox
                            </a>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 min-w-[160px]">
                          {request.status === "pending_captcha" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleAction(request.id, "mark_captcha_completed")}
                                disabled={actionLoading === request.id}
                                className="gap-1"
                              >
                                {actionLoading === request.id ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3 w-3" />
                                )}
                                Captcha Done
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(request.id, "mark_failed", "Manual rejection")}
                                disabled={actionLoading === request.id}
                                className="gap-1"
                              >
                                <XCircle className="h-3 w-3" />
                                Mark Failed
                              </Button>
                            </>
                          )}

                          {request.status === "captcha_completed" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1 bg-green-600 hover:bg-green-700"
                                onClick={() => handleAction(request.id, "mark_joined")}
                                disabled={actionLoading === request.id}
                              >
                                {actionLoading === request.id ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3 w-3" />
                                )}
                                Mark Joined
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(request.id, "mark_failed", "Failed to join after captcha")}
                                disabled={actionLoading === request.id}
                                className="gap-1"
                              >
                                <XCircle className="h-3 w-3" />
                                Mark Failed
                              </Button>
                            </>
                          )}

                          {(request.status === "joined" || request.status === "failed") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(request.id, "delete")}
                              disabled={actionLoading === request.id}
                              className="gap-1 text-destructive hover:text-destructive"
                            >
                              {actionLoading === request.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              Delete
                            </Button>
                          )}
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

      {/* Site Admins Management */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Site Administrators
          </CardTitle>
          <CardDescription>
            Manage users who have full administrative access to this site
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Admin Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for a user to add as admin..."
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                className="pl-9"
              />
            </div>
            <Button onClick={searchUsers} disabled={searchingAdmin || !adminSearchQuery.trim()}>
              {searchingAdmin ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>

          {/* Search Results */}
          {adminSearchResults.length > 0 && (
            <div className="border rounded-lg p-2 space-y-1 bg-muted/30">
              <p className="text-xs text-muted-foreground px-2 mb-2">Search Results</p>
              {adminSearchResults.slice(0, 5).map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 hover:bg-background rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{user.name}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addSiteAdmin(user)}
                    disabled={adminActionLoading === user.id.toString() || siteAdmins.some(a => a.robloxId === user.id.toString())}
                  >
                    {adminActionLoading === user.id.toString() ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : siteAdmins.some(a => a.robloxId === user.id.toString()) ? (
                      "Already Admin"
                    ) : (
                      "Add Admin"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Current Admins List */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Current Site Admins ({siteAdmins.length})</p>
            {siteAdmins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No site admins configured</p>
            ) : (
              <div className="space-y-2">
                {siteAdmins.map((admin) => (
                  <div
                    key={admin.robloxId}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={admin.avatarUrl} alt={admin.username || admin.robloxId} />
                        <AvatarFallback>{admin.username?.[0] || admin.robloxId[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{admin.displayName || admin.username || admin.robloxId}</p>
                          <Badge variant="secondary" className="text-xs">
                            <Crown className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{admin.username ? `@${admin.username}` : `ID: ${admin.robloxId}`}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSiteAdmin(admin.robloxId)}
                      disabled={adminActionLoading === admin.robloxId || admin.robloxId === session?.user?.robloxId}
                      className="text-destructive hover:text-destructive"
                    >
                      {adminActionLoading === admin.robloxId ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Users */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                Active Users
                <Badge variant="secondary" className="ml-2">
                  {activeUsers.length} online
                </Badge>
              </CardTitle>
              <CardDescription>
                Users currently browsing the site (updates every 5 minutes)
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchActiveUsers}
              disabled={activeUsersLoading}
            >
              <RefreshCw className={`h-4 w-4 ${activeUsersLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeUsersLoading && activeUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading active users...</p>
            </div>
          ) : activeUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active users at the moment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeUsers.map((user) => (
                <div
                  key={user.robloxId}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl} alt={user.username} />
                        <AvatarFallback>{user.username[0]}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                    </div>
                    <div>
                      <p className="font-medium">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {user.currentPage || "Dashboard"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeSince(user.lastSeen)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-1">When a request shows "Captcha Required":</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Click "Open Group on Roblox" to go to the group page</li>
              <li>Log into the bot account in your browser</li>
              <li>Manually request to join the group and complete any captcha</li>
              <li>Come back here and click "Captcha Done"</li>
            </ol>
          </div>
          <div>
            <h4 className="font-semibold mb-1">After marking "Captcha Done":</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>The user will see that the request is being processed</li>
              <li>Once the group owner accepts the join request, click "Mark Joined"</li>
              <li>The user can then verify and the group will be unlocked</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
