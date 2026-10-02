"use client";

import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { type Customer, deleteCustomer, getCustomerDisplayName } from "@/lib/customers";

interface DeleteCustomerConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSuccess: () => void;
}

export function DeleteCustomerConfirmationDialog({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: DeleteCustomerConfirmationDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!customer) return;

    // Check if customer can be deleted
    if (customer.status === "active" && customer.total_orders > 0) {
      toast({
        title: "Cannot Delete Customer",
        description: "Active customers with existing orders cannot be deleted. Please set the customer to inactive first.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      await deleteCustomer(customer.id);
      
      toast({
        title: "Success! ✅",
        description: "Customer deleted successfully",
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!customer) return null;

  const canDelete = !(customer.status === "active" && customer.total_orders > 0);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Delete Customer
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {canDelete ? (
              <>
                <p>
                  Are you sure you want to delete <strong>{getCustomerDisplayName(customer)}</strong>?
                </p>
                <p className="text-sm text-gray-600">
                  This action cannot be undone. All customer data, including order history 
                  and associated records, will be permanently removed.
                </p>
              </>
            ) : (
              <>
                <p>
                  Cannot delete <strong>{getCustomerDisplayName(customer)}</strong> because they are an active customer with existing orders.
                </p>
                <p className="text-sm text-gray-600">
                  Active customers with orders cannot be deleted. Please set the customer status to 
                  "Inactive" first if you need to remove them from the active customer list.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          {canDelete && (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Customer
                </>
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}