"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Eye, Receipt, Calendar, User, CreditCard, Loader2 } from "lucide-react"
import { getCustomerDisplayName } from "@/lib/customers"
import { ReceiptPrinter } from "./receipt-printer"
import { PaymentModal } from "./payment-modal"
import { fetchOrders, Order, fetchOrderById } from "@/lib/orders"
import { usePermissions } from "@/hooks/use-permissions"

export function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<any>(null)
  const { hasPermission } = usePermissions()

  // Check if user has permission to view the company's full order list. Sales
  // reps generally don't (that's staff-only Sales-section access), but they
  // still need to see their OWN past orders here - the "mine" fetch below
  // covers that without needing can_view_orders at all.
  const canViewOrders = hasPermission("can_view_orders")

  useEffect(() => {
    setIsLoading(true)
    fetchOrders(canViewOrders ? {} : { mine: true }).then((data) => {
      setOrders(data)
      setFilteredOrders(data)
      setIsLoading(false)
    })
  }, [canViewOrders])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    filterOrders(term, statusFilter)
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    filterOrders(searchTerm, status)
  }

  const filterOrders = (term: string, status: string) => {
    let filtered = orders

    if (term) {
      filtered = filtered.filter(
        (order) =>
          order.id.toLowerCase().includes(term.toLowerCase()) ||
          order.customer?.name?.toLowerCase().includes(term.toLowerCase()) ||
          order.customer?.email?.toLowerCase().includes(term.toLowerCase()),
      )
    }

    if (status !== "all") {
      filtered = filtered.filter((order) => order.status === status)
    }

    setFilteredOrders(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default"
      case "pending":
        return "secondary"
      case "refunded":
        return "destructive"
      default:
        return "default"
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "cash":
        return "💵"
      case "card":
        return "💳"
      case "mpesa":
        return "📱"
      default:
        return "💳"
    }
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const viewOrderDetails = (order: Order) => {
    setSelectedOrder(order)
    setShowOrderModal(true)
  }

  // Handler to open payment modal for existing order
  const handlePayOrder = async (orderId: string) => {
    // Check if user has permission to create payments
    if (!hasPermission("can_create_payment")) {
      // Handle permission denied
      return
    }
    
    // Fetch full order details (for items, totals, etc.)
    const orderDetail = await fetchOrderById(orderId)
    if (!orderDetail) return // Add null check
    // Calculate total paid so far
    const totalPaid = (orderDetail.payments || [])
      .filter((p: any) => p.status === 'completed' || p.status === 'paid')
      .reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0)
    // Calculate remaining balance
    const balance = Number(orderDetail.final_amount) - totalPaid
    setPaymentOrder({ ...orderDetail, totalPaid, balance })
    setShowPaymentModal(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search orders by ID, customer name, or email..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <Card key={order.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{order.order_number || order.id}</h3>
                  <Badge variant={getStatusColor(order.status) as any}>{order.status}</Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {order.customer ? getCustomerDisplayName(order.customer) : "Unknown"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(order.created_at)}
                  </div>
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-4 w-4" />
                    {/* Payment method not available in Order, so just show payment status */}
                    {order.payment_status}
                  </div>
                </div>

                <div className="text-sm">
                  <span className="text-gray-600">
                    {/* Items count not available in Order, so skip or show placeholder */}
                    {/* {order.items.length} item{order.items.length > 1 ? "s" : ""} • */}
                  </span>
                  {/* Use final_amount for display */}
                  <span className="font-semibold ml-1">Ksh. {Number(order.final_amount).toFixed(2)}</span>
                </div>
              </div>
              <div>
                <Button variant="outline" size="icon" onClick={() => viewOrderDetails(order)}>
                  <Eye className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedOrder.order_number || selectedOrder.id}</h3>
                  <Badge variant={getStatusColor(selectedOrder.status) as any}>{selectedOrder.status}</Badge>
                </div>
                <p className="text-sm text-gray-600">{formatDate(selectedOrder.created_at)}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Customer</h4>
                <p>{selectedOrder.customer ? getCustomerDisplayName(selectedOrder.customer) : "Unknown"}</p>
                {selectedOrder.customer?.email && (
                  <p className="text-sm text-gray-600">{selectedOrder.customer.email}</p>
                )}
              </div>

              {/* Show payment button if payment is not complete */}
              {(selectedOrder.payment_status !== "paid" && selectedOrder.status !== "completed") && (
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  onClick={() => handlePayOrder(selectedOrder.id)}
                  disabled={!hasPermission("can_create_payment")}
                >
                  Complete Payment
                </Button>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowOrderModal(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment Modal for existing order */}
      {showPaymentModal && paymentOrder && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          cartItems={[]}
          customer={paymentOrder.customer}
          onPaymentComplete={() => { setShowPaymentModal(false); setShowOrderModal(false); }}
          subtotal={paymentOrder.balance}
          tax={0}
          taxEnabled={false}
          taxRate={0}
          total={paymentOrder.balance}
          existingOrderId={paymentOrder.id}
          orderBreakdown={{
            total: Number(paymentOrder.final_amount),
            paid: paymentOrder.totalPaid,
            balance: paymentOrder.balance,
          }}
        />
      )}
    </div>
  )
}