"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupsGrid } from "./groups-grid";
import { OrganizationsPanel } from "./organizations-panel";
import { Users, Building2 } from "lucide-react";

export function MainTabs() {
  return (
    <Tabs defaultValue="groups" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="groups" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Groups
        </TabsTrigger>
        <TabsTrigger value="organizations" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Organizations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="groups">
        <GroupsGrid />
      </TabsContent>

      <TabsContent value="organizations">
        <OrganizationsPanel />
      </TabsContent>
    </Tabs>
  );
}
