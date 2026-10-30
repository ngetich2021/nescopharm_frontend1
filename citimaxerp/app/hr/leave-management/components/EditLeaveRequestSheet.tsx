"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { balanceAfter, emptyLeaveForm, leaveFormFrom, leavePayload, updateLeaveRequest, type LeaveRequest } from "@/lib/leave";
import { getEmployees, type Employee } from "@/lib/employees";
import { useAuth } from "@/lib/auth-context";
import { LeaveFormFields } from "./LeaveFormFields";

interface EditLeaveRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  leaveRequest: LeaveRequest | null;
  /** All leave on record, for the balance left after this one. */
  leaveRequests: LeaveRequest[];
  recordsApprover: string | null;
}

export function EditLeaveRequestSheet({ open, onOpenChange, onSuccess, leaveRequest, leaveRequests, recordsApprover }: EditLeaveRequestSheetProps) {
  const { companyId, hasPermission } = useAuth();
  const canApprove = hasPermission("can_approve_leave");
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [form, setForm] = useState(emptyLeaveForm);
  const [status, setStatus] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && companyId) {
      getEmployees({ company_id: companyId }).then((res) => setEmployees(res.employees || []));
    }
  }, [open, companyId]);

  useEffect(() => {
    if (leaveRequest) {
      setEmployeeId(leaveRequest.employee_id || "");
      setForm(leaveFormFrom(leaveRequest));
      setStatus(leaveRequest.status || "");
    }
  }, [leaveRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveRequest || loading) return;
    setLoading(true);
    try {
      await updateLeaveRequest(leaveRequest.id, {
        employee_id: employeeId,
        ...leavePayload(form),
        status,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to update leave request.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Leave Request</SheetTitle>
          <SheetDescription>Update the details below to modify this leave request.</SheetDescription>
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

          <LeaveFormFields
            value={form}
            onChange={setForm}
            balanceAfter={employeeId ? balanceAfter(leaveRequests, employeeId, form, leaveRequest?.id) : null}
            recordsApprover={recordsApprover}
            isRecord={!!leaveRequest?.isRecord}
          />

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
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            ) : (
              <>
                <div className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm capitalize text-muted-foreground">
                  {status || "pending"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Only GM, Directors, or this employee's assigned approver can approve or reject leave.
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
