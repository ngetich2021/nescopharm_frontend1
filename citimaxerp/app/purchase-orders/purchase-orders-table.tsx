"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MoreHorizontal,
  Search,
  Filter,
  Download,
  Upload,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Trash2,
  Plus,
  Eye,
  Edit,
  Package,
  RotateCcw,
  CheckCircle,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getPurchaseOrders, deletePurchaseOrder, approvePurchaseOrder, PurchaseOrder } from "@/lib/purchaseorders"
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
import { useToast } from "@/hooks/use-toast"
import { PurchaseOrderDetailsSheet } from "./purchase-order-details-sheet"
import { EditPurchaseOrderSheet } from "./components/edit-purchase-order-sheet"
import { ReceiptPurchaseOrderSheet } from "./components/receipt-purchase-order-sheet"
import { ReturnPurchaseOrderSheet } from "./components/return-purchase-order-sheet"
import { CreatePurchaseOrderSheet } from "./components/create-purchase-order-sheet"
import { getSuppliers, Supplier } from "@/lib/suppliers"
import { formatDate, formatCurrency } from "@/lib/utils"
import { PurchaseOrdersTableSkeleton } from "./purchase-orders-table-skeleton"
import { PermissionGuard } from "@/components/PermissionGuard"

interface PurchaseOrdersTableProps {
  onDataChanged?: () => void
}

