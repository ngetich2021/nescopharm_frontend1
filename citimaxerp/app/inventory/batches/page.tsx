"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Calendar, AlertTriangle, CheckCircle, DollarSign } from "lucide-react"
import { BatchTable } from "./batch-table"
import { useState, useEffect } from "react"
import { getBatches, getBatchSummary } from "@/lib/batches"
import { useDataCache, invalidateCacheKey } from "@/lib/data-cache"
import { PermissionGuard } from "@/components/PermissionGuard"
import type { Batch, InventorySummary } from "@/types/batches"

export default function BatchesPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // Use the data cache hook for batches with pagination
  const { 
    data: batchesData,
    isLoading: isLoadingBatches,
    refetch: refreshBatches,
    error,
    invalidateCache
  } = useDataCache<{data: Batch[], total: number, current_page: number, per_page: number, last_page?: number}>(
    `batches_page_${currentPage}_${itemsPerPage}`, 
    () => getBatches({ page: currentPage, per_page: itemsPerPage }), // Fetch with pagination
    {
      expirationMs: 5 * 60 * 1000 // 5 minutes cache
    }
  )

  // Use the data cache hook for inventory summary
  const {
    data: inventorySummaryData,
    isLoading: isLoadingSummary,
    error: summaryError
  } = useDataCache<InventorySummary>(
    "inventory_summary",
    () => getBatchSummary(),
    {
      expirationMs: 5 * 60 * 1000 // 5 minutes cache
    }
  )

  // Use the data cache hook for batch summary
  const {
    data: batchSummaryData,
    isLoading: isLoadingBatchSummary,
    error: batchSummaryError
  } = useDataCache<any>(
    "batch_summary",
    () => getBatchSummary(),
    {
      expirationMs: 5 * 60 * 1000 // 5 minutes cache
    }
  )

  // Ensure batches is always an array
  const safeBatches = batchesData?.data || []
  const pagination = {
    current_page: batchesData?.current_page || currentPage,
    per_page: batchesData?.per_page || itemsPerPage,
    total: batchesData?.total || 0,
    last_page: batchesData?.last_page || Math.ceil((batchesData?.total || 0) / (batchesData?.per_page || itemsPerPage))
  }

  // Handle error state
  useEffect(() => {
    if (error) {
      console.error("Error loading batches:", error)
    }
    if (summaryError) {
      console.error("Error loading inventory summary:", summaryError)
    }
    if (batchSummaryError) {
      console.error("Error loading batch summary:", batchSummaryError)
    }
  }, [error, summaryError, batchSummaryError])

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    // Invalidate cache for the new configuration before changing state
    invalidateCacheKey(`batches_page_1_${newItemsPerPage}`)
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  // Extract key metrics from the API response
  const keyMetrics = {
    totalBatches: batchSummaryData?.overview?.total_batches || inventorySummaryData?.batch_summary?.total_batches || 0,
    activeBatches: batchSummaryData?.overview?.active_batches || inventorySummaryData?.batch_summary?.active_batches || 0,
    expiringSoon: batchSummaryData?.alerts?.expiring_batches_count || inventorySummaryData?.batch_summary?.expiring_soon || 0,
    batchTotalValue: batchSummaryData?.financial?.total_inventory_value || inventorySummaryData?.batch_summary?.batch_total_value || 0,
    totalQuantityReceived: batchSummaryData?.inventory?.total_quantity_received || 0,
    totalQuantityAvailable: batchSummaryData?.inventory?.total_quantity_available || 0,
    totalQuantitySold: batchSummaryData?.inventory?.total_quantity_sold || 0,
    avgBatchValue: batchSummaryData?.financial?.avg_batch_value || 0
  }

  return (
    <PermissionGuard permissions={["can_view_products_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Batch Tracking</h1>
          <p className="text-sm text-gray-600">
            Manage and track inventory batches with expiration dates and serial numbers
          </p>
        </div>

        {/* Summary Cards - Top 4 relevant metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingBatchSummary ? (
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                ) : (
                  keyMetrics.totalBatches
                )}
              </div>
              <p className="text-xs text-muted-foreground">All batches in inventory</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingBatchSummary ? (
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                ) : (
                  keyMetrics.activeBatches
                )}
              </div>
              <p className="text-xs text-muted-foreground">Currently available</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingBatchSummary ? (
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                ) : (
                  keyMetrics.totalQuantityReceived
                )}
              </div>
              <p className="text-xs text-muted-foreground">Total received quantity</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingBatchSummary ? (
                  <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
                ) : (
                  `KES ${keyMetrics.batchTotalValue.toLocaleString()}`
                )}
              </div>
              <p className="text-xs text-muted-foreground">Total inventory value</p>
            </CardContent>
          </Card>
        </div>

        <BatchTable 
          batches={safeBatches} 
          summaryData={{
            totalBatches: keyMetrics.totalBatches,
            activeBatches: keyMetrics.activeBatches,
            batchTotalValue: keyMetrics.batchTotalValue,
            expiringSoon: keyMetrics.expiringSoon
          }}
          onBatchUpdated={refreshBatches}
          isLoading={isLoadingBatches}
          error={error}
          onRefresh={refreshBatches}
          pagination={pagination}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </PermissionGuard>
  )
}