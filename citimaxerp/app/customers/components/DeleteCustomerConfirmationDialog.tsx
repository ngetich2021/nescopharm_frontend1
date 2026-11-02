"use client";

import { useEffect, useState } from "react";
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
import { type Customer, type CustomerDeletionSummary, deleteCustomer, getCustomerDeletionSummary, getCustomerDisplayName } from "@/lib/customers";

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
  // undefined while loading; null when it could not be read.
  const [summary, setSummary] = useState<CustomerDeletionSummary | null | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !customer) return;
    setSummary(undefined);
    getCustomerDeletionSummary(customer.id).then(setSummary).catch(() => setSummary(null));
  }, [open, customer]);

  const handleDelete = async () => {
    if (!customer) return;

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

  const goesWith = summary
    ? ([
        [summary.orders, "order"],
        [summary.invoices, "invoice"],
        [summary.credit_notes, "credit note"],
        [summary.receipts, "receipt"],
        [summary.quotes, "quote"],
      ] as [number, string][])
        .filter(([n]) => n > 0)
        .map(([n, label]) => `${n} ${label}${n === 1 ? "" : "s"}`)
    : [];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Delete Customer
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete <strong>{getCustomerDisplayName(customer)}</strong>?
            </p>
            <span className="block text-sm text-gray-700">
              {summary === undefined ? (
                <span className="inline-flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking their records...
                </span>
              ) : summary === null ? (
                <>Everything recorded for them (orders, invoices, credit notes, receipts, quotes) is deleted with them.</>
              ) : goesWith.length ? (
                <>Everything recorded for them is deleted with them: <strong>{goesWith.join(", ")}</strong>. Stock on their orders goes back (except past orders).</>
              ) : (
                <>They have no orders, invoices, credit notes, receipts or quotes.</>
              )}
            </span>
            <span className="block text-sm font-semibold text-red-600">This cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}