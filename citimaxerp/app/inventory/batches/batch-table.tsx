"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Search, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, Eye, RefreshCw, AlertTriangle, Calendar, Package, CheckCircle } from "lucide-react"
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

function RemainingCell({ available, received }: { available: number; received: number }) {
  const pct = received > 0 ? Math.min(Math.max(available / received, 0), 1) : 0
  const tone = available <= 0 ? "bg-red-500" : pct <= 0.2 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="min-w-[120px]">
      <div className="text-sm tabular-nums">
        <span className={available <= 0 ? "font-semibold text-red-600" : "font-semibold text-gray-900"}>{Number(available || 0).toLocaleString()}</span>
        <span className="text-gray-500"> / {Number(received || 0).toLocaleString()}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

function ExpiryCell({ date }: { date?: string }) {
  if (!date) return <span className="text-gray-400">-</span>
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
  const label = new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
  if (days < 0) return <div><div className="font-medium text-red-600">{label}</div><div className="text-xs text-red-600">Expired</div></div>
  const tone = days <= 90 ? "text-amber-600" : "text-gray-500"
  return <div><div className={days <= 90 ? "font-medium text-amber-600" : "text-gray-900"}>{label}</div><div className={`text-xs ${tone}`}>{days} days left</div></div>
}

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
    (batch.product?.name?.toLowerCase().includes(term) ?? false) ||
    (batch.variant?.name?.toLowerCase().includes(term) ?? false) ||
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
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
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

  // Group batches by product so the parent row shows the product once and
  // expands to reveal each size (variant) with its own batches. Products
  // without sizes expand to a batch list under the single parent row.
  type ProductGroup = {
    productId: string
    productName: string
    hasVariants: boolean
    totalAvailable: number
    totalReceived: number
    batchCount: number
    earliestExpiry: string | null
    variants: Array<{
      variantId: string | null
      variantName: string
      batches: Batch[]
    }>
  }

  const productGroups: ProductGroup[] = useMemo(() => {
    const map = new Map<string, ProductGroup>()
    for (const batch of filteredAndSortedBatches) {
      const pid = batch.product_id
      let group = map.get(pid)
      if (!group) {
        group = {
          productId: pid,
          productName: batch.product?.name || "-",
          hasVariants: false,
          totalAvailable: 0,
          totalReceived: 0,
          batchCount: 0,
          earliestExpiry: null,
          variants: [],
        }
        map.set(pid, group)
      }
      const vid = batch.variant_id || null
      let variant = group.variants.find(v => v.variantId === vid)
      if (!variant) {
        variant = {
          variantId: vid,
          variantName: batch.variant?.name || "-",
          batches: [],
        }
        group.variants.push(variant)
      }
      variant.batches.push(batch)
      group.totalAvailable += Number(batch.quantity_available || 0)
      group.totalReceived += Number(batch.quantity_received || 0)
      group.batchCount += 1
      if (batch.expiry_date) {
        if (!group.earliestExpiry || batch.expiry_date < group.earliestExpiry) {
          group.earliestExpiry = batch.expiry_date
        }
      }
    }
    for (const group of map.values()) {
      group.hasVariants = group.variants.some(v => v.variantId !== null)
    }
    return Array.from(map.values())
  }, [filteredAndSortedBatches])

  const toggleProduct = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

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
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-14 text-center font-semibold">S/No.</TableHead>
              <TableHead className="font-semibold">Product</TableHead>
              <TableHead className="font-semibold text-center">Sizes</TableHead>
              <TableHead className="font-semibold text-center">Batches</TableHead>
              <TableHead className="font-semibold">Total Remaining / Received</TableHead>
              <TableHead className="font-semibold">Earliest Expiry</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell colSpan={8} className="h-16">
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

        {/* Batches Table - grouped by product; parent row shows no batch
            info (the product itself holds no stock when it has sizes), click
            to expand and see each size with its batches. */}
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-14 text-center font-semibold">S/No.</TableHead>
                <TableHead className="font-semibold">Product</TableHead>
                <TableHead className="font-semibold text-center">Sizes</TableHead>
                <TableHead className="font-semibold text-center">Batches</TableHead>
                <TableHead className="font-semibold">Total Remaining / Received</TableHead>
                <TableHead className="font-semibold">Earliest Expiry</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="text-gray-500">
                      <p className="font-semibold">No batches found</p>
                      <p className="text-sm">Try adjusting your search or filter criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                productGroups.map((group, groupIndex) => {
                  const isExpanded = expandedProducts.has(group.productId)
                  const sizeCount = group.variants.filter(v => v.variantId !== null).length
                  return (
                    <Fragment key={group.productId}>
                      <TableRow
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleProduct(group.productId)}
                      >
                        <TableCell className="text-center">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-gray-500 inline" />
                            : <ChevronRightIcon className="h-4 w-4 text-gray-500 inline" />}
                        </TableCell>
                        <TableCell className="text-center text-gray-700">{(currentPage - 1) * itemsPerPage + groupIndex + 1}</TableCell>
                        <TableCell className="font-medium">{group.productName}</TableCell>
                        <TableCell className="text-center">
                          {group.hasVariants ? (
                            <Badge className="bg-blue-100 text-blue-800">{sizeCount}</Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-indigo-100 text-indigo-800">{group.batchCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <RemainingCell available={group.totalAvailable} received={group.totalReceived} />
                        </TableCell>
                        <TableCell>
                          <ExpiryCell date={group.earliestExpiry ?? undefined} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); router.push(`/inventory/products/${group.productId}`) }}
                          >
                            <Eye className="h-4 w-4 mr-1" /> Product
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-0">
                          <TableCell colSpan={8} className="p-0">
                            <div className="p-4 space-y-4">
                              {group.variants.map((v) => (
                                <div key={v.variantId ?? "no-variant"} className="bg-white border rounded-md overflow-hidden">
                                  {v.variantId !== null && (
                                    <div className="px-4 py-2 bg-blue-50 border-b flex items-center gap-2">
                                      <Package className="h-4 w-4 text-blue-700" />
                                      <span className="font-semibold text-sm text-blue-900">Size: {v.variantName}</span>
                                      <Badge className="bg-blue-100 text-blue-800 ml-auto">{v.batches.length} {v.batches.length === 1 ? "batch" : "batches"}</Badge>
                                    </div>
                                  )}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50 text-gray-600 text-xs">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium">S/No</th>
                                          <th className="px-3 py-2 text-left font-medium">Batch Number</th>
                                          <th className="px-3 py-2 text-left font-medium">Lot Number</th>
                                          <th className="px-3 py-2 text-left font-medium">Remaining / Received</th>
                                          <th className="px-3 py-2 text-right font-medium">Qty Sold</th>
                                          <th className="px-3 py-2 text-left font-medium">Manufacture</th>
                                          <th className="px-3 py-2 text-left font-medium">Expiry</th>
                                          <th className="px-3 py-2 text-left font-medium">Supplier</th>
                                          <th className="px-3 py-2 text-right font-medium">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {v.batches.map((batch, bi) => (
                                          <tr key={batch.id} className="border-t hover:bg-gray-50">
                                            <td className="px-3 py-2">{bi + 1}</td>
                                            <td className="px-3 py-2 font-medium">{batch.batch_number}</td>
                                            <td className="px-3 py-2">{batch.lot_number || "N/A"}</td>
                                            <td className="px-3 py-2">
                                              <RemainingCell available={batch.quantity_available} received={batch.quantity_received} />
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">{Number(batch.quantity_sold || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2">{batch.manufacture_date ? new Date(batch.manufacture_date).toLocaleDateString() : "N/A"}</td>
                                            <td className="px-3 py-2">
                                              <ExpiryCell date={batch.expiry_date} />
                                            </td>
                                            <td className="px-3 py-2">
                                              {typeof batch.supplier === 'string'
                                                ? batch.supplier
                                                : (batch.supplier && typeof batch.supplier === 'object' && 'name' in batch.supplier
                                                  ? batch.supplier.name
                                                  : "N/A")}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedBatch({ productId: batch.product_id, batchId: batch.id })
                                                  }}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View Details
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })
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