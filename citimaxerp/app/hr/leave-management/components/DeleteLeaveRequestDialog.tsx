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
import { deleteLeaveRequest, type LeaveRequest } from "@/lib/leave";

interface DeleteLeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  leaveRequest: LeaveRequest | null;
}

export function DeleteLeaveRequestDialog({ open, onOpenChange, onSuccess, leaveRequest }: DeleteLeaveRequestDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!leaveRequest) return;
    setLoading(true);
    try {
      await deleteLeaveRequest(leaveRequest.id);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete leave request.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!leaveRequest) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Leave Request</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the leave request for {leaveRequest.employee}? This action cannot be undone.
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
