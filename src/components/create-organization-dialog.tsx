"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Building2 } from "lucide-react";
import type { RobloxGroup } from "@/app/api/groups/route";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: RobloxGroup[];
  onCreate: (name: string, selectedGroups: Array<{ id: number; name: string; iconUrl?: string }>) => Promise<void>;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  groups,
  onCreate,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const handleToggleGroup = (groupId: number) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedGroupIds.size < 2) return;

    setLoading(true);
    try {
      const selectedGroups = groups
        .filter((g) => selectedGroupIds.has(g.group.id))
        .map((g) => ({
          id: g.group.id,
          name: g.group.name,
          iconUrl: g.group.iconUrl,
        }));

      await onCreate(name.trim(), selectedGroups);
      setName("");
      setSelectedGroupIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setName("");
      setSelectedGroupIds(new Set());
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create Organization
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Organization"
            />
          </div>

          <div className="space-y-2">
            <Label>Select Groups (minimum 2)</Label>
            <ScrollArea className="h-[250px] border rounded-lg p-2">
              <div className="space-y-2">
                {groups.map((item) => (
                  <div
                    key={item.group.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleGroup(item.group.id)}
                  >
                    <Checkbox
                      checked={selectedGroupIds.has(item.group.id)}
                      onCheckedChange={() => handleToggleGroup(item.group.id)}
                    />
                    <Avatar className="h-10 w-10 rounded-lg">
                      <AvatarImage src={item.group.iconUrl || undefined} alt={item.group.name} />
                      <AvatarFallback className="rounded-lg">{item.group.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Your role: {item.role.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              {selectedGroupIds.size} group{selectedGroupIds.size !== 1 ? "s" : ""} selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !name.trim() || selectedGroupIds.size < 2}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create Organization"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
