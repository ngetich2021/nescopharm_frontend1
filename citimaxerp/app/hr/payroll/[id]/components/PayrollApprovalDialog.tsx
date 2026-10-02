"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { PayrollRecord } from "@/lib/payroll";
import { formatCurrency } from "@/lib/finance";
import { useAuth } from "@/lib/auth-context";

interface PayrollApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollRecord: PayrollRecord;
  onApprove: () => Promise<void>;
}

export function PayrollApprovalDialog({
  open,
  onOpenChange,
  payrollRecord,
  onApprove,
}: PayrollApprovalDialogProps) {
  const [loading, setLoading] = useState(false);
  const { hasPermission } = useAuth();

  const handleApprove = async () => {
    try {
      setLoading(true);
      await onApprove();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Draft</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Approved</Badge>;
      case "paid":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Paid</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canApprove = payrollRecord.status.toLowerCase() === 'draft' && hasPermission("can_approve_payroll");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Approve Payroll Record</span>
          </DialogTitle>
          <DialogDescription>
            Review the payroll details below and confirm approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payroll Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Payroll Number</span>
              <span className="text-sm font-semibold text-primary">
                {payrollRecord.payroll_number}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Pay Period</span>
              <span className="text-sm">
                {format(new Date(payrollRecord.pay_period_start), 'MMM d')} - {format(new Date(payrollRecord.pay_period_end), 'MMM d, yyyy')}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Employees</span>
              <span className="text-sm font-semibold">
                {payrollRecord.employee_count} employees
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Total Net Pay</span>
              <span className="text-sm font-bold text-primary">
                {formatCurrency(parseFloat(payrollRecord.total_net_pay))}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Current Status</span>
              {getStatusBadge(payrollRecord.status)}
            </div>
          </div>

          {/* Warning/Info Message */}
          {canApprove ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Once approved, this payroll record cannot be modified. 
                Please ensure all details are correct before proceeding.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                {payrollRecord.status.toLowerCase() !== 'draft' ? (
                  <>This payroll record is already <strong>{payrollRecord.status}</strong> and cannot be approved.</>
                ) : (
                  <>Only GM or Directors can approve payroll.</>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Approval Details Preview */}
          {canApprove && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-2">After Approval:</div>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Status will change to "Approved"</li>
                <li>• Approval timestamp will be recorded</li>
                <li>• Payroll will be ready for payment processing</li>
                <li>• No further modifications will be allowed</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={loading || !canApprove}
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Approving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Payroll
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}