"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight, Filter } from "lucide-react"
// Removed apiCall import as data is now passed via props

// Define the Order type based on your API response
interface Order {
  id: string
  order_number: string
  tracking_number: string | null
  created_at: string
  total_amount: string // API returns string for decimal
  final_amount: string | null // API returns string for decimal
  status: "pending" | "processing" | "completed" | "cancelled" | "dispatch_initiated" // Added dispatch_initiated
  // Assuming order_items count is available or can be derived
  order_items: Array<{ count: number }> // Assuming this structure for item count
  // Add other fields as needed from your actual API response
}

interface CustomerOrdersProps {
  customerId: string
  initialOrders: Order[] // Orders are now passed as a prop
}

export function CustomerOrders({ customerId, initialOrders }: CustomerOrdersProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders) // Initialize with prop
  const [filteredOrders, setFilteredOrders] = useState<Order[]>(initialOrders) // Initialize with prop
  const [isLoading, setIsLoading] = useState(false) // No longer loading internally
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const router = useRouter()

  // Update orders when initialOrders prop changes (e.g., when customer profile re-fetches)
  useEffect(() => {
    setOrders(initialOrders)
    setFilteredOrders(initialOrders)
    setCurrentPage(1) // Reset pagination when data changes
  }, [initialOrders])

  useEffect(() => {
    // Apply filters and search whenever orders, searchQuery, or statusFilter changes
    let result = [...orders]

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((order) => order.status === statusFilter)
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (order) =>
          order.order_number?.toLowerCase().includes(query) || order.tracking_number?.toLowerCase().includes(query),
      )
    }

    setFilteredOrders(result)
    setCurrentPage(1) // Reset to first page when filters change
  }, [orders, searchQuery, statusFilter])

  const handleOrderClick = (orderId: string) => {
    router.push(`/sales/orders/${orderId}`)
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredOrders.slice(indexOfFirstItem, indexOfLastItem)

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value))
    setCurrentPage(1) // Reset to first page when items per page changes
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search orders..."
              className="w-full pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="dispatch_initiated">Dispatch Initiated</SelectItem> {/* Added new status */}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="py-4 text-center text-red-500">{error}</div>
        ) : filteredOrders.length === 0 ? (
          <p className="py-4 text-center text-gray-500">No orders found for this customer.</p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Tracking Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Item Amount</TableHead>
                    <TableHead>Final Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleOrderClick(order.id)}
                    >
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.tracking_number || "N/A"}</TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {order.order_items && order.order_items.length > 0 ? order.order_items[0].count : 0}
                      </TableCell>
                      <TableCell>
                        KES{" "}
                        {Number.parseFloat(order.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        KES{" "}
                        {Number.parseFloat(order.final_amount || "0").toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            order.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : order.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : order.status === "processing"
                                  ? "bg-blue-100 text-blue-800"
                                  : order.status === "dispatch_initiated" // Added new status color
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-red-100 text-red-800"
                          }
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination controls */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">
                  Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredOrders.length)} of{" "}
                  {filteredOrders.length} orders
                </p>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-500">per page</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    // Show first page, last page, current page, and pages around current
                    let pageToShow: number | null = null

                    if (totalPages <= 5) {
                      // If 5 or fewer pages, show all
                      pageToShow = i + 1
                    } else if (currentPage <= 3) {
                      // Near start
                      if (i < 4) {
                        pageToShow = i + 1
                      } else {
                        pageToShow = totalPages
                      }
                    } else {
                      // Middle
                      if (i === 0) {
                        pageToShow = 1
                      } else if (i === 4) {
                        pageToShow = totalPages
                      } else {
                        pageToShow = currentPage - 1 + i
                      }
                    }

                    // Show ellipsis instead of page number
                    if ((i === 1 && pageToShow !== 2) || (i === 3 && pageToShow !== totalPages - 1)) {
                      return (
                        <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-sm">
                          ...
                        </span>
                      )
                    }

                    return (
                      <Button
                        key={pageToShow}
                        variant={currentPage === pageToShow ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePageChange(pageToShow!)}
                      >
                        {pageToShow}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
