"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import ProductReceiptTable from "./ProductReceiptTable";
import ProductReceiptSummary from "./ProductReceiptSummary";
import { CreateProductReceiptModal } from "./CreateProductReceiptModal";
import { EditProductReceiptModal } from "./EditProductReceiptModal";
import { DeleteProductReceiptConfirmationDialog } from "./DeleteProductReceiptConfirmationDialog";
import { ProductReceiptDetailsModal } from "./ProductReceiptDetailsModal";
import { listProductReceipts as getProductReceipts, type ProductReceipt } from "@/lib/productreceipt";
import { invalidateCacheKey } from "@/lib/data-cache";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionGuard } from "@/components/PermissionGuard";
import { Loader2, ShieldAlert } from "lucide-react";

// Revalidation configuration
const REVALIDATE_INTERVAL = 4000; // 4 seconds
const STALE_TIME = 2000; // Data is considered fresh for 2 seconds

export function ProductReceiptPage() {
  const [productReceipts, setProductReceipts] = useState<ProductReceipt[]>([]);
  const [selectedProductReceipt, setSelectedProductReceipt] = useState<ProductReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editProductReceipt, setEditProductReceipt] = useState<ProductReceipt | null>(null);
  const [deleteProductReceipt, setDeleteProductReceipt] = useState<ProductReceipt | null>(null);

  const { toast } = useToast();
  const { hasPermission, isAdmin } = usePermissions();

  // Track last fetch time for stale-time management
  const lastFetchTime = useRef<number>(0);
  const revalidateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch product receipts with cache check
  const fetchProductReceipts = useCallback(async (force = false) => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    
    // Skip fetch if data is still fresh and not forced
    if (!force && timeSinceLastFetch < STALE_TIME) {
      return;
    }

    try {
      setLoading(true);
      const data = await getProductReceipts();
      setProductReceipts(Array.isArray(data) ? data : []);
      lastFetchTime.current = now;
    } catch (e: any) {
      console.error("Error fetching product receipts:", e);
      setProductReceipts([]);
      toast({
        title: "Error",
        description: e.message || "Failed to load product receipts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Revalidate data in background (for polling)
  const revalidate = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    
    // Only revalidate if data is stale
    if (timeSinceLastFetch < STALE_TIME) {
      return;
    }

    try {
      setIsRevalidating(true);
      const data = await getProductReceipts();
      setProductReceipts(Array.isArray(data) ? data : []);
      lastFetchTime.current = now;
    } catch (e: any) {
      console.error("Error revalidating product receipts:", e);
      // Don't show error toast for background revalidation
    } finally {
      setIsRevalidating(false);
    }
  }, []);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    await fetchProductReceipts(true);
    // Invalidate summary cache to trigger refresh
    invalidateCacheKey("product_receipt_summary");
    toast({
      title: "Refreshed",
      description: "Product receipts data has been updated.",
    });
  }, [fetchProductReceipts, toast]);

  // Initial fetch on mount
  useEffect(() => {
    fetchProductReceipts(true);
  }, []);

  // Setup automatic revalidation interval
  useEffect(() => {
    // Clear any existing interval
    if (revalidateIntervalRef.current) {
      clearInterval(revalidateIntervalRef.current);
    }

    // Setup new interval for background revalidation
    revalidateIntervalRef.current = setInterval(() => {
      revalidate();
    }, REVALIDATE_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (revalidateIntervalRef.current) {
        clearInterval(revalidateIntervalRef.current);
      }
    };
  }, [revalidate]);

  // Revalidate when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      revalidate();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [revalidate]);

  // Revalidate when window becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [revalidate]);

  // Filter product receipts by search
  const filteredProductReceipts = productReceipts.filter((receipt) => {
    const searchLower = search.toLowerCase();
    return (
      receipt.supplier?.name?.toLowerCase().includes(searchLower) ||
      receipt.reference_number?.toLowerCase().includes(searchLower) ||
      receipt.document_type?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredProductReceipts.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedProductReceipts = filteredProductReceipts.slice(startIndex, startIndex + rowsPerPage);

  // Event handlers
  const handleViewProductReceipt = (receipt: ProductReceipt) => {
    setSelectedProductReceipt(receipt);
    setViewModalOpen(true);
  };

  const handleEditProductReceipt = (receipt: ProductReceipt) => {
    setEditProductReceipt(receipt);
    setEditModalOpen(true);
  };

  const handleDeleteProductReceipt = (receipt: ProductReceipt) => {
    setDeleteProductReceipt(receipt);
    setDeleteDialogOpen(true);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    // Force immediate revalidation after create
    fetchProductReceipts(true);
    // Invalidate summary cache to trigger refresh
    invalidateCacheKey("product_receipt_summary");
    toast({
      title: "Success",
      description: "Product receipt created successfully.",
    });
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditProductReceipt(null);
    // Force immediate revalidation after edit
    fetchProductReceipts(true);
    // Invalidate summary cache to trigger refresh
    invalidateCacheKey("product_receipt_summary");
    toast({
      title: "Success",
      description: "Product receipt updated successfully.",
    });
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setDeleteProductReceipt(null);
    // Force immediate revalidation after delete
    fetchProductReceipts(true);
    // Invalidate summary cache to trigger refresh
    invalidateCacheKey("product_receipt_summary");
    toast({
      title: "Success",
      description: "Product receipt deleted successfully.",
    });
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setSelectedProductReceipt(null);
  };

  return (
    <PermissionGuard 
      permissions={["can_view_product_receipt_menu", "can_manage_system", "can_manage_company"]}
      fallback={
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <ShieldAlert className="h-12 w-12 text-red-500" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-gray-500 text-center">
            You do not have permission to view product receipts.<br />
            Please contact your administrator to request access.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Product Receipts</h1>
          <p className="text-muted-foreground">Manage and track your product receipts</p>
        </div>

        <ProductReceiptSummary />
        
        <ProductReceiptTable
          receipts={paginatedProductReceipts}
          loading={loading}
          onViewReceipt={handleViewProductReceipt}
          onEditReceipt={handleEditProductReceipt}
          onDeleteReceipt={handleDeleteProductReceipt}
          search={search}
          onSearchChange={setSearch}
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          totalItems={filteredProductReceipts.length}
          onRefresh={handleRefresh}
          onCreateNew={() => setCreateModalOpen(true)}
        />

        {/* View Product Receipt Modal */}
        <ProductReceiptDetailsModal 
          open={viewModalOpen} 
          onOpenChange={(v) => { 
            setViewModalOpen(v);
            if (!v) setSelectedProductReceipt(null);
          }} 
          receiptId={selectedProductReceipt?.id || null} 
          onEdit={(receiptId: string) => {
            // Find the receipt object and call the edit handler
            const receipt = productReceipts.find(r => r.id === receiptId);
            if (receipt) {
              handleEditProductReceipt(receipt);
            }
          }}
        />

        {/* Create Modal */}
        <PermissionGuard permissions={["can_create_product_receipts", "can_manage_system", "can_manage_company"]} hideOnDenied>
          <CreateProductReceiptModal
            open={createModalOpen}
            onOpenChange={setCreateModalOpen}
            onSuccess={handleCreateSuccess}
          />
        </PermissionGuard>

        {/* Edit Modal */}
        <PermissionGuard permissions={["can_update_product_receipts", "can_manage_system", "can_manage_company"]} hideOnDenied>
          <EditProductReceiptModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            onSuccess={handleEditSuccess}
            productReceipt={editProductReceipt as any}
          />
        </PermissionGuard>

        {/* Delete Confirmation Dialog */}
        <PermissionGuard permissions={["can_delete_product_receipts", "can_manage_system", "can_manage_company"]} hideOnDenied>
          <DeleteProductReceiptConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            productReceipt={deleteProductReceipt}
            onSuccess={handleDeleteSuccess}
          />
        </PermissionGuard>
      </div>
    </PermissionGuard>
  );
}