export function PurchaseOrdersTable({ onDataChanged }: PurchaseOrdersTableProps) {
  const { toast } = useToast()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false)
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<PurchaseOrder | null>(null)
  const [isReceiptSheetOpen, setIsReceiptSheetOpen] = useState(false)
  const [receiptOrder, setReceiptOrder] = useState<PurchaseOrder | null>(null)
  const [isReturnSheetOpen, setIsReturnSheetOpen] = useState(false)
  const [returnOrder, setReturnOrder] = useState<PurchaseOrder | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [approveOrder, setApproveOrder] = useState<PurchaseOrder | null>(null)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  useEffect(() => {
    fetchOrders()
    fetchSuppliers()
  }, [])

  async function fetchOrders() {
    setIsLoading(true)
    try {
      const data = await getPurchaseOrders({ status: statusFilter !== 'all' ? statusFilter : undefined })
      setOrders(data)
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to fetch purchase orders',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchSuppliers() {
    try {
      const data = await getSuppliers()
      setSuppliers(data)
    } catch (err) {
      // Optionally handle error
    }
  }

  function getSupplierName(supplierId: string) {
    const supplier = suppliers.find(s => s.id === supplierId)
    return supplier ? supplier.name : supplierId
  }

  function getOrderSubtotal(order: PurchaseOrder) {
    return order.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
  }

  // Filtering and search
  const filteredOrders = orders.filter(
    (order) =>
      (statusFilter === "all" || order.status === statusFilter) &&
      (search === "" ||
        order.order_number.toLowerCase().includes(search.toLowerCase())
      )
  )

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage)
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const handleRowClick = (orderId: string) => {
    setSelectedOrderId(orderId)
    setIsOrderDetailsOpen(true)
  }

  const toggleSelectOrder = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    setSelectedOrders((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId)
      } else {
        return [...prev, orderId]
      }
    })
  }

  const toggleSelectOrderCheckbox = (orderId: string) => {
    setSelectedOrders((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId)
      } else {
        return [...prev, orderId]
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectedOrders.length === paginatedOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(paginatedOrders.map((order) => order.id))
    }
  }

  const handleEditClick = (order: PurchaseOrder) => {
    setEditOrder(order)
    setIsEditSheetOpen(true)
  }

  const handleReceiptClick = (order: PurchaseOrder) => {
    setReceiptOrder(order)
    setIsReceiptSheetOpen(true)
  }

  const handleReturnClick = (order: PurchaseOrder) => {
    setReturnOrder(order)
    setIsReturnSheetOpen(true)
  }

  const handleApproveClick = (order: PurchaseOrder) => {
    setApproveOrder(order)
    setIsApproveDialogOpen(true)
  }

  const handleApproveConfirm = async () => {
    if (!approveOrder) return
    setIsApproving(true)
    try {
      await approvePurchaseOrder(approveOrder.id)
      toast({
        title: "Success",
        description: `Purchase order ${approveOrder.order_number} has been approved.`
      })
      fetchOrders()
      if (onDataChanged) onDataChanged()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve purchase order",
        variant: "destructive"
      })
    } finally {
      setIsApproving(false)
      setIsApproveDialogOpen(false)
      setApproveOrder(null)
    }
  }

  const handleDeleteClick = async (order: PurchaseOrder) => {
    if (confirm(`Are you sure you want to delete purchase order ${order.order_number}?`)) {
      try {
        await deletePurchaseOrder(order.id)
        toast({
          title: "Success",
          description: "Purchase order deleted successfully."
        })
        fetchOrders()
        if (onDataChanged) onDataChanged()
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to delete purchase order",
          variant: "destructive"
        })
      }
    }
  }

  if (isLoading) {
    return <PurchaseOrdersTableSkeleton />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <Input
              className="pl-8 max-w-sm"
              placeholder="Search purchase orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="pl-8 w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="partially_received">Partially Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex space-x-2">
          <PermissionGuard permissions={["can_create_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <CreatePurchaseOrderSheet
              open={isCreateSheetOpen}
              onOpenChange={setIsCreateSheetOpen}
              onPurchaseOrderCreated={() => {
                setIsCreateSheetOpen(false)
                fetchOrders()
                if (onDataChanged) onDataChanged()
              }}
            />
            <Button 
              onClick={() => setIsCreateSheetOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Purchase Order
            </Button>
          </PermissionGuard>
          <Button variant="outline" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  No purchase orders found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => (
                <TableRow 
                  key={order.id} 
                  className="cursor-pointer"
                  onClick={(e) => {
                    // Don't trigger row click when clicking on action buttons
                    if ((e.target as HTMLElement).closest('button, a, input')) return;
                    handleRowClick(order.id)
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={() => toggleSelectOrderCheckbox(order.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{order.supplier?.name || getSupplierName(order.supplier_id)}</TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell>{order.items?.length || 0}</TableCell>
                  <TableCell>{formatCurrency(parseFloat(order.total_amount || '0') || getOrderSubtotal(order))}</TableCell>
                  <TableCell>
                    <Badge variant={
                      order.payment_status === 'paid' ? 'default' :
                      order.payment_status === 'partial' ? 'secondary' :
                      'outline'
                    } className="capitalize">
                      {order.payment_status || 'unpaid'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      order.approval_status === 'approved' ? 'default' :
                      order.approval_status === 'rejected' ? 'destructive' :
                      'outline'
                    } className="capitalize">
                      {order.approval_status || 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      order.status === 'draft' ? 'secondary' :
                      order.status === 'pending' ? 'outline' :
                      order.status === 'approved' ? 'default' :
                      order.status === 'rejected' ? 'destructive' :
                      order.status === 'received' ? 'default' :
                      order.status === 'partially_received' ? 'outline' :
                      'secondary'
                    } className="capitalize">
                      {order.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRowClick(order.id); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <PermissionGuard permissions={["can_update_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(order); }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        </PermissionGuard>
                        <PermissionGuard permissions={["can_receive_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReceiptClick(order); }}>
                            <Package className="h-4 w-4 mr-2" />
                            Receipt
                          </DropdownMenuItem>
                        </PermissionGuard>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReturnClick(order); }}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Return
                        </DropdownMenuItem>
                        {(order.approval_status === 'pending' || !order.approval_status) && (
                          <PermissionGuard permissions={["can_approve_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleApproveClick(order); }}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </DropdownMenuItem>
                          </PermissionGuard>
                        )}
                        <PermissionGuard permissions={["can_delete_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-primary"
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(order); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </PermissionGuard>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select value={String(rowsPerPage)} onValueChange={value => { setRowsPerPage(Number(value)); setCurrentPage(1); }}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <PurchaseOrderDetailsSheet
        orderId={selectedOrderId}
        open={isOrderDetailsOpen}
        onOpenChange={setIsOrderDetailsOpen}
        onOrderUpdated={() => {
          fetchOrders()
          if (onDataChanged) onDataChanged()
        }}
        onEdit={(order) => {
          setEditOrder(order)
          setIsEditSheetOpen(true)
        }}
      />
      <PermissionGuard permissions={["can_update_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
        <EditPurchaseOrderSheet
          open={isEditSheetOpen}
          onOpenChange={setIsEditSheetOpen}
          order={editOrder}
          onPurchaseOrderUpdated={() => {
            setIsEditSheetOpen(false)
            setEditOrder(null)
            fetchOrders()
            if (onDataChanged) onDataChanged()
          }}
        />
      </PermissionGuard>
      <PermissionGuard permissions={["can_receive_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
        <ReceiptPurchaseOrderSheet
          open={isReceiptSheetOpen}
          onOpenChange={setIsReceiptSheetOpen}
          order={receiptOrder}
          onPurchaseOrderReceipted={() => {
            setIsReceiptSheetOpen(false)
            setReceiptOrder(null)
            fetchOrders()
            if (onDataChanged) onDataChanged()
          }}
        />
      </PermissionGuard>
      <ReturnPurchaseOrderSheet
        open={isReturnSheetOpen}
        onOpenChange={setIsReturnSheetOpen}
        order={returnOrder}
        onPurchaseOrderReturned={() => {
          setIsReturnSheetOpen(false)
          setReturnOrder(null)
          fetchOrders()
          if (onDataChanged) onDataChanged()
        }}
      />
      {/* Approve Confirmation Dialog */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve purchase order <strong>{approveOrder?.order_number}</strong>?
              This action will change the status to approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveConfirm} disabled={isApproving}>
              {isApproving ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 