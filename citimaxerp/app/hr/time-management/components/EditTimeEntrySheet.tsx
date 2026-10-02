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
import { updateTimeEntry, type TimeEntry } from "@/lib/time-management";
import { getEmployees, type Employee } from "@/lib/employees";
import { useAuth } from "@/lib/auth-context";

interface EditTimeEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  timeEntry: TimeEntry | null;
}

export function EditTimeEntrySheet({ open, onOpenChange, onSuccess, timeEntry }: EditTimeEntrySheetProps) {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
  const [project, setProject] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && companyId) {
      getEmployees({ company_id: companyId }).then((res) => setEmployees(res.employees || []));
    }
  }, [open, companyId]);

  useEffect(() => {
    if (timeEntry) {
      setEmployeeId(timeEntry.employee_id || "");
      setDate(timeEntry.date || "");
      setHours(timeEntry.hours || "");
      setProject(timeEntry.project || "");
      setDescription(timeEntry.description || "");
      setStatus(timeEntry.status || "");
    }
  }, [timeEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeEntry) return;
    setLoading(true);
    try {
      await updateTimeEntry(timeEntry.id, {
        employee_id: employeeId,
        date,
        hours: parseFloat(hours),
        project,
        description,
        status,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update time entry.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit Time Entry</SheetTitle>
          <SheetDescription>Update the details below to modify this time entry.</SheetDescription>
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
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Hours</Label>
            <Input id="hours" type="number" step="0.25" min="0.25" max="24" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Enter hours worked" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Input id="project" value={project} onChange={(e) => setProject(e.target.value)} placeholder="Enter project name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of work done" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <SheetFooter className="mt-6">
            <SheetClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </SheetClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Entry"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
