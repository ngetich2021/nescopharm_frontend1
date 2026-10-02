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
import { createSalaryAdvance } from "@/lib/salary-advance";
import { getEmployees, type Employee } from "@/lib/employees";
import { useAuth } from "@/lib/auth-context";

interface CreateSalaryAdvanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateSalaryAdvanceSheet({ open, onOpenChange, onSuccess }: CreateSalaryAdvanceSheetProps) {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && companyId) {
      getEmployees({ company_id: companyId }).then((res) => setEmployees(res.employees || []));
    }
  }, [open, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createSalaryAdvance({
        employee_id: employeeId,
        amount: parseFloat(amount),
        request_date: requestDate,
        reason,
      });
      setEmployeeId("");
      setAmount("");
      setRequestDate("");
      setReason("");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create salary advance request.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create Salary Advance Request</SheetTitle>
          <SheetDescription>Fill in the details below to create a new salary advance request.</SheetDescription>
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
