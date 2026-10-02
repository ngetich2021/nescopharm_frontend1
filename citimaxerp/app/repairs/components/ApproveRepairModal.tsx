"use client";

import { useState, useEffect } from "react";
import { approveRepair, type Repair } from "@/lib/repairs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  XCircle,
  Loader2,
  ClipboardCheck,
  AlertTriangle,
  Calendar,
  User,
  Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ApproveRepairModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  repair: Repair | null;
}

interface FormData {
  decision: "approved" | "rejected" | "";
  approval_notes: string;
  rejection_reason?: string;
}

interface FormErrors {
  decision?: string;
  approval_notes?: string;
  rejection_reason?: string;
}

const REJECTION_REASONS = [
  "insufficient_information",
  "not_repairable",
  "duplicate_request",
  "cost_too_high",
  "policy_violation",
  "missing_documentation",
  "other"
];

const REJECTION_REASON_LABELS: Record<string, string> = {
  "insufficient_information": "Insufficient Information",
  "not_repairable": "Item Not Repairable",
  "duplicate_request": "Duplicate Request",
  "cost_too_high": "Cost Too High",
  "policy_violation": "Policy Violation",
  "missing_documentation": "Missing Documentation",
  "other": "Other"
};

export function ApproveRepairModal({
  open,
  onOpenChange,
  onSuccess,
  repair,
}: ApproveRepairModalProps) {
  const [formData, setFormData] = useState<FormData>({
    decision: "",
    approval_notes: "",
    rejection_reason: undefined,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setFormData({
        decision: "",
        approval_notes: "",
        rejection_reason: undefined,
      });
      setErrors({});
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.decision) {
      newErrors.decision = "Decision is required";
    }

    if (formData.decision === "rejected" && !formData.rejection_reason) {
      newErrors.rejection_reason = "Rejection reason is required";
    }

    if (!formData.approval_notes.trim()) {
      newErrors.approval_notes = "Notes are required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !repair) return;

    setLoading(true);
    try {
      const payload = {
        approval_status: formData.decision as "approved" | "rejected",
        notes: formData.approval_notes.trim(),
        rejection_reason: formData.decision === "rejected" ? formData.rejection_reason : undefined
      };

      await approveRepair(repair.id, payload);
      
      toast({
        title: "Success",
        description: `Repair ${formData.decision === "approved" ? "approved" : "rejected"} successfully.`,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error processing approval:", error);
      toast({
        title: "Error",
        description: "Failed to process approval. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canApprove = repair?.approval_status === "pending";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center space-x-2">
            <ClipboardCheck className="h-5 w-5 text-green-600" />
            <span>Approve Repair Request</span>
          </SheetTitle>
          <SheetDescription>
            {repair ? `Review and approve repair ${repair.repair_number}` : "Review repair request details"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Repair Summary */}
          {repair && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Wrench className="h-5 w-5 text-blue-600" />
                  <span>Repair Summary</span>
                </CardTitle>
                <CardDescription>
                  Review the repair request details before making your decision
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Repair Number</Label>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-[#E30040]">{repair.repair_number}</span>
                        <Badge 
                          variant={
                            repair.approval_status === "approved" ? "default" : 
                            repair.approval_status === "rejected" ? "destructive" : 
                            "secondary"
                          }
                        >
                          {repair.approval_status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Date Reported</Label>
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(repair.created_at), "MMM dd, yyyy 'at' HH:mm")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reporter Info */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Reported By</Label>
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <User className="h-4 w-4" />
                        <span>
                          {repair.reporter?.first_name} {repair.reporter?.last_name}
                        </span>
                      </div>
                    </div>
                    {repair.description && (
                      <div>
                        <Label className="text-sm font-medium">Description</Label>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{repair.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Summary */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Items for Repair ({repair.items.length})
                  </h4>
                  <div className="space-y-3">
                    {repair.items.map((item, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.product?.name}</p>
                            {item.variant && (
                              <p className="text-sm text-gray-600">Variant: {item.variant.name}</p>
                            )}
                            <p className="text-xs text-gray-500">SKU: {item.product?.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">Qty: {item.quantity}</p>
                            <Badge 
                              variant={item.is_repairable ? "default" : "secondary"}
                              className={item.is_repairable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                            >
                              {item.is_repairable ? "Repairable" : "Not Repairable"}
                            </Badge>
                          </div>
                        </div>
                        {item.notes && (
                          <div className="mt-2">
                            <span className="font-medium text-sm">Notes: </span>
                            <span className="text-sm text-gray-700">{item.notes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval Decision */}
          {canApprove && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Approval Decision</CardTitle>
                <CardDescription>
                  Make your decision and provide feedback
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Decision */}
                <div className="space-y-2">
                  <Label>Decision *</Label>
                  <Select 
                    value={formData.decision} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      decision: value as "approved" | "rejected",
                      rejection_reason: value === "approved" ? undefined : prev.rejection_reason
                    }))}
                  >
                    <SelectTrigger className={errors.decision ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>Approve</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="rejected">
                        <div className="flex items-center space-x-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span>Reject</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.decision && (
                    <p className="text-sm text-red-600">{errors.decision}</p>
                  )}
                </div>

                {/* Rejection Reason (only shown if rejecting) */}
                {formData.decision === "rejected" && (
                  <div className="space-y-2">
                    <Label>Rejection Reason *</Label>
                    <Select 
                      value={formData.rejection_reason || ""} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, rejection_reason: value }))}
                    >
                      <SelectTrigger className={errors.rejection_reason ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select reason for rejection" />
                      </SelectTrigger>
                      <SelectContent>
                        {REJECTION_REASONS.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {REJECTION_REASON_LABELS[reason]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.rejection_reason && (
                      <p className="text-sm text-red-600">{errors.rejection_reason}</p>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>
                    {formData.decision === "approved" ? "Approval Notes" : "Notes"} *
                  </Label>
                  <Textarea
                    placeholder={
                      formData.decision === "approved" 
                        ? "Add any approval notes or instructions..."
                        : formData.decision === "rejected"
                        ? "Explain the reason for rejection and any required actions..."
                        : "Add your notes about this repair request..."
                    }
                    value={formData.approval_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, approval_notes: e.target.value }))}
                    rows={4}
                    className={errors.approval_notes ? "border-red-500" : ""}
                  />
                  {errors.approval_notes && (
                    <p className="text-sm text-red-600">{errors.approval_notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Already Processed Warning */}
          {repair && !canApprove && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    This repair request has already been {repair.approval_status}.
                    {repair.approver && ` Processed by ${repair.approver.first_name} ${repair.approver.last_name}`}
                    {repair.approved_at && ` on ${format(new Date(repair.approved_at), "MMM dd, yyyy 'at' HH:mm")}`}.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <SheetFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canApprove && (
              <Button 
                onClick={handleSubmit} 
                disabled={loading}
                className={cn(
                  "min-w-[120px]",
                  formData.decision === "approved" 
                    ? "bg-green-600 hover:bg-green-700" 
                    : formData.decision === "rejected"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {formData.decision === "approved" && <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {formData.decision === "rejected" && <XCircle className="h-4 w-4 mr-2" />}
                    {formData.decision ? `${formData.decision === "approved" ? "Approve" : "Reject"} Repair` : "Make Decision"}
                  </>
                )}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}