"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import {
  SheetFooter,
} from "@/components/ui/sheet"
import { createPayment } from "@/lib/payments" // Update to use API functions
import { fetchOrderById } from "@/lib/orders"
import { getPayments } from "@/lib/payments"

interface PaymentModalProps {
  orderId: string
  onClose: () => void
  onSuccess?: () => void
  orderNumber?: string
  orderTotal?: number
  customerId?: string
}

export function PaymentModal({ 
  orderId, 
  onClose, 
  onSuccess,
  orderNumber,
  orderTotal: initialOrderTotal,
  customerId: initialCustomerId 
}: PaymentModalProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [amount, setAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [transactionId, setTransactionId] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [orderTotal, setOrderTotal] = useState<number>(initialOrderTotal || 0)
  const [totalPaid, setTotalPaid] = useState<number>(0)
  const [customerId, setCustomerId] = useState<string>(initialCustomerId || "")

  useEffect(() => {
    async function fetchOrderDetails() {
      // If we have props, we might not need to fetch, but we do need totalPaid
      // Fetch total paid logic
      try {
        const payments = await getPayments({ search: orderId })
        const orderPayments = payments.filter(payment => payment.order_id === orderId)
        
        if (orderPayments && Array.isArray(orderPayments)) {
          const sumPaid = orderPayments.reduce(
            (sum, p) => sum + parseFloat(p.amount_paid), 
            0
          ) || 0
          setTotalPaid(sumPaid)
        }
      } catch (error) {
        // Silent fail or low priority error
      }

      // If props weren't provided, fetch full details (fallback)
      if (!initialOrderTotal || !initialCustomerId) {
        try {
          const order = await fetchOrderById(orderId)
          if (order) {
            if (!initialOrderTotal && order.final_amount) {
              setOrderTotal(parseFloat(order.final_amount))
            } else if (!initialOrderTotal && order.total_amount) {
              setOrderTotal(parseFloat(order.total_amount))
            }
            if (!initialCustomerId && order.customer_id) {
              setCustomerId(order.customer_id)
            }
          }
        } catch (error) {
           console.error("Failed to fetch order details fallback")
        }
      }
    }

    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId, initialOrderTotal, initialCustomerId])

  // Update amount whenever orderTotal or totalPaid changes
  useEffect(() => {
    // Only set default amount if user hasn't typed anything (amount is 0)
    // and we have valid numbers
    const remaining = orderTotal - totalPaid
    if (remaining > 0 && amount === 0) {
      setAmount(remaining)
    }
  }, [orderTotal, totalPaid])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (amount <= 0 || !paymentMethod) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount and select a payment method.",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    if (!customerId) {
      toast({
        title: "Error",
        description: "Customer information is missing. Please try again.",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    try {
      await createPayment({
        order_id: orderId,
        amount_paid: amount,
        payment_method: paymentMethod,
        transaction_id: transactionId || undefined,
        status: "completed",
        customer_id: customerId,
      })

      toast({
        title: "Payment Receipted",
        description: `Ksh. ${amount.toFixed(2)} received via ${paymentMethod}.`,
      })
      onClose()
      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const remainingBalance = Math.max(0, orderTotal - totalPaid)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary Card */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 border">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order Total</span>
            <span className="font-medium">Ksh. {orderTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Already Paid</span>
            <span className="font-medium">Ksh. {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="border-t pt-2 flex justify-between items-center">
            <span className="font-semibold text-gray-900">Remaining Balance</span>
            <span className="font-bold text-lg text-primary">Ksh. {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-base">Amount to Pay</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Ksh.</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount || ''} 
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                required
                min="0.01"
                className="pl-12 h-12 text-lg"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
              <SelectTrigger id="paymentMethod" className="h-11">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Credit Card">Credit Card</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Paying by cheque? Cheques can only be recorded against an invoice, and stay pending until they clear —
              invoice this order first, then record the cheque from there.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transactionId">Transaction ID (Optional)</Label>
            <Input
              id="transactionId"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g. QXJ892..."
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any payment notes..."
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>
      </div>

      <div className="p-6 border-t bg-white mt-auto sticky bottom-0 z-10">
        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={onClose} disabled={loading} type="button" className="h-12">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="h-12 text-base font-medium">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Receipting...
              </>
            ) : (
              `Pay Ksh. ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
