"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createInvoiceFromOrder, CreateInvoiceFromOrderRequest, fetchSalesReps, SalesRep } from "@/lib/invoices"
import { fetchOrders, fetchOrderById, Order, OrderDetail } from "@/lib/orders"
import { fetchCustomerCreditTerms, CustomerCreditTerms, getCustomerDisplayName } from "@/lib/customers"
import { INSTANT_PAYMENT_METHODS } from "@/lib/payment-methods"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Wallet, CreditCard as CreditCardIcon } from "lucide-react"
import { CreditOveragePrompt } from "@/components/credit-overage-prompt"
import { coversOverage } from "@/lib/credit-overage"

const invoiceFromOrderSchema = z.object({
  order_id: z.string().min(1, "Order is required"),
  invoice_date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
})

type InvoiceFromOrderFormData = z.infer<typeof invoiceFromOrderSchema>

interface CreateInvoiceFromOrderModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateInvoiceFromOrderModal({ open, onClose, onSuccess }: CreateInvoiceFromOrderModalProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [salesRepId, setSalesRepId] = useState<string>("")
  const [paymentOption, setPaymentOption] = useState<'instant' | 'credit'>('instant')
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [transactionRef, setTransactionRef] = useState("")
  const [creditTerms, setCreditTerms] = useState<CustomerCreditTerms | null>(null)
  const [isLoadingCreditTerms, setIsLoadingCreditTerms] = useState(false)
  const [downPaymentAmount, setDownPaymentAmount] = useState(0)
  const [downPaymentMethod, setDownPaymentMethod] = useState("")
  const [downPaymentTransactionRef, setDownPaymentTransactionRef] = useState("")
  const { toast } = useToast()

  const form = useForm<InvoiceFromOrderFormData>({
    resolver: zodResolver(invoiceFromOrderSchema),
    defaultValues: {
      order_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '', // left blank = auto-calculated from the customer's credit terms
      payment_terms: '',
      notes: '',
    }
  })

  // Load orders when modal opens
  useEffect(() => {
    if (open) {
      loadOrders()
      fetchSalesReps().then(setSalesReps).catch(() => setSalesReps([]))
      // Reset form when modal opens
      form.reset({
        order_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        payment_terms: '',
        notes: '',
      })
      setSelectedOrder(null)
      setSalesRepId("")
      setPaymentOption('instant')
      setPaymentMethod("")
      setTransactionRef("")
      setCreditTerms(null)
      setDownPaymentAmount(0)
      setDownPaymentMethod("")
      setDownPaymentTransactionRef("")
    }
  }, [open, form])

  const loadOrders = async () => {
    try {
      const ordersData = await fetchOrders()
      
      // Filter orders that can be invoiced (completed/confirmed orders that haven't been invoiced yet)
      const availableOrders = ordersData.filter((order: Order) => {
        const isValidStatus = order.status.toLowerCase() === 'completed' || 
                             order.status.toLowerCase() === 'confirmed'
        const hasCustomer = order.customer_id && order.customer
        const hasValidAmount = order.final_amount || order.total_amount
        
        return isValidStatus && hasCustomer && hasValidAmount
      })
      
      setOrders(availableOrders)
      
      if (availableOrders.length === 0) {
        toast({
          title: "No Available Orders",
          description: "No completed or confirmed orders are available for invoicing.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      })
    }
  }

  // Watch for order selection changes
  const watchedOrderId = form.watch('order_id')
  useEffect(() => {
    if (watchedOrderId) {
      const order = orders.find(o => o.id === watchedOrderId)
      setSelectedOrder(order || null)
    } else {
      setSelectedOrder(null)
    }
  }, [watchedOrderId, orders])

  // Load the order's customer's credit terms so staff can see what's already on file
  useEffect(() => {
    const customerId = selectedOrder?.customer_id
    setDownPaymentAmount(0)
    setDownPaymentMethod("")
    setDownPaymentTransactionRef("")
    if (!customerId) {
      setCreditTerms(null)
      return
    }
    setIsLoadingCreditTerms(true)
    fetchCustomerCreditTerms(customerId)
      .then((terms) => {
        setCreditTerms(terms)
        setPaymentOption(terms.payment_method === 'credit' ? 'credit' : 'instant')
      })
      .catch(() => setCreditTerms(null))
      .finally(() => setIsLoadingCreditTerms(false))
  }, [selectedOrder?.customer_id])

  const orderTotal = selectedOrder ? parseFloat(selectedOrder.final_amount || selectedOrder.total_amount) : 0
  // No overage check here: this order's outstanding balance is already
  // counted against the customer's available_credit (see backend
  // CustomerController::creditTerms(), which sums every un-invoiced credit
  // order's remaining balance into creditUsed) - that exposure, and any
  // down payment made to cover it, was already vetted when the order itself
  // was created. Turning that same order into an invoice doesn't add new
  // credit exposure, so re-running the overage gate here would just demand
  // the customer pay the same overage a second time.
  const creditOverage = 0

  const onSubmit: SubmitHandler<InvoiceFromOrderFormData> = async (data) => {
    // Prevent submission if no valid order is selected
    if (!data.order_id || data.order_id === 'no-orders') {
      toast({
        title: "Error",
        description: "Please select a valid order to create an invoice",
        variant: "destructive",
      })
      return
    }

    // Validate that the selected order exists and has required data
    const selectedOrderData = orders.find(o => o.id === data.order_id)
    if (!selectedOrderData) {
      toast({
        title: "Error",
        description: "Selected order not found. Please refresh and try again.",
        variant: "destructive",
      })
      return
    }

    // Check if order has customer information
    if (!selectedOrderData.customer_id && !selectedOrderData.customer) {
      toast({
        title: "Error",
        description: "Selected order is missing customer information required for invoice creation.",
        variant: "destructive",
      })
      return
    }

    if (paymentOption === 'instant' && !paymentMethod) {
      toast({
        title: "Error",
        description: "Select how the payment was received (cash, M-Pesa, bank, etc.)",
        variant: "destructive",
      })
      return
    }

    if (paymentOption === 'credit' && !creditTerms?.credit_days) {
      toast({
        title: "Error",
        description: "This customer has no GM-approved credit terms. Get credit terms approved, or switch to instant payment.",
        variant: "destructive",
      })
      return
    }

    if (creditOverage > 0 && (!coversOverage(downPaymentAmount, creditOverage) || !downPaymentMethod)) {
      toast({
        title: "Error",
        description: `This exceeds available credit by KES ${creditOverage.toLocaleString()}. Enter how that amount will be paid now to proceed.`,
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)

      // Prepare simplified invoice data for the new API
      // The backend will handle all line item conversion automatically
      const invoiceData = {
        invoice_date: data.invoice_date,
        // Left blank: the backend auto-calculates due_date from the customer's credit terms
        due_date: paymentOption === 'credit' ? (data.due_date || undefined) : undefined,
        payment_terms: paymentOption === 'credit' ? (data.payment_terms || undefined) : undefined,
        notes: data.notes || '',
        sales_rep_id: salesRepId || undefined,
        payment_option: paymentOption,
        payment_method: paymentOption === 'instant' ? paymentMethod : undefined,
        transaction_id: paymentOption === 'instant' ? (transactionRef || undefined) : undefined,
        down_payment_amount: paymentOption === 'credit' && creditOverage > 0 ? downPaymentAmount : undefined,
        down_payment_method: paymentOption === 'credit' && creditOverage > 0 ? downPaymentMethod : undefined,
        down_payment_transaction_id: paymentOption === 'credit' && creditOverage > 0 ? (downPaymentTransactionRef || undefined) : undefined,
      }

      const result = await createInvoiceFromOrder(data.order_id, invoiceData)
      
      toast({
        title: "Success",
        description: "Invoice created from order successfully",
      })
      
      // Dispatch event for automatic cache refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('invoice-created', { 
          detail: { invoiceId: result?.id, timestamp: Date.now() } 
        }))
      }
      
      form.reset()
      setSelectedOrder(null)
      setSalesRepId("")
      setPaymentOption('instant')
      setPaymentMethod("")
      setTransactionRef("")
      setCreditTerms(null)
      setDownPaymentAmount(0)
      setDownPaymentMethod("")
      setDownPaymentTransactionRef("")
      onSuccess()
    } catch (error: any) {
      // Extract the API error message directly
      let errorMessage = "Failed to create invoice from order"
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }
      
      // Show the API error message directly
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Invoice from Order</SheetTitle>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Order Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="order_id">Select Order</Label>
              <Select 
                value={form.watch('order_id')} 
                onValueChange={(value) => form.setValue('order_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an order to invoice" />
                </SelectTrigger>
                <SelectContent>
                  {orders.length === 0 ? (
                    <SelectItem value="no-orders" disabled>No available orders</SelectItem>
                  ) : (
                    orders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{order.order_number}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {order.customer ? getCustomerDisplayName(order.customer) : "Unknown Customer"} - {formatCurrency(parseFloat(order.final_amount || order.total_amount))}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.order_id && (
                <p className="text-sm text-red-600">{form.formState.errors.order_id.message}</p>
              )}
            </div>

            {/* Selected Order Preview */}
            {selectedOrder && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Order Number</Label>
                      <p className="text-sm">{selectedOrder.order_number}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <Badge className={getOrderStatusColor(selectedOrder.status)}>
                        {selectedOrder.status}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Customer</Label>
                      <p className="text-sm">{selectedOrder.customer ? getCustomerDisplayName(selectedOrder.customer) : 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Order Date</Label>
                      <p className="text-sm">{formatDate(selectedOrder.created_at)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Total Amount</Label>
                      <p className="text-sm font-bold">
                        {formatCurrency(parseFloat(selectedOrder.final_amount || selectedOrder.total_amount))}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Payment Status</Label>
                      <p className="text-sm">{selectedOrder.payment_status || 'Pending'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice Date</Label>
              <Input
                type="date"
                {...form.register('invoice_date')}
              />
              {form.formState.errors.invoice_date && (
                <p className="text-sm text-red-600">{form.formState.errors.invoice_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sales_rep_id">Sales Rep</Label>
              <Select
                value={salesRepId || "none"}
                onValueChange={(value) => setSalesRepId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {salesReps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.full_name || `${rep.first_name} ${rep.last_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* How is this being paid? */}
          <div className="space-y-3 rounded-lg border p-4">
            <Label>How is this being paid? *</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentOption('instant')}
                className={`flex items-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors ${
                  paymentOption === 'instant'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Wallet className="h-4 w-4" />
                Instant Payment
              </button>
              <button
                type="button"
                onClick={() => setPaymentOption('credit')}
                className={`flex items-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors ${
                  paymentOption === 'credit'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CreditCardIcon className="h-4 w-4" />
                Credit
              </button>
            </div>

            {paymentOption === 'instant' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Payment Method *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
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
                  <Label htmlFor="transaction_ref">Reference (optional)</Label>
                  <Input
                    id="transaction_ref"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="M-Pesa code, bank ref, etc."
                  />
                </div>
                <p className="col-span-1 md:col-span-2 text-xs text-muted-foreground">
                  The invoice will be created and marked paid immediately. Paying by cheque?
                  Create it on credit instead, then record the cheque from the invoice — it stays pending until it clears.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {isLoadingCreditTerms ? (
                  <p className="text-sm text-muted-foreground">Loading customer's credit terms...</p>
                ) : !selectedOrder ? (
                  <p className="text-sm text-muted-foreground">Select an order to see the customer's credit terms.</p>
                ) : creditTerms?.credit_days ? (
                  <div className="rounded-md bg-purple-50 border border-purple-200 p-3 text-sm">
                    <p className="font-medium text-purple-900">
                      Approved terms: Net {creditTerms.credit_days} ({creditTerms.credit_days} days)
                    </p>
                    {creditTerms.available_credit != null && (
                      <p className="text-purple-700">Available credit: KES {Number(creditTerms.available_credit).toLocaleString()}</p>
                    )}
                    {creditTerms.has_pending_change && (
                      <p className="text-amber-700 mt-1">Note: a terms change is pending GM approval and not yet in effect.</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                    No GM-approved credit terms on file for this customer. Get credit terms approved, or
                    switch to instant payment, before this invoice can be created.
                  </div>
                )}

                {creditOverage > 0 && (
                  <CreditOveragePrompt
                    overage={creditOverage}
                    downPaymentAmount={downPaymentAmount}
                    onDownPaymentAmountChange={setDownPaymentAmount}
                    downPaymentMethod={downPaymentMethod}
                    onDownPaymentMethodChange={setDownPaymentMethod}
                    downPaymentTransactionRef={downPaymentTransactionRef}
                    onDownPaymentTransactionRefChange={setDownPaymentTransactionRef}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due Date Override</Label>
                    <Input type="date" {...form.register('due_date')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_terms">Payment Terms Override</Label>
                    <Input
                      placeholder={creditTerms?.credit_days ? `Net ${creditTerms.credit_days}` : "Net 30"}
                      {...form.register('payment_terms')}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              placeholder="Additional notes for the invoice"
              {...form.register('notes')}
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !selectedOrder ||
                (paymentOption === 'credit' && !creditTerms?.credit_days) ||
                (creditOverage > 0 && (!coversOverage(downPaymentAmount, creditOverage) || !downPaymentMethod))
              }
            >
              {isLoading ? "Creating..." : "Create Invoice"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
