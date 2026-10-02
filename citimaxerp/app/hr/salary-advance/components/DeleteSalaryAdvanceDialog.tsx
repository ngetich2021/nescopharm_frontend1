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
import { deleteSalaryAdvance, type SalaryAdvanceRequest } from "@/lib/salary-advance";

interface DeleteSalaryAdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  salaryAdvanceRequest: SalaryAdvanceRequest | null;
}

export function DeleteSalaryAdvanceDialog({ open, onOpenChange, onSuccess, salaryAdvanceRequest }: DeleteSalaryAdvanceDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!salaryAdvanceRequest) return;
    setLoading(true);
    try {
      await deleteSalaryAdvance(salaryAdvanceRequest.id);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete salary advance request.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!salaryAdvanceRequest) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Salary Advance Request</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the salary advance request for {salaryAdvanceRequest.employee}? This action cannot be undone.
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
