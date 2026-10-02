"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, File, Download, Eye, CheckCircle2, Truck } from "lucide-react";
import { OrderDispatch } from "@/lib/order-dispatches";
import { uploadDeliveryNote, updateLogistics, type Logistics } from "@/lib/logistics";
import { useToast } from "@/hooks/use-toast";

interface MarkDeliveredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: OrderDispatch;
  onSuccess?: () => void;
}

export function MarkDeliveredModal({ open, onOpenChange, dispatch, onSuccess }: MarkDeliveredModalProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [logistic, setLogistic] = useState<OrderDispatch["logistic"]>(dispatch.logistic ?? null);

  useEffect(() => {
    if (open) {
      setLogistic(dispatch.logistic ?? null);
    }
  }, [open, dispatch]);

  const hasDeliveryNote = !!logistic?.delivery_note_file;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dispatch.logistic?.id) return;
    setUploading(true);
    try {
      const updated = await uploadDeliveryNote(dispatch.logistic.id, file);
      setLogistic((prev) => ({ ...prev, ...updated } as OrderDispatch["logistic"]));
      toast({ title: "Delivery note uploaded", description: "You can now mark this dispatch as delivered." });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!hasDeliveryNote || !dispatch.logistic?.id) {
      toast({
        title: "Delivery note required",
        description: "Upload the stamped delivery note before marking this dispatch as delivered.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await updateLogistics(dispatch.logistic.id, {
        delivery_status: "delivered",
        actual_delivery_time: new Date().toISOString(),
        update_order_status: true,
      });
      toast({ title: "Success", description: "Dispatch marked as delivered." });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to mark dispatch as delivered.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-green-600" />
            Mark Dispatch #{dispatch.dispatch_number} as Delivered
          </DialogTitle>
          <DialogDescription>
            Upload the customer-stamped delivery note as proof of receipt before closing out this dispatch.
          </DialogDescription>
        </DialogHeader>

        <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
          {hasDeliveryNote ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Delivery note uploaded
              </div>
              <div className="flex gap-2">
                {logistic?.delivery_note_url && (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <a href={logistic.delivery_note_url} target="_blank" rel="noopener noreferrer">
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={logistic.delivery_note_url} download>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </>
                )}
              </div>
              <label htmlFor="delivery-note-replace" className="inline-block">
                <input
                  id="delivery-note-replace"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <Button variant="ghost" size="sm" asChild className="cursor-pointer text-xs">
                  <span>{uploading ? "Uploading..." : "Replace file"}</span>
                </Button>
              </label>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-amber-600 text-sm">
                <File className="h-5 w-5" />
                No stamped delivery note uploaded yet
              </div>
              <label htmlFor="delivery-note-upload">
                <input
                  id="delivery-note-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <Button variant="outline" size="sm" asChild className="cursor-pointer">
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Upload Delivery Note"}
                  </span>
                </Button>
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading || !hasDeliveryNote}
            className="bg-green-600 hover:bg-green-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Mark as Delivered
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
