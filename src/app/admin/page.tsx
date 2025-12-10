"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
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
  ArrowLeft
} from "lucide-react";

const ADMIN_USER_ID = "3857050833";

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

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<PendingBotJoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdmin = session?.user?.robloxId === ADMIN_USER_ID;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && !isAdmin) {
      router.push("/");
    } else if (status === "authenticated" && isAdmin) {
      fetchRequests();
    }
  }, [status, isAdmin, router]);

  async function fetchRequests() {
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
  }

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
        <Button onClick={fetchRequests} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
