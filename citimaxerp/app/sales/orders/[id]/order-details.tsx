"use client"
import { useState, useEffect, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Mail, MoreHorizontal, Phone, Printer, MapPin, ChevronRight, HelpCircle, Truck, FileText, Plus, Eye, Download, CreditCard, History, Edit, Wallet } from "lucide-react"
import { CreditOveragePrompt } from "@/components/credit-overage-prompt"
import { coversOverage } from "@/lib/credit-overage"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { INSTANT_PAYMENT_METHODS } from "@/lib/payment-methods"
import { PaymentModal } from "./payment-modal"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { DeliveryLocationModal } from "./delivery-location-modal"
import { toast } from "@/components/ui/use-toast"
import { getPayments, createPayment } from "@/lib/payments"
import { fetchInvoices, fetchInvoiceByOrderId, Invoice, createInvoiceFromOrder } from "@/lib/invoices"
import { fetchCustomerCreditTerms, CustomerCreditTerms } from "@/lib/customers"
import { getInvoiceStatusColor, getInvoiceStatusLabel } from "@/lib/invoice-status"
import { getLogistics, createLogistics, CreateLogisticsData, Logistics as ApiLogistics } from "@/lib/logistics"
import { fetchOrderById, OrderDetail } from "@/lib/orders"
import { DeliveryLocation as ApiDeliveryLocation } from "@/lib/delivery-locations"
import { Customer, Product } from "@/app/sales/types"
import { RecordPaymentModal } from "@/components/modals/record-payment-modal"
import { PaymentHistoryModal } from "@/components/modals/payment-history-modal"
import { MapPaymentModal } from "@/components/modals/map-payment-modal"
import { EditOrderModal } from "@/components/modals/edit-order-modal"
import { CreateDispatchModal } from "./create-dispatch-modal"
import apiCall from "@/lib/api"
import { formatPackagingForDisplay } from "@/lib/packaging-utils"

// API type definitions
interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  price_label?: string | null;
  total_price: string;
  created_at: string;
  updated_at: string;
  company_id: string;
  product: Product;
}

// Payment type to match the API format
interface Payment {
  id: string;
  order_id: string;
  payment_method: string;
  transaction_id: string | null;
  amount_paid: string;
  status: string;
  created_at: string;
  payment_date: string | null;
  customer_id: string;
  company_id: string;
}

// Update delivery location type to match API format
interface DeliveryLocation {
  id: string;
  customer_id: string;
  house_number: string;
  estate: string | null;
  city: string;
  landmark: string | null;
  is_default: boolean;
  location_note?: string | null;
  created_at: string;
  updated_at: string;
  company_id: string;
}

// Delivery person type
interface DeliveryPerson {
  id: string;
  company_id: string;
  full_name: string;
  phone_number: string;
  availability_status: string;
}

// Using the imported ApiLogistics type to avoid naming conflicts
type Logistics = ApiLogistics;

interface OrderDetailsProps {
  order: OrderDetail;
  refreshOrder?: () => void;
}

