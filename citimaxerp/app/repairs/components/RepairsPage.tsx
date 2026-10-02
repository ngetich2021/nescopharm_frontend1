"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { RepairsSummary } from "./RepairsSummary";
import { RepairsTable } from "./RepairsTable";
import { RepairModal } from "./RepairModal";
import { CreateRepairModal } from "./CreateRepairModal";
import { EditRepairModal } from "./EditRepairModal";
import { UpdateRepairStatusModal } from "./UpdateRepairStatusModal";
import { DeleteRepairConfirmationDialog } from "./DeleteRepairConfirmationDialog";
import { ApproveRepairModal } from "./ApproveRepairModal";
import { AssignRepairModal } from "./AssignRepairModal";
import { listRepairs, type Repair, type RepairResponse } from "@/lib/repairs";

export function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRepair, setEditRepair] = useState<Repair | null>(null);
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
  const [updateStatusRepair, setUpdateStatusRepair] = useState<Repair | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteRepair, setDeleteRepair] = useState<Repair | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveRepair, setApproveRepair] = useState<Repair | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignRepair, setAssignRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { toast } = useToast();

  const fetchRepairs = async () => {
    setLoading(true);
    try {
      const response: RepairResponse = await listRepairs();
      setRepairs(response.data.data);
    } catch (error) {
      console.error('Error fetching repairs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch repairs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepairs();
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      if (search.trim() === "") {
        fetchRepairs();
      }
    }, 500);

    setSearchDebounceTimer(timer);

    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [search]);

  // Filter repairs client-side for now
  const filteredRepairs = repairs.filter(repair =>
    repair.repair_number.toLowerCase().includes(search.toLowerCase()) ||
    repair.description.toLowerCase().includes(search.toLowerCase()) ||
    (repair.reporter?.first_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (repair.reporter?.last_name || "").toLowerCase().includes(search.toLowerCase()) ||
    repair.status.toLowerCase().includes(search.toLowerCase()) ||
    (repair.priority || "").toLowerCase().includes(search.toLowerCase()) ||
    (repair.notes && repair.notes.toLowerCase().includes(search.toLowerCase())) ||
    (repair.repair_notes && repair.repair_notes.toLowerCase().includes(search.toLowerCase()))
  );

  // Pagination
  const totalItems = filteredRepairs.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedRepairs = filteredRepairs.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleViewRepair = (repair: Repair) => {
    setSelectedRepair(repair);
    setModalOpen(true);
  };

  const handleEditRepair = (repair: Repair) => {
    setEditRepair(repair);
    setEditModalOpen(true);
  };

  const handleUpdateStatus = (repair: Repair) => {
    setUpdateStatusRepair(repair);
    setUpdateStatusModalOpen(true);
  };

  const handleDeleteRepair = (repair: Repair) => {
    setDeleteRepair(repair);
    setDeleteModalOpen(true);
  };

  const handleApproveRepair = (repair: Repair) => {
    setApproveRepair(repair);
    setApproveModalOpen(true);
  };

  const handleAssignRepair = (repair: Repair) => {
    setAssignRepair(repair);
    setAssignModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRepair(null);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    fetchRepairs();
    toast({
      title: "Success",
      description: "Repair report created successfully.",
    });
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditRepair(null);
    fetchRepairs();
    toast({
      title: "Success",
      description: "Repair updated successfully.",
    });
  };

  const handleUpdateStatusSuccess = () => {
    setUpdateStatusModalOpen(false);
    setUpdateStatusRepair(null);
    fetchRepairs();
    toast({
      title: "Success",
      description: "Repair status updated successfully.",
    });
  };

  const handleDeleteSuccess = () => {
    setDeleteModalOpen(false);
    setDeleteRepair(null);
    fetchRepairs();
    toast({
      title: "Success",
      description: "Repair deleted successfully.",
    });
  };

  const handleApproveSuccess = () => {
    setApproveModalOpen(false);
    setApproveRepair(null);
    fetchRepairs();
    toast({
      title: "Success",
      description: "Repair approval processed successfully.",
    });
  };

  const handleAssignSuccess = () => {
    setAssignModalOpen(false);
    setAssignRepair(null);
    fetchRepairs();
    toast({
      title: "Success",
      description: "Repair items assigned successfully.",
    });
  };

  const handleRefresh = () => {
    fetchRepairs();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Repairs</h1>
        <p className="text-muted-foreground">Track and manage product repairs and maintenance requests</p>
      </div>

      <RepairsSummary repairs={repairs} loading={loading} />
      
      <RepairsTable
        repairs={paginatedRepairs}
        loading={loading}
        onViewRepair={handleViewRepair}
        onEditRepair={handleEditRepair}
        onUpdateStatus={handleUpdateStatus}
        onDeleteRepair={handleDeleteRepair}
        onApproveRepair={handleApproveRepair}
        onAssignRepair={handleAssignRepair}
        search={search}
        onSearchChange={setSearch}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        totalItems={filteredRepairs.length}
        onRefresh={fetchRepairs}
        onCreateNew={() => setCreateModalOpen(true)}
      />

      {/* Modal Components */}
      {selectedRepair && (
        <RepairModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          repair={selectedRepair}
          onClose={handleCloseModal}
          onRefresh={handleRefresh}
          onEditRepair={handleEditRepair}
          onUpdateStatus={handleUpdateStatus}
          onDeleteRepair={handleDeleteRepair}
          onApproveRepair={handleApproveRepair}
          onAssignRepair={handleAssignRepair}
        />
      )}

      <CreateRepairModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      {editRepair && (
        <EditRepairModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          repair={editRepair}
          onSuccess={handleEditSuccess}
        />
      )}

      {updateStatusRepair && (
        <UpdateRepairStatusModal
          open={updateStatusModalOpen}
          onOpenChange={setUpdateStatusModalOpen}
          repair={updateStatusRepair}
          onSuccess={handleUpdateStatusSuccess}
        />
      )}

      {deleteRepair && (
        <DeleteRepairConfirmationDialog
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          repair={deleteRepair}
          onSuccess={handleDeleteSuccess}
        />
      )}

      <ApproveRepairModal
        open={approveModalOpen}
        onOpenChange={setApproveModalOpen}
        onSuccess={handleApproveSuccess}
        repair={approveRepair}
      />

      <AssignRepairModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        onSuccess={handleAssignSuccess}
        repair={assignRepair}
      />
    </div>
  );
}