"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getCustomerDisplayName } from "@/lib/customers";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { approveOrRejectCustomerAccount, type CustomerAccountWithDetails } from "@/lib/customer-accounts";

interface ApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: CustomerAccountWithDetails | null;
  action: "approve" | "reject";
  onSuccess: () => void;
}

export function ApprovalModal({ open, onOpenChange, account, action, onSuccess }: ApprovalModalProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!account) return;
    
    if (!notes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide notes for this approval decision.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await approveOrRejectCustomerAccount(account.id, {
        status: action === "approve" ? "approved" : "rejected",
        notes: notes.trim(),
      });

      toast({
        title: "Success",
        description: `Account has been ${action === "approve" ? "approved" : "rejected"} successfully.`,
      });

      onSuccess();
      onOpenChange(false);
      setNotes("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} account.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setNotes("");
    onOpenChange(false);
  };

  if (!account) return null;

  const isApprove = action === "approve";
  const title = isApprove ? "Approve Account" : "Reject Account";
  const description = isApprove 
    ? "Please provide notes explaining why this account is being approved."
    : "Please provide notes explaining why this account is being rejected.";
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Account: {account.account_number}</p>
            <p className="text-sm text-muted-foreground">
              Customer: {account.customer ? getCustomerDisplayName(account.customer) : "N/A"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes *</Label>
            <Textarea
              id="notes"
              placeholder={
                isApprove
                  ? "e.g., Customer account meets all requirements. Credit history verified and business documentation complete."
                  : "e.g., Insufficient documentation provided. Credit history shows recent defaults."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !notes.trim()}
            className={
              isApprove
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              title
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}