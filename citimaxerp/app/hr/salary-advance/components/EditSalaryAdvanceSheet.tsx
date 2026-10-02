"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { updateSalaryAdvance, type SalaryAdvanceRequest } from "@/lib/salary-advance";
import { getEmployees, type Employee } from "@/lib/employees";
import { useAuth } from "@/lib/auth-context";

interface EditSalaryAdvanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  salaryAdvanceRequest: SalaryAdvanceRequest | null;
}

export function EditSalaryAdvanceSheet({ open, onOpenChange, onSuccess, salaryAdvanceRequest }: EditSalaryAdvanceSheetProps) {
  const { companyId, hasPermission } = useAuth();
  const canApprove = hasPermission("can_approve_salary_changes");
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && companyId) {
      getEmployees({ company_id: companyId }).then((res) => setEmployees(res.employees || []));
    }
  }, [open, companyId]);

  useEffect(() => {
    if (salaryAdvanceRequest) {
      setEmployeeId(salaryAdvanceRequest.employee_id || "");
      setAmount(salaryAdvanceRequest.amount || "");
      setRequestDate(salaryAdvanceRequest.requestDate || "");
      setReason(salaryAdvanceRequest.reason || "");
      setStatus(salaryAdvanceRequest.status || "");
    }
  }, [salaryAdvanceRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryAdvanceRequest) return;
    setLoading(true);
    try {
      await updateSalaryAdvance(salaryAdvanceRequest.id, {
        employee_id: employeeId,
        amount: parseFloat(amount),
        request_date: requestDate,
        reason,
        status,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update salary advance request.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit Salary Advance Request</SheetTitle>
          <SheetDescription>Update the details below to modify this salary advance request.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="employeeId">Employee</Label>
            <select
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input id="amount" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requestDate">Request Date</Label>
            <Input id="requestDate" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for salary advance" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            {canApprove ? (
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            ) : (
              <>
                <div className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm capitalize text-muted-foreground">
                  {status || "pending"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Only GM, Directors, or this employee's assigned approver can approve or reject salary advances.
                </p>
              </>
            )}
          </div>

          <SheetFooter className="mt-6">
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </SheetClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Request"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
