"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteTimeEntry, type TimeEntry } from "@/lib/time-management";

interface DeleteTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  timeEntry: TimeEntry | null;
}

export function DeleteTimeEntryDialog({ open, onOpenChange, onSuccess, timeEntry }: DeleteTimeEntryDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!timeEntry) return;
    setLoading(true);
    try {
      await deleteTimeEntry(timeEntry.id);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete time entry.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!timeEntry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Time Entry</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the time entry for {timeEntry.employee} on {timeEntry.date}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
