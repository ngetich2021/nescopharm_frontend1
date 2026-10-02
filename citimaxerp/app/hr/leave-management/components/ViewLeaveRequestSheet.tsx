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

interface LeaveRequest {
  id: string;
  employee: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
}

interface ViewLeaveRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveRequest: LeaveRequest | null;
  onEdit: (leaveRequest: LeaveRequest) => void;
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

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case "annual": return "Annual Leave";
      case "sick": return "Sick Leave";
      case "maternity": return "Maternity Leave";
      case "paternity": return "Paternity Leave";
      case "unpaid": return "Unpaid Leave";
      default: return type;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Leave Request Details</SheetTitle>
          <SheetDescription>
            View the details of this leave request.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Employee</h3>
              <p className="text-base font-medium">{leaveRequest.employee}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Leave Type</h3>
              <p className="text-base font-medium">{getLeaveTypeLabel(leaveRequest.leaveType)}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Start Date</h3>
                <p className="text-base font-medium">{leaveRequest.startDate}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">End Date</h3>
                <p className="text-base font-medium">{leaveRequest.endDate}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Reason</h3>
              <p className="text-base font-medium">{leaveRequest.reason}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <Badge className={getStatusColor(leaveRequest.status)}>
                {leaveRequest.status}
              </Badge>
            </div>
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