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
import { fetchOrders, Order, fetchOrderById, OrderDetail, deleteOrder } from "@/lib/orders"
import { PermissionGuard } from "@/components/PermissionGuard"

interface OrdersTableProps {
  initialOrders?: Order[]
}

export function OrdersTable({ initialOrders = [] }: OrdersTableProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [isLoading, setIsLoading] = useState(false)
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
    setIsLoading(true)
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
      setIsLoading(false)
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
      setIsLoading(true)
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
      setIsLoading(false)
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

  const exportToCSV = () => {
    const ordersToExport =
      selectedOrders.length > 0 ? filteredOrders.filter((order) => selectedOrders.includes(order.id)) : filteredOrders

    const headers = ["Order Number", "Customer", "Date", "Status", "Total Amount"]
    const csvContent = [
      headers.join(","),
      ...ordersToExport.map((order) =>
        [
          formatOrderNumber(order),
          (order.customer as any)?.business_name || order.customer?.name || "Unknown",
          new Date(order.created_at).toLocaleDateString(),
          formatStatus(order.status),
          Number.parseFloat(order.final_amount || order.total_amount || "0").toFixed(2),
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `orders_export_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export Successful",
      description: `Exported ${ordersToExport.length} orders to CSV`,
    })
  }

  const exportToPDF = async () => {
    const ordersToExport =
      selectedOrders.length > 0 ? filteredOrders.filter((order) => selectedOrders.includes(order.id)) : filteredOrders

    toast({
      title: "Preparing PDF",
      description: "Your PDF is being generated...",
    })

    try {
      const iframe = document.createElement("iframe")
      iframe.style.position = "absolute"
      iframe.style.top = "-9999px"
      document.body.appendChild(iframe)

      const doc = iframe.contentDocument
      if (!doc) throw new Error("Could not create document")

      doc.open()
      doc.write(`
      <html>
        <head>
          <title>Orders Export</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .header { margin-bottom: 20px; }
            .header h1 { color: #1E2764; margin-bottom: 5px; }
            .header p { color: #666; margin-top: 0; }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 12px;
            }
            .badge-pending { border: 1px solid #f59e0b; color: #f59e0b; background-color: #fffbeb; }
            .badge-paid { border: 1px solid #10b981; color: #10b981; background-color: #ecfdf5; }
            .badge-failed { border: 1px solid #ef4444; color: #ef4444; background-color: #fef2f2; }
            .badge-processing { border: 1px solid #3b82f6; color: #3b82f6; background-color: #eff6ff; }
            .badge-cancelled { border: 1px solid #6b7280; color: #6b7280; background-color: #f3f4f6; }
            .badge-completed { border: 1px solid #10b981; color: #10b981; background-color: #ecfdf5; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Orders Export</h1>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${ordersToExport
                .map((order) => {
                  const status = formatStatus(order.status).toLowerCase()
                  let badgeClass = "badge-pending"

                  if (status.includes("paid") || status.includes("complete")) {
                    badgeClass = "badge-paid"
                  } else if (status.includes("fail")) {
                    badgeClass = "badge-failed"
                  } else if (status.includes("process")) {
                    badgeClass = "badge-processing"
                  } else if (status.includes("cancel")) {
                    badgeClass = "badge-cancelled"
                  }

                  return `
                      <tr>
                        <td>${formatOrderNumber(order)}</td>
                        <td>${order.customer?.name || "Unknown"}</td>
                        <td>${new Date(order.created_at).toLocaleDateString()}</td>
                        <td>
                          <span class="badge ${badgeClass}">
                            ${formatStatus(order.status)}
                          </span>
                        </td>
                        <td>KES ${(Number.parseFloat(order.final_amount || order.total_amount || "0")).toFixed(2)}</td>
                      </tr>
                    `
                })
                .join("")}
            </tbody>
          </table>
          <div class="footer">
            <p>Cherry CRM - Orders Export</p>
          </div>
        </body>
      </html>
    `)
      doc.close()

      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()

      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)

      toast({
        title: "Export Successful",
        description: `Exported ${ordersToExport.length} orders to PDF`,
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error generating the PDF",
        variant: "destructive",
      })
    }
  }

  const printOrders = () => {
    const ordersToPrint =
      selectedOrders.length > 0 ? filteredOrders.filter((order) => selectedOrders.includes(order.id)) : filteredOrders

    const iframe = document.createElement("iframe")
    iframe.style.position = "absolute"
    iframe.style.top = "-9999px"
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) return

    doc.open()
    doc.write(`
    <html>
      <head>
        <title>Orders</title>
        <style>
          body { font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .header { margin-bottom: 20px; }
          .header h1 { color: primary; margin-bottom: 5px; }
          .header p { color: #666; margin-top: 0; }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
          }
          .badge-pending { border: 1px solid #f59e0b; color: #f59e0b; background-color: #fffbeb; }
          .badge-paid { border: 1px solid #10b981; color: #10b981; background-color: #ecfdf5; }
          .badge-processing { border: 1px solid #3b82f6; color: #3b82f6; background-color: #eff6ff; }
          .badge-cancelled { border: 1px solid #6b7280; color: #6b7280; background-color: #f3f4f6; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Orders</h1>
          <p>Printed on ${new Date().toLocaleDateString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Status</th>
              <th>Total Amount</th>
            </tr>
          </thead>
            <tbody>
            ${ordersToPrint
              .map((order) => {
                const status = formatStatus(order.status).toLowerCase()
                let badgeClass = "badge-pending"

                if (status.includes("paid") || status.includes("complete")) {
                  badgeClass = "badge-paid"
                } else if (status.includes("fail")) {
                  badgeClass = "badge-failed"
                } else if (status.includes("process")) {
                  badgeClass = "badge-processing"
                } else if (status.includes("cancel")) {
                  badgeClass = "badge-cancelled"
                }

                return `
                    <tr>
                      <td>${formatOrderNumber(order)}</td>
                      <td>${(order.customer as any)?.business_name || order.customer?.name || "Unknown"}</td>
                      <td>${new Date(order.created_at).toLocaleDateString()}</td>
                      <td>
                        <span class="badge ${badgeClass}">
                          ${formatStatus(order.status)}
                        </span>
                      </td>
                      <td>KES ${(Number.parseFloat(order.final_amount || order.total_amount || "0")).toFixed(2)}</td>
                    </tr>
                  `
              })
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `)
    doc.close()

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)

    toast({
      title: "Print Initiated",
      description: `Printing ${ordersToPrint.length} orders`,
    })
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      searchQuery === "" ||
      (order.order_number && order.order_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="border-gray-800 text-gray-800 hover:bg-gray-100"
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF}>
                <FilePdf className="mr-2 h-4 w-4" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={printOrders}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              <TableHead className="font-semibold">Items</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Created On</TableHead>
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
                      } else if (statusLower.includes("fail")) {
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
                        <Badge variant="outline" className={cn(badgeClass)}>
                          {formattedStatus}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(order.created_at).toLocaleDateString()}
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
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