"use client";
import { useState, useEffect, Suspense } from "react";
import {
  listOrderDispatches,
  type OrderDispatch
} from "@/lib/order-dispatches";
import { useAuth } from "@/lib/auth-context";
import { DispatchDetailsSheet } from "./DispatchDetailsSheet";
import { DispatchTable } from "./DispatchTable";
import { EditDispatchModal } from "./EditDispatchModal";
import { DeleteDispatchConfirmationDialog } from "./DeleteDispatchConfirmationDialog";
import { ReturnItemsModal } from "./ReturnItemsModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, RefreshCw, Search, ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PermissionGuard } from "@/components/PermissionGuard";
import { LogisticsTable } from "@/app/logistics/logistics-table";
import { LogisticsSummary } from "@/app/logistics/logistics-summary";
import { DeliveryRatesTab } from "./DeliveryRatesTab";
import { hasPermission } from "@/lib/rbac";

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState<OrderDispatch[]>([]);
  const [selectedDispatch, setSelectedDispatch] = useState<OrderDispatch | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [dispatchToEdit, setDispatchToEdit] = useState<OrderDispatch | null>(null);
  const [dispatchToDelete, setDispatchToDelete] = useState<OrderDispatch | null>(null);
  const [dispatchToReturn, setDispatchToReturn] = useState<OrderDispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const canViewDeliveryRates = hasPermission(userProfile as any, "can_view_delivery_rates");

  const fetchDispatches = async () => {
    setLoading(true);
    try {
      const response = await listOrderDispatches({
        page: currentPage,
        per_page: rowsPerPage
      });
      
      // Handle both array response and paginated response structures
      // Based on lib, it returns { status, data, meta }
      if (response && Array.isArray(response.data)) {
        setDispatches(response.data);
      } else if (response && response.data && typeof response.data === 'object' && Array.isArray((response.data as any).data)) {
        // Handle potential nested pagination object
        setDispatches((response.data as any).data);
      } else {
        console.warn('Unexpected API response structure:', response);
        setDispatches([]);
      }
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      toast({
        title: "Error",
        description: "Failed to fetch dispatches. Please try again.",
        variant: "destructive",
      });
      setDispatches([]); // Ensure robust state on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatches();
  }, [currentPage, rowsPerPage]); // Refetch when pagination changes

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [searchDebounceTimer]);

  const handleViewDispatch = (dispatch: OrderDispatch) => {
    if (!dispatch || !dispatch.id) {
      toast({
        title: "Error",
        description: "Invalid dispatch data. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedDispatch(dispatch);
    setModalOpen(true);
  };



  const handleCloseModal = () => {
    setSelectedDispatch(null);
    setModalOpen(false);
    // Refresh data after modal closes
    fetchDispatches();
  };

  const handleRefresh = () => {
    fetchDispatches();
  };

  const handleEditDispatch = (dispatch: OrderDispatch) => {
    // Close any other modals first
    setModalOpen(false);
    setSelectedDispatch(null);
    // Then open edit modal
    setDispatchToEdit(dispatch);
    setEditModalOpen(true);
  };

  const handleDeleteDispatch = (dispatch: OrderDispatch) => {
    // Close any other modals first
    setModalOpen(false);
    setSelectedDispatch(null);
    // Then open delete modal
    setDispatchToDelete(dispatch);
    setDeleteModalOpen(true);
  };

  const handleReturnItems = (dispatch: OrderDispatch) => {
    // Close any other modals first
    setModalOpen(false);
    setSelectedDispatch(null);
    // Then open return modal
    setDispatchToReturn(dispatch);
    setReturnModalOpen(true);
  };

  const handleEditSuccess = () => {
    fetchDispatches();
    setDispatchToEdit(null);
    setEditModalOpen(false);
  };

  const handleDeleteSuccess = () => {
    fetchDispatches();
    setDispatchToDelete(null);
    setDeleteModalOpen(false);
  };

  const handleReturnSuccess = () => {
    fetchDispatches();
    setDispatchToReturn(null);
    setReturnModalOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1); // Reset to first page when searching
    
    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    // Set new timer - no need for API call, just local filtering
    const timer = setTimeout(() => {
      // Search is now handled by client-side filtering for now
    }, 300);
    
    setSearchDebounceTimer(timer);
  };

  const getStatsData = () => {
    const totalDispatches = dispatches.length;
    const pendingDispatches = dispatches.filter(d => 
      d.items?.some(item => (item.delivered_quantity || 0) < item.quantity)
    ).length;
    const completedDispatches = dispatches.filter(d => 
      d.items?.every(item => (item.delivered_quantity || 0) >= item.quantity)
    ).length;
    // Note: 'returned' status isn't explicitly in the simple JSON, 
    // assuming we might need to check for damaged or specific status
    const returnedDispatches = dispatches.filter(d => 
      d.items?.some(item => (item.damaged_quantity || 0) > 0)
    ).length;
    
    return { totalDispatches, pendingDispatches, completedDispatches, returnedDispatches };
  };

  // Apply client-side filtering
  const filteredDispatches = Array.isArray(dispatches) ? dispatches.filter((dispatch) => {
    // Status filter
    if (statusFilter !== "all" && dispatch.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;

    // Approval filter
    if (approvalFilter !== "all" && dispatch.approval_status?.toLowerCase() !== approvalFilter.toLowerCase()) return false;

    // Search filter
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      dispatch.dispatch_number?.toLowerCase().includes(q) ||
      dispatch.order?.order_number?.toLowerCase().includes(q) ||
      dispatch.order?.customer?.name?.toLowerCase().includes(q) ||
      dispatch.created_by?.first_name?.toLowerCase().includes(q) ||
      dispatch.created_by?.last_name?.toLowerCase().includes(q) ||
      dispatch.notes?.toLowerCase().includes(q) ||
      dispatch.items?.some(item =>
        item.product?.name?.toLowerCase().includes(q)
      )
    );
  }) : [];

  const totalPages = Math.ceil(filteredDispatches.length / rowsPerPage);
  // If we are doing client side pagination on the filtered results:
  const paginatedDispatches = filteredDispatches.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  // Note: The API supports pagination, but here we are mixing client/server a bit. 
  // Ideally we should use server side search + pagination, but keeping consistent with previous implementation style.
  
  const stats = getStatsData();

  return (
    <PermissionGuard permissions={["can_view_dispatch_menu", "can_manage_system", "can_manage_company"]}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Dispatches & Logistics</h1>
          <p className="text-muted-foreground">
            Manage order dispatches and track delivery logistics
          </p>
        </div>

        <Tabs defaultValue="dispatches" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dispatches" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Dispatches
            </TabsTrigger>
            <TabsTrigger value="logistics" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Logistics
            </TabsTrigger>
            {canViewDeliveryRates && (
              <TabsTrigger value="delivery-rates" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Delivery Rates
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dispatches" className="space-y-6">

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Dispatches</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-12" /> : dispatches.length}
              </div>
              <p className="text-xs text-muted-foreground">
                All time dispatches
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Delivery</CardTitle>
              <Package className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-12" /> : stats.pendingDispatches}
              </div>
              <p className="text-xs text-muted-foreground">
                Not fully delivered
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Package className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-12" /> : stats.completedDispatches}
              </div>
              <p className="text-xs text-muted-foreground">
                Fully delivered
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Damaged/Returned</CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-12" /> : stats.returnedDispatches}
              </div>
              <p className="text-xs text-muted-foreground">
                Items with issues
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search, Filters and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Input
                className="pl-8 w-full sm:max-w-sm"
                placeholder="Search dispatches..."
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={approvalFilter} onValueChange={(v) => { setApprovalFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Approval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Approval</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Dispatches Table */}
        <DispatchTable 
          dispatches={paginatedDispatches} // Using paginated results
          onViewDispatch={handleViewDispatch}
          onReturnItems={handleReturnItems}
          onEditDispatch={handleEditDispatch}
          onDeleteDispatch={handleDeleteDispatch}
          loading={loading}
        />

        {/* Pagination - Simplified for client side slice of fetched data */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={rowsPerPage.toString()}
              onValueChange={(value) => {
                setRowsPerPage(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={rowsPerPage} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={pageSize.toString()}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((old) => Math.max(old - 1, 1))}
              disabled={currentPage === 1}
              className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center justify-center text-sm font-medium">
              Page {currentPage} of {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((old) => Math.min(old + 1, totalPages || 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DispatchDetailsSheet 
          open={modalOpen} 
          onOpenChange={setModalOpen} 
          dispatch={selectedDispatch} 
          onClose={handleCloseModal}
          onRefresh={handleRefresh}
          currentUserId={user?.id}
        />

        {/* Edit Modal */}
        <EditDispatchModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          dispatch={dispatchToEdit}
          onSuccess={handleEditSuccess}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteDispatchConfirmationDialog
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          dispatch={dispatchToDelete}
          onSuccess={handleDeleteSuccess}
        />

        {/* Return Items Modal */}
        <ReturnItemsModal
          open={returnModalOpen}
          onOpenChange={setReturnModalOpen}
          dispatch={dispatchToReturn}
          onSuccess={handleReturnSuccess}
        />

          </TabsContent>

          <TabsContent value="logistics" className="space-y-6">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
              <LogisticsSummary />
            </Suspense>
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
              <LogisticsTable />
            </Suspense>
          </TabsContent>

          {canViewDeliveryRates && (
            <TabsContent value="delivery-rates" className="space-y-6">
              <DeliveryRatesTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PermissionGuard>
  );
}
