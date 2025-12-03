"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { GroupCard } from "./group-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, Users } from "lucide-react";
import type { RobloxGroup } from "@/app/api/groups/route";

function GroupCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-10 w-full mb-3" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

export function GroupsGrid() {
  const { data: session, status } = useSession();
  const [groups, setGroups] = useState<RobloxGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetchGroups();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  async function fetchGroups() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/groups");
      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }
      const data = await response.json();
      setGroups(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Sign in to view your groups</h2>
        <p className="text-muted-foreground max-w-md">
          Connect your Roblox account to see all the groups you&apos;re a member of.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <GroupCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Failed to load groups</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button
          onClick={fetchGroups}
          className="text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No groups found</h2>
        <p className="text-muted-foreground">
          You&apos;re not a member of any Roblox groups yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Your Groups</h2>
        <span className="text-sm text-muted-foreground">
          {groups.length} group{groups.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((item) => (
          <GroupCard key={item.group.id} group={item.group} role={item.role} />
        ))}
      </div>
    </div>
  );
}
