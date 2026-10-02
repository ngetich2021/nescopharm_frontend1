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
import { deleteBreakage, type Breakage } from "@/lib/breakages";

interface DeleteBreakageConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  breakage: Breakage | null;
}

export function DeleteBreakageConfirmationDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  breakage 
}: DeleteBreakageConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!breakage) return;

    setLoading(true);
    try {
      await deleteBreakage(breakage.id);
      
      toast({
        title: "Success",
        description: `Breakage ${breakage.breakage_number} has been deleted successfully.`,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete breakage",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if breakage can be deleted (only pending status)
  const canDelete = breakage?.status === "pending" && breakage?.approval_status === "pending";

  if (!canDelete && breakage) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Cannot Delete Breakage</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Breakage {breakage.breakage_number} cannot be deleted because it has already been {breakage.status}.
              Only pending breakages can be deleted.
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
            <span>Delete Breakage</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete breakage{" "}
            <span className="font-semibold">{breakage?.breakage_number}</span>?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-primary hover:bg-primary/90 focus:ring-primary"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Breakage"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}