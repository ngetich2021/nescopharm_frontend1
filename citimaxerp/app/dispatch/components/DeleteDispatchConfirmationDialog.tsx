"use client";
import { useState } from "react";
import { deleteOrderDispatch, type OrderDispatch } from "@/lib/order-dispatches";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteDispatchConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: OrderDispatch | null;
  onSuccess?: () => void;
}

export function DeleteDispatchConfirmationDialog({ 
  open, 
  onOpenChange, 
  dispatch, 
  onSuccess 
}: DeleteDispatchConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!dispatch) return;

    setLoading(true);
    
    try {
      const response = await deleteOrderDispatch(dispatch.id);

      toast({
        title: "Success",
        description: response.message || "Dispatch deleted successfully!",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting dispatch:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete dispatch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!dispatch) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <AlertDialogTitle>Delete Dispatch</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Are you sure you want to delete dispatch <strong>{dispatch.dispatch_number}</strong>?
            <br />
            <br />
            This action cannot be undone and will permanently remove:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>{dispatch.items?.length || 0} dispatch items</li>
              <li>All associated notes and acknowledgment data</li>
              <li>Complete dispatch history</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              "Delete Dispatch"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}