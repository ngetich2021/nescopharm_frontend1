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
import { balanceAfter, createLeaveRequest, emptyLeaveForm, leavePayload, type LeaveRequest } from "@/lib/leave";
import { getEmployees, type Employee } from "@/lib/employees";
import { useAuth } from "@/lib/auth-context";
import { LeaveFormFields } from "./LeaveFormFields";

interface CreateLeaveRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** All leave on record, for the balance left after this one. */
  leaveRequests: LeaveRequest[];
  recordsApprover: string | null;
}

export function CreateLeaveRequestSheet({ open, onOpenChange, onSuccess, leaveRequests, recordsApprover }: CreateLeaveRequestSheetProps) {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [form, setForm] = useState(emptyLeaveForm);
  const { toast } = useToast();

  useEffect(() => {
    if (open && companyId) {
      getEmployees({ company_id: companyId }).then((res) => setEmployees(res.employees || []));
    }
  }, [open, companyId]);

  const employee = employees.find((e) => e.id === employeeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await createLeaveRequest({ employee_id: employeeId, ...leavePayload(form) });
      setEmployeeId("");
      setForm(emptyLeaveForm());
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to create leave request.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Leave Request</SheetTitle>
          <SheetDescription>Fill in the leave form. Leave starting today or earlier is saved as an approved record.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
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
              <Label>Department</Label>
              <div className="rounded-md border bg-muted px-3 py-2 text-sm">{employee?.department || "—"}</div>
            </div>
          </div>

          <LeaveFormFields
            value={form}
            onChange={setForm}
            balanceAfter={employeeId ? balanceAfter(leaveRequests, employeeId, form) : null}
            recordsApprover={recordsApprover}
          />

          <SheetFooter className="mt-6">
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </SheetClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Request"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
