"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "@/components/PermissionGuard";
import { CreateTimeEntrySheet } from "./CreateTimeEntrySheet";
import { EditTimeEntrySheet } from "./EditTimeEntrySheet";
import { ViewTimeEntrySheet } from "./ViewTimeEntrySheet";
import { DeleteTimeEntryDialog } from "./DeleteTimeEntryDialog";
import { TimeManagementTable } from "./TimeManagementTable";
import { getTimeEntries, type TimeEntry } from "@/lib/time-management";
import { useAuth } from "@/lib/auth-context";

export function TimeManagementPage() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTimeEntry, setSelectedTimeEntry] = useState<TimeEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { toast } = useToast();

  const fetchTimeEntries = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await getTimeEntries({ search: searchTerm || undefined });
      setTimeEntries(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load time entries.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeEntries();
  }, [companyId]);

  useEffect(() => {
    const timer = setTimeout(() => fetchTimeEntries(), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredEntries = timeEntries.filter((entry) =>
    entry.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.project.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredEntries.length / rowsPerPage);
  const paginatedEntries = filteredEntries.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleCreateSuccess = () => {
    fetchTimeEntries();
    toast({ title: "Success", description: "Time entry created successfully." });
  };

  const handleEditSuccess = () => {
    fetchTimeEntries();
    toast({ title: "Success", description: "Time entry updated successfully." });
  };

  const handleDeleteSuccess = () => {
    fetchTimeEntries();
    toast({ title: "Success", description: "Time entry deleted successfully." });
  };

  const handleViewTimeEntry = (timeEntry: TimeEntry) => {
    setSelectedTimeEntry(timeEntry);
    setViewSheetOpen(true);
  };

  const handleEditTimeEntry = (timeEntry: TimeEntry) => {
    setSelectedTimeEntry(timeEntry);
    setViewSheetOpen(false);
    setEditSheetOpen(true);
  };

  const handleDeleteTimeEntry = (timeEntry: TimeEntry) => {
    setSelectedTimeEntry(timeEntry);
    setDeleteDialogOpen(true);
  };

  return (
    <PermissionGuard permissions={["can_view_time_management_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Time Management</h1>
              <p className="text-muted-foreground">Track and manage employee working hours and attendance</p>
            </div>
          </div>
        </div>

        <TimeManagementTable
          timeEntries={paginatedEntries}
          loading={loading}
          onViewTimeEntry={handleViewTimeEntry}
          onEditTimeEntry={handleEditTimeEntry}
          onDeleteTimeEntry={handleDeleteTimeEntry}
          search={searchTerm}
          onSearchChange={setSearchTerm}
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          totalItems={filteredEntries.length}
          onRefresh={fetchTimeEntries}
          onCreateNew={() => setCreateSheetOpen(true)}
        />

        <CreateTimeEntrySheet
          open={createSheetOpen}
          onOpenChange={setCreateSheetOpen}
          onSuccess={handleCreateSuccess}
        />

        <ViewTimeEntrySheet
          open={viewSheetOpen}
          onOpenChange={setViewSheetOpen}
          timeEntry={selectedTimeEntry}
          onEdit={handleEditTimeEntry}
        />

        <EditTimeEntrySheet
          open={editSheetOpen}
          onOpenChange={setEditSheetOpen}
          onSuccess={handleEditSuccess}
          timeEntry={selectedTimeEntry}
        />

        <DeleteTimeEntryDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onSuccess={handleDeleteSuccess}
          timeEntry={selectedTimeEntry}
        />
      </div>
    </PermissionGuard>
  );
}
