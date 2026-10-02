"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { CreateLeaveRequestSheet } from "./CreateLeaveRequestSheet";
import { EditLeaveRequestSheet } from "./EditLeaveRequestSheet";
import { ViewLeaveRequestSheet } from "./ViewLeaveRequestSheet";
import { DeleteLeaveRequestDialog } from "./DeleteLeaveRequestDialog";
import { LeaveManagementTable } from "./LeaveManagementTable";
import { getLeaveRequests, type LeaveRequest } from "@/lib/leave";
import { useAuth } from "@/lib/auth-context";

export function LeaveManagementPage() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { toast } = useToast();

  const fetchLeaveRequests = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await getLeaveRequests({ search: searchTerm || undefined });
      setLeaveRequests(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load leave requests.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, [companyId]);

  useEffect(() => {
    const timer = setTimeout(() => fetchLeaveRequests(), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredRequests = leaveRequests.filter((lr) =>
    lr.employee.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredRequests.length / rowsPerPage);
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleCreateSuccess = () => {
    fetchLeaveRequests();
    toast({ title: "Success", description: "Leave request created successfully." });
  };

  const handleEditSuccess = () => {
    fetchLeaveRequests();
    toast({ title: "Success", description: "Leave request updated successfully." });
  };

  const handleDeleteSuccess = () => {
    fetchLeaveRequests();
    toast({ title: "Success", description: "Leave request deleted successfully." });
  };

  const handleViewLeaveRequest = (leaveRequest: LeaveRequest) => {
    setSelectedLeaveRequest(leaveRequest);
    setViewSheetOpen(true);
  };

  const handleEditLeaveRequest = (leaveRequest: LeaveRequest) => {
    setSelectedLeaveRequest(leaveRequest);
    setViewSheetOpen(false);
    setEditSheetOpen(true);
  };

  const handleDeleteLeaveRequest = (leaveRequest: LeaveRequest) => {
    setSelectedLeaveRequest(leaveRequest);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
            <p className="text-muted-foreground">Manage employee leave requests and approvals</p>
          </div>
        </div>
      </div>

      <LeaveManagementTable
        leaveRequests={paginatedRequests}
        loading={loading}
        onViewLeaveRequest={handleViewLeaveRequest}
        onEditLeaveRequest={handleEditLeaveRequest}
        onDeleteLeaveRequest={handleDeleteLeaveRequest}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        totalItems={filteredRequests.length}
        onRefresh={fetchLeaveRequests}
        onCreateNew={() => setCreateSheetOpen(true)}
      />

      <CreateLeaveRequestSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        onSuccess={handleCreateSuccess}
      />

      <ViewLeaveRequestSheet
        open={viewSheetOpen}
        onOpenChange={setViewSheetOpen}
        leaveRequest={selectedLeaveRequest}
        onEdit={handleEditLeaveRequest}
      />

      <EditLeaveRequestSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        onSuccess={handleEditSuccess}
        leaveRequest={selectedLeaveRequest}
      />

      <DeleteLeaveRequestDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
        leaveRequest={selectedLeaveRequest}
      />
    </div>
  );
}
