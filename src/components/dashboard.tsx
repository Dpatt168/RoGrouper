"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { GroupsGrid } from "./groups-grid";
import { OrganizationsPanel } from "./organizations-panel";
import { LandingPage } from "./landing-page";
import { ApiDocsPage } from "./api-docs-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, Building2, Sparkles, Bug, Wrench, Zap, Clock, Award, FolderTree, Shield, Bot } from "lucide-react";

interface UpdateEntry {
  version: string;
  date: string;
  title: string;
  type: "feature" | "fix" | "improvement";
  changes: string[];
}

const SITE_UPDATES: UpdateEntry[] = [
  {
    version: "1.2.01",
    date: "2026-01-02",
    title: "API Documentation Update",
    type: "improvement",
    changes: [
      "Added Access Control endpoints to API docs",
      "Added Bot info endpoint documentation",
      "Added User search and avatar endpoints",
      "Updated response examples with botStatus",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-01-02",
    title: "Dashboard & UI Improvements",
    type: "feature",
    changes: [
      "New dashboard with site update log",
      "Feature highlights section",
      "Fixed scrolling issues on Sub-Groups and Access pages",
      "Sub-group badges now show immediately on group members",
      "Improved Access panel with two-column layout",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-01-01",
    title: "Awards System",
    type: "feature",
    changes: [
      "Create custom awards with icons and colors",
      "Give awards to group members",
      "Awards display on member profiles",
      "Organization-wide awards support",
    ],
  },
  {
    version: "1.0.5",
    date: "2025-12-28",
    title: "Access Control",
    type: "feature",
    changes: [
      "Role-based access control for group management",
      "Admin roles can manage access settings",
      "Individual user access permissions",
    ],
  },
  {
    version: "1.0.4",
    date: "2025-12-25",
    title: "Sub-Groups & Points",
    type: "feature",
    changes: [
      "Create sub-groups within your Roblox groups",
      "Assign members to sub-groups with point tracking",
      "Sub-group specific automation rules",
      "Exclude sub-groups from general automation",
    ],
  },
  {
    version: "1.0.3",
    date: "2025-12-20",
    title: "Suspension System",
    type: "feature",
    changes: [
      "Suspend members with automatic role restoration",
      "Timed suspensions with worker process",
      "Suspension history in audit log",
    ],
  },
  {
    version: "1.0.2",
    date: "2025-12-15",
    title: "Organization Role Syncs",
    type: "feature",
    changes: [
      "Link multiple Roblox groups into organizations",
      "Set up role synchronization between groups",
      "Automatic sync on role changes",
      "Manual sync all functionality",
    ],
  },
  {
    version: "1.0.1",
    date: "2025-12-10",
    title: "Automation Rules",
    type: "feature",
    changes: [
      "Point-based promotion automation",
      "Configure point thresholds for each role",
      "Audit logging for all automated actions",
    ],
  },
  {
    version: "1.0.0",
    date: "2025-12-01",
    title: "Initial Release",
    type: "feature",
    changes: [
      "Roblox OAuth authentication",
      "Group member management",
      "Role changes via bot",
      "Member search and filtering",
    ],
  },
];

function HomePage() {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "feature":
        return <Sparkles className="h-4 w-4 text-green-500" />;
      case "fix":
        return <Bug className="h-4 w-4 text-red-500" />;
      case "improvement":
        return <Wrench className="h-4 w-4 text-blue-500" />;
      default:
        return <Zap className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "feature":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">New Feature</Badge>;
      case "fix":
        return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Bug Fix</Badge>;
      case "improvement":
        return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Improvement</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Bloxmesh!</h1>
        <p className="text-muted-foreground mt-1">
          Your all-in-one Roblox group management platform.
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Group Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Manage members, roles, and permissions across all your groups.
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Automation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Set up point-based promotions and automatic role assignments.
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Link groups and sync roles across your organization.
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4" />
              Awards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Create custom awards and recognize outstanding members.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Update Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            What&apos;s New
          </CardTitle>
          <CardDescription>
            Recent updates and new features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {SITE_UPDATES.map((update, index) => (
                <div key={update.version} className="relative">
                  {index !== SITE_UPDATES.length - 1 && (
                    <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
                  )}
                  <div className="flex gap-4">
                    <div className="mt-1 p-1.5 rounded-full bg-muted shrink-0">
                      {getTypeIcon(update.type)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{update.title}</span>
                        <Badge variant="outline" className="text-xs">v{update.version}</Badge>
                        {getTypeBadge(update.type)}
                      </div>
                      <p className="text-xs text-muted-foreground">{update.date}</p>
                      <ul className="text-sm space-y-1">
                        {update.changes.map((change, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-muted-foreground">•</span>
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              Sub-Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Organize members into departments with custom point rules.
            </p>
          </CardContent>
        </Card>
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Access Control
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Control who can access your group&apos;s management page.
            </p>
          </CardContent>
        </Card>
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Role Syncs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Automatically sync roles between linked groups.
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
          Get help with using Bloxmesh.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Learn the basics of Bloxmesh
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
