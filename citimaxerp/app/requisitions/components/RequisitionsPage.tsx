"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { RequisitionsSummary } from "./RequisitionsSummary";
import { RequisitionsTable } from "./RequisitionsTable";
import { RequisitionModal } from "./RequisitionModal";
import { CreateRequisitionModal } from "./CreateRequisitionModal";
import { EditRequisitionModal } from "./EditRequisitionModal";
import { DeleteRequisitionConfirmationDialog } from "./DeleteRequisitionConfirmationDialog";
import { ApproveRequisitionModal } from "./ApproveRequisitionModal";
import { CreateDispatchFromRequisitionModal } from "./CreateDispatchFromRequisitionModal";
import { listRequisitions, type Requisition, type RequisitionResponse } from "@/lib/requisitions";
import { PermissionGuard } from "@/components/PermissionGuard";

export function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRequisition, setEditRequisition] = useState<Requisition | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteRequisition, setDeleteRequisition] = useState<Requisition | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveRequisition, setApproveRequisition] = useState<Requisition | null>(null);
  const [createDispatchModalOpen, setCreateDispatchModalOpen] = useState(false);
  const [createDispatchRequisition, setCreateDispatchRequisition] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { toast } = useToast();

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      const response: RequisitionResponse = await listRequisitions();
      
      setRequisitions(response.data.data);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch requisitions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      // Here you would implement the search functionality when backend supports it
      // For now, we'll filter client-side
      if (search.trim() === "") {
        fetchRequisitions();
      }
    }, 500);

    setSearchDebounceTimer(timer);

    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [search]);

  // Filter requisitions client-side for now
  const filteredRequisitions = requisitions.filter(requisition =>
    requisition.requisition_number.toLowerCase().includes(search.toLowerCase()) ||
    requisition.requester.first_name.toLowerCase().includes(search.toLowerCase()) ||
    requisition.requester.last_name.toLowerCase().includes(search.toLowerCase()) ||
    requisition.status.toLowerCase().includes(search.toLowerCase()) ||
    requisition.approval_status.toLowerCase().includes(search.toLowerCase()) ||
    (requisition.notes && requisition.notes.toLowerCase().includes(search.toLowerCase()))
  );

  // Pagination
  const totalItems = filteredRequisitions.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedRequisitions = filteredRequisitions.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleViewRequisition = (requisition: Requisition) => {
    setSelectedRequisition(requisition);
    setModalOpen(true);
  };

  const handleEditRequisition = (requisition: Requisition) => {
    setEditRequisition(requisition);
    setEditModalOpen(true);
  };

  const handleDeleteRequisition = (requisition: Requisition) => {
    setDeleteRequisition(requisition);
    setDeleteModalOpen(true);
  };

  const handleApproveRequisition = (requisition: Requisition) => {
    setApproveRequisition(requisition);
    setApproveModalOpen(true);
  };

  const handleCreateDispatch = (requisition: Requisition) => {
    setCreateDispatchRequisition(requisition);
    setCreateDispatchModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRequisition(null);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    fetchRequisitions();
    toast({
      title: "Success",
      description: "Requisition created successfully.",
    });
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditRequisition(null);
    fetchRequisitions();
    toast({
      title: "Success",
      description: "Requisition updated successfully.",
    });
  };

  const handleDeleteSuccess = () => {
    setDeleteModalOpen(false);
    setDeleteRequisition(null);
    fetchRequisitions();
    // Toast is handled in the DeleteRequisitionConfirmationDialog
  };

  const handleApproveSuccess = () => {
    setApproveModalOpen(false);
    setApproveRequisition(null);
    fetchRequisitions();
    // Toast is handled in the ApproveRequisitionModal
  };

  const handleCreateDispatchSuccess = () => {
    setCreateDispatchModalOpen(false);
    setCreateDispatchRequisition(null);
    fetchRequisitions();
    // Toast is handled in the CreateDispatchFromRequisitionModal
  };

  const handleRefresh = () => {
    fetchRequisitions();
  };

  return (
    <PermissionGuard permissions={["can_view_requisitions_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Requisitions</h1>
          <p className="text-muted-foreground">Manage and track product requisitions across your organization</p>
        </div>

        <RequisitionsSummary requisitions={requisitions} loading={loading} />
        
        <RequisitionsTable
          requisitions={paginatedRequisitions}
          loading={loading}
          onViewRequisition={handleViewRequisition}
          onEditRequisition={handleEditRequisition}
          onDeleteRequisition={handleDeleteRequisition}
          onApproveRequisition={handleApproveRequisition}
          onCreateDispatch={handleCreateDispatch}
          search={search}
          onSearchChange={setSearch}
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          totalItems={filteredRequisitions.length}
          onRefresh={fetchRequisitions}
          onCreateNew={() => setCreateModalOpen(true)}
        />

        {/* Modal */}
        <RequisitionModal 
          open={modalOpen} 
          onOpenChange={setModalOpen} 
          requisition={selectedRequisition} 
          onClose={handleCloseModal}
          onRefresh={handleRefresh}
          onCreateDispatch={handleCreateDispatch}
        />

        {/* Create Modal */}
        <CreateRequisitionModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={handleCreateSuccess}
        />

        {/* Edit Modal */}
        <EditRequisitionModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onSuccess={handleEditSuccess}
          requisition={editRequisition}
        />

        {/* Delete Modal */}
        <DeleteRequisitionConfirmationDialog
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          onSuccess={handleDeleteSuccess}
          requisition={deleteRequisition}
        />

        {/* Approve Modal */}
        <ApproveRequisitionModal
          open={approveModalOpen}
          onOpenChange={setApproveModalOpen}
          onSuccess={handleApproveSuccess}
          requisition={approveRequisition}
        />

        {/* Create Dispatch Modal */}
        <CreateDispatchFromRequisitionModal
          open={createDispatchModalOpen}
          onOpenChange={setCreateDispatchModalOpen}
          onSuccess={handleCreateDispatchSuccess}
          requisition={createDispatchRequisition}
        />
      </div>
    </PermissionGuard>
  );
}