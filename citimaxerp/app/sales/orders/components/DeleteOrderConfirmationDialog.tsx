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
import { deleteOrder } from "@/lib/orders";
import { Order } from "@/lib/orders";

interface DeleteOrderConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  order: Order | null;
}

export function DeleteOrderConfirmationDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  order 
}: DeleteOrderConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!order) return;

    setLoading(true);
    try {
      await deleteOrder(order.id);
      
      toast({
        title: "Success",
        description: `Order ${order.order_number || `ORD-${order.id.substring(0, 8).toUpperCase()}`} has been deleted successfully.`,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // For orders, we'll allow deletion for now (can be restricted based on status if needed)
  const canDelete = true;

  if (!canDelete && order) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Cannot Delete Order</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Order {order.order_number || `ORD-${order.id.substring(0, 8).toUpperCase()}`} cannot be deleted.
              Only pending orders can be deleted.
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
            <span>Delete Order</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete order{" "}
            <span className="font-semibold">{order?.order_number || `ORD-${order?.id.substring(0, 8).toUpperCase()}`}</span>?
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
              "Delete Order"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}