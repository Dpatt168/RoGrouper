"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Calendar, 
  Award, 
  Users, 
  Building2,
  ExternalLink,
  Trophy
} from "lucide-react";

interface UserAward {
  id: string;
  awardId: string;
  awardName: string;
  awardIcon: string;
  awardColor: string;
  userId: number;
  username: string;
  awardedAt: number;
  awardedBy: string;
  reason?: string;
}

interface RobloxUserInfo {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  isBanned: boolean;
  hasVerifiedBadge: boolean;
}

interface UserGroup {
  group: {
    id: number;
    name: string;
    memberCount: number;
  };
  role: {
    id: number;
    name: string;
    rank: number;
  };
}

interface Organization {
  id: string;
  name: string;
  groups: Array<{
    id: number;
    name: string;
  }>;
}

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  currentGroupId: number;
}

export function UserProfileDialog({
  open,
  onOpenChange,
  userId,
  username,
  displayName,
  avatarUrl,
  currentGroupId,
}: UserProfileDialogProps) {
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<RobloxUserInfo | null>(null);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [userAwards, setUserAwards] = useState<UserAward[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [relatedGroups, setRelatedGroups] = useState<UserGroup[]>([]);

  const fetchUserData = useCallback(async () => {
    if (!open || !userId) return;
    
    setLoading(true);
    try {
      // Fetch user info and groups from our API (to avoid CORS)
      const [robloxDataRes, awardsRes, orgsRes] = await Promise.all([
        fetch(`/api/roblox/user/${userId}`),
        fetch(`/api/awards?userId=${userId}`),
        fetch("/api/organizations"),
      ]);

      if (robloxDataRes.ok) {
        const robloxData = await robloxDataRes.json();
        console.log("Roblox data:", robloxData);
        setUserInfo(robloxData.userInfo || null);
        setUserGroups(robloxData.userGroups || []);
      } else {
        console.error("Failed to fetch Roblox data:", robloxDataRes.status);
      }

      if (awardsRes.ok) {
        const awards = await awardsRes.json();
        console.log("Awards data:", awards);
        setUserAwards(awards.userAwards || []);
      } else {
        console.error("Failed to fetch awards:", awardsRes.status);
      }

      if (orgsRes.ok) {
        const orgs = await orgsRes.json();
        setOrganizations(orgs.organizations || []);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  }, [open, userId]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Find groups that are part of organizations
  useEffect(() => {
    if (userGroups.length === 0 || organizations.length === 0) {
      setRelatedGroups([]);
      return;
    }

    const orgGroupIds = new Set<number>();
    organizations.forEach((org) => {
      org.groups.forEach((g) => orgGroupIds.add(g.id));
    });

    const related = userGroups.filter((ug) => orgGroupIds.has(ug.group.id));
    setRelatedGroups(related);
  }, [userGroups, organizations]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getAccountAge = (created: string) => {
    const createdDate = new Date(created);
    const now = new Date();
    const years = Math.floor((now.getTime() - createdDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (years < 1) {
      const months = Math.floor((now.getTime() - createdDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
      return `${months} month${months !== 1 ? "s" : ""}`;
    }
    return `${years} year${years !== 1 ? "s" : ""}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* User Header */}
            <div className="flex items-start gap-4 pb-4 border-b">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl} alt={username} />
                <AvatarFallback className="text-2xl">
                  {username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{displayName}</h2>
                  {userInfo?.hasVerifiedBadge && (
                    <Badge variant="secondary" className="text-xs">
                      ✓ Verified
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">@{username}</p>
                
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {userInfo ? formatDate(userInfo.created) : "Unknown"}</span>
                  </div>
                  {userInfo && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{getAccountAge(userInfo.created)} old</span>
                    </div>
                  )}
                  <a
                    href={`https://www.roblox.com/users/${userId}/profile`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Roblox
                  </a>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="awards" className="flex-1 flex flex-col mt-4 min-h-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="awards" className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  Awards ({userAwards.length})
                </TabsTrigger>
                <TabsTrigger value="groups" className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Groups ({userGroups.length})
                </TabsTrigger>
                <TabsTrigger value="organizations" className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  Organizations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="awards" className="flex-1 mt-4 min-h-0">
                <ScrollArea className="h-[300px]">
                  {userAwards.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No awards yet</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 pr-4">
                      {userAwards.map((award) => (
                        <Card key={award.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <span
                                className="text-3xl"
                                style={{ filter: `drop-shadow(0 0 6px ${award.awardColor})` }}
                              >
                                {award.awardIcon}
                              </span>
                              <div className="flex-1">
                                <h4 className="font-medium">{award.awardName}</h4>
                                {award.reason && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    "{award.reason}"
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  Awarded by {award.awardedBy} on{" "}
                                  {new Date(award.awardedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="groups" className="flex-1 mt-4 min-h-0">
                <ScrollArea className="h-[300px]">
                  {userGroups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Not in any groups</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-4">
                      {userGroups.map((ug) => (
                        <div
                          key={ug.group.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            ug.group.id === currentGroupId ? "bg-primary/5 border-primary/20" : ""
                          }`}
                        >
                          <div>
                            <p className="font-medium">{ug.group.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {ug.group.memberCount.toLocaleString()} members
                            </p>
                          </div>
                          <Badge variant="secondary">{ug.role.name}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="organizations" className="flex-1 mt-4 min-h-0">
                <ScrollArea className="h-[300px]">
                  {relatedGroups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Not in any organization groups</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pr-4">
                      {organizations.map((org) => {
                        const orgUserGroups = relatedGroups.filter((ug) =>
                          org.groups.some((g) => g.id === ug.group.id)
                        );
                        if (orgUserGroups.length === 0) return null;

                        return (
                          <Card key={org.id}>
                            <CardHeader className="py-3 px-4">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {org.name}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-3 pt-0">
                              <div className="space-y-2">
                                {orgUserGroups.map((ug) => (
                                  <div
                                    key={ug.group.id}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span>{ug.group.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {ug.role.name}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
