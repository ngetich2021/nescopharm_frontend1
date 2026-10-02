"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { CreditCard, Banknote, Smartphone, Receipt } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ReceiptPrinter } from "./receipt-printer"
import type { CartItem } from "./pos-interface"
import { useCart } from "./pos-interface"
import type { Customer } from "@/lib/customers"
import { createPayment } from "@/lib/payments"
import apiCall from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { createDebt, updateDebtByOrderId, getDebtForOrder } from "@/lib/debts"
import { getCustomers, createCustomer, getCustomerDisplayName } from "@/lib/customers"
import { createQuote } from "@/lib/quotes"
import { usePermissions } from "@/hooks/use-permissions"

// Add a local placeholder for sendMpesaStkPush
async function sendMpesaStkPush({ phone, amount }: { phone: string; amount: number }) {
  // TODO: Replace with real API call
  return new Promise((resolve) => setTimeout(resolve, 1000))
}
import { Switch } from "@/components/ui/switch" // Uncomment if exists
import { useRouter } from "next/navigation"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  cartItems: CartItem[]
  customer: Customer | null
  onPaymentComplete: (paymentData: any) => void
  subtotal: number
  tax: number
  taxEnabled: boolean
  taxRate: number
  total: number
  existingOrderId?: string // NEW: for existing orders
  orderBreakdown?: { total: number; paid: number; balance: number }
}

type PaymentMethod = "cash" | "card" | "mpesa" | "debt"

