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
import { deleteRequisition, type Requisition } from "@/lib/requisitions";

interface DeleteRequisitionConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisition: Requisition | null;
  onSuccess: () => void;
}

export function DeleteRequisitionConfirmationDialog({
  open,
  onOpenChange,
  requisition,
  onSuccess,
}: DeleteRequisitionConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!requisition) return;

    setLoading(true);
    try {
      await deleteRequisition(requisition.id);
      
      toast({
        title: "Success",
        description: `Requisition ${requisition.requisition_number} has been deleted successfully.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete requisition",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if requisition can be deleted (only pending status)
  const canDelete = requisition?.status === "pending" && requisition?.approval_status === "pending";

  if (!canDelete && requisition) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Cannot Delete Requisition</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Requisition {requisition.requisition_number} cannot be deleted because it has already been {requisition.status}.
              Only pending requisitions can be deleted.
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
            <span>Delete Requisition</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete requisition{" "}
            <span className="font-semibold">{requisition?.requisition_number}</span>?
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
              "Delete Requisition"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}