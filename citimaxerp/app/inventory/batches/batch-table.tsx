"use client"

import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Search, Download, ChevronLeft, ChevronRight, Eye, RefreshCw, AlertTriangle, Calendar, Package, CheckCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"
import { PermissionGuard } from "@/components/PermissionGuard"
import { usePermissions } from "@/hooks/use-permissions"
import { useRouter } from "next/navigation"
import { BatchDetailsSheet } from "@/app/inventory/components/batch-details-sheet"
import type { Batch } from "@/types/batches"

// Helper function to check if a batch matches search criteria
function batchMatchesSearch(batch: Batch, searchTerm: string): boolean {
  const term = searchTerm.toLowerCase()
  
  // Helper function to safely get supplier name
  const getSupplierName = (supplier: Batch['supplier']): string => {
    if (!supplier) return ''
    if (typeof supplier === 'string') return supplier
    if (typeof supplier === 'object' && supplier !== null && 'name' in supplier) {
      return supplier.name || ''
    }
    return ''
  }
  
  return (
    batch.batch_number.toLowerCase().includes(term) ||
    (batch.lot_number?.toLowerCase().includes(term) ?? false) ||
    batch.product_id.toLowerCase().includes(term) ||
    getSupplierName(batch.supplier).toLowerCase().includes(term) ||
    (batch.serial_number?.toLowerCase().includes(term) ?? false)
  )
}

