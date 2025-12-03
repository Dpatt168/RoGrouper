"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Plus, 
  AlertCircle, 
  Users, 
  Settings,
  Trash2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { CreateOrganizationDialog } from "./create-organization-dialog";
import { OrganizationManagementDialog } from "./organization-management-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import type { Organization } from "@/app/api/organizations/route";
import type { RobloxGroup } from "@/app/api/groups/route";

function OrganizationCardSkeleton() {
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
      </CardContent>
    </Card>
  );
}

export function OrganizationsPanel() {
  const { data: session, status } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [groups, setGroups] = useState<RobloxGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [manageOrg, setManageOrg] = useState<Organization | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      
      const [orgsRes, groupsRes] = await Promise.all([
        fetch("/api/organizations"),
        fetch("/api/groups")
      ]);
      
      if (!orgsRes.ok || !groupsRes.ok) {
        throw new Error("Failed to fetch data");
      }
      
      const orgsData = await orgsRes.json();
      const groupsData = await groupsRes.json();
      
      setOrganizations(orgsData.organizations || []);
      setGroups(groupsData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  const handleCreateOrg = async (name: string, selectedGroups: Array<{ id: number; name: string; iconUrl?: string }>) => {
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name,
          groupIds: selectedGroups.map(g => g.id),
          groups: selectedGroups,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations);
        toast.success("Organization created successfully");
        setCreateDialogOpen(false);
      } else {
        toast.error("Failed to create organization");
      }
    } catch (error) {
      console.error("Error creating organization:", error);
      toast.error("Failed to create organization");
    }
  };

  const handleDeleteOrg = async () => {
    if (!deleteConfirm) return;
    
    setDeleting(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          orgId: deleteConfirm.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations);
        toast.success("Organization deleted");
        setDeleteConfirm(null);
      } else {
        toast.error("Failed to delete organization");
      }
    } catch (error) {
      console.error("Error deleting organization:", error);
      toast.error("Failed to delete organization");
    } finally {
      setDeleting(false);
    }
  };

  const handleOrgUpdate = (updatedOrg: Organization) => {
    setOrganizations(prev => 
      prev.map(o => o.id === updatedOrg.id ? updatedOrg : o)
    );
    // Also update the manageOrg state so the dialog sees the changes
    if (manageOrg?.id === updatedOrg.id) {
      setManageOrg(updatedOrg);
    }
  };

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Building2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Sign in to view organizations</h2>
        <p className="text-muted-foreground max-w-md">
          Connect your Roblox account to create and manage organizations.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <OrganizationCardSkeleton key={i} />
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
        <h2 className="text-xl font-semibold mb-2">Failed to load organizations</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={fetchData} className="text-primary hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Building2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No organizations yet</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Create an organization to link multiple groups together and sync roles between them.
        </p>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>

        <CreateOrganizationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          groups={groups}
          onCreate={handleCreateOrg}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Your Organizations</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <Card key={org.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {org.groups.length} group{org.groups.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Group avatars */}
              <div className="flex -space-x-2 mb-4">
                {org.groups.slice(0, 5).map((group) => (
                  <Avatar key={group.id} className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={group.iconUrl || undefined} alt={group.name} />
                    <AvatarFallback className="text-xs">{group.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
                {org.groups.length > 5 && (
                  <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                    +{org.groups.length - 5}
                  </div>
                )}
              </div>

              {/* Role syncs badge */}
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {org.roleSyncs.length} role sync{org.roleSyncs.length !== 1 ? "s" : ""}
                </Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setManageOrg(org)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirm(org)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateOrganizationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        groups={groups}
        onCreate={handleCreateOrg}
      />

      {manageOrg && (
        <OrganizationManagementDialog
          open={!!manageOrg}
          onOpenChange={(open: boolean) => !open && setManageOrg(null)}
          organization={manageOrg}
          allGroups={groups}
          onUpdate={handleOrgUpdate}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Organization"
        description={`Are you sure you want to delete "${deleteConfirm?.name}"? This will remove all role syncs. This action cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteOrg}
      />
    </div>
  );
}
