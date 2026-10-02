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
import { deleteProductReceipt, type ProductReceipt } from "@/lib/productreceipt";
import { usePermissions } from "@/hooks/use-permissions";

interface DeleteProductReceiptConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productReceipt: ProductReceipt | null;
  onSuccess: () => void;
}

export function DeleteProductReceiptConfirmationDialog({
  open,
  onOpenChange,
  productReceipt,
  onSuccess,
}: DeleteProductReceiptConfirmationDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  
  const { hasPermission, isAdmin } = usePermissions();

  async function handleDelete() {
    if (!productReceipt) return;
    
    // Check delete permission
    if (!hasPermission("can_delete_product_receipts") && !isAdmin()) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to delete product receipts.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProductReceipt(productReceipt.id);
      
      toast({
        title: "Success",
        description: `Product receipt ${productReceipt.product_receipt_number || productReceipt.reference_number} has been deleted successfully.`,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete product receipt",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  // Note: For product receipts, we don't have the same status restrictions as repairs
  // but we could add similar business logic here if needed
  const canDelete = true; // Could be modified based on receipt status or business rules

  if (!canDelete && productReceipt) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Cannot Delete Receipt</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Product receipt {productReceipt.product_receipt_number || productReceipt.reference_number} cannot be deleted at this time.
              Please contact your administrator for assistance.
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
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the product receipt
            and remove all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          {/* Check if user has permission to delete before showing delete button */}
          {(hasPermission("can_delete_product_receipts") || isAdmin()) ? (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Receipt"
              )}
            </AlertDialogAction>
          ) : (
            <Button 
              variant="destructive" 
              disabled
              className="cursor-not-allowed"
            >
              No Delete Permission
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}