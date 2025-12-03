"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield } from "lucide-react";
import { GroupManagementDialog } from "./group-management-dialog";

interface GroupCardProps {
  group: {
    id: number;
    name: string;
    description: string;
    memberCount: number;
    hasVerifiedBadge: boolean;
    iconUrl?: string | null;
  };
  role: {
    name: string;
    rank: number;
  };
}

export function GroupCard({ group, role }: GroupCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const isOwner = role.rank === 255;
  const isHighRank = role.rank >= 200;

  return (
    <>
      <Card
        className="group hover:shadow-lg transition-all duration-200 hover:border-primary/50 cursor-pointer"
        onClick={() => setDialogOpen(true)}
      >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 rounded-lg">
            <AvatarImage
              src={group.iconUrl || undefined}
              alt={group.name}
            />
            <AvatarFallback className="rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base truncate">{group.name}</CardTitle>
              {group.hasVerifiedBadge && (
                <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={isOwner ? "default" : isHighRank ? "secondary" : "outline"}
                className="text-xs"
              >
                {isOwner && <Crown className="h-3 w-3 mr-1" />}
                {role.name}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{group.memberCount.toLocaleString()} members</span>
        </div>
      </CardContent>
      </Card>

      <GroupManagementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        group={group}
      />
    </>
  );
}
