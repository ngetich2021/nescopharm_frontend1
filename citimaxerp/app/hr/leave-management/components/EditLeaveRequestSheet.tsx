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
import { updateLeaveRequest, type LeaveRequest } from "@/lib/leave";
import { getEmployees, type Employee } from "@/lib/employees";
import { useAuth } from "@/lib/auth-context";

interface EditLeaveRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  leaveRequest: LeaveRequest | null;
}

export function EditLeaveRequestSheet({ open, onOpenChange, onSuccess, leaveRequest }: EditLeaveRequestSheetProps) {
  const { companyId, hasPermission } = useAuth();
  const canApprove = hasPermission("can_approve_leave");
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
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
      setLeaveType(leaveRequest.leaveType || "");
      setStartDate(leaveRequest.startDate || "");
      setEndDate(leaveRequest.endDate || "");
      setReason(leaveRequest.reason || "");
      setStatus(leaveRequest.status || "");
    }
  }, [leaveRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveRequest) return;
    setLoading(true);
    try {
      await updateLeaveRequest(leaveRequest.id, {
        employee_id: employeeId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
        status,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update leave request.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
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

          <div className="space-y-2">
            <Label htmlFor="leaveType">Leave Type</Label>
            <select
              id="leaveType"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              <option value="">Select leave type</option>
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="maternity">Maternity Leave</option>
              <option value="paternity">Paternity Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for leave" required />
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
