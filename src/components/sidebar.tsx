"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, 
  Building2, 
  Home,
  ChevronLeft,
  ChevronRight,
  Settings,
  HelpCircle,
  FileCode,
  Shield
} from "lucide-react";

const ADMIN_USER_ID = "3857050833";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "groups", label: "Groups", icon: Users },
  { id: "organizations", label: "Organizations", icon: Building2 },
];

const bottomItems = [
  { id: "api-docs", label: "API Docs", icon: FileCode },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Help", icon: HelpCircle },
];

export function Sidebar({ activeTab, onTabChange, collapsed, onCollapsedChange }: SidebarProps) {
  const { data: session } = useSession();
  const router = useRouter();
  
  const isAdmin = session?.user?.robloxId === ADMIN_USER_ID;

  if (!session) return null;

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 z-40",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Toggle button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute -right-3 top-6 h-6 w-6 rounded-full border bg-background p-0 shadow-md"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {/* Main navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 transition-all",
                  collapsed ? "px-3" : "px-4"
                )}
                onClick={() => onTabChange(item.id)}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Button>
            ))}
          </nav>
        </ScrollArea>

        {/* Bottom navigation */}
        <div className="border-t py-4 px-2 space-y-1">
          {/* Admin button - only visible to admin */}
          {isAdmin && (
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 transition-all text-amber-600 hover:text-amber-700 hover:bg-amber-50",
                collapsed ? "px-3" : "px-4"
              )}
              onClick={() => router.push("/admin")}
            >
              <Shield className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="truncate">Admin Panel</span>
              )}
            </Button>
          )}
          
          {bottomItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 transition-all",
                collapsed ? "px-3" : "px-4"
              )}
              onClick={() => onTabChange(item.id)}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Button>
          ))}
        </div>
      </div>
    </aside>
  );
}
