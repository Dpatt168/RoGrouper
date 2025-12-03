"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { GroupsGrid } from "./groups-grid";
import { OrganizationsPanel } from "./organizations-panel";
import { LandingPage } from "./landing-page";
import { ApiDocsPage } from "./api-docs-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users, Building2, TrendingUp, Activity } from "lucide-react";

function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your group management dashboard.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Groups you manage
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Linked organizations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Role Syncs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Active sync rules
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Actions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              In the last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Groups
            </CardTitle>
            <CardDescription>
              Manage your Roblox groups, members, and automation rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click on "Groups" in the sidebar to view and manage all your groups.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizations
            </CardTitle>
            <CardDescription>
              Link multiple groups and set up role synchronization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click on "Organizations" in the sidebar to create and manage organizations.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your application preferences.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Settings and preferences will be available in a future update.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Help & Support</h1>
        <p className="text-muted-foreground mt-1">
          Get help with using RoGrouper.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Learn the basics of RoGrouper
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>1.</strong> Navigate to Groups to see all your Roblox groups</p>
            <p><strong>2.</strong> Click on a group to manage members and automation</p>
            <p><strong>3.</strong> Set up point rules to automate promotions</p>
            <p><strong>4.</strong> Create sub-groups for department-specific rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>
              Link groups and sync roles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>1.</strong> Create an organization and add groups</p>
            <p><strong>2.</strong> Set up role syncs between groups</p>
            <p><strong>3.</strong> Use "Sync Now" to apply all rules</p>
            <p><strong>4.</strong> Role changes trigger automatic syncs</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Show loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Show landing page if not signed in
  if (!session) {
    return <LandingPage />;
  }

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <HomePage />;
      case "groups":
        return <GroupsGrid />;
      case "organizations":
        return <OrganizationsPanel />;
      case "api-docs":
        return <ApiDocsPage />;
      case "settings":
        return <SettingsPage />;
      case "help":
        return <HelpPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="flex">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main 
        className={cn(
          "flex-1 transition-all duration-300 p-8",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        {renderContent()}
      </main>
    </div>
  );
}
