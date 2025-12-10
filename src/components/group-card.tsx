"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Crown, Shield, Lock, UserPlus, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { GroupManagementDialog } from "./group-management-dialog";
import type { BotStatus } from "@/app/api/groups/route";

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
  botStatus?: BotStatus;
  botRank?: number;
  botRoleName?: string;
  onRefresh?: () => void;
}

interface BotInfo {
  id: number;
  name: string;
  displayName: string;
}

export function GroupCard({ group, role, botStatus = "not_in_group", botRank = 0, botRoleName = "", onRefresh }: GroupCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  
  const isOwner = role.rank === 255;
  const isHighRank = role.rank >= 200;
  const isLocked = botStatus !== "ready";

  // Fetch bot info when needed
  useEffect(() => {
    if (isLocked && !botInfo) {
      fetch("/api/bot/info")
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            setBotInfo(data);
          }
        })
        .catch(console.error);
    }
  }, [isLocked, botInfo]);

  const handleInviteBot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInviting(true);
    setActionMessage(null);
    
    try {
      const response = await fetch(`/api/groups/${group.id}/bot-join`, {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActionMessage(data.message || "Join request sent! Accept the bot in your group, then click Verify.");
      } else if (data.pendingCaptcha) {
        setActionMessage(data.message || "Request sent to admin for manual processing.");
      } else {
        setActionMessage(data.error || "Failed to send join request");
      }
    } catch (error) {
      setActionMessage("Failed to send join request");
    } finally {
      setIsInviting(false);
    }
  };

  const checkPendingStatus = async () => {
    try {
      const response = await fetch(`/api/groups/${group.id}/bot-join`);
      const data = await response.json();
      
      if (data.exists) {
        if (data.status === "captcha_completed" || data.status === "joined") {
          setActionMessage("Admin has processed the request. Click Verify to check if bot joined.");
        } else if (data.status === "pending_captcha") {
          setActionMessage("Waiting for admin to complete captcha...");
        } else if (data.status === "failed") {
          setActionMessage("Request failed. Please try again or contact admin.");
        }
      }
    } catch (error) {
      console.error("Error checking pending status:", error);
    }
  };

  // Check pending status periodically for locked groups
  useEffect(() => {
    if (isLocked && botStatus === "not_in_group") {
      checkPendingStatus();
      const interval = setInterval(checkPendingStatus, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isLocked, botStatus, group.id]);

  const handleVerify = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVerifying(true);
    setActionMessage(null);
    
    try {
      // Refresh the groups list to check bot status
      if (onRefresh) {
        onRefresh();
        setActionMessage("Checking bot status...");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCardClick = () => {
    if (!isLocked) {
      setDialogOpen(true);
    }
  };

  return (
    <>
      <Card
        className={`group transition-all duration-200 ${
          isLocked 
            ? "opacity-75 border-amber-500/30 bg-amber-500/5" 
            : "hover:shadow-lg hover:border-primary/50 cursor-pointer"
        }`}
        onClick={handleCardClick}
      >
        {/* Lock overlay for locked groups */}
        {isLocked && (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-amber-500/20 rounded-full p-1.5">
              <Lock className="h-4 w-4 text-amber-600" />
            </div>
          </div>
        )}
        
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className={`h-12 w-12 rounded-lg ${isLocked ? "grayscale-[30%]" : ""}`}>
                <AvatarImage
                  src={group.iconUrl || undefined}
                  alt={group.name}
                />
                <AvatarFallback className="rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </AvatarFallback>
              </Avatar>
            </div>
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
        
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{group.memberCount.toLocaleString()} members</span>
          </div>

          {/* Bot status section for locked groups */}
          {isLocked && (
            <div className="space-y-2 pt-2 border-t">
              {botStatus === "not_in_group" && (
                <>
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Bot not in group</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8"
                    onClick={handleInviteBot}
                    disabled={isInviting}
                  >
                    {isInviting ? (
                      <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3 w-3 mr-1.5" />
                    )}
                    Invite Bot to Group
                  </Button>
                  {actionMessage && (
                    <p className="text-xs text-muted-foreground text-center">{actionMessage}</p>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs h-7"
                    onClick={handleVerify}
                    disabled={isVerifying}
                  >
                    {isVerifying ? (
                      <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3 w-3 mr-1.5" />
                    )}
                    Verify
                  </Button>
                </>
              )}

              {botStatus === "needs_rank" && (
                <>
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Bot needs rank permission</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Please give <strong>{botInfo?.name || "the bot"}</strong> a role with &quot;Manage lower-ranked member ranks&quot; permission.
                    {botRoleName && (
                      <span className="block mt-1">Current role: {botRoleName} (Rank {botRank})</span>
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8"
                    onClick={handleVerify}
                    disabled={isVerifying}
                  >
                    {isVerifying ? (
                      <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3 w-3 mr-1.5" />
                    )}
                    Verify Permission
                  </Button>
                </>
              )}
            </div>
          )}
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
