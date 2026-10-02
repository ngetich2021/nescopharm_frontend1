"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  MoreHorizontal, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Edit, 
  Plus, 
  RefreshCw, 
  Trash2,
  CheckCircle,
  XCircle,
  Send
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"
import { useRouter } from "next/navigation"
import { 
  type StockAdjustment,
  getStatusColor,
  getReasonTypeLabel,
  getAdjustmentTypeLabel,
  formatCurrency,
  canEditAdjustment,
  canDeleteAdjustment,
  canSubmitAdjustment,
  canApproveAdjustment
} from "@/lib/stock-adjustments"
import { CreateStockAdjustmentSheet } from "./components/create-stock-adjustment-sheet"
import { EditStockAdjustmentSheet } from "./components/edit-stock-adjustment-sheet"
import { ApproveAdjustmentDialog } from "./components/approve-adjustment-dialog"
import { RejectAdjustmentDialog } from "./components/reject-adjustment-dialog"
import { DeleteAdjustmentDialog } from "./components/delete-adjustment-dialog"
import { format } from "date-fns"

interface StockAdjustmentsTableProps {
  adjustments: StockAdjustment[]
  onAdjustmentUpdated: () => void
  isLoading?: boolean
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

export function StockAdjustmentsTable({
  adjustments,
  onAdjustmentUpdated,
  isLoading = false,
  onRefresh,
  pagination,
  onPageChange,
  onItemsPerPageChange,
  currentPage = 1,
  itemsPerPage = 20,
}: StockAdjustmentsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [reasonTypeFilter, setReasonTypeFilter] = useState("all")
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustment | null>(null)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const { toast } = useToast()

  // Filter adjustments based on search and filters
  const filteredAdjustments = adjustments.filter((adjustment) => {
    // Get product names from either direct product or items array
    const productNames = adjustment.product 
      ? [adjustment.product.name?.toLowerCase() || ""]
      : adjustment.items?.map(item => item.product?.name?.toLowerCase() || "") || []
    
    const matchesSearch = searchTerm === "" || 
      adjustment.adjustment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      productNames.some(name => name.includes(searchTerm.toLowerCase())) ||
      adjustment.reason.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || adjustment.status === statusFilter
    const matchesReasonType = reasonTypeFilter === "all" || adjustment.reason_type === reasonTypeFilter
    
    return matchesSearch && matchesStatus && matchesReasonType
  })

  const handleViewDetails = (adjustment: StockAdjustment) => {
    router.push(`/inventory/stock-adjustments/${adjustment.id}`)
  }

  const handleEdit = (adjustment: StockAdjustment) => {
    setSelectedAdjustment(adjustment)
    setIsEditSheetOpen(true)
  }

  const handleApprove = (adjustment: StockAdjustment) => {
    setSelectedAdjustment(adjustment)
    setIsApproveDialogOpen(true)
  }

  const handleReject = (adjustment: StockAdjustment) => {
    setSelectedAdjustment(adjustment)
    setIsRejectDialogOpen(true)
  }

  const handleDelete = (adjustment: StockAdjustment) => {
    setSelectedAdjustment(adjustment)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmit = async (adjustment: StockAdjustment) => {
    setIsSubmitting(true)
    try {
      const { submitStockAdjustmentAction } = await import("./actions")
      const result = await submitStockAdjustmentAction(adjustment.id)
      if (result.success) {
        toast({
          title: "Success",
          description: "Stock adjustment submitted for approval",
        })
        onAdjustmentUpdated()
      } else {
        throw new Error(result.message)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit adjustment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search adjustments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reasonTypeFilter} onValueChange={setReasonTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="damage">Damage</SelectItem>
                <SelectItem value="expiry">Expiry</SelectItem>
                <SelectItem value="theft">Theft</SelectItem>
                <SelectItem value="loss">Loss</SelectItem>
                <SelectItem value="found">Found</SelectItem>
                <SelectItem value="recount">Recount</SelectItem>
                <SelectItem value="correction">Correction</SelectItem>
                <SelectItem value="return">Return</SelectItem>
                <SelectItem value="donation">Donation</SelectItem>
                <SelectItem value="sample">Sample</SelectItem>
                <SelectItem value="write_off">Write-off</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
            {hasPermission("can_update_products") && (
              <Button size="sm" onClick={() => setIsCreateSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Adjustment
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adjustment #</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Qty Adjusted</TableHead>
                <TableHead className="text-right">Value Impact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No stock adjustments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAdjustments.map((adjustment) => {
                  // Determine if this is a bulk adjustment (has items) or single product adjustment
                  const isBulkAdjustment = adjustment.items && adjustment.items.length > 0
                  const itemCount = isBulkAdjustment ? adjustment.items_count || adjustment.items.length : 1
                  
                  // Get display quantity - use total_quantity_adjusted for bulk, quantity_adjusted for single
                  const displayQuantity = isBulkAdjustment 
                    ? adjustment.total_quantity_adjusted 
                    : adjustment.quantity_adjusted
                  
                  return (
                    <TableRow 
                      key={adjustment.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleViewDetails(adjustment)}
                    >
                      <TableCell className="font-medium">
                        {adjustment.adjustment_number}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {itemCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={adjustment.adjustment_type === "increase" ? "default" : adjustment.adjustment_type === "decrease" ? "destructive" : "secondary"}>
                          {getAdjustmentTypeLabel(adjustment.adjustment_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{getReasonTypeLabel(adjustment.reason_type)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {displayQuantity !== null && displayQuantity !== undefined ? (
                          <span className={displayQuantity < 0 ? "text-red-600" : "text-green-600"}>
                            {displayQuantity > 0 ? "+" : ""}{displayQuantity}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={parseFloat(adjustment.total_value) < 0 ? "text-red-600" : "text-green-600"}>
                          {formatCurrency(adjustment.total_value)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(adjustment.status)}>
                          {adjustment.status.charAt(0).toUpperCase() + adjustment.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(adjustment.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(adjustment);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {canEditAdjustment(adjustment.status) && hasPermission("can_update_products") && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(adjustment);
                              }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canSubmitAdjustment(adjustment.status) && hasPermission("can_update_products") && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleSubmit(adjustment);
                              }} disabled={isSubmitting}>
                                <Send className="mr-2 h-4 w-4" />
                                Submit for Approval
                              </DropdownMenuItem>
                            )}
                            {canApproveAdjustment(adjustment.status) && hasPermission("can_approve_adjustments") && (
                              <>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(adjustment);
                                }}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleReject(adjustment);
                                }}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {canDeleteAdjustment(adjustment.status) && hasPermission("can_delete_products") && (
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(adjustment);
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4">
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 text-sm text-gray-600 order-2 sm:order-1">
              <span className="whitespace-nowrap">Rows per page</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  const newItemsPerPage = Number(value)
                  onItemsPerPageChange?.(newItemsPerPage)
                }}
              >
                <SelectTrigger className="h-8 w-[70px] text-sm">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={pageSize.toString()} className="text-sm">
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="hidden lg:inline whitespace-nowrap">
                | Total: {pagination.total}
              </span>
            </div>
            <div className="flex items-center space-x-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.current_page - 1)}
                disabled={pagination.current_page === 1}
                className="border-gray-300 hover:border-primary hover:text-primary"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <div className="flex items-center justify-center text-sm font-medium text-gray-700 px-2">
                <span className="whitespace-nowrap">Page {pagination.current_page} of {pagination.last_page > 0 ? pagination.last_page : 1}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.current_page + 1)}
                disabled={pagination.current_page === pagination.last_page || pagination.last_page === 0}
                className="border-gray-300 hover:border-primary hover:text-primary"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs and Sheets */}
      <CreateStockAdjustmentSheet
        open={isCreateSheetOpen}
        onOpenChange={setIsCreateSheetOpen}
        onSuccess={onAdjustmentUpdated}
      />

      {selectedAdjustment && (
        <>
          <EditStockAdjustmentSheet
            open={isEditSheetOpen}
            onOpenChange={setIsEditSheetOpen}
            adjustment={selectedAdjustment}
            onSuccess={onAdjustmentUpdated}
          />

          <ApproveAdjustmentDialog
            open={isApproveDialogOpen}
            onOpenChange={setIsApproveDialogOpen}
            adjustment={selectedAdjustment}
            onSuccess={onAdjustmentUpdated}
          />

          <RejectAdjustmentDialog
            open={isRejectDialogOpen}
            onOpenChange={setIsRejectDialogOpen}
            adjustment={selectedAdjustment}
            onSuccess={onAdjustmentUpdated}
          />

          <DeleteAdjustmentDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            adjustment={selectedAdjustment}
            onSuccess={onAdjustmentUpdated}
          />
        </>
      )}
    </>
  )
}
