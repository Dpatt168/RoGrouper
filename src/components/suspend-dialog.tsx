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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldBan } from "lucide-react";

interface SuspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  onConfirm: (durationMs: number) => Promise<void>;
}

type DurationUnit = "minutes" | "hours" | "days" | "weeks";

const DURATION_MULTIPLIERS: Record<DurationUnit, number> = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
};

export function SuspendDialog({
  open,
  onOpenChange,
  username,
  onConfirm,
}: SuspendDialogProps) {
  const [duration, setDuration] = useState("1");
  const [unit, setUnit] = useState<DurationUnit>("days");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    const durationValue = parseInt(duration);
    if (isNaN(durationValue) || durationValue <= 0) return;

    const durationMs = durationValue * DURATION_MULTIPLIERS[unit];
    setLoading(true);
    try {
      await onConfirm(durationMs);
      onOpenChange(false);
      setDuration("1");
      setUnit("days");
    } finally {
      setLoading(false);
    }
  };

  const formatPreview = () => {
    const durationValue = parseInt(duration);
    if (isNaN(durationValue) || durationValue <= 0) return "";
    
    const durationMs = durationValue * DURATION_MULTIPLIERS[unit];
    const expiresAt = new Date(Date.now() + durationMs);
    return expiresAt.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-destructive" />
            Suspend {username}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Suspension Duration</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-24"
                placeholder="1"
              />
              <Select value={unit} onValueChange={(v) => setUnit(v as DurationUnit)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formatPreview() && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Expires:</span> {formatPreview()}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            The user will be given the suspended role for this duration. After it expires, 
            they will automatically be restored to their previous role.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || !duration || parseInt(duration) <= 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Suspending...
              </>
            ) : (
              "Suspend"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
