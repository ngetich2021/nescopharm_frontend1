"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDuration, leaveTypeLabel, reasonCategoryLabel, type LeaveRequest } from "@/lib/leave";

interface ViewLeaveRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveRequest: LeaveRequest | null;
  onEdit: (leaveRequest: LeaveRequest) => void;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500">{label}</h3>
      <p className="text-base font-medium">{value || "—"}</p>
    </div>
  );
}

export function ViewLeaveRequestSheet({ open, onOpenChange, leaveRequest, onEdit }: ViewLeaveRequestSheetProps) {
  if (!leaveRequest) return null;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "rejected": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const decided = ["approved", "rejected"].includes(leaveRequest.status.toLowerCase());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Leave Request Details</SheetTitle>
          <SheetDescription>
            {leaveRequest.isRecord ? "Recorded after the leave was taken." : "View the details of this leave request."}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Employee" value={leaveRequest.employee} />
            <Field label="Department" value={leaveRequest.department} />
            <Field label="Leave Type" value={leaveTypeLabel(leaveRequest.leaveType)} />
            <Field label="Date of Request" value={leaveRequest.requestDate} />
            <Field label="Start Date (Day Out)" value={leaveRequest.startDate} />
            <Field label="Last Day of Leave" value={leaveRequest.endDate} />
            <Field label="Reporting Date (Day In)" value={leaveRequest.reportingDate} />
            <Field label="Total Requested" value={formatDuration(leaveRequest)} />
            <Field label="Balance After This Leave" value={leaveRequest.balanceDays != null ? `${leaveRequest.balanceDays} days` : null} />
            <Field label="Reason for Request" value={reasonCategoryLabel(leaveRequest.reasonCategory)} />
          </div>

          <Field label="Details" value={leaveRequest.reason} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <Badge className={getStatusColor(leaveRequest.status)}>
                {leaveRequest.status}
              </Badge>
            </div>
            {decided && (
              <Field
                label={leaveRequest.status.toLowerCase() === "approved" ? "Approved By" : "Rejected By"}
                value={[leaveRequest.approvedBy, leaveRequest.approvedAt].filter(Boolean).join(" · ")}
              />
            )}
          </div>
        </div>

        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
          <Button onClick={() => onEdit(leaveRequest)}>Edit</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
