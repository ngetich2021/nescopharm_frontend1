"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { BreakagesSummary } from "./BreakagesSummary";
import { BreakagesTable } from "./BreakagesTable";
import { BreakageModal } from "./BreakageModal";
import { CreateBreakageModal } from "./CreateBreakageModal";
import { EditBreakageModal } from "./EditBreakageModal";
import { CreateDispatchFromBreakageModal } from "./CreateDispatchFromBreakageModal";
import { DeleteBreakageConfirmationDialog } from "./DeleteBreakageConfirmationDialog";
import { ApproveBreakageModal } from "./ApproveBreakageModal";
import { listBreakages, type Breakage, type BreakageResponse } from "@/lib/breakages";

export function BreakagesPage() {
  const [breakages, setBreakages] = useState<Breakage[]>([]);
  const [selectedBreakage, setSelectedBreakage] = useState<Breakage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editBreakage, setEditBreakage] = useState<Breakage | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteBreakage, setDeleteBreakage] = useState<Breakage | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveBreakage, setApproveBreakage] = useState<Breakage | null>(null);
  const [createDispatchModalOpen, setCreateDispatchModalOpen] = useState(false);
  const [dispatchBreakage, setDispatchBreakage] = useState<Breakage | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { toast } = useToast();

  const fetchBreakages = async () => {
    setLoading(true);
    try {
      const response: BreakageResponse = await listBreakages();
      setBreakages(response.breakages.data);
    } catch (error) {
      console.error('Error fetching breakages:', error);
      toast({
        title: "Error",
        description: "Failed to fetch breakages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreakages();
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      if (search.trim() === "") {
        fetchBreakages();
      }
    }, 500);

    setSearchDebounceTimer(timer);

    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [search]);

  // Filter breakages client-side for now
  const filteredBreakages = breakages.filter(breakage =>
    breakage.breakage_number.toLowerCase().includes(search.toLowerCase()) ||
    (breakage.reporter?.first_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (breakage.reporter?.last_name || "").toLowerCase().includes(search.toLowerCase()) ||
    breakage.status.toLowerCase().includes(search.toLowerCase()) ||
    breakage.approval_status.toLowerCase().includes(search.toLowerCase()) ||
    (breakage.notes && breakage.notes.toLowerCase().includes(search.toLowerCase())) ||
    breakage.items.some(item => 
      item.cause.toLowerCase().includes(search.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(search.toLowerCase()))
    )
  );

  // Pagination
  const totalItems = filteredBreakages.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedBreakages = filteredBreakages.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleViewBreakage = (breakage: Breakage) => {
    setSelectedBreakage(breakage);
    setModalOpen(true);
  };

  const handleEditBreakage = (breakage: Breakage) => {
    setEditBreakage(breakage);
    setEditModalOpen(true);
  };

  const handleDeleteBreakage = (breakage: Breakage) => {
    setDeleteBreakage(breakage);
    setDeleteModalOpen(true);
  };

  const handleApproveBreakage = (breakage: Breakage) => {
    setApproveBreakage(breakage);
    setApproveModalOpen(true);
  };

  const handleCreateDispatch = (breakage: Breakage) => {
    setDispatchBreakage(breakage);
    setCreateDispatchModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedBreakage(null);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    fetchBreakages();
    toast({
      title: "Success",
      description: "Breakage reported successfully.",
    });
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditBreakage(null);
    fetchBreakages();
    toast({
      title: "Success",
      description: "Breakage updated successfully.",
    });
  };

  const handleDeleteSuccess = () => {
    setDeleteModalOpen(false);
    setDeleteBreakage(null);
    fetchBreakages();
  };

  const handleApproveSuccess = () => {
    setApproveModalOpen(false);
    setApproveBreakage(null);
    fetchBreakages();
  };

  const handleCreateDispatchSuccess = () => {
    setCreateDispatchModalOpen(false);
    setDispatchBreakage(null);
    fetchBreakages();
  };

  const handleRefresh = () => {
    fetchBreakages();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Breakages</h1>
        <p className="text-muted-foreground">Track and manage product breakages and replacement requests</p>
      </div>

      <BreakagesSummary breakages={breakages} loading={loading} />
      
      <BreakagesTable
        breakages={paginatedBreakages}
        loading={loading}
        onViewBreakage={handleViewBreakage}
        onEditBreakage={handleEditBreakage}
        onDeleteBreakage={handleDeleteBreakage}
        onApproveBreakage={handleApproveBreakage}
        onCreateDispatch={handleCreateDispatch}
        search={search}
        onSearchChange={setSearch}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        totalItems={filteredBreakages.length}
        onRefresh={fetchBreakages}
        onCreateNew={() => setCreateModalOpen(true)}
      />

      {/* Modals */}
      <BreakageModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        breakage={selectedBreakage}
        onClose={handleCloseModal}
        onEditBreakage={handleEditBreakage}
        onDeleteBreakage={handleDeleteBreakage}
        onApproveBreakage={handleApproveBreakage}
        onCreateDispatch={handleCreateDispatch}
      />
      
      <CreateBreakageModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />
      
      <EditBreakageModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={handleEditSuccess}
        breakage={editBreakage}
      />
      
      <DeleteBreakageConfirmationDialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onSuccess={handleDeleteSuccess}
        breakage={deleteBreakage}
      />
      
      <ApproveBreakageModal
        open={approveModalOpen}
        onOpenChange={setApproveModalOpen}
        onSuccess={handleApproveSuccess}
        breakage={approveBreakage}
      />
      
      <CreateDispatchFromBreakageModal
        open={createDispatchModalOpen}
        onOpenChange={setCreateDispatchModalOpen}
        onSuccess={handleCreateDispatchSuccess}
        breakage={dispatchBreakage}
      />
    </div>
  );
}