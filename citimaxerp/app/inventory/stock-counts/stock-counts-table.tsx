"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Download, ChevronLeft, ChevronRight, Eye, X, Calendar, RefreshCw, MoreHorizontal, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList, CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FileSpreadsheet } from "lucide-react"
import type { StockCount } from "@/app/types"
import { format } from "date-fns"
import { PermissionGuard } from "@/components/PermissionGuard"
import { CreateStockCountSheet } from "./components/create-stock-count-sheet"
import { deleteStockCount, updateStockCountStatus } from "@/lib/stock-counts"

interface StockCountSummary {
  totalCounts: number
  completedCounts: number
  inProgressCounts: number
  pendingCounts: number
  cancelledCounts: number
}

interface StockCountsTableProps {
  stockCounts: StockCount[]
  summaryData: StockCountSummary
  onStockCountCreated: (newCount: StockCount) => void
  onRefresh?: () => void
}

export function StockCountsTable({
  stockCounts: initialStockCounts,
  summaryData,
  onStockCountCreated,
  onRefresh,
}: StockCountsTableProps) {
  const router = useRouter()
  const [stockCounts, setStockCounts] = useState<StockCount[]>(initialStockCounts)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"name" | "date" | "items">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const { toast } = useToast()
  const [isCreateStockCountSheetOpen, setIsCreateStockCountSheetOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [selectedStockCountId, setSelectedStockCountId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedLocation, statusFilter])

  // Filter and sort stock counts
  const filteredAndSortedStockCounts = useMemo(() => {
    let result = [...stockCounts]
    
    // Apply search filter
    if (searchQuery) {
      result = result.filter(
        (count) =>
          count.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          count.count_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (count.created_by || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          ((count.store?.name || count.location || '').toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    // Apply location filter
    if (selectedLocation !== "all") {
      result = result.filter(
        (count) => (count.store?.name || count.location) === selectedLocation
      )
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((count) => count.status === statusFilter)
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "date":
          comparison = new Date(a.scheduled_date || a.created_at || 0).getTime() - 
                      new Date(b.scheduled_date || b.created_at || 0).getTime()
          break
        case "items":
          comparison = a.total_products_expected - b.total_products_expected
          break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    
    return result
  }, [stockCounts, searchQuery, selectedLocation, statusFilter, sortBy, sortOrder])

  const totalPages = Math.ceil(filteredAndSortedStockCounts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentStockCounts = filteredAndSortedStockCounts.slice(startIndex, endIndex)

  const handleSelectAll = (checked: boolean) => {
    // Removed checkbox functionality
  }

  const handleSelectCount = (countId: string, checked: boolean) => {
    // Removed checkbox functionality
  }

  const exportToCSV = () => {
    const countsToExport = filteredAndSortedStockCounts

    const csv = [
      [
        "Count Number",
        "Name",
        "Location",
        "Type",
        "Status",
        "Created By",
        "Scheduled Date",
        "Products Expected",
        "Products Counted",
        "Variances",
      ],
      ...countsToExport.map((c: StockCount) => [
        c.count_number,
        c.name,
        c.store?.name || c.location || "-",
        c.count_type,
        c.status,
        c.created_by || "System",
        c.scheduled_date ? format(new Date(c.scheduled_date), "yyyy-MM-dd") : "-",
        c.total_products_expected.toString(),
        c.total_products_counted.toString(),
        c.total_variances.toString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `stock-counts-${new Date().toISOString().split("T")[0]}.csv`
    a.click()

    toast({
      title: "Export successful",
      description: `Exported ${countsToExport.length} stock counts to CSV`,
    })
  }

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedLocation("all")
    setStatusFilter("all")
  }

  const hasActiveFilters = searchQuery || selectedLocation !== "all" || statusFilter !== "all"

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "draft":
        return "border-yellow-500 text-yellow-500"
      case "in_progress":
        return "border-blue-500 text-blue-500"
      case "completed":
        return "border-green-500 text-green-500"
      case "approved":
        return "border-purple-500 text-purple-500"
      case "cancelled":
        return "border-red-500 text-red-500"
      default:
        return ""
    }
  }

  const formatStatusLabel = (status: string) => {
    switch (status) {
      case "in_progress":
        return "In Progress"
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const handleViewDetails = (stockCountId: string) => {
    router.push(`/inventory/stock-counts/${stockCountId}`)
  }

  // Listen for changes to initialStockCounts prop
  useEffect(() => {
    setStockCounts(initialStockCounts);
  }, [initialStockCounts]);

  const handleStockCountCreated = (newCount: StockCount) => {
    setStockCounts((prev) => [newCount, ...prev]);
    onStockCountCreated(newCount); // Propagate up to refresh parent data if needed
  }

  const handleDeleteClick = (stockCountId: string) => {
    setSelectedStockCountId(stockCountId)
    setDeleteDialogOpen(true)
  }

  const handleApproveClick = (stockCountId: string) => {
    setSelectedStockCountId(stockCountId)
    setApproveDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedStockCountId) return

    try {
      setIsDeleting(true)
      await deleteStockCount(selectedStockCountId)
      
      // Remove from local state
      setStockCounts((prev) => prev.filter(c => c.id !== selectedStockCountId))
      
      toast({
        title: "Success",
        description: "Stock count deleted successfully",
      })
      
      setDeleteDialogOpen(false)
      setSelectedStockCountId(null)
      onStockCountCreated({} as StockCount) // Trigger parent refresh
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stock count",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleApproveConfirm = async () => {
    if (!selectedStockCountId) return

    try {
      setIsApproving(true)
      await updateStockCountStatus(selectedStockCountId, "approved", {
        approved_at: new Date().toISOString(),
      })
      
      toast({
        title: "Success",
        description: "Stock count approved successfully",
      })
      
      setApproveDialogOpen(false)
      setSelectedStockCountId(null)
      onStockCountCreated({} as StockCount) // Trigger parent refresh
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve stock count",
        variant: "destructive",
      })
    } finally {
      setIsApproving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Counts</CardTitle>
            <ClipboardList className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.totalCounts}</div>
            <p className="text-xs text-muted-foreground">All time counts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.completedCounts}</div>
            <p className="text-xs text-muted-foreground">
              {summaryData.totalCounts > 0
                ? ((summaryData.completedCounts / summaryData.totalCounts) * 100).toFixed(1)
                : 0}
              % completion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.inProgressCounts}</div>
            <p className="text-xs text-muted-foreground">Currently being counted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.pendingCounts}</div>
            <p className="text-xs text-muted-foreground">Awaiting start</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.cancelledCounts}</div>
            <p className="text-xs text-muted-foreground">Cancelled counts</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stock counts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {Array.from(
                  new Set(
                    stockCounts
                      .map((count) => count.store?.name || count.location)
                      .filter(Boolean)
                  )
                ).map((location) => (
                  <SelectItem key={location} value={location as string}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="date-desc">Date (Newest)</SelectItem>
                <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                <SelectItem value="items-desc">Items (High-Low)</SelectItem>
                <SelectItem value="items-asc">Items (Low-High)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <PermissionGuard permissions={["can_create_stock_counts", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <Button
              onClick={() => setIsCreateStockCountSheetOpen(true)}
              variant="outline"
              size="sm"
              className="border-[#1E2764] text-[#1E2764] hover:bg-[#1E2764]/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Count
            </Button>
          </PermissionGuard>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportToCSV}>
                Export as CSV
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

      {/* Stock Counts Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Count #</TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Location</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Created By</TableHead>
              <TableHead className="font-semibold">Scheduled</TableHead>
              <TableHead className="font-semibold">Items</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentStockCounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No stock counts found</p>
                    <p className="text-sm">Create your first stock count to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              currentStockCounts.map((count) => (
                <TableRow 
                  key={count.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleViewDetails(count.id)}
                >
                  <TableCell className="font-medium">
                    <div className="text-sm font-semibold text-[#1E2764]">
                      {count.count_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{count.name}</div>
                  </TableCell>
                  <TableCell>{count.store?.name || count.location || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {count.count_type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(getStatusBadgeStyle(count.status))}>
                      {formatStatusLabel(count.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {count.creator?.full_name || count.created_by || "System"}
                  </TableCell>
                  <TableCell>
                    {count.scheduled_date ? (
                      <div className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                        {format(new Date(count.scheduled_date), "MMM d, yyyy")}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {count.total_products_counted} / {count.total_products_expected}
                      </span>
                      {count.total_variances > 0 && (
                        <span className="text-xs text-red-500">
                          {count.total_variances} {count.total_variances === 1 ? 'variance' : 'variances'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(count.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {count.status === "completed" && (
                          <DropdownMenuItem onClick={() => handleApproveClick(count.id)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(count.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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
      {filteredAndSortedStockCounts.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-muted-foreground">Rows per page</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => {
                setItemsPerPage(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={itemsPerPage} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((old) => Math.max(old - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((old) => Math.min(old + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Stock Count Sheet */}
      <CreateStockCountSheet
        isOpen={isCreateStockCountSheetOpen}
        onOpenChange={setIsCreateStockCountSheetOpen}
        onStockCountCreated={handleStockCountCreated}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Count</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stock count? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Stock Count</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this stock count? This will finalize the count and update inventory records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveConfirm}
              disabled={isApproving}
            >
              {isApproving ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
