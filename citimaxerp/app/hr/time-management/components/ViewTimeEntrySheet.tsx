"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface TimeEntry {
  id: string;
  employee: string;
  date: string;
  hours: string;
  project: string;
  description: string;
}

interface ViewTimeEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeEntry: TimeEntry | null;
  onEdit: (timeEntry: TimeEntry) => void;
}

export function ViewTimeEntrySheet({ open, onOpenChange, timeEntry, onEdit }: ViewTimeEntrySheetProps) {
  if (!timeEntry) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Time Entry Details</SheetTitle>
          <SheetDescription>
            View the details of this time entry.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Employee</h3>
              <p className="text-base font-medium">{timeEntry.employee}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Date</h3>
              <p className="text-base font-medium">{timeEntry.date}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Hours</h3>
              <p className="text-base font-medium">{timeEntry.hours} hours</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Project</h3>
              <p className="text-base font-medium">{timeEntry.project}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Description</h3>
              <p className="text-base font-medium">{timeEntry.description}</p>
            </div>
          </div>
        </div>
        
        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
          <Button onClick={() => onEdit(timeEntry)}>Edit</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}