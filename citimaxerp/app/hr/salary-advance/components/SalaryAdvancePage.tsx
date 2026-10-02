"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { CreateSalaryAdvanceSheet } from "./CreateSalaryAdvanceSheet";
import { EditSalaryAdvanceSheet } from "./EditSalaryAdvanceSheet";
import { ViewSalaryAdvanceSheet } from "./ViewSalaryAdvanceSheet";
import { DeleteSalaryAdvanceDialog } from "./DeleteSalaryAdvanceDialog";
import { SalaryAdvanceTable } from "./SalaryAdvanceTable";
import { getSalaryAdvances, type SalaryAdvanceRequest } from "@/lib/salary-advance";
import { useAuth } from "@/lib/auth-context";

export function SalaryAdvancePage() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [salaryAdvanceRequests, setSalaryAdvanceRequests] = useState<SalaryAdvanceRequest[]>([]);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSalaryAdvanceRequest, setSelectedSalaryAdvanceRequest] = useState<SalaryAdvanceRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { toast } = useToast();

  const fetchAdvances = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await getSalaryAdvances({ search: searchTerm || undefined });
      setSalaryAdvanceRequests(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load salary advances.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, [companyId]);

  useEffect(() => {
    const timer = setTimeout(() => fetchAdvances(), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredAdvances = salaryAdvanceRequests.filter((adv) =>
    adv.employee.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredAdvances.length / rowsPerPage);
  const paginatedAdvances = filteredAdvances.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleCreateSuccess = () => {
    fetchAdvances();
    toast({ title: "Success", description: "Salary advance request created successfully." });
  };

  const handleEditSuccess = () => {
    fetchAdvances();
    toast({ title: "Success", description: "Salary advance request updated successfully." });
  };

  const handleDeleteSuccess = () => {
    fetchAdvances();
    toast({ title: "Success", description: "Salary advance request deleted successfully." });
  };

  const handleViewSalaryAdvanceRequest = (req: SalaryAdvanceRequest) => {
    setSelectedSalaryAdvanceRequest(req);
    setViewSheetOpen(true);
  };

  const handleEditSalaryAdvanceRequest = (req: SalaryAdvanceRequest) => {
    setSelectedSalaryAdvanceRequest(req);
    setViewSheetOpen(false);
    setEditSheetOpen(true);
  };

  const handleDeleteSalaryAdvanceRequest = (req: SalaryAdvanceRequest) => {
    setSelectedSalaryAdvanceRequest(req);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Salary Advance</h1>
            <p className="text-muted-foreground">Manage employee salary advance requests and approvals</p>
          </div>
        </div>
      </div>

      <SalaryAdvanceTable
        salaryAdvanceRequests={paginatedAdvances}
        loading={loading}
        onViewSalaryAdvance={handleViewSalaryAdvanceRequest}
        onEditSalaryAdvance={handleEditSalaryAdvanceRequest}
        onDeleteSalaryAdvance={handleDeleteSalaryAdvanceRequest}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        totalItems={filteredAdvances.length}
        onRefresh={fetchAdvances}
        onCreateNew={() => setCreateSheetOpen(true)}
      />

      <CreateSalaryAdvanceSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        onSuccess={handleCreateSuccess}
      />

      <ViewSalaryAdvanceSheet
        open={viewSheetOpen}
        onOpenChange={setViewSheetOpen}
        salaryAdvanceRequest={selectedSalaryAdvanceRequest}
        onEdit={handleEditSalaryAdvanceRequest}
      />

      <EditSalaryAdvanceSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        onSuccess={handleEditSuccess}
        salaryAdvanceRequest={selectedSalaryAdvanceRequest}
      />

      <DeleteSalaryAdvanceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
        salaryAdvanceRequest={selectedSalaryAdvanceRequest}
      />
    </div>
  );
}
