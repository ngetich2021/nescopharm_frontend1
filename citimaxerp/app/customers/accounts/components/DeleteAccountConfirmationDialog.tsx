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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { deleteCustomerAccount } from "@/lib/customer-accounts";
import { type CustomerAccountWithDetails } from "@/lib/customer-accounts";

interface DeleteAccountConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: CustomerAccountWithDetails | null;
  onSuccess: () => void;
}

export function DeleteAccountConfirmationDialog({
  open,
  onOpenChange,
  account,
  onSuccess,
}: DeleteAccountConfirmationDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!account) return;
    
    setIsDeleting(true);
    try {
      // Call the actual API function to delete the customer account
      await deleteCustomerAccount(account.id);
      
      toast({
        title: "Success",
        description: "Customer account deleted successfully.",
      });
      
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer account",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!account) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the customer account{" "}
            <span className="font-medium">{account.account_number}</span> and remove all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
              "Delete Account"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}