export function OrderDetails({ order, refreshOrder }: OrderDetailsProps) {
  const router = useRouter()
  
  // Format number with thousand separators
  const formatAmount = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isDeliveryLocationModalOpen, setIsDeliveryLocationModalOpen] = useState(false)
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false)
  const [isPaymentHistoryModalOpen, setIsPaymentHistoryModalOpen] = useState(false)
  const [isMapPaymentModalOpen, setIsMapPaymentModalOpen] = useState(false)
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false)
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false)
  const [invoicePaymentOption, setInvoicePaymentOption] = useState<'instant' | 'credit'>('instant')
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState<string>("")
  const [invoiceTransactionRef, setInvoiceTransactionRef] = useState("")
  const [invoiceCreditTerms, setInvoiceCreditTerms] = useState<CustomerCreditTerms | null>(null)
  const [isLoadingInvoiceCreditTerms, setIsLoadingInvoiceCreditTerms] = useState(false)
  const [invoiceDownPaymentAmount, setInvoiceDownPaymentAmount] = useState(0)
  const [invoiceDownPaymentMethod, setInvoiceDownPaymentMethod] = useState("")
  const [invoiceDownPaymentTransactionRef, setInvoiceDownPaymentTransactionRef] = useState("")
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([])
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [orderInvoice, setOrderInvoice] = useState<Invoice | null>(null)
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(true)
  const [isCreateDispatchModalOpen, setIsCreateDispatchModalOpen] = useState(false)

  // Load the customer's credit terms when the payment method dialog opens, so staff
  // can see what they're eligible for before choosing cash vs. credit.
  useEffect(() => {
    setInvoiceDownPaymentAmount(0)
    setInvoiceDownPaymentMethod("")
    setInvoiceDownPaymentTransactionRef("")
    if (!showPaymentMethodDialog || !order.customer_id) {
      return
    }
    setIsLoadingInvoiceCreditTerms(true)
    fetchCustomerCreditTerms(order.customer_id)
      .then((terms) => {
        setInvoiceCreditTerms(terms)
        setInvoicePaymentOption(terms.payment_method === 'credit' ? 'credit' : 'instant')
      })
      .catch(() => setInvoiceCreditTerms(null))
      .finally(() => setIsLoadingInvoiceCreditTerms(false))
  }, [showPaymentMethodDialog, order.customer_id])

  // Fetch delivery locations when modal opens
  useEffect(() => {
    const fetchDeliveryLocations = async () => {
      if (isDeliveryLocationModalOpen && order.customer_id) {
        setIsLoadingLocations(true)
        try {
          const data = await apiCall<{ status: string; message: string; delivery_locations: DeliveryLocation[] }>(
            `/delivery-locations/customer/${order.customer_id}`,
            "GET",
            undefined,
            true
          )
          if (data.status === "success" && Array.isArray(data.delivery_locations)) {
            setDeliveryLocations(data.delivery_locations)
          } else {
            setDeliveryLocations([])
            toast({
              title: "No locations found",
              description: data.message || "No delivery locations available for this customer.",
              variant: "destructive",
            })
          }
        } catch (error) {
          setDeliveryLocations([])
          toast({
            title: "Error",
            description: "Failed to fetch delivery locations.",
            variant: "destructive",
          })
        } finally {
          setIsLoadingLocations(false)
        }
      }
    }
    fetchDeliveryLocations()
  }, [isDeliveryLocationModalOpen, order.customer_id])

  // Fetch delivery persons on mount
  useEffect(() => {
    const fetchDeliveryPersons = async () => {
      try {
        const data = await apiCall<{ status: string; message: string; delivery_persons: DeliveryPerson[] }>(
          "/delivery-people",
          "GET",
          undefined,
          true
        )
        if (data.status === "success" && Array.isArray(data.delivery_persons)) {
          setDeliveryPersons(data.delivery_persons)
        } else {
          setDeliveryPersons([])
        }
      } catch (error) {
        setDeliveryPersons([])
      }
    }
    fetchDeliveryPersons()
  }, [])

  // Fetch invoice data for this order
  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!order.id) return;
      
      setIsLoadingInvoice(true);
      try {
        const invoice = await fetchInvoiceByOrderId(order.id);
        setOrderInvoice(invoice);
      } catch (error: any) {
        // Don't show error for 404 - just means no invoice exists yet
        if (error.response?.status !== 404) {
          toast({
            title: "Error",
            description: "Failed to fetch invoice data",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoadingInvoice(false);
      }
    };

    fetchInvoiceData();
  }, [order.id])

  // Use the payments from the order prop and invoice from state
  const payments = order.payments || []
  const invoices = orderInvoice ? [orderInvoice] : []
  const logisticsData = order.delivery_details?.[0] || null
  
  const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount_paid), 0);

  const orderTotal = parseFloat(order.final_amount || order.total_amount)
  // Already covered (or over-covered) by payments already recorded on this
  // order - nothing new needs to be collected when the invoice is created.
  const isOrderFullySettled = totalPaid >= orderTotal - 0.01
  const orderOverpayment = Math.max(0, totalPaid - orderTotal)
  const orderRemainingBalance = Math.max(0, orderTotal - totalPaid)
  // No overage check here: this order's outstanding balance is already
  // counted against the customer's available_credit (see backend
  // CustomerController::creditTerms(), which sums every un-invoiced credit
  // order's remaining balance into creditUsed) - that exposure, and any
  // down payment made to cover it, was already vetted when the order itself
  // was created. Turning that same order into an invoice doesn't add new
  // credit exposure, so re-running the overage gate here would just demand
  // the customer pay the same overage a second time.
  const invoiceCreditOverage = 0

  // Function to create invoice directly from current order
  const handleCreateInvoice = async () => {
    // Validate order has required data
    if (!order.customer_id) {
      toast({
        title: "Error",
        description: "This order is missing customer information required for invoice creation.",
        variant: "destructive",
      })
      return
    }

    if (!order.id) {
      toast({
        title: "Error",
        description: "Order ID is missing. Cannot create invoice.",
        variant: "destructive",
      })
      return
    }

    // Check if order is not completed
    if (order.status.toLowerCase() !== 'completed') {
      setShowCompletionDialog(true)
      return
    }

    // Always ask how this invoice is being paid (cash vs. credit) before creating it.
    setShowPaymentMethodDialog(true)
  }

  // Function to actually create the invoice, once cash/credit has been chosen (extracted for reuse)
  const createInvoiceFromCompletedOrder = async () => {
    // Already paid (or overpaid) via payments already on this order - nothing
    // left to collect, so skip the "how is this being paid" requirements.
    if (isOrderFullySettled) {
      await submitInvoiceCreation()
      return
    }

    if (invoicePaymentOption === 'instant' && !invoicePaymentMethod) {
      toast({
        title: "Error",
        description: "Select how the payment was received (cash, M-Pesa, bank, etc.)",
        variant: "destructive",
      })
      return
    }

    if (invoicePaymentOption === 'credit' && !invoiceCreditTerms?.credit_days) {
      toast({
        title: "Error",
        description: "This customer has no GM-approved credit terms. Get credit terms approved, or switch to instant payment.",
        variant: "destructive",
      })
      return
    }

    if (invoiceCreditOverage > 0 && (!coversOverage(invoiceDownPaymentAmount, invoiceCreditOverage) || !invoiceDownPaymentMethod)) {
      toast({
        title: "Error",
        description: `This exceeds available credit by KES ${invoiceCreditOverage.toLocaleString()}. Enter how that amount will be paid now to proceed.`,
        variant: "destructive",
      })
      return
    }

    await submitInvoiceCreation()
  }

  // Actually calls the API to create the invoice - split out so the
  // already-settled path can skip straight here past the validations above.
  const submitInvoiceCreation = async () => {
    setIsCreatingInvoice(true)
    try {
      const invoiceData = {
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_terms: 'Net 30',
        notes: order.notes || '',
        payment_option: isOrderFullySettled ? 'instant' as const : invoicePaymentOption,
        payment_method: invoicePaymentOption === 'instant' ? invoicePaymentMethod : undefined,
        transaction_id: invoicePaymentOption === 'instant' ? (invoiceTransactionRef || undefined) : undefined,
        down_payment_amount: invoicePaymentOption === 'credit' && invoiceCreditOverage > 0 ? invoiceDownPaymentAmount : undefined,
        down_payment_method: invoicePaymentOption === 'credit' && invoiceCreditOverage > 0 ? invoiceDownPaymentMethod : undefined,
        down_payment_transaction_id: invoicePaymentOption === 'credit' && invoiceCreditOverage > 0 ? (invoiceDownPaymentTransactionRef || undefined) : undefined,
      }

      console.log('Creating invoice with data:', { orderId: order.id, invoiceData })

      const newInvoice = await createInvoiceFromOrder(order.id, invoiceData)
      
      console.log('Invoice created successfully:', newInvoice)
      
      toast({
        title: "Success",
        description: `Invoice ${newInvoice.invoice_number} created successfully`,
      })
      
      // Dispatch event for automatic cache refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('invoice-created', { 
          detail: { invoiceId: newInvoice?.id, timestamp: Date.now() } 
        }))
      }
      
      // Refresh invoice data
      setOrderInvoice(newInvoice)
      setShowPaymentMethodDialog(false)
      setInvoicePaymentOption('instant')
      setInvoicePaymentMethod("")
      setInvoiceTransactionRef("")
      setInvoiceDownPaymentAmount(0)
      setInvoiceDownPaymentMethod("")
      setInvoiceDownPaymentTransactionRef("")
    } catch (error: any) {
      // Extract the API error message directly
      let errorMessage = "Failed to create invoice from order"
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }
      
      console.error('Invoice creation error:', {
        error,
        orderId: order.id,
        orderData: {
          customer_id: order.customer_id,
          order_number: order.order_number,
          total_amount: order.total_amount,
          status: order.status,
        },
        response: error.response,
      })
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsCreatingInvoice(false)
    }
  }

  // Function to handle order completion, then ask how the resulting invoice is paid
  const handleCompleteOrderAndCreateInvoice = async () => {
    setShowCompletionDialog(false)
    setIsCreatingInvoice(true)

    try {
      // Update order status to completed
      console.log('Updating order status to completed...')
      await apiCall(
        `/orders/${order.id}`,
        "PUT",
        { status: 'completed' },
        true
      )

      console.log('Order status updated successfully')

      toast({
        title: "Order Completed",
        description: "Order status updated to completed.",
      })

      // Update local order state
      order.status = 'completed'

      // Always ask how this invoice is being paid (cash vs. credit) before creating it.
      setShowPaymentMethodDialog(true)
    } catch (error: any) {
      console.error('Error completing order:', error)

      let errorMessage = "Failed to complete order"
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsCreatingInvoice(false)
    }
  }
  
  // Function to view invoice as document
  const handleViewInvoiceDocument = (invoiceId: string) => {
    router.push(`/sales/invoices/${invoiceId}/document`)
  }

  const getCurrentStatus = () => {
    return logisticsData?.delivery_status || order.status || "pending"
  }

  // Calculate total paid from payments
  // Calculate total payable amount (final_amount includes tax/discounts, fallback to total_amount)
  const totalPayable = parseFloat((order.final_amount || order.total_amount).toString());

  const paymentStatus =
    totalPaid === 0
      ? "Not Paid"
      : totalPaid < totalPayable
        ? "Partially Paid"
        : totalPaid === totalPayable
          ? "Paid"
          : "Overpayment"

  const badgeStyles = {
    "Not Paid": "bg-red-100 text-red-800",
    "Partially Paid": "bg-yellow-100 text-yellow-800",
    Paid: "bg-green-100 text-green-800",
    Overpayment: "bg-purple-100 text-purple-800",
  }

  const handleDispatchOrder = async () => {
    setIsDeliveryLocationModalOpen(true)
  }

  const handleDeliveryLocationSelected = async (locationId: string) => {
    try {
      // This logic can be simplified as the primary goal is display
      toast({
        title: "Success",
        description: "Delivery location selected successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update order status. Please try again.",
        variant: "destructive",
      });
    }
  }

  const generateTrackingNumber = () => {
    const prefix = "TRK"
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 5)
    return `${prefix}-${timestamp}-${random}`.toUpperCase()
  }

  const handleDispatchInitiated = async (locationId: string, deliveryPersonId: string, deliveryMethod: string) => {
    // For display purposes, we can simplify this
    toast({
      title: "Dispatch Initiated",
      description: "Order dispatch process has started.",
    });
    setIsDeliveryLocationModalOpen(false);
  }

  const handleInvoiceCreated = async () => {
    // Refetch invoice data to show the newly created invoice
    try {
      const invoice = await fetchInvoiceByOrderId(order.id);
      setOrderInvoice(invoice);
      
      toast({
        title: "Success",
        description: "Invoice created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Success",
        description: "Invoice created successfully. Please refresh to see the latest data.",
      });
    }
  }

  const handlePaymentRecorded = async () => {
    setIsRecordPaymentModalOpen(false);
    
    // Refetch invoice data to show updated payment status
    try {
      const invoice = await fetchInvoiceByOrderId(order.id);
      setOrderInvoice(invoice);
      
      toast({
        title: "Success",
        description: "Payment recorded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Success", 
        description: "Payment recorded successfully. Please refresh to see the latest data.",
      });
    }
  }

  const handlePaymentMapped = async () => {
    setIsMapPaymentModalOpen(false);
    
    // Refetch invoice data to show updated payment status
    try {
      const invoice = await fetchInvoiceByOrderId(order.id);
      setOrderInvoice(invoice);
      
      toast({
        title: "Success",
        description: "Payment mapped to invoice successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Success",
        description: "Payment mapped successfully. Please refresh to see the latest data.",
      });
    }
  }

  // No need for loading or error states if we rely on the prop
  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-primary">Error Loading Order</h2>
          <p className="mt-2 text-primary/80">Order data is not available.</p>
          <Button 
            variant="outline" 
            onClick={() => router.back()} 
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6">
      {/* Header Section - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" onClick={() => router.back()} size="sm" className="p-2 sm:p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold">Order #{order.order_number}</h1>
            <Badge
              variant="secondary"
              className={`text-xs sm:text-sm ${
                getCurrentStatus() === "completed"
                  ? "bg-green-100 text-green-800"
                  : getCurrentStatus() === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : getCurrentStatus() === "dispatched"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-blue-50 text-blue-700"
              }`}
            >
              {getCurrentStatus().charAt(0).toUpperCase() + getCurrentStatus().slice(1).replace("_", " ")}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Button 
            variant="outline" 
            onClick={() => setIsCreateDispatchModalOpen(true)} 
            size="sm" 
            className="text-xs sm:text-sm h-8 sm:h-9"
          >
            <Truck className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Create Dispatch
          </Button>
          {orderInvoice && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm h-8 sm:h-9"
              onClick={() => router.push(`/sales/credit-notes/new?invoice_id=${orderInvoice.id}`)}
            >
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Create Credit Note
            </Button>
          )}
          {/* Always-available order document, regardless of invoice status. */}
          <Button
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm h-8 sm:h-9"
            onClick={() => router.push(`/sales/orders/${order.id}/document`)}
          >
            <Printer className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Print
          </Button>
          {order.status?.toLowerCase() !== "completed" && (
            <Button 
              variant="outline" 
              onClick={() => setIsEditOrderModalOpen(true)} 
              size="sm" 
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Edit
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs sm:text-sm">Cancel Order</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content - Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Takes full width on mobile, 2/3 on desktop */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Order Summary Card */}
          <Card className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row justify-between gap-2 text-xs sm:text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Ordered</div>
                  <div>{order.order_items?.length || 0} Product(s)</div>
                </div>
                <div className="sm:text-right">
                  <div className="text-muted-foreground mb-1">Order created</div>
                  <div>{new Date(order.created_at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Customer Card */}
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 bg-purple-100">
                  <AvatarFallback className="text-purple-500 text-xs sm:text-sm">
                    {((order.customer as any)?.business_name || order.customer?.name || "U").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-sm sm:text-base">
                    {(order.customer as any)?.business_name || order.customer?.name || "Unknown Customer"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-9">
                  <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Email
                </Button>
                <Button variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-9">
                  <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  {order.customer?.phone || "No phone"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Delivery Progress Card */}
          {/* <Card className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              <h2 className="font-semibold text-sm sm:text-base">DELIVERY PROGRESS</h2>
              <div className="w-full bg-gray-200 h-1.5 sm:h-2 rounded-full">
                <div
                  className="bg-black h-full rounded-full"
                  style={{
                    width:
                      getCurrentStatus() === "completed" ? "100%" : getCurrentStatus() === "dispatched" ? "66%" : "33%",
                  }}
                ></div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2 text-xs sm:text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Delivery Status:</div>
                  <div className="font-semibold text-sm sm:text-base">
                    {getCurrentStatus().charAt(0).toUpperCase() + getCurrentStatus().slice(1).replace("_", " ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  <span className="text-xs sm:text-sm">
                    {logisticsData?.delivery_address || (order.delivery_location ? `${order.delivery_location.street}, ${order.delivery_location.city}` : "Address not set")}
                  </span>
                </div>
              </div>
              {logisticsData?.tracking_number && (
                <div className="text-xs sm:text-sm">
                  <span className="text-muted-foreground">Tracking: </span>
                  <span className="font-medium">{logisticsData.tracking_number}</span>
                </div>
              )}
            </div>
          </Card> */}

          {/* Order Items Table */}
          <Card className="p-4 sm:p-6 overflow-x-auto">
            <div className="space-y-4 sm:space-y-6">
              <div className="min-w-[500px] sm:min-w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      {/* Only show Variant column if any item has a variant */}
                      {order.order_items?.some(item => item.variant || item.variant_id) && (
                        <TableHead>Variant</TableHead>
                      )}
                      <TableHead>Quantity</TableHead>
                      {/* Only show Packaging column if any item has packaging details */}
                      {order.order_items?.some(item => 
                        (item as any).packaging_breakdown?.display_text || 
                        (item.product?.has_packaging && item.quantity > 0)
                      ) && (
                        <TableHead>Packaging</TableHead>
                      )}
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.order_items?.map(item => {
                      // Determine quantity display
                      const displayQty = item.packagingUnit 
                        ? `${item.unit_quantity || item.quantity} ${item.packagingUnit.unit_abbreviation}`
                        : `${item.quantity} PCS`;
                      
                      // Get breakdown text from API (priority) or calculate as fallback
                      let breakdown = '';
                      
                      // First, try to get display_text from the API's packaging_breakdown
                      if ((item as any).packaging_breakdown?.display_text) {
                        breakdown = (item as any).packaging_breakdown.display_text;
                      } 
                      // Fallback: calculate if product has packaging units
                      else if (item.product?.has_packaging && item.quantity > 0) {
                        // Try sellable_packaging_units (snake_case from API) or sellablePackagingUnits (camelCase)
                        const packagingUnits = (item.product as any)?.sellable_packaging_units || (item.product as any)?.sellablePackagingUnits || (item.product as any)?.packaging_units;
                        
                        if (packagingUnits) {
                          // Parse if it's a JSON string
                          let parsedUnits = packagingUnits;
                          if (typeof packagingUnits === 'string') {
                            try {
                              parsedUnits = JSON.parse(packagingUnits);
                            } catch (e) {
                              parsedUnits = [];
                            }
                          }
                          
                          if (Array.isArray(parsedUnits) && parsedUnits.length > 0) {
                            const packagingDisplay = formatPackagingForDisplay(item.quantity, parsedUnits);
                            breakdown = packagingDisplay.shortText;
                          }
                        }
                      }
                      
                      // Get total pieces (base quantity)
                      const totalPieces = item.base_quantity || item.quantity;
                      
                      // Check if we should show variant and packaging columns
                      const hasAnyVariant = order.order_items?.some(item => item.variant || item.variant_id);
                      const hasAnyPackaging = order.order_items?.some(item => 
                        (item as any).packaging_breakdown?.display_text || 
                        (item.product?.has_packaging && item.quantity > 0)
                      );

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.product?.name || 'Unknown Product'}
                            {item.batch_allocations && item.batch_allocations.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {item.batch_allocations.map((a, i) => (
                                  <div key={a.batch_id}>
                                    {item.batch_allocations!.length > 1 ? `${a.quantity} from ` : ''}
                                    Batch {a.batch_number}
                                    {a.expiry_date && ` · Exp ${new Date(a.expiry_date).toLocaleDateString()}`}
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          {/* Only show Variant cell if any item has variants */}
                          {hasAnyVariant && (
                            <TableCell>
                              {item.variant?.name || ""}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{displayQty}</div>
                              {item.packagingUnit && (
                                <div className="text-xs text-muted-foreground">
                                  ({totalPieces} {item.product?.base_unit || 'pcs'} total)
                                </div>
                              )}
                            </div>
                          </TableCell>
                          {/* Only show Packaging cell if any item has packaging */}
                          {hasAnyPackaging && (
                            <TableCell>
                              {breakdown ? (
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">{breakdown}</div>
                                  <div className="text-xs text-muted-foreground">For fulfillment</div>
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">-</div>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="space-y-1">
                              <div>KES {formatAmount(item.unit_price)}</div>
                              {item.packagingUnit && (
                                <div className="text-xs text-muted-foreground">per {item.packagingUnit.unit_abbreviation}</div>
                              )}
                              {/* Which named price tier this was - staff-only
                                  reference, never shown on a printed order. */}
                              {item.price_label && (
                                <div className="text-xs text-muted-foreground italic">{item.price_label}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">KES {formatAmount(item.total_price)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 text-xs sm:text-sm border-t pt-3 sm:pt-4">
                <div className="grid grid-cols-3 items-center">
                  <span className="col-start-2 text-right pr-2 sm:pr-4 text-muted-foreground">Subtotal</span>
                  <span className="text-right font-medium">KES {formatAmount(order.total_amount)}</span>
                </div>
                {/* Only show tax if it exists and is greater than 0 */}
                {order.tax && parseFloat(order.tax) > 0 && (
                  <div className="grid grid-cols-3 items-center">
                    <span className="col-start-2 text-right pr-2 sm:pr-4 text-muted-foreground">Tax</span>
                    <span className="text-right font-medium">KES {formatAmount(order.tax)}</span>
                  </div>
                )}
                {/* Only show discount if it exists and is greater than 0 */}
                {order.discount && parseFloat(order.discount) > 0 && (
                  <div className="grid grid-cols-3 items-center">
                    <span className="col-start-2 text-right pr-2 sm:pr-4 text-red-600">Discount</span>
                    <span className="text-right text-red-600">-KES {formatAmount(order.discount)}</span>
                  </div>
                )}
                {/* Final Amount */}
                <div className="grid grid-cols-3 items-center pt-2 border-t">
                  <span className="col-start-2 text-right pr-2 sm:pr-4 font-semibold">Total Amount</span>
                  <span className="text-right font-bold text-base sm:text-lg">KES {formatAmount(order.final_amount || order.total_amount)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Payments/Invoices - Full width on mobile, 1/3 on desktop */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6">
            <Tabs defaultValue="payments">
              <TabsList className="w-full">
                <TabsTrigger value="payments" className="flex-1 text-xs sm:text-sm">
                  Payments
                </TabsTrigger>
                <TabsTrigger value="invoices" className="flex-1 text-xs sm:text-sm">
                  Invoices
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex-1 text-xs sm:text-sm">
                  Notes
                </TabsTrigger>
              </TabsList>
              <TabsContent value="payments" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                <div>
                  <div className="text-xs sm:text-sm text-muted-foreground mb-1">STATUS:</div>
                  <Badge variant="secondary" className={`text-xs sm:text-sm ${badgeStyles[paymentStatus]}`}>
                    {paymentStatus}
                  </Badge>
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Total Paid:</span>
                    <span className="font-medium">KES {formatAmount(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Balance:</span>
                    <span className="font-medium">KES {formatAmount(parseFloat((order.final_amount || order.total_amount).toString()) - totalPaid)}</span>
                  </div>
                </div>
                {payments && payments.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-xs">Payment #{payment.id.substring(0, 7)}</div>
                          <div className="text-xs text-muted-foreground">{payment.payment_method}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-xs">KES {formatAmount(payment.amount_paid)}</div>
                          <div className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-muted-foreground">No payments recorded yet</div>
                )}
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                  <Button
                    className="w-full bg-black hover:bg-gray-800 text-white text-xs sm:text-sm h-8 sm:h-9"
                    onClick={() => setIsPaymentModalOpen(true)}
                  >
                    Receipt Payment
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="invoices" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs sm:text-sm font-medium">Invoices</div>
                  {!isLoadingInvoice && !orderInvoice && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateInvoice}
                      disabled={isCreatingInvoice}
                      className="text-xs h-8"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                    </Button>
                  )}
                </div>
                
                {isLoadingInvoice ? (
                  <div className="text-center py-6">
                    <div className="text-sm text-muted-foreground">Loading invoice information...</div>
                  </div>
                ) : orderInvoice ? (
                  <div className="space-y-3">
                    <div className="border rounded-lg p-3 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="font-medium text-sm">
                            Invoice #{orderInvoice.invoice_number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Issued: {new Date(orderInvoice.invoice_date).toLocaleDateString()}
                          </div>
                          {orderInvoice.due_date && (
                            <div className="text-xs text-muted-foreground">
                              Due: {new Date(orderInvoice.due_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          <div className="font-medium text-sm">
                            KES {parseFloat(orderInvoice.total_amount.toString()).toFixed(2)}
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${getInvoiceStatusColor(orderInvoice.status)}`}
                          >
                            {getInvoiceStatusLabel(orderInvoice.status)}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Invoice Line Items */}
                      {orderInvoice.line_items && orderInvoice.line_items.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="text-xs font-medium text-muted-foreground">Line Items</div>
                          <div className="space-y-2">
                            {orderInvoice.line_items.map((item, index) => (
                              <div key={item.id || index} className="flex justify-between items-start p-2 bg-gray-50 rounded text-xs">
                                <div className="flex-1">
                                  <div className="font-medium">{item.description}</div>
                                  <div className="text-muted-foreground">
                                    {item.quantity} {item.unit} × KES {parseFloat(item.unit_price.toString()).toFixed(2)}
                                  </div>
                                  {item.variant_id && (
                                    <div className="text-muted-foreground text-xs">
                                      Variant ID: {item.variant_id}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">
                                    KES {(parseFloat(item.quantity.toString()) * parseFloat(item.unit_price.toString())).toFixed(2)}
                                  </div>
                                  {parseFloat(item.discount_amount.toString()) > 0 && (
                                    <div className="text-green-600 text-xs">
                                      -KES {parseFloat(item.discount_amount.toString()).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Invoice summary */}
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>KES {parseFloat(orderInvoice.subtotal.toString()).toFixed(2)}</span>
                        </div>
                        {parseFloat(orderInvoice.tax_amount.toString()) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Tax</span>
                            <span>KES {parseFloat(orderInvoice.tax_amount.toString()).toFixed(2)}</span>
                          </div>
                        )}
                        {parseFloat(orderInvoice.discount_amount.toString()) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Discount</span>
                            <span className="text-green-600">-KES {parseFloat(orderInvoice.discount_amount.toString()).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs font-medium pt-1 border-t">
                          <span>Total</span>
                          <span>KES {parseFloat(orderInvoice.total_amount.toString()).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Amount Paid</span>
                          <span className="text-green-600">KES {parseFloat(orderInvoice.amount_paid.toString()).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Balance</span>
                          <span className={parseFloat(orderInvoice.balance_amount.toString()) > 0 ? "text-red-600" : "text-green-600"}>
                            KES {parseFloat(orderInvoice.balance_amount.toString()).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      {orderInvoice.notes && (
                        <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                          <strong>Notes:</strong> {orderInvoice.notes}
                        </div>
                      )}

                      {orderInvoice.payment_terms && (
                        <div className="text-xs text-muted-foreground">
                          <strong>Payment Terms:</strong> {orderInvoice.payment_terms}
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2 border-t">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-7 w-full"
                          onClick={() => handleViewInvoiceDocument(orderInvoice.id)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Invoice
                        </Button>
                      </div>
                      
                      {/* Payment Management Actions */}
                      {parseFloat(orderInvoice.balance_amount.toString()) > 0 && (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-7 flex-1"
                            onClick={() => setIsRecordPaymentModalOpen(true)}
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Record Payment
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-7 flex-1"
                            onClick={() => setIsMapPaymentModalOpen(true)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Map Payment
                          </Button>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-7 w-full"
                          onClick={() => setIsPaymentHistoryModalOpen(true)}
                        >
                          <History className="h-3 w-3 mr-1" />
                          Payment History
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">No invoice created yet</div>
                    <div className="text-xs text-muted-foreground">
                      Create an invoice to bill this order
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="notes">
                <div className="text-xs sm:text-sm text-muted-foreground">{order.notes || "No notes yet"}</div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <Sheet open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <SheetContent side="right" className="sm:max-w-[600px] w-full p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Receipt Payment</SheetTitle>
            <SheetDescription>Enter payment details for Order #{order.order_number}</SheetDescription>
          </SheetHeader>
          <PaymentModal 
            orderId={order.id} 
            orderNumber={order.order_number}
            orderTotal={parseFloat((order.final_amount || order.total_amount).toString())}
            customerId={order.customer_id}
            onClose={() => setIsPaymentModalOpen(false)} 
            onSuccess={() => {
              if (refreshOrder) refreshOrder();
            }}
          />{" "}
        </SheetContent>
      </Sheet>

      <DeliveryLocationModal
        isOpen={isDeliveryLocationModalOpen}
        onClose={() => setIsDeliveryLocationModalOpen(false)}
        deliveryLocations={deliveryLocations.map(loc => ({
          ...loc,
          estate: loc.estate === undefined ? null : loc.estate,
          landmark: loc.landmark === undefined ? null : loc.landmark,
        }))}
        customerId={order.customer_id}
        onLocationSelected={handleDeliveryLocationSelected}
        onLocationAdded={async (newLocation) => {
          setDeliveryLocations((prev) => [
            ...prev,
            {
              ...newLocation,
              estate: newLocation.estate === undefined ? null : newLocation.estate,
              landmark: newLocation.landmark === undefined ? null : newLocation.landmark,
            } as DeliveryLocation
          ])
        }}
        onLocationUpdated={async (updatedLocation) => {
          try {
            const data = await apiCall<{ status: string; message: string; delivery_location: DeliveryLocation }>(
              `/delivery-locations/${updatedLocation.id}`,
              "POST",
              updatedLocation,
              true
            )
            if (data.status === "success" && data.delivery_location) {
              setDeliveryLocations((prev) => prev.map(loc => loc.id === data.delivery_location.id ? data.delivery_location : loc))
              toast({
                title: "Location updated",
                description: data.message || "Delivery location updated successfully.",
                variant: "default",
              })
            } else {
              toast({
                title: "Update failed",
                description: data.message || "Could not update delivery location.",
                variant: "destructive",
              })
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to update delivery location.",
              variant: "destructive",
            })
          }
        }}
        onDispatchInitiated={handleDispatchInitiated}
        companyId={order.company_id || ""}
      />

      {/* Payment Management Modals */}
      {orderInvoice && (
        <>
          <RecordPaymentModal
            isOpen={isRecordPaymentModalOpen}
            onClose={() => setIsRecordPaymentModalOpen(false)}
            invoiceId={orderInvoice.id}
            invoiceNumber={orderInvoice.invoice_number}
            totalAmount={parseFloat(orderInvoice.total_amount.toString())}
            balanceAmount={parseFloat(orderInvoice.balance_amount.toString())}
            onPaymentRecorded={handlePaymentRecorded}
          />

          <PaymentHistoryModal
            isOpen={isPaymentHistoryModalOpen}
            onClose={() => setIsPaymentHistoryModalOpen(false)}
            invoiceId={orderInvoice.id}
            invoiceNumber={orderInvoice.invoice_number}
          />

          <MapPaymentModal
            isOpen={isMapPaymentModalOpen}
            onClose={() => setIsMapPaymentModalOpen(false)}
            invoiceId={orderInvoice.id}
            invoiceNumber={orderInvoice.invoice_number}
            balanceAmount={parseFloat(orderInvoice.balance_amount.toString())}
            customerId={order.customer_id}
            onPaymentMapped={handlePaymentMapped}
          />
        </>
      )}

      {/* Order Completion Confirmation Dialog */}
      <AlertDialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Order Before Creating Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This order has a status of &quot;{order.status}&quot;. To create an invoice, the order must be marked as completed. 
              <br /><br />
              Would you like to mark this order as completed and proceed with invoice creation?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteOrderAndCreateInvoice}>
              Complete Order & Create Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Method Dialog - required before an invoice can be created from an order */}
      <Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isOrderFullySettled ? "This order is already settled" : "How is this being paid?"}</DialogTitle>
          </DialogHeader>
          {isOrderFullySettled ? (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
              <p>
                KES {totalPaid.toFixed(2)} is already recorded against this order's total of KES {orderTotal.toFixed(2)}.
              </p>
              {orderOverpayment > 0 && (
                <p className="mt-2">
                  That's an overpayment of <strong>KES {orderOverpayment.toFixed(2)}</strong>. It won't be
                  collected again — the invoice will carry it as a credit balance, visible on the invoice
                  and available to map to a refund or a future invoice.
                </p>
              )}
            </div>
          ) : (
          <div className="space-y-3">
            {orderRemainingBalance > 0 && orderRemainingBalance < orderTotal && (
              <p className="text-xs text-muted-foreground">
                KES {totalPaid.toFixed(2)} of KES {orderTotal.toFixed(2)} is already recorded on this order -
                only the remaining KES {orderRemainingBalance.toFixed(2)} needs to be collected now.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInvoicePaymentOption('instant')}
                className={`flex items-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors ${
                  invoicePaymentOption === 'instant'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Wallet className="h-4 w-4" />
                Instant Payment
              </button>
              <button
                type="button"
                onClick={() => setInvoicePaymentOption('credit')}
                className={`flex items-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors ${
                  invoicePaymentOption === 'credit'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                Credit
              </button>
            </div>

            {invoicePaymentOption === 'instant' ? (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="order-invoice-payment-method">Payment Method *</Label>
                  <Select value={invoicePaymentMethod} onValueChange={setInvoicePaymentMethod}>
                    <SelectTrigger id="order-invoice-payment-method">
                      <SelectValue placeholder="How was it paid?" />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTANT_PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-invoice-transaction-ref">Reference (optional)</Label>
                  <Input
                    id="order-invoice-transaction-ref"
                    value={invoiceTransactionRef}
                    onChange={(e) => setInvoiceTransactionRef(e.target.value)}
                    placeholder="M-Pesa code, bank ref, etc."
                  />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  The invoice will be created and marked paid immediately. Paying by cheque?
                  Create it on credit instead, then record the cheque from the invoice — it stays pending until it clears.
                </p>
              </div>
            ) : (
              <div className="pt-1">
                {isLoadingInvoiceCreditTerms ? (
                  <p className="text-sm text-muted-foreground">Loading customer's credit terms...</p>
                ) : invoiceCreditTerms?.credit_days ? (
                  <div className="rounded-md bg-purple-50 border border-purple-200 p-3 text-sm">
                    <p className="font-medium text-purple-900">
                      Approved terms: Net {invoiceCreditTerms.credit_days} ({invoiceCreditTerms.credit_days} days)
                    </p>
                    {invoiceCreditTerms.available_credit != null && (
                      <p className="text-purple-700">Available credit: KES {Number(invoiceCreditTerms.available_credit).toLocaleString()}</p>
                    )}
                    {invoiceCreditTerms.has_pending_change && (
                      <p className="text-amber-700 mt-1">Note: a terms change is pending GM approval and not yet in effect.</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                    No GM-approved credit terms on file for this customer. Get credit terms approved, or
                    switch to instant payment, before this invoice can be created.
                  </div>
                )}

                {invoiceCreditOverage > 0 && (
                  <div className="mt-3">
                    <CreditOveragePrompt
                      overage={invoiceCreditOverage}
                      downPaymentAmount={invoiceDownPaymentAmount}
                      onDownPaymentAmountChange={setInvoiceDownPaymentAmount}
                      downPaymentMethod={invoiceDownPaymentMethod}
                      onDownPaymentMethodChange={setInvoiceDownPaymentMethod}
                      downPaymentTransactionRef={invoiceDownPaymentTransactionRef}
                      onDownPaymentTransactionRefChange={setInvoiceDownPaymentTransactionRef}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentMethodDialog(false)} disabled={isCreatingInvoice}>
              Cancel
            </Button>
            <Button
              onClick={createInvoiceFromCompletedOrder}
              disabled={
                isCreatingInvoice ||
                (!isOrderFullySettled && invoicePaymentOption === 'credit' && !invoiceCreditTerms?.credit_days) ||
                (!isOrderFullySettled && invoiceCreditOverage > 0 && (!coversOverage(invoiceDownPaymentAmount, invoiceCreditOverage) || !invoiceDownPaymentMethod))
              }
            >
              {isCreatingInvoice ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dispatch Modal */}
      <CreateDispatchModal
        open={isCreateDispatchModalOpen}
        onOpenChange={setIsCreateDispatchModalOpen}
        order={order}
        onSuccess={() => {
          // Optionally refresh order data or navigate to dispatch page
          toast({
            title: "Success",
            description: "Dispatch created successfully. You can now submit it for approval.",
          })
        }}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        order={order}
        open={isEditOrderModalOpen}
        onOpenChange={setIsEditOrderModalOpen}
        onOrderUpdated={() => {
          setIsEditOrderModalOpen(false)
          toast({
            title: "Success",
            description: "Order updated successfully.",
          })
          // Force a hard refresh to get updated order data
          window.location.reload()
        }}
      />
    </div>
  )
}
