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
  XCircle,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getPurchaseOrders, deletePurchaseOrder, approvePurchaseOrder, updatePurchaseOrder, itemLabel, receiveGoodsUrl, PurchaseOrder } from "@/lib/purchaseorders"
import { useRouter } from "next/navigation"
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
import { ReturnPurchaseOrderSheet } from "./components/return-purchase-order-sheet"
import { PurchaseOrderFormSheet } from "./components/purchase-order-form-sheet"
import { getSuppliers, Supplier } from "@/lib/suppliers"
import { formatDate, formatCurrency } from "@/lib/utils"
import { PurchaseOrdersTableSkeleton } from "./purchase-orders-table-skeleton"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useAuth } from "@/lib/auth-context"
import { hasExplicitPermission } from "@/lib/rbac"

interface PurchaseOrdersTableProps {
  onDataChanged?: () => void
}

export function PurchaseOrdersTable({ onDataChanged }: PurchaseOrdersTableProps) {
  const { toast } = useToast()
  const router = useRouter()
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
  const [isReturnSheetOpen, setIsReturnSheetOpen] = useState(false)
  const [returnOrder, setReturnOrder] = useState<PurchaseOrder | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const { userProfile } = useAuth()
  const canApprove = hasExplicitPermission(userProfile, "can_approve_purchase_orders")
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
      const data = await getPurchaseOrders()
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
    return order.items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0)
  }

  const receivedUnits = (order: PurchaseOrder) => order.items.reduce((s, i) => s + (i.received_quantity || 0), 0)
  const returnableUnits = (order: PurchaseOrder) =>
    order.items.reduce((s, i) => s + (i.returnable_quantity ?? Math.max(0, (i.received_quantity || 0) - (i.returned_quantity || 0))), 0)
  const isEditable = (order: PurchaseOrder) => order.status === "pending" && receivedUnits(order) === 0
  const isReceivable = (order: PurchaseOrder) =>
    ["pending", "partial"].includes(order.status) && order.approval_status === "approved" && order.items.length > 0

  const term = search.trim().toLowerCase()
  const filteredOrders = orders.filter((order) => {
    if (statusFilter === "awaiting_approval") {
      if (order.status !== "pending" || (order.approval_status && order.approval_status !== "pending")) return false
    } else if (statusFilter !== "all" && order.status !== statusFilter) {
      return false
    }
    if (!term) return true
    return (
      order.order_number.toLowerCase().includes(term) ||
      (order.supplier?.name || getSupplierName(order.supplier_id)).toLowerCase().includes(term) ||
      order.items.some((item) => itemLabel(item).toLowerCase().includes(term))
    )
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

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
    router.push(receiveGoodsUrl(order.id))
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

  const handleCancelClick = async (order: PurchaseOrder) => {
    if (!confirm(`Cancel purchase order ${order.order_number}? It can no longer be approved or received.`)) return
    try {
      await updatePurchaseOrder(order.id, { status: "cancelled" })
      toast({ title: "Purchase order cancelled", description: order.order_number })
      fetchOrders()
      if (onDataChanged) onDataChanged()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel purchase order",
        variant: "destructive"
      })
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
              placeholder="Search PO, supplier or item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="pl-8 w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="awaiting_approval">Awaiting approval</SelectItem>
                <SelectItem value="pending">Awaiting goods</SelectItem>
                <SelectItem value="partial">Partially received</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex space-x-2">
          <PermissionGuard permissions={["can_create_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <PurchaseOrderFormSheet
              open={isCreateSheetOpen}
              onOpenChange={setIsCreateSheetOpen}
              onSaved={() => {
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
                  <TableCell>
                    <span>{order.items?.length || 0}</span>
                    {order.items?.length > 0 && (
                      <span className="text-xs text-muted-foreground"> · {order.items.reduce((s, i) => s + i.quantity, 0)} units</span>
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(order.total_amount != null ? Number(order.total_amount) : getOrderSubtotal(order))}</TableCell>
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
                      order.status === 'pending' ? 'outline' :
                      order.status === 'received' ? 'default' :
                      order.status === 'cancelled' ? 'destructive' :
                      'secondary'
                    } className="capitalize">
                      {order.status === 'partial' ? 'Partially received' : order.status}
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
                        {isEditable(order) && (
                          <PermissionGuard permissions={["can_update_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(order); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          </PermissionGuard>
                        )}
                        {canApprove && order.status === 'pending' && order.items.length > 0 && (order.approval_status === 'pending' || !order.approval_status) && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleApproveClick(order); }}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                        )}
                        {isReceivable(order) && (
                          <PermissionGuard permissions={["can_create_product_receipts", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReceiptClick(order); }}>
                              <Package className="h-4 w-4 mr-2" />
                              Receive goods
                            </DropdownMenuItem>
                          </PermissionGuard>
                        )}
                        {returnableUnits(order) > 0 && (
                          <PermissionGuard permissions={["can_receive_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReturnClick(order); }}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Return to supplier
                            </DropdownMenuItem>
                          </PermissionGuard>
                        )}
                        {isEditable(order) && (
                          <PermissionGuard permissions={["can_update_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCancelClick(order); }}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel order
                            </DropdownMenuItem>
                          </PermissionGuard>
                        )}
                        {receivedUnits(order) === 0 && Number(order.amount_paid || 0) === 0 && (
                          <PermissionGuard permissions={["can_delete_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(order); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </PermissionGuard>
                        )}
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
        <PurchaseOrderFormSheet
          open={isEditSheetOpen}
          onOpenChange={setIsEditSheetOpen}
          order={editOrder}
          onSaved={() => {
            setIsEditSheetOpen(false)
            setEditOrder(null)
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