// Helper function to download CSV template
function downloadCSVTemplate(batches: Batch[], searchTerm: string) {
  // Filter batches based on search term
  const filteredBatches = searchTerm 
    ? batches.filter(batch => batchMatchesSearch(batch, searchTerm))
    : batches

  // Helper function to safely get supplier name
  const getSupplierName = (supplier: Batch['supplier']): string => {
    if (!supplier) return ''
    if (typeof supplier === 'string') return supplier
    if (typeof supplier === 'object' && supplier !== null && 'name' in supplier) {
      return supplier.name || ''
    }
    return ''
  }

  // Create CSV content
  const headers = ["Batch Number", "Lot Number", "Quantity Received", "Quantity Available", "Quantity Sold", "Manufacture Date", "Expiry Date", "Supplier"]
  const csvContent = [
    headers.join(","),
    ...filteredBatches.map(batch => 
      [
        `"${batch.batch_number || ""}"`,
        `"${batch.lot_number || ""}"`,
        `"${batch.quantity_received || 0}"`,
        `"${batch.quantity_available || 0}"`,
        `"${batch.quantity_sold || 0}"`,
        `"${batch.manufacture_date ? new Date(batch.manufacture_date).toLocaleDateString() : ""}"`,
        `"${batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : ""}"`,
        `"${getSupplierName(batch.supplier)}"`
      ].join(",")
    )
  ].join("\n")

  // Create download link
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `batches_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Helper function to download Excel template
function downloadExcelTemplate(batches: Batch[], searchTerm: string) {
  // Filter batches based on search term
  const filteredBatches = searchTerm 
    ? batches.filter(batch => batchMatchesSearch(batch, searchTerm))
    : batches

  // Helper function to safely get supplier name
  const getSupplierName = (supplier: Batch['supplier']): string => {
    if (!supplier) return ''
    if (typeof supplier === 'string') return supplier
    if (typeof supplier === 'object' && supplier !== null && 'name' in supplier) {
      return supplier.name || ''
    }
    return ''
  }

  // Create worksheet data
  const worksheetData = [
    ["Batch Number", "Lot Number", "Quantity Received", "Quantity Available", "Quantity Sold", "Manufacture Date", "Expiry Date", "Supplier"],
    ...filteredBatches.map(batch => [
      batch.batch_number || "",
      batch.lot_number || "",
      batch.quantity_received || 0,
      batch.quantity_available || 0,
      batch.quantity_sold || 0,
      batch.manufacture_date ? new Date(batch.manufacture_date).toLocaleDateString() : "",
      batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : "",
      getSupplierName(batch.supplier)
    ])
  ]

  // Create workbook and worksheet
  const ws = XLSX.utils.aoa_to_sheet(worksheetData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Batches")

  // Download Excel file
  XLSX.writeFile(wb, `batches_${new Date().toISOString().split("T")[0]}.xlsx`)
}

interface BatchTableProps {
  batches: Batch[]
  summaryData: any
  onBatchUpdated: () => void
  isLoading?: boolean
  error?: Error | null
  onRefresh?: () => void
  pagination?: {
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
  onPageChange?: (page: number) => void
  onItemsPerPageChange?: (itemsPerPage: number) => void
  currentPage?: number
  itemsPerPage?: number
}

export function BatchTable({ 
  batches, 
  summaryData,
  onBatchUpdated,
  isLoading = false,
  error = null,
  onRefresh,
  pagination,
  onPageChange,
  onItemsPerPageChange,
  currentPage = 1,
  itemsPerPage = 20
}: BatchTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"batch_number" | "quantity_available" | "quantity_received" | "quantity_sold" | "received_date">("received_date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [selectedBatch, setSelectedBatch] = useState<{ productId: string; batchId: string } | null>(null)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const { toast } = useToast()

  // Filter and sort batches
  const filteredAndSortedBatches = useMemo(() => {
    let result = [...batches]
    
    
    // Apply search filter
    if (searchTerm) {
      result = result.filter(batch => 
        batchMatchesSearch(batch, searchTerm)
      )
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter(batch => batch.status === statusFilter)
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case "batch_number":
          comparison = a.batch_number.localeCompare(b.batch_number)
          break
        case "quantity_available":
          comparison = (a.quantity_available || 0) - (b.quantity_available || 0)
          break
        case "quantity_received":
          comparison = (a.quantity_received || 0) - (b.quantity_received || 0)
          break
        case "quantity_sold":
          comparison = (a.quantity_sold || 0) - (b.quantity_sold || 0)
          break
        case "received_date":
          const dateA = a.received_date ? new Date(a.received_date).getTime() : 0
          const dateB = b.received_date ? new Date(b.received_date).getTime() : 0
          comparison = dateA - dateB
          break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    
    return result
  }, [batches, searchTerm, statusFilter, sortBy, sortOrder])

  // Handle export
  const handleExport = (format: "csv" | "excel") => {
    if (format === "csv") {
      downloadCSVTemplate(batches, searchTerm)
    } else {
      downloadExcelTemplate(batches, searchTerm)
    }
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "expired":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "damaged":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case "sold_out":
        return <Package className="h-4 w-4 text-gray-500" />
      default:
        return <Package className="h-4 w-4 text-gray-500" />
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium"
    
    switch (status) {
      case "active":
        return `${baseClasses} bg-green-100 text-green-800`
      case "expired":
        return `${baseClasses} bg-red-100 text-red-800`
      case "damaged":
        return `${baseClasses} bg-orange-100 text-orange-800`
      case "sold_out":
        return `${baseClasses} bg-gray-100 text-gray-800`
      case "recalled":
        return `${baseClasses} bg-purple-100 text-purple-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Batch Number</TableHead>
              <TableHead className="font-semibold">Lot Number</TableHead>
              <TableHead className="font-semibold">Qty Received</TableHead>
              <TableHead className="font-semibold">Qty Available</TableHead>
              <TableHead className="font-semibold">Qty Sold</TableHead>
              <TableHead className="font-semibold">Manufacture Date</TableHead>
              <TableHead className="font-semibold">Expiry Date</TableHead>
              <TableHead className="font-semibold">Supplier</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell colSpan={9} className="h-16">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 text-red-500 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading batches</h3>
          <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          <div className="mt-4">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="sold_out">Sold Out</SelectItem>
                  <SelectItem value="recalled">Recalled</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [newSortBy, newSortOrder] = value.split('-') as [typeof sortBy, typeof sortOrder]
                setSortBy(newSortBy)
                setSortOrder(newSortOrder)
              }}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="batch_number-asc">Batch # (A-Z)</SelectItem>
                  <SelectItem value="batch_number-desc">Batch # (Z-A)</SelectItem>
                  <SelectItem value="quantity_available-asc">Available (Low-High)</SelectItem>
                  <SelectItem value="quantity_available-desc">Available (High-Low)</SelectItem>
                  <SelectItem value="quantity_received-asc">Received (Low-High)</SelectItem>
                  <SelectItem value="quantity_received-desc">Received (High-Low)</SelectItem>
                  <SelectItem value="quantity_sold-asc">Sold (Low-High)</SelectItem>
                  <SelectItem value="quantity_sold-desc">Sold (High-Low)</SelectItem>
                  <SelectItem value="received_date-asc">Received Date (Old-New)</SelectItem>
                  <SelectItem value="received_date-desc">Received Date (New-Old)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Batches Table */}
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Batch Number</TableHead>
                <TableHead className="font-semibold">Lot Number</TableHead>
                <TableHead className="font-semibold">Qty Received</TableHead>
                <TableHead className="font-semibold">Qty Available</TableHead>
                <TableHead className="font-semibold">Qty Sold</TableHead>
                <TableHead className="font-semibold">Manufacture Date</TableHead>
                <TableHead className="font-semibold">Expiry Date</TableHead>
                <TableHead className="font-semibold">Supplier</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedBatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="text-gray-500">
                      <p className="font-semibold">No batches found</p>
                      <p className="text-sm">Try adjusting your search or filter criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedBatches.map((batch) => (
                  <TableRow 
                    key={batch.id}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <TableCell className="font-medium">{batch.batch_number}</TableCell>
                    <TableCell>{batch.lot_number || "N/A"}</TableCell>
                    <TableCell>{batch.quantity_received}</TableCell>
                    <TableCell>{batch.quantity_available}</TableCell>
                    <TableCell>{batch.quantity_sold}</TableCell>
                    <TableCell>
                      {batch.manufacture_date ? (
                        new Date(batch.manufacture_date).toLocaleDateString()
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      {batch.expiry_date ? (
                        new Date(batch.expiry_date).toLocaleDateString()
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      {typeof batch.supplier === 'string' 
                        ? batch.supplier 
                        : (batch.supplier && typeof batch.supplier === 'object' && 'name' in batch.supplier 
                          ? batch.supplier.name 
                          : "N/A")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBatch({ productId: batch.product_id, batchId: batch.id })
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">
                Showing {(pagination.current_page - 1) * pagination.per_page + 1} to{" "}
                {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{" "}
                {pagination.total} batches
              </p>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  const newItemsPerPage = Number(value)
                  if (onItemsPerPageChange) {
                    onItemsPerPageChange(newItemsPerPage)
                  }
                  // Reset to first page when changing items per page
                  if (onPageChange) {
                    onPageChange(1)
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={itemsPerPage.toString()} />
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
                onClick={() => onPageChange && onPageChange(Math.max(1, pagination.current_page - 1))}
                disabled={pagination.current_page === 1}
                className="border-gray-200 hover:bg-[#1E2764]/10 hover:text-[#1E2764] hover:border-[#1E2764]"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center justify-center text-sm font-medium">
                Page {pagination.current_page} of {pagination.last_page}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange && onPageChange(Math.min(pagination.last_page, pagination.current_page + 1))}
                disabled={pagination.current_page === pagination.last_page}
                className="border-gray-200 hover:bg-[#1E2764]/10 hover:text-[#1E2764] hover:border-[#1E2764]"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedBatch && (
        <BatchDetailsSheet
          productId={selectedBatch.productId}
          batchId={selectedBatch.batchId}
          open={selectedBatch !== null}
          onOpenChange={(open) => !open && setSelectedBatch(null)}
        />
      )}
    </>
  )
}