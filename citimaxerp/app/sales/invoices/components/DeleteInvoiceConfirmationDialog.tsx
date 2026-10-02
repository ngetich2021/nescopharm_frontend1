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
import { deleteInvoice } from "@/lib/invoices";
import { Invoice } from "@/lib/invoices";

interface DeleteInvoiceConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  invoice: Invoice | null;
}

export function DeleteInvoiceConfirmationDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  invoice 
}: DeleteInvoiceConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!invoice) return;

    setLoading(true);
    try {
      await deleteInvoice(invoice.id);
      
      toast({
        title: "Success",
        description: `Invoice ${invoice.invoice_number} has been deleted successfully.`,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // For invoices, we'll allow deletion for draft invoices only
  const canDelete = invoice?.status === 'draft';

  if (!canDelete && invoice) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <span>Cannot Delete Invoice</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Invoice {invoice.invoice_number} cannot be deleted.
              Only draft invoices can be deleted.
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
            <span>Delete Invoice</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete invoice{" "}
            <span className="font-semibold">{invoice?.invoice_number}</span>?
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
              "Delete Invoice"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}