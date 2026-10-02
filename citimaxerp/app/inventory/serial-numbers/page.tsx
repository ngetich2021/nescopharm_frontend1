"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, CheckCircle, AlertTriangle, Clock, DollarSign } from "lucide-react"
import { useState, useEffect } from "react"
import { getSerialNumbers, getSerialNumberStatistics } from "@/lib/serial-numbers"
import { useDataCache, invalidateCacheKey } from "@/lib/data-cache"
import { PermissionGuard } from "@/components/PermissionGuard"
import type { SerialNumber } from "@/types/serial-numbers"
import type { SerialNumberStatistics } from "@/types/serial-numbers"
import { SerialNumberTable } from "@/app/inventory/serial-numbers/serial-number-table"
import { AddSerialNumberSheet } from "@/app/inventory/serial-numbers/components/add-serial-number-sheet"

export default function SerialNumbersPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)
  
  // Use the data cache hook for serial numbers with pagination
  const { 
    data: serialNumbersData,
    isLoading: isLoadingSerialNumbers,
    refetch: refreshSerialNumbers,
    error,
    invalidateCache
  } = useDataCache<{data: SerialNumber[], total: number, current_page: number, per_page: number, last_page: number}>(
    `serial_numbers_page_${currentPage}_${itemsPerPage}`, 
    () => getSerialNumbers({ page: currentPage, per_page: itemsPerPage, serial_number: searchTerm }), // Fetch with pagination and search
    {
      expirationMs: 5 * 60 * 1000 // 5 minutes cache
    }
  )

  // Use the data cache hook for serial number statistics
  const {
    data: serialNumberStatisticsData,
    isLoading: isLoadingStatistics,
    error: statisticsError
  } = useDataCache<SerialNumberStatistics>(
    "serial_number_statistics",
    () => getSerialNumberStatistics(),
    {
      expirationMs: 5 * 60 * 1000 // 5 minutes cache
    }
  )

  // Ensure serial numbers is always an array
  const safeSerialNumbers = serialNumbersData?.data || []
  const pagination = {
    current_page: serialNumbersData?.current_page || currentPage,
    per_page: serialNumbersData?.per_page || itemsPerPage,
    total: serialNumbersData?.total || 0,
    last_page: serialNumbersData?.last_page || Math.ceil((serialNumbersData?.total || 0) / (serialNumbersData?.per_page || itemsPerPage))
  }

  // Handle error state
  useEffect(() => {
    if (error) {
      console.error("Error loading serial numbers:", error)
    }
    if (statisticsError) {
      console.error("Error loading serial number statistics:", statisticsError)
    }
  }, [error, statisticsError])

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    // Invalidate cache for the new configuration before changing state
    invalidateCacheKey(`serial_numbers_page_1_${newItemsPerPage}`)
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  // Handle search change
  const handleSearchChange = (search: string) => {
    setSearchTerm(search)
    setCurrentPage(1) // Reset to first page when searching
  }

  // Extract key metrics from the API response
  const keyMetrics = {
    totalSerialNumbers: serialNumberStatisticsData?.total_serials || 0,
    activeSerialNumbers: serialNumberStatisticsData?.by_status?.active || 0,
    soldSerialNumbers: serialNumberStatisticsData?.by_status?.sold || 0,
    damagedSerialNumbers: serialNumberStatisticsData?.by_status?.damaged || 0,
    underWarranty: serialNumberStatisticsData?.warranty_stats?.under_warranty || 0,
    totalCostValue: serialNumberStatisticsData?.value_stats?.total_cost_value || 0,
    addedToday: serialNumberStatisticsData?.recent_activity?.added_today || 0,
  }

  // Handle view serial number
  const handleViewSerialNumber = (serialNumber: SerialNumber) => {
    // Implementation for viewing serial number details
    console.log("View serial number:", serialNumber)
  }

  // Handle edit serial number
  const handleEditSerialNumber = (serialNumber: SerialNumber) => {
    // Implementation for editing serial number
    console.log("Edit serial number:", serialNumber)
  }

  // Handle delete serial number
  const handleDeleteSerialNumber = (serialNumber: SerialNumber) => {
    // Implementation for deleting serial number
    console.log("Delete serial number:", serialNumber)
    refreshSerialNumbers()
  }

  // Handle assign batch
  const handleAssignBatch = (serialNumber: SerialNumber) => {
    // Implementation for assigning batch
    console.log("Assign batch to serial number:", serialNumber)
  }

  return (
    <PermissionGuard permissions={["can_view_serial_numbers_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Serial Number Tracking</h1>
          <p className="text-sm text-gray-600">
            Manage and track inventory serial numbers
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Serial Numbers</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStatistics ? (
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                ) : (
                  keyMetrics.totalSerialNumbers
                )}
              </div>
              <p className="text-xs text-muted-foreground">All serial numbers in inventory</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStatistics ? (
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                ) : (
                  keyMetrics.activeSerialNumbers
                )}
              </div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Under Warranty</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStatistics ? (
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                ) : (
                  keyMetrics.underWarranty
                )}
              </div>
              <p className="text-xs text-muted-foreground">Currently covered</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Added Today</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStatistics ? (
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                ) : (
                  keyMetrics.addedToday
                )}
              </div>
              <p className="text-xs text-muted-foreground">New today</p>
            </CardContent>
          </Card>
        </div>

        <SerialNumberTable 
          serialNumbers={safeSerialNumbers}
          loading={isLoadingSerialNumbers}
          onViewSerialNumber={handleViewSerialNumber}
          onEditSerialNumber={handleEditSerialNumber}
          onDeleteSerialNumber={handleDeleteSerialNumber}
          onAssignBatch={handleAssignBatch}
          search={searchTerm}
          onSearchChange={handleSearchChange}
          currentPage={currentPage}
          totalPages={pagination.last_page}
          rowsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleItemsPerPageChange}
          totalItems={pagination.total}
          onRefresh={refreshSerialNumbers}
          onCreateNew={() => setIsAddSheetOpen(true)}
          onAddSerialNumber={() => setIsAddSheetOpen(true)}
        />

        {/* Add Serial Number Sheet */}
        <AddSerialNumberSheet
          open={isAddSheetOpen}
          onOpenChange={setIsAddSheetOpen}
          onSerialNumberAdded={refreshSerialNumbers}
        />
      </div>
    </PermissionGuard>
  )
}