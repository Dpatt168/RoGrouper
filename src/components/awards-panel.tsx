"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Loader2, Award, Gift } from "lucide-react";
import { toast } from "sonner";

interface AwardType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  createdAt: number;
  scope: {
    type: "group" | "organization";
    id: number | string;
    name: string;
  };
}

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

interface Member {
  user: {
    userId: number;
    username: string;
    displayName: string;
  };
}

interface AwardsPanelProps {
  scopeType: "group" | "organization";
  scopeId: number | string;
  scopeName: string;
  members?: Member[];
}

const ICONS = ["🏆", "⭐", "🎖️", "🥇", "🥈", "🥉", "💎", "👑", "🎯", "🔥", "💪", "🌟", "✨", "🎉", "🏅"];

const COLORS = [
  { name: "Gold", value: "#fbbf24" },
  { name: "Silver", value: "#9ca3af" },
  { name: "Bronze", value: "#d97706" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
];

export function AwardsPanel({ scopeType, scopeId, scopeName, members = [] }: AwardsPanelProps) {
  const [awards, setAwards] = useState<AwardType[]>([]);
  const [userAwards, setUserAwards] = useState<UserAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Create award dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAwardName, setNewAwardName] = useState("");
  const [newAwardDescription, setNewAwardDescription] = useState("");
  const [newAwardIcon, setNewAwardIcon] = useState("🏆");
  const [newAwardColor, setNewAwardColor] = useState("#fbbf24");

  // Give award dialog
  const [showGiveDialog, setShowGiveDialog] = useState(false);
  const [selectedAwardId, setSelectedAwardId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [awardReason, setAwardReason] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/awards?scopeType=${scopeType}&scopeId=${scopeId}`
      );
      if (response.ok) {
        const data = await response.json();
        setAwards(data.awards || []);
        setUserAwards(data.userAwards || []);
      }
    } catch (error) {
      console.error("Error fetching awards:", error);
    } finally {
      setLoading(false);
    }
  }, [scopeType, scopeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateAward = async () => {
    if (!newAwardName.trim()) {
      toast.error("Please enter an award name");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch("/api/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createAward",
          name: newAwardName.trim(),
          description: newAwardDescription.trim(),
          icon: newAwardIcon,
          color: newAwardColor,
          scopeType,
          scopeId,
          scopeName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAwards(data.awards.filter((a: AwardType) => 
          a.scope.type === scopeType && a.scope.id.toString() === scopeId.toString()
        ));
        toast.success("Award created!");
        setShowCreateDialog(false);
        setNewAwardName("");
        setNewAwardDescription("");
        setNewAwardIcon("🏆");
        setNewAwardColor("#fbbf24");
      }
    } catch (error) {
      console.error("Error creating award:", error);
      toast.error("Failed to create award");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAward = async (awardId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteAward",
          awardId,
        }),
      });

      if (response.ok) {
        setAwards(awards.filter((a) => a.id !== awardId));
        setUserAwards(userAwards.filter((ua) => ua.awardId !== awardId));
        toast.success("Award deleted");
      }
    } catch (error) {
      console.error("Error deleting award:", error);
      toast.error("Failed to delete award");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGiveAward = async () => {
    if (!selectedAwardId || !selectedUserId) {
      toast.error("Please select an award and user");
      return;
    }

    const member = members.find((m) => m.user.userId.toString() === selectedUserId);
    if (!member) return;

    setActionLoading(true);
    try {
      const response = await fetch("/api/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "giveAward",
          awardId: selectedAwardId,
          userId: member.user.userId,
          username: member.user.username,
          reason: awardReason.trim() || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const awardIds = new Set(awards.map((a) => a.id));
        setUserAwards(data.userAwards.filter((ua: UserAward) => awardIds.has(ua.awardId)));
        toast.success("Award given!");
        setShowGiveDialog(false);
        setSelectedAwardId("");
        setSelectedUserId("");
        setAwardReason("");
      }
    } catch (error) {
      console.error("Error giving award:", error);
      toast.error("Failed to give award");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAward = async (userAwardId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revokeAward",
          userAwardId,
        }),
      });

      if (response.ok) {
        setUserAwards(userAwards.filter((ua) => ua.id !== userAwardId));
        toast.success("Award revoked");
      }
    } catch (error) {
      console.error("Error revoking award:", error);
      toast.error("Failed to revoke award");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full max-h-[calc(100vh-200px)]">
      <div className="space-y-4 pr-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          <h3 className="font-medium">Awards</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowGiveDialog(true)} disabled={awards.length === 0}>
            <Gift className="h-4 w-4 mr-1" />
            Give
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create
          </Button>
        </div>
      </div>

      {/* Awards List */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm">Available Awards</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {awards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No awards created yet
            </p>
          ) : (
            <div className="space-y-2">
              {awards.map((award) => (
                <div
                  key={award.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xl"
                      style={{ filter: `drop-shadow(0 0 4px ${award.color})` }}
                    >
                      {award.icon}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{award.name}</p>
                      {award.description && (
                        <p className="text-xs text-muted-foreground">{award.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAward(award.id)}
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Awards Given */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm">Recent Awards Given</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <ScrollArea className="h-[200px]">
            {userAwards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No awards given yet
              </p>
            ) : (
              <div className="space-y-2">
                {userAwards
                  .sort((a, b) => b.awardedAt - a.awardedAt)
                  .slice(0, 20)
                  .map((ua) => (
                    <div
                      key={ua.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ua.awardIcon}</span>
                        <div>
                          <p className="text-sm">
                            <span className="font-medium">{ua.username}</span>
                            <span className="text-muted-foreground"> received </span>
                            <span className="font-medium">{ua.awardName}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            by {ua.awardedBy} • {new Date(ua.awardedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeAward(ua.id)}
                        disabled={actionLoading}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create Award Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Award</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newAwardName}
                onChange={(e) => setNewAwardName(e.target.value)}
                placeholder="e.g., Employee of the Month"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={newAwardDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewAwardDescription(e.target.value)}
                placeholder="What is this award for?"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Icon</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    className={`text-2xl p-2 rounded-lg border-2 transition-all ${
                      newAwardIcon === icon
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:bg-muted"
                    }`}
                    onClick={() => setNewAwardIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 mt-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newAwardColor === color.value
                        ? "border-foreground"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setNewAwardColor(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAward} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Give Award Dialog */}
      <Dialog open={showGiveDialog} onOpenChange={setShowGiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give Award</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Award</label>
              <Select value={selectedAwardId} onValueChange={setSelectedAwardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an award" />
                </SelectTrigger>
                <SelectContent>
                  {awards.map((award) => (
                    <SelectItem key={award.id} value={award.id}>
                      <div className="flex items-center gap-2">
                        <span>{award.icon}</span>
                        {award.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.user.userId} value={member.user.userId.toString()}>
                      {member.user.displayName} (@{member.user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                value={awardReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAwardReason(e.target.value)}
                placeholder="Why are they receiving this award?"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGiveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGiveAward} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Give Award"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </ScrollArea>
  );
}
