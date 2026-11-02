"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Plus,
  Search,
  FileSpreadsheet,
  FileIcon as FilePdf,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CreateOrderModal } from "@/components/modals/create-order-modal"
import { EditOrderModal } from "@/components/modals/edit-order-modal"
import { DeleteOrderConfirmationDialog } from "./components/DeleteOrderConfirmationDialog"
import { toast } from "@/components/ui/use-toast"
import { fetchOrders, Order, fetchOrderById, OrderDetail, deleteOrder, isPastSaleDate, declinedDeletesAt } from "@/lib/orders"
import { matchesDocNumber } from "@/lib/utils"
import { PermissionGuard } from "@/components/PermissionGuard"
import { ExportMenu, useTableExport } from "@/components/export-menu"

interface OrdersTableProps {
  initialOrders?: Order[]
  isLoading?: boolean
}

export function OrdersTable({ initialOrders = [], isLoading: initialLoading = false }: OrdersTableProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [isRefreshing, setIsRefreshing] = useState(false)
  // Combine parent-driven loading (initial fetch) with internal refresh loading
  const isLoading = initialLoading || isRefreshing
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // State for edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [isViewingOrder, setIsViewingOrder] = useState(false)
  
  // State for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)

  const refreshOrders = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const fetchedOrders = await fetchOrders()
      setOrders(fetchedOrders)
      toast({
        title: "Orders Refreshed",
        description: "Orders data reloaded successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh orders",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // The parent page owns the initial load; the table only re-fetches on explicit refresh.
  useEffect(() => {
    if (initialOrders.length > 0) {
      setOrders(initialOrders)
    }
  }, [initialOrders])

  const toggleOrder = (orderId: string) => {
    setSelectedOrders((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    )
  }

  const toggleAll = () => {
    setSelectedOrders((current) =>
      current.length === filteredOrders.length && filteredOrders.length > 0
        ? []
        : filteredOrders.map((order) => order.id),
    )
  }

  const handleRowClick = (orderId: string) => {
    router.push(`/sales/orders/${orderId}`)
  }

  // Function to handle viewing order details
  const handleViewOrder = (orderId: string) => {
    router.push(`/sales/orders/${orderId}`)
  }

  // Function to handle editing an order
  const handleEditOrder = async (orderId: string) => {
    try {
      setIsRefreshing(true)
      const orderDetail = await fetchOrderById(orderId)
      if (orderDetail) {
        setSelectedOrder(orderDetail)
        setIsEditModalOpen(true)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch order details",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Function to handle deleting an order
  const handleDeleteOrder = (order: Order) => {
    setOrderToDelete(order)
    setIsDeleteDialogOpen(true)
  }

  // Function to handle order deletion success
  const handleOrderDeleted = () => {
    setIsDeleteDialogOpen(false)
    setOrderToDelete(null)
    refreshOrders()
  }

  // Function to handle order update
  const handleOrderUpdated = () => {
    setIsEditModalOpen(false)
    setSelectedOrder(null)
    refreshOrders()
    toast({
      title: "Order Updated",
      description: "Order has been updated successfully.",
    })
  }

  const formatOrderNumber = (order: Order) => {
    return order.order_number ? order.order_number : `ORD-${order.id.substring(0, 8).toUpperCase()}`
  }

  const formatStatus = (status: string | null) => {
    const rawStatus = status || "Unknown"
    return rawStatus
      .replace(/[^\w\s]/gi, "")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  }

  // The ticked orders, or every order matching the search and status.
  const exportOrders = useTableExport(() => {
    const list = selectedOrders.length > 0 ? filteredOrders.filter((order) => selectedOrders.includes(order.id)) : filteredOrders
    const amount = (order: Order) => Number.parseFloat(order.final_amount || order.total_amount || "0") || 0
    return {
      fileName: `orders-${new Date().toISOString().split("T")[0]}`,
      title: "Orders",
      subtitle: statusFilter !== "all" ? `Status: ${formatStatus(statusFilter)}` : undefined,
      headers: ["S/No", "Order Number", "Invoice", "Customer", "Date", "Status", "Total Amount"],
      moneyColumns: [6],
      rows: list.map((order, i) => [
        i + 1,
        formatOrderNumber(order),
        order.invoice?.invoice_number || "",
        (order.customer as any)?.business_name || order.customer?.name || "Unknown",
        new Date(order.order_date || order.created_at).toLocaleDateString("en-GB"),
        formatStatus(order.status),
        amount(order),
      ]),
      footer: [["", "", "", "", "", "Total", list.reduce((s, o) => s + amount(o), 0)]],
    }
  })

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      searchQuery === "" ||
      (order.order_number && order.order_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      matchesDocNumber(order.invoice?.invoice_number, searchQuery) ||
      (order.customer?.name && order.customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      ((order.customer as any)?.business_name && (order.customer as any).business_name.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = statusFilter === "all" || order.status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage)
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  useEffect(() => {
    setSelectedOrders([])
  }, [currentPage, rowsPerPage, statusFilter, searchQuery])

  // Actions dropdown component
  const ActionsDropdown = ({ order }: { order: Order }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewOrder(order.id); }}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
          <PermissionGuard permissions={["can_update_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditOrder(order.id); }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Order
            </DropdownMenuItem>
          </PermissionGuard>
          <PermissionGuard permissions={["can_delete_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-primary"
              onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Order
            </DropdownMenuItem>
          </PermissionGuard>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <Input
              className="pl-8 max-w-sm"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <PermissionGuard permissions={["can_create_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <CreateOrderModal onOrderCreated={refreshOrders}>
              <Button 
                variant="outline"
                size="sm"
                className="border-primary text-primary hover:bg-primary/10"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </CreateOrderModal>
          </PermissionGuard>
          <ExportMenu onExport={exportOrders} disabled={filteredOrders.length === 0} />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshOrders}
            disabled={isLoading}
            className="border-gray-800 text-gray-800 hover:bg-gray-100"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} mr-2`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Order #</TableHead>
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">Total Amount</TableHead>
              <TableHead className="font-semibold">Lines</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Order Date</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading orders...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No orders found</p>
                    <p className="text-sm">Create your first order to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => (
                <TableRow 
                  key={order.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRowClick(order.id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-primary">
                        {formatOrderNumber(order)}
                      </span>
                      {order.invoice?.invoice_number && (
                        <span className="text-xs text-muted-foreground">{order.invoice.invoice_number}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {(order.customer as any)?.business_name || order.customer?.name || "Unknown Customer"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {order.customer?.email || "No email"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    Ksh.{" "}
                    {Number.parseFloat(order.final_amount || order.total_amount || "0").toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {order.item_count}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const rawStatus = order.status || "Unknown"
                      const formattedStatus = formatStatus(rawStatus)

                      const statusLower = rawStatus.toLowerCase()
                      let badgeClass = ""

                      if (statusLower.includes("paid") || statusLower.includes("complete")) {
                        badgeClass = "bg-green-100 text-green-800 border-green-500"
                      } else if (statusLower.includes("pending")) {
                        badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-500"
                      } else if (statusLower.includes("process")) {
                        badgeClass = "bg-blue-100 text-blue-800 border-blue-500"
                      } else if (statusLower.includes("fail") || statusLower.includes("reject")) {
                        badgeClass = "bg-red-100 text-red-800 border-red-500"
                      } else if (statusLower.includes("cancel")) {
                        badgeClass = "bg-gray-100 text-gray-800 border-gray-500"
                      } else if (statusLower.includes("refund")) {
                        badgeClass = "bg-purple-100 text-purple-800 border-purple-500"
                      } else if (statusLower.includes("hold")) {
                        badgeClass = "bg-orange-100 text-orange-800 border-orange-500"
                      } else if (statusLower.includes("ship")) {
                        badgeClass = "bg-indigo-100 text-indigo-800 border-indigo-500"
                      } else if (statusLower.includes("deliver")) {
                        badgeClass = "bg-teal-100 text-teal-800 border-teal-500"
                      } else {
                        badgeClass = "bg-gray-100 text-gray-800 border-gray-500"
                      }

                      return (
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="outline" className={cn(badgeClass)}>
                            {formattedStatus}
                          </Badge>
                          {(order.is_historical || isPastSaleDate(order.order_date)) && (
                            <span className="text-[11px] text-muted-foreground">Past sale · no stock</span>
                          )}
                          {declinedDeletesAt(order) && (
                            <span className="text-[11px] text-red-600">
                              Deletes {declinedDeletesAt(order)!.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    {/* The sale's own date; when it was keyed in is shown under it if that's a different day. */}
                    <div className="text-sm">
                      {new Date(order.order_date || order.created_at).toLocaleDateString("en-GB")}
                      {order.order_date && order.order_date.slice(0, 10) !== order.created_at?.slice(0, 10) && (
                        <div className="text-xs text-muted-foreground">
                          entered {new Date(order.created_at).toLocaleDateString("en-GB")}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <ActionsDropdown order={order} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Edit Order Modal */}
      <PermissionGuard permissions={["can_update_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
        {selectedOrder && (
          <EditOrderModal
            order={selectedOrder}
            open={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            onOrderUpdated={handleOrderUpdated}
          />
        )}
      </PermissionGuard>
      
      {/* Delete Order Confirmation Dialog */}
      <PermissionGuard permissions={["can_delete_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
        <DeleteOrderConfirmationDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onSuccess={handleOrderDeleted}
          order={orderToDelete}
        />
      </PermissionGuard>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={rowsPerPage.toString()}
            onValueChange={(value) => {
              setRowsPerPage(Number(value));
              setCurrentPage(1);
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
            className="border-gray-200 hover:bg-[primary]/10 hover:text-[primary] hover:border-[primary]"
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
            className="border-gray-200 hover:bg-[primary]/10 hover:text-[primary] hover:border-[primary]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}