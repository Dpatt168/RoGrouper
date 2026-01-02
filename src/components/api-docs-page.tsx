"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check,
  Users,
  Building2,
  Award,
  Shield,
  FileText,
  Settings,
  User,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth: boolean;
  params?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  body?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  response?: string;
}

interface ApiSection {
  title: string;
  icon: React.ReactNode;
  description: string;
  endpoints: Endpoint[];
}

const apiSections: ApiSection[] = [
  {
    title: "Groups",
    icon: <Users className="h-5 w-5" />,
    description: "Manage Roblox groups and their members",
    endpoints: [
      {
        method: "GET",
        path: "/api/groups",
        description: "Get all groups for the authenticated user",
        auth: true,
        response: `{
  "groups": [
    {
      "group": {
        "id": 123456,
        "name": "My Group",
        "memberCount": 1000
      },
      "role": {
        "id": 1,
        "name": "Owner",
        "rank": 255
      },
      "botStatus": "ready"
    }
  ]
}`,
      },
      {
        method: "GET",
        path: "/api/groups/[groupId]/members",
        description: "Get members of a specific group",
        auth: true,
        params: [
          { name: "groupId", type: "number", required: true, description: "The Roblox group ID" },
          { name: "limit", type: "number", required: false, description: "Number of members (default: 100)" },
          { name: "cursor", type: "string", required: false, description: "Pagination cursor" },
        ],
      },
      {
        method: "PATCH",
        path: "/api/groups/[groupId]/members/[userId]",
        description: "Update a member's role in the group",
        auth: true,
        params: [
          { name: "groupId", type: "number", required: true, description: "The Roblox group ID" },
          { name: "userId", type: "number", required: true, description: "The Roblox user ID" },
        ],
        body: [
          { name: "roleId", type: "number", required: true, description: "The new role ID to assign" },
          { name: "triggerSync", type: "boolean", required: false, description: "Trigger organization sync (default: true)" },
        ],
      },
      {
        method: "DELETE",
        path: "/api/groups/[groupId]/members/[userId]",
        description: "Kick a member from the group",
        auth: true,
        params: [
          { name: "groupId", type: "number", required: true, description: "The Roblox group ID" },
          { name: "userId", type: "number", required: true, description: "The Roblox user ID" },
        ],
      },
      {
        method: "GET",
        path: "/api/groups/[groupId]/roles",
        description: "Get all roles in a group",
        auth: true,
        params: [
          { name: "groupId", type: "number", required: true, description: "The Roblox group ID" },
        ],
      },
      {
        method: "GET",
        path: "/api/groups/[groupId]/bot-role",
        description: "Get the bot's role and rank in the group",
        auth: true,
        params: [
          { name: "groupId", type: "number", required: true, description: "The Roblox group ID" },
        ],
        response: `{
  "rank": 90,
  "roleName": "Vice Chairman"
}`,
      },
      {
        method: "GET",
        path: "/api/groups/[groupId]/bot-join",
        description: "Get bot join link for the group",
        auth: true,
        params: [
          { name: "groupId", type: "number", required: true, description: "The Roblox group ID" },
        ],
      },
    ],
  },
  {
    title: "Automation",
    icon: <Settings className="h-5 w-5" />,
    description: "Configure point-based automation rules",
    endpoints: [
      {
        method: "GET",
        path: "/api/groups/[groupId]/automation",
        description: "Get automation settings for a group",
        auth: true,
        params: [
          { name: "groupId", type: "number", required: true, description: "The Roblox group ID" },
        ],
        response: `{
  "rules": [...],
  "userPoints": [...],
  "suspendedRole": {...},
  "suspensions": [...],
  "subGroups": [...]
}`,
      },
      {
        method: "POST",
        path: "/api/groups/[groupId]/automation",
        description: "Update automation settings",
        auth: true,
        body: [
          { name: "action", type: "string", required: true, description: "addRule, deleteRule, setPoints, addPoints, suspend, unsuspend, createSubGroup, etc." },
        ],
      },
    ],
  },
  {
    title: "Sub-Groups",
    icon: <Users className="h-5 w-5" />,
    description: "Manage sub-groups within a group",
    endpoints: [
      {
        method: "POST",
        path: "/api/groups/[groupId]/automation",
        description: "Create a sub-group",
        auth: true,
        body: [
          { name: "action", type: "string", required: true, description: '"createSubGroup"' },
          { name: "name", type: "string", required: true, description: "Sub-group name" },
          { name: "color", type: "string", required: true, description: "Hex color code" },
        ],
      },
      {
        method: "POST",
        path: "/api/groups/[groupId]/automation",
        description: "Add rule to sub-group",
        auth: true,
        body: [
          { name: "action", type: "string", required: true, description: '"addSubGroupRule"' },
          { name: "subGroupId", type: "string", required: true, description: "Sub-group ID" },
          { name: "points", type: "number", required: true, description: "Points threshold" },
          { name: "roleId", type: "number", required: true, description: "Role to assign" },
        ],
      },
      {
        method: "POST",
        path: "/api/groups/[groupId]/automation",
        description: "Assign user to sub-group",
        auth: true,
        body: [
          { name: "action", type: "string", required: true, description: '"assignUserToSubGroup"' },
          { name: "userId", type: "number", required: true, description: "User ID" },
          { name: "subGroupId", type: "string", required: true, description: "Sub-group ID or null" },
        ],
      },
    ],
  },
  {
    title: "Organizations",
    icon: <Building2 className="h-5 w-5" />,
    description: "Manage organizations and role syncs",
    endpoints: [
      {
        method: "GET",
        path: "/api/organizations",
        description: "Get all organizations",
        auth: true,
        response: `{
  "organizations": [
    {
      "id": "uuid",
      "name": "My Organization",
      "groups": [...],
      "roleSyncs": [...]
    }
  ]
}`,
      },
      {
        method: "POST",
        path: "/api/organizations",
        description: "Create or update organization",
        auth: true,
        body: [
          { name: "action", type: "string", required: true, description: "create, rename, delete, updateGroups, addRoleSync, deleteRoleSync" },
        ],
      },
    ],
  },
  {
    title: "Awards",
    icon: <Award className="h-5 w-5" />,
    description: "Manage awards for groups and organizations",
    endpoints: [
      {
        method: "GET",
        path: "/api/awards",
        description: "Get awards and user awards",
        auth: true,
        params: [
          { name: "scopeType", type: "string", required: false, description: '"group" or "organization"' },
          { name: "scopeId", type: "string", required: false, description: "Group or Organization ID" },
          { name: "userId", type: "number", required: false, description: "Filter by user ID" },
        ],
      },
      {
        method: "POST",
        path: "/api/awards",
        description: "Create, give, or revoke awards",
        auth: true,
        body: [
          { name: "action", type: "string", required: true, description: '"createAward", "deleteAward", "giveAward", "revokeAward"' },
        ],
      },
    ],
  },
  {
    title: "Audit Log",
    icon: <FileText className="h-5 w-5" />,
    description: "View and configure audit logs",
    endpoints: [
      {
        method: "GET",
        path: "/api/groups/[groupId]/audit-log",
        description: "Get audit log entries",
        auth: true,
        params: [
          { name: "groupId", type: "number", required: true, description: "The Roblox group ID" },
        ],
      },
      {
        method: "POST",
        path: "/api/groups/[groupId]/audit-log",
        description: "Add log entry or set webhook",
        auth: true,
        body: [
          { name: "action", type: "string", required: false, description: "Action type for logging" },
          { name: "webhookUrl", type: "string", required: false, description: "Discord webhook URL" },
        ],
      },
    ],
  },
  {
    title: "Access Control",
    icon: <Shield className="h-5 w-5" />,
    description: "Manage who can access group management",
    endpoints: [
      {
        method: "GET",
        path: "/api/groups/[groupId]/access",
        description: "Get access settings for a group",
        auth: true,
        params: [
          { name: "groupId", type: "number", required: true, description: "The Roblox group ID" },
        ],
        response: `{
  "allowedRoles": [{ "roleId": 123, "roleName": "Admin" }],
  "allowedUsers": [{ "userId": 456, "username": "user" }],
  "adminRoles": [...],
  "adminUsers": [...],
  "permissions": {
    "canManageAccess": true,
    "canManageAdmins": false
  }
}`,
      },
      {
        method: "POST",
        path: "/api/groups/[groupId]/access",
        description: "Update access settings",
        auth: true,
        body: [
          { name: "action", type: "string", required: true, description: '"addRole", "removeRole", "addUser", "removeUser", "addAdminRole", "removeAdminRole", "addAdminUser", "removeAdminUser"' },
          { name: "roleId", type: "number", required: false, description: "Role ID (for role actions)" },
          { name: "userId", type: "number", required: false, description: "User ID (for user actions)" },
        ],
      },
    ],
  },
  {
    title: "Roblox User",
    icon: <User className="h-5 w-5" />,
    description: "Fetch Roblox user information",
    endpoints: [
      {
        method: "GET",
        path: "/api/roblox/user/[userId]",
        description: "Get user info and groups",
        auth: true,
        params: [
          { name: "userId", type: "number", required: true, description: "The Roblox user ID" },
        ],
        response: `{
  "userInfo": {
    "id": 123,
    "name": "username",
    "displayName": "Display",
    "created": "2020-01-01T00:00:00Z"
  },
  "userGroups": [...]
}`,
      },
      {
        method: "GET",
        path: "/api/users/search",
        description: "Search for Roblox users by username",
        auth: true,
        params: [
          { name: "q", type: "string", required: true, description: "Search query (username)" },
        ],
        response: `{
  "users": [
    {
      "id": 123,
      "name": "username",
      "displayName": "Display Name"
    }
  ]
}`,
      },
      {
        method: "GET",
        path: "/api/users/avatars",
        description: "Get avatar thumbnails for users",
        auth: true,
        params: [
          { name: "userIds", type: "string", required: true, description: "Comma-separated user IDs" },
        ],
      },
    ],
  },
  {
    title: "Bot",
    icon: <Bot className="h-5 w-5" />,
    description: "Bot information and status",
    endpoints: [
      {
        method: "GET",
        path: "/api/bot/info",
        description: "Get bot account information",
        auth: true,
        response: `{
  "id": 123456789,
  "name": "BotUsername",
  "displayName": "Bot Display Name"
}`,
      },
    ],
  },
];

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-green-500/10 text-green-500 border-green-500/20",
    POST: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    PATCH: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    DELETE: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <Badge variant="outline" className={`font-mono ${colors[method] || ""}`}>
      {method}
    </Badge>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPath = () => {
    navigator.clipboard.writeText(endpoint.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="mb-3">
      <CardHeader 
        className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <MethodBadge method={endpoint.method} />
            <code className="text-sm font-mono">{endpoint.path}</code>
          </div>
          <div className="flex items-center gap-2">
            {endpoint.auth && (
              <Badge variant="secondary" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Auth
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                copyPath();
              }}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <CardDescription className="mt-1 ml-7">{endpoint.description}</CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-4 px-4">
          <div className="ml-7 space-y-4">
            {endpoint.params && endpoint.params.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Parameters</h4>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  {endpoint.params.map((param) => (
                    <div key={param.name} className="flex items-start gap-2 text-sm flex-wrap">
                      <code className="text-primary font-mono">{param.name}</code>
                      <Badge variant="outline" className="text-xs">{param.type}</Badge>
                      {param.required && (
                        <Badge variant="destructive" className="text-xs">required</Badge>
                      )}
                      <span className="text-muted-foreground">{param.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {endpoint.body && endpoint.body.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Request Body</h4>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  {endpoint.body.map((field) => (
                    <div key={field.name} className="flex items-start gap-2 text-sm flex-wrap">
                      <code className="text-primary font-mono">{field.name}</code>
                      <Badge variant="outline" className="text-xs">{field.type}</Badge>
                      {field.required && (
                        <Badge variant="destructive" className="text-xs">required</Badge>
                      )}
                      <span className="text-muted-foreground">{field.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {endpoint.response && (
              <div>
                <h4 className="text-sm font-medium mb-2">Response</h4>
                <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-x-auto">
                  <code>{endpoint.response}</code>
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function ApiDocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Documentation</h1>
        <p className="text-muted-foreground mt-1">
          Complete reference for the Bloxmesh API endpoints.
        </p>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <h3 className="font-medium text-yellow-600 dark:text-yellow-400 mb-1">Authentication</h3>
        <p className="text-sm text-muted-foreground">
          All API endpoints require authentication via Roblox OAuth. Session is managed via cookies.
        </p>
      </div>

      <Tabs defaultValue="groups" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          {apiSections.map((section) => (
            <TabsTrigger 
              key={section.title} 
              value={section.title.toLowerCase().replace(" ", "-")}
              className="flex items-center gap-1 text-xs"
            >
              {section.icon}
              {section.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {apiSections.map((section) => (
          <TabsContent key={section.title} value={section.title.toLowerCase().replace(" ", "-")}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                {section.icon}
                {section.title}
              </h2>
              <p className="text-muted-foreground text-sm">{section.description}</p>
            </div>

            <ScrollArea className="h-[calc(100vh-450px)]">
              {section.endpoints.map((endpoint, idx) => (
                <EndpointCard key={idx} endpoint={endpoint} />
              ))}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Base URL</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <code className="text-sm bg-muted px-2 py-1 rounded">
            {typeof window !== "undefined" ? window.location.origin : "http://bloxmesh.com"}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
