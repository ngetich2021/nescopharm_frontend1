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

interface SalaryAdvanceRequest {
  id: string;
  employee: string;
  amount: string;
  requestDate: string;
  reason: string;
  status: string;
}

interface ViewSalaryAdvanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salaryAdvanceRequest: SalaryAdvanceRequest | null;
  onEdit: (salaryAdvanceRequest: SalaryAdvanceRequest) => void;
}

export function ViewSalaryAdvanceSheet({ open, onOpenChange, salaryAdvanceRequest, onEdit }: ViewSalaryAdvanceSheetProps) {
  if (!salaryAdvanceRequest) return null;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "rejected": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Salary Advance Request Details</SheetTitle>
          <SheetDescription>
            View the details of this salary advance request.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Employee</h3>
              <p className="text-base font-medium">{salaryAdvanceRequest.employee}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Amount</h3>
              <p className="text-base font-medium">KES {salaryAdvanceRequest.amount}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Request Date</h3>
              <p className="text-base font-medium">{salaryAdvanceRequest.requestDate}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Reason</h3>
              <p className="text-base font-medium">{salaryAdvanceRequest.reason}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <Badge className={getStatusColor(salaryAdvanceRequest.status)}>
                {salaryAdvanceRequest.status}
              </Badge>
            </div>
          </div>
        </div>
        
        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
          <Button onClick={() => onEdit(salaryAdvanceRequest)}>Edit</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}