export function PaymentModal({ isOpen, onClose, cartItems, customer, onPaymentComplete, subtotal, tax, taxEnabled, taxRate, total, existingOrderId, orderBreakdown }: PaymentModalProps) {
  if (!isOpen) return null;
  // REMOVE: Guard that closes modal if cart is empty
  // The parent should control when the modal opens. Only show if isOpen is true.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [amountReceived, setAmountReceived] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [orderData, setOrderData] = useState<any>(null)
  const [payments, setPayments] = useState<{ method: PaymentMethod; amount: number; change: number; phone?: string; txnCode?: string }[]>([])
  const { toast } = useToast()
  const [mpesaPhone, setMpesaPhone] = useState("")
  const [mpesaTxnCode, setMpesaTxnCode] = useState("")
  const [cardTxnCode, setCardTxnCode] = useState("")
  const [isStkLoading, setIsStkLoading] = useState(false)
  const [completeAsDebt, setCompleteAsDebt] = useState(false)
  const [debtCustomer, setDebtCustomer] = useState({ name: "", phone: "", email: "" })
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<string>("")
  const router = useRouter()
  const { companyId, user } = useAuth();
  const { bumpActivityVersion } = useCart()
  // Sales Reps don't take payment or create orders in POS - their "sale" is
  // captured as a Quote and routed to whoever can create quotes for review,
  // rather than pushing them through the full order/payment/debt machinery.
  const isRepSubmission = !existingOrderId && !!user?.role?.is_sales_rep
  const [quoteSubmitted, setQuoteSubmitted] = useState<{ quote_number: string } | null>(null)
  const [customerList, setCustomerList] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [newCustomer, setNewCustomer] = useState<{ name: string; phone: string; email: string }>({ name: "", phone: "", email: "" })
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [currentDebtAmount, setCurrentDebtAmount] = useState<number | null>(null)
  const { hasPermission } = usePermissions()

  // Check if user has permission to create payments
  const canCreatePayment = hasPermission("can_create_payment")

  // If user doesn't have permission to create payments, show a message and close the modal.
  // Doesn't apply to a Sales Rep's own submission - they never touch payment
  // at all, they submit a Quote (a completely separate permission,
  // can_create_quotes, checked server-side). Gating on can_create_payment
  // here was closing the modal on them before they could even see the
  // "Submit as Quote" button.
  useEffect(() => {
    if (isOpen && !isRepSubmission && !canCreatePayment) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to create payments",
        variant: "destructive"
      })
      onClose()
    }
  }, [isOpen, isRepSubmission, canCreatePayment, onClose, toast])

  useEffect(() => {
    if (paymentMethod === "debt") {
      getCustomers().then(setCustomerList)
    }
  }, [paymentMethod])

  useEffect(() => {
    if (isOpen && existingOrderId) {
      // Fetch the current debt for this order
      getDebtForOrder(existingOrderId).then((debt) => {
        setCurrentDebtAmount(debt ? debt.amount : null)
      })
    } else {
      setCurrentDebtAmount(null)
    }
  }, [isOpen, existingOrderId])

  // Reset modal state when opened or closed
  useEffect(() => {
    if (isOpen) {
      setShowReceipt(false)
      setOrderData(null)
      setAmountReceived("")
      setPaymentMethod("cash")
      setPayments([])
      setMpesaPhone("")
      setMpesaTxnCode("")
      setCardTxnCode("")
      setCompleteAsDebt(false)
      setDebtCustomer({ name: "", phone: "", email: "" })
      setExpectedPaymentDate("")
      setQuoteSubmitted(null)
    }
  }, [isOpen])

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = Math.max(0, total - totalPaid)
  const currentAmount = Number.parseFloat(amountReceived) || 0
  const change = currentAmount > remaining ? currentAmount - remaining : 0
  const maxPayable = existingOrderId && currentDebtAmount !== null ? currentDebtAmount : remaining

  const handleMpesaStkPush = async () => {
    if (!mpesaPhone) {
      toast({ title: "Enter phone number", variant: "destructive" })
      return
    }
    setIsStkLoading(true)
    try {
      await sendMpesaStkPush({ phone: mpesaPhone, amount: currentAmount })
      toast({ title: "STK Push sent!", description: "Check your phone to complete payment." })
    } catch (e) {
      toast({ title: "STK Push failed", description: String(e), variant: "destructive" })
    }
    setIsStkLoading(false)
  }

  const handleAddPayment = () => {
    if (currentAmount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }
    if (currentAmount > maxPayable) {
      toast({ title: "Amount exceeds debt", description: `You cannot pay more than the current debt (Ksh ${maxPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })})`, variant: "destructive" })
      return
    }
    if (paymentMethod === "mpesa" && !mpesaPhone) {
      toast({ title: "Enter phone number for Mpesa", variant: "destructive" })
      return
    }
    if (paymentMethod === "card" && !cardTxnCode) {
      toast({ title: "Enter transaction code for Card", variant: "destructive" })
      return
    }
    setPayments((prev) => [
      ...prev,
      {
        method: paymentMethod,
        amount: currentAmount,
        change: change,
        phone: paymentMethod === "mpesa" ? mpesaPhone : undefined,
        txnCode: paymentMethod === "mpesa" ? mpesaTxnCode : paymentMethod === "card" ? cardTxnCode : undefined,
      },
    ])
    setAmountReceived("")
    setPaymentMethod("cash")
    setMpesaPhone("")
    setMpesaTxnCode("")
    setCardTxnCode("")
  }

  const handleSubmitQuote = async () => {
    if (cartItems.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" })
      return
    }
    if (!customer?.id || customer.id === "walk-in") {
      toast({ title: "Select a customer", description: "A customer is required to submit a quote.", variant: "destructive" })
      return
    }
    setIsProcessing(true)
    try {
      const items = cartItems.map((item) => {
        const quoteItem: any = {
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: String(item.price),
        }
        if (item.variantId) quoteItem.variant_id = item.variantId
        return quoteItem
      })
      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + 14)
      const quote = await createQuote({
        customer_id: customer.id,
        items,
        currency: "KES",
        notes: "Submitted from POS by sales rep - pending review.",
        status: "pending",
        valid_until: validUntil.toISOString().slice(0, 10),
      })
      setQuoteSubmitted({ quote_number: quote.quote_number })
      bumpActivityVersion()
      toast({
        title: "Quote submitted for review",
        description: `Quote ${quote.quote_number} sent for review. It becomes a full order once reviewed and edited.`,
      })
    } catch (error: any) {
      toast({ title: "Quote submission failed", description: error.message || String(error), variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCompleteOrder = async () => {
    if (!canCreatePayment) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to create payments",
        variant: "destructive"
      })
      return
    }
    
    if (paymentMethod === "debt") {
      const customerId = selectedCustomerId || customer?.id;
      if (!customerId || !expectedPaymentDate) {
        toast({ title: "Fill all debt details", variant: "destructive" })
        return
      }
    }
    if (!companyId) {
      toast({ title: "Company not found", description: "Cannot create order without company context.", variant: "destructive" })
      return
    }
    if (!existingOrderId && cartItems.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" })
      return
    }
    setIsProcessing(true)
    try {
      let orderId = existingOrderId;
      let isNewOrder = false;
      let paymentIds: string[] = [];
      if (!existingOrderId) {
        // Build order items
        const items = cartItems.map(item => {
          const orderItem: any = {
            product_id: item.productId, // Use actual productId
            quantity: item.quantity,
            unit_price: item.price,
          };
          if (item.variantId) {
            orderItem.variant_id = item.variantId;
          }
          return orderItem;
        });
        // Build order payload
        const orderPayload: any = {
          store_id: companyId,
          status: "pending",
          payment_status: "unpaid",
          currency: "KES",
          notes: paymentMethod === "debt" ? `Debt for ${selectedCustomerId || customer?.id}` : undefined,
          items,
        }
        
        // Only add customer_id if it's a valid UUID (not walk-in customer)
        if (customer?.id && customer.id !== "walk-in") {
          orderPayload.customer_id = customer.id;
        }
        // Create order
        const orderRes = await apiCall<any>("/orders", "POST", orderPayload, true)
        orderId = orderRes?.order?.id || orderRes?.id
        if (!orderId) throw new Error("Order creation failed: No order ID returned.")
        isNewOrder = true;
      }

      // 1. Create payments for each payment entered (not for debt)
      let totalPaidThisSession = 0;
      for (const p of payments) {
        if (p.method !== "debt" && p.amount > 0) {
          const paymentPayload = {
            order_id: orderId as string,
            payment_method: p.method,
            amount_paid: p.amount,
            transaction_id: p.txnCode,
            payment_date: new Date().toISOString().slice(0, 10),
            status: "completed",
            generate_invoice: true,
            ...(customer?.id ? { customer_id: customer.id } : {}),
          }
          const paymentResult = await createPayment(paymentPayload)
          if (paymentResult?.id) paymentIds.push(paymentResult.id)
          totalPaidThisSession += p.amount;
        }
      }

      // 2b. If this is an existing order, update the debt by order id if payment was made
      if (existingOrderId && paymentIds.length > 0 && currentDebtAmount !== null) {
        const newBalance = currentDebtAmount - totalPaidThisSession;
        const isFullyPaid = newBalance <= 0;
        // Update the debt: reduce amount, set status, do not pass payment_id
        await updateDebtByOrderId(existingOrderId, {
          amount: isFullyPaid ? 0 : newBalance,
          status: isFullyPaid ? "paid" : "partial",
          due_date: expectedPaymentDate || (orderBreakdown ? undefined : undefined),
          notes: isFullyPaid
            ? `Customer paid off debt on ${new Date().toISOString().slice(0, 10)}`
            : `Partial payment received, balance pending.`,
        });
        // Fetch updated debt and update UI state
        const updatedDebt = await getDebtForOrder(existingOrderId);
        setCurrentDebtAmount(updatedDebt ? updatedDebt.amount : null);
        
        // Update order status to completed if fully paid
        if (isFullyPaid) {
          try {
            await apiCall(`/orders/${existingOrderId}`, "PUT", {
              status: "completed",
              payment_status: "paid"
            }, true);
          } catch (updateError) {
            console.error("Failed to update order status:", updateError);
            // Don't throw here to avoid breaking the payment flow
          }
        }
      }
      
      // 2c. If this is an existing order without debt but payments were made, check if order is fully paid
      else if (existingOrderId && paymentIds.length > 0 && orderBreakdown) {
        const totalPaidForOrder = orderBreakdown.paid + totalPaidThisSession;
        const isOrderFullyPaid = totalPaidForOrder >= orderBreakdown.total;
        
        if (isOrderFullyPaid) {
          try {
            await apiCall(`/orders/${existingOrderId}`, "PUT", {
              status: "completed",
              payment_status: "paid"
            }, true);
          } catch (updateError) {
            console.error("Failed to update order status:", updateError);
            // Don't throw here to avoid breaking the payment flow
          }
        }
      }

      // 2. If there is a balance and debt is selected, create a debt for the balance (for new orders)
      let balance = total - payments.reduce((sum, p) => p.method !== "debt" ? sum + p.amount : sum, 0)
      if (paymentMethod === "debt" && balance > 0 && !existingOrderId) {
        const customerId = selectedCustomerId || customer?.id;
        if (!customerId) throw new Error("Customer ID is required to create a debt.");
        if (!orderId) throw new Error("Order ID is required to create debt.");
        const debtPayload = {
          customer_id: customerId,
          order_id: orderId,
          company_id: companyId,
          amount: balance,
          status: "unpaid",
          due_date: expectedPaymentDate,
          notes: `Outstanding balance for order ${orderId}`,
          payment_id: null,
        }
        await createDebt(debtPayload)
      }

      // 3. Update order status if fully paid
      let finalStatus = "pending";
      if (balance <= 0) {
        finalStatus = "completed";
        // Update order status to completed via API
        try {
          await apiCall(`/orders/${orderId}`, "PUT", {
            status: "completed",
            payment_status: "paid"
          }, true);
        } catch (updateError) {
          console.error("Failed to update order status:", updateError);
          // Don't throw here to avoid breaking the payment flow
          // The payment was successful even if status update fails
        }
      }

      setOrderData({ id: orderId, items: cartItems, customer: customer, subtotal, tax, total, timestamp: new Date().toISOString(), isDebt: paymentMethod === "debt", expectedPaymentDate: paymentMethod === "debt" ? expectedPaymentDate : undefined, payments });
      setShowReceipt(true)
      
      // Determine toast message based on payment status
      let toastTitle = "";
      let toastDescription = "";
      
      if (balance <= 0) {
        toastTitle = "Order completed!";
        toastDescription = `Order ${orderId} has been paid in full and marked as completed.`;
      } else if (paymentMethod === "debt") {
        toastTitle = "Debt recorded!";
        toastDescription = `Outstanding balance recorded for order ${orderId}.`;
      } else {
        toastTitle = "Partial payment recorded!";
        toastDescription = `Partial payment received for order ${orderId}.`;
      }
      
      toast({ title: toastTitle, description: toastDescription })
    } catch (error: any) {
      toast({ title: "Order/Payment failed", description: error.message || String(error), variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (orderData) {
      onPaymentComplete(orderData.payment)
    } else if (quoteSubmitted) {
      onPaymentComplete({ isQuote: true, ...quoteSubmitted })
    }
    setAmountReceived("")
    setPaymentMethod("cash")
    setShowReceipt(false)
    setOrderData(null)
    setPayments([])
    setMpesaPhone("")
    setMpesaTxnCode("")
    setCardTxnCode("")
    setCompleteAsDebt(false)
    setDebtCustomer({ name: "", phone: "", email: "" })
    setExpectedPaymentDate("")
    setQuoteSubmitted(null)
    onClose()
  }

  const getPaymentIcon = (method: PaymentMethod) => {
    switch (method) {
      case "cash":
        return <Banknote className="h-4 w-4" />
      case "card":
        return <CreditCard className="h-4 w-4" />
      case "mpesa":
        return <Smartphone className="h-4 w-4" />
      case "debt":
        return <Receipt className="h-4 w-4" />
    }
  }

  const handleCreateCustomer = async () => {
    setCreatingCustomer(true)
    try {
      // Prepare customer data without company_id - it will be handled by the backend
      const customerData = {
        name: newCustomer.name,
        phone: newCustomer.phone || null,
        email: newCustomer.email || null,
        address: null,
        city: null,
        state: null,
        country: null,
        postal_code: null,
        company: null,
        notes: null,
        tags: [],
        customer_type: null,
        preferred_communication_channel: null,
        last_contact_date: null,
        // These fields are no longer collected via form, assuming backend handles defaults or they are not required
        first_name: newCustomer.name.split(" ")[0] || "", // Derive first_name from name
        last_name: newCustomer.name.split(" ").slice(1).join(" ") || "", // Derive last_name from name
        // company_id is intentionally omitted - will be handled by the backend
      };

      const created = await createCustomer(customerData as any)
      setCustomerList((prev) => [...prev, created])
      setSelectedCustomerId(created.id)
      setShowNewCustomerForm(false)
      setNewCustomer({ name: "", phone: "", email: "" })
      toast({ title: "Customer created", description: created.name })
    } catch (e: any) {
      toast({ title: "Failed to create customer", description: e.message, variant: "destructive" })
    } finally {
      setCreatingCustomer(false)
    }
  }

  if (quoteSubmitted) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Quote Submitted
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-blue-700 font-semibold text-lg">Sent for review!</div>
              <div className="text-sm text-blue-700">Quote {quoteSubmitted.quote_number}</div>
              <div className="text-xs text-blue-600 mt-2">
                This will become a full order once someone authorized reviews and edits it.
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showReceipt && orderData) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Payment Complete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-green-600 font-semibold text-lg">Payment Successful!</div>
              <div className="text-sm text-green-700">Order #{orderData.id}</div>
            </div>
            <ReceiptPrinter order={orderData} />
            <Button onClick={handleClose} className="w-full">
              Complete Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // If user doesn't have permission to create payments, don't render the
  // modal - except for a rep's own submission, which never needs it (see effect above).
  if (!isRepSubmission && !canCreatePayment) {
    return null;
  }

  // --- UI/UX Redesign for Payment Modal ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-auto relative flex flex-col max-h-[95vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-8 pt-8 pb-2 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">Checkout</h2>
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
            <span aria-hidden>×</span>
          </Button>
        </div>

        {/* Order Breakdown for existing orders */}
        {orderBreakdown && (
          <div className="px-8 pt-4 pb-2">
            <div className="rounded-lg bg-gray-50 p-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Total</span>
                <span>Ksh {orderBreakdown.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>Paid</span>
                <span>Ksh {orderBreakdown.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>Balance</span>
                <span>Ksh {orderBreakdown.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Order Summary */}
        <div className="px-8 pt-4 pb-2">
          <div className="rounded-lg bg-gray-50 p-4 mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Subtotal</span>
              <span>Ksh {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {taxEnabled && (
              <div className="flex justify-between text-sm mb-1">
                <span>Tax ({taxRate}%)</span>
                <span>Ksh {tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>Ksh {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Sales Reps don't take payment in POS - their sale becomes a Quote
            for someone authorized to create quotes to review and finalize.
            Since there's no going back to fix a typo'd item once submitted,
            show everything in full (customer's real name, full product/
            variant names, no truncation) as a proper "review before you
            submit" step rather than just a subtotal. */}
        {isRepSubmission && (
          <div className="px-8 pb-2 space-y-3">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              As a Sales Rep, this won't be completed as an order here. It will be submitted as a
              quote for review by someone authorized to create quotes - it becomes a full order once
              they've reviewed and edited it.
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-xs font-medium text-gray-500 mb-1">Customer</div>
              <div className="text-sm font-semibold text-gray-900 mb-3">
                {customer && customer.id !== "walk-in" ? getCustomerDisplayName(customer) : "No customer selected"}
              </div>

              <div className="text-xs font-medium text-gray-500 mb-2">Items ({cartItems.length})</div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between text-sm gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 break-words">
                        {item.name}
                        {item.variant && <span className="text-gray-500"> — {item.variant}</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        SKU: {item.sku || "—"} · Qty {item.quantity} × Ksh {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                      Ksh {(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!isRepSubmission && (
        <>
        {/* Step 2: Payment Method Selection (now includes Debt) */}
        <div className="px-8 pb-2">
          <Label className="mb-1 block">Payment Method</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            {(["cash", "card", "mpesa", "debt"] as PaymentMethod[]).map((method) => (
              <Button
                key={method}
                variant={paymentMethod === method ? "default" : "outline"}
                onClick={() => setPaymentMethod(method)}
                className="flex flex-col items-center gap-1 py-4 px-2 text-base font-medium h-20 w-full justify-center"
                aria-pressed={paymentMethod === method}
              >
                {getPaymentIcon(method)}
                <span className="text-xs capitalize mt-1">{method === "mpesa" ? "Mpesa" : method.charAt(0).toUpperCase() + method.slice(1)}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Step 3: Payment Details */}
        <div className="px-8 pb-2">
          {/* Debt fields if selected */}
          {paymentMethod === "debt" && (
            <div className="rounded-lg bg-yellow-50 p-4 space-y-2 mb-2">
              <Label>Customer</Label>
              <div className="flex gap-2 items-center">
                <select
                  className="border rounded px-2 py-1 flex-1"
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  disabled={showNewCustomerForm}
                >
                  <option value="">Select customer...</option>
                  {customerList.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowNewCustomerForm(v => !v)}>
                  {showNewCustomerForm ? "Cancel" : "New Customer"}
                </Button>
              </div>
              {showNewCustomerForm && (
                <div className="space-y-2 mt-2">
                  <Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Name" />
                  <Input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="Phone" />
                  <Input value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="Email (optional)" />
                  <Button type="button" onClick={handleCreateCustomer} disabled={creatingCustomer || !newCustomer.name || !newCustomer.phone}>
                    {creatingCustomer ? "Creating..." : "Create Customer"}
                  </Button>
                </div>
              )}
              <Label>Expected Payment Date</Label>
              <Input type="date" value={expectedPaymentDate} onChange={e => setExpectedPaymentDate(e.target.value)} />
              <span className="text-xs text-gray-500">All fields required except email.</span>
            </div>
          )}
          {/* Amount Input & Quick Amounts (not for debt) */}
          {paymentMethod !== "debt" && (
            <>
              <Label>Amount Paid</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  type="number"
                  step="0.01"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder="Enter amount (Ksh)"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmountReceived(remaining.toString())}
                  type="button"
                >
                  All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmountReceived((Math.ceil(remaining / 10) * 10).toString())}
                  type="button"
                >
                  Round
                </Button>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span>Change:</span>
                <span className={change > 0 ? "text-green-600 font-semibold" : "text-gray-500"}>
                  Ksh {change.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </>
          )}
          {/* Payment Method Specific Fields */}
          {paymentMethod === "mpesa" && (
            <div className="space-y-2 mb-2">
              <Label>Mpesa Phone Number</Label>
              <Input value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} placeholder="07XXXXXXXX" />
              <Button onClick={handleMpesaStkPush} disabled={isStkLoading || !mpesaPhone || currentAmount <= 0} type="button" className="w-full">
                {isStkLoading ? "Sending STK Push..." : "Send STK Push"}
              </Button>
              <Label>Mpesa Transaction Code <span className="text-xs text-gray-400">(optional)</span></Label>
              <Input value={mpesaTxnCode} onChange={e => setMpesaTxnCode(e.target.value)} placeholder="e.g. QJD12345" />
            </div>
          )}
          {paymentMethod === "card" && (
            <div className="space-y-2 mb-2">
              <Label>Card Transaction Code <span className="text-xs text-gray-400">(required)</span></Label>
              <Input value={cardTxnCode} onChange={e => setCardTxnCode(e.target.value)} placeholder="e.g. 123456" />
            </div>
          )}
          {paymentMethod !== "debt" && (
            <Button
              onClick={handleAddPayment}
              className="w-full mt-2"
              disabled={isProcessing || currentAmount <= 0}
              type="button"
            >
              Add Payment
            </Button>
          )}
        </div>

        {/* Step 4: Payments List (not for debt) */}
        {paymentMethod !== "debt" && payments.length > 0 && (
          <div className="px-8 pb-2">
            <div className="rounded-lg bg-gray-100 p-4 mb-2">
              <div className="font-medium mb-2">Payments Made</div>
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-b-0">
                  <div className="flex flex-col">
                    <span className="font-medium">{p.method.toUpperCase()} - Ksh {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {p.txnCode && <span className="text-xs text-gray-500">Txn: {p.txnCode}</span>}
                    {p.phone && <span className="text-xs text-gray-500">Phone: {p.phone}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={p.change > 0 ? "text-green-600 font-semibold" : "text-gray-500"}>
                      Change: Ksh {p.change.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    {/* Remove payment button */}
                    <Button variant="ghost" size="icon" onClick={() => setPayments(payments.filter((_, idx) => idx !== i))} aria-label="Remove payment">
                      <span aria-hidden>🗑️</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Final Summary & Complete */}
        <div className="px-8 pb-32">
          <div className="rounded-lg bg-blue-50 p-4 mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Total Paid</span>
              <span>Ksh {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>Remaining</span>
              <span>Ksh {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Sticky Footer for Complete Order */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t px-8 py-4 flex flex-col gap-2 max-w-xl mx-auto">
          <Button
            onClick={isRepSubmission ? handleSubmitQuote : handleCompleteOrder}
            className="w-full text-lg font-bold"
            disabled={
              isProcessing ||
              (isRepSubmission
                ? !customer?.id || customer.id === "walk-in"
                : paymentMethod === "debt"
                ? !(selectedCustomerId || customer?.id) || !expectedPaymentDate
                : totalPaid < total)
            }
            type="button"
          >
            {isProcessing
              ? "Processing..."
              : isRepSubmission
              ? "Submit as Quote"
              : paymentMethod === "debt"
              ? "Record Debt"
              : "Complete Order"}
          </Button>
          {isRepSubmission && (!customer?.id || customer.id === "walk-in") && (
            <div className="text-center text-xs text-red-500 mt-1">
              Please select a customer to submit this quote.
            </div>
          )}
          {!isRepSubmission && paymentMethod === "debt" && (!selectedCustomerId && !customer?.id || !expectedPaymentDate) && (
            <div className="text-center text-xs text-red-500 mt-1">
              Please select or create a customer and set the expected payment date to record a debt.
            </div>
          )}
          <div className="text-center text-xs text-gray-400">
            {isRepSubmission
              ? "This will be sent as a quote for review, not completed as an order."
              : paymentMethod === "debt"
              ? "Order will be saved as a debt. Customer will be expected to pay by the selected date."
              : "Order will be completed and marked as paid."}
          </div>
        </div>

        {/* Success State (Receipt) */}
        {showReceipt && orderData && (
          <div className="absolute inset-0 bg-white bg-opacity-95 flex flex-col items-center justify-center z-50 rounded-xl">
            <div className="p-6 text-center">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-xl font-bold mb-1">{orderData.isDebt || paymentMethod === "debt" ? "Debt Recorded!" : "Payment Successful!"}</div>
              <div className="mb-2 text-gray-600">Order {orderData.id} {orderData.isDebt || paymentMethod === "debt" ? "has been saved as a debt." : "is complete."}</div>
              <Button className="mt-2 w-full" onClick={onPaymentComplete}>Complete Order</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}