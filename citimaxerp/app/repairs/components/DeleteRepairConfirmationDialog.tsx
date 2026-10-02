"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { deleteRepair, type Repair } from "@/lib/repairs";

interface DeleteRepairConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  repair: Repair | null;
}

export function DeleteRepairConfirmationDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  repair 
}: DeleteRepairConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!repair) return;

    setLoading(true);
    try {
      await deleteRepair(repair.id);
      
      toast({
        title: "Success",
        description: `Repair ${repair.repair_number} has been deleted successfully.`,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete repair",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if repair can be deleted (only pending/reported status)
  const canDelete = repair?.status === "pending" || repair?.status === "reported";

  if (!canDelete && repair) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Cannot Delete Repair</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Repair {repair.repair_number} cannot be deleted because it has already been {repair.status}.
              Only pending or reported repairs can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span>Delete Repair</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete repair{" "}
            <span className="font-semibold">{repair?.repair_number}</span>?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Repair"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}