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
import { createPayment } from "@/lib/payments"
import { fetchOrderById } from "@/lib/orders"
import { getPayments } from "@/lib/payments"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface PaymentModalProps {
  orderId: string
  onClose: () => void
}

export function PaymentModal({ orderId, onClose }: PaymentModalProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [amount, setAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [transactionId, setTransactionId] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [orderTotal, setOrderTotal] = useState<number>(0)
  const [totalPaid, setTotalPaid] = useState<number>(0)

  useEffect(() => {
    async function fetchOrderDetails() {
      try {
        // Use the API to fetch the order
        const order = await fetchOrderById(orderId);
        
        if (order && order.total_amount) {
          setOrderTotal(parseFloat(order.total_amount));
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load order details.",
          variant: "destructive",
        });
      }
    }

    async function fetchTotalPaid() {
      try {
        // Use the API to fetch payments
        const payments = await getPayments({ search: orderId });
        const orderPayments = payments.filter(payment => payment.order_id === orderId);
        
        if (orderPayments && Array.isArray(orderPayments)) {
          const sumPaid = orderPayments.reduce(
            (sum: number, p: { amount_paid: string }) => sum + parseFloat(p.amount_paid), 
            0
          ) || 0;
          setTotalPaid(sumPaid);
          setAmount(orderTotal - sumPaid > 0 ? orderTotal - sumPaid : 0);
        }
      } catch (error) {
      }
    }

    if (orderId) {
      fetchOrderDetails();
      fetchTotalPaid();
    }
  }, [orderId, orderTotal, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (amount <= 0 || !paymentMethod) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount and select a payment method.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      // Use the API to create a payment
      await createPayment({
        order_id: orderId,
        customer_id: "", // This would be populated from the order
        amount_paid: amount.toString(),
        payment_method: paymentMethod,
        transaction_id: transactionId || undefined,
        status: "completed",
      });

      toast({
        title: "Payment Recorded",
        description: `Ksh. ${amount.toFixed(2)} received via ${paymentMethod}.`,
      });
      onClose();
      router.refresh(); // Revalidate data on the order details page
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const remainingBalance = orderTotal - totalPaid;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="orderTotal">Order Total</Label>
            <Input
              id="orderTotal"
              value={orderTotal.toFixed(2)}
              disabled
              className="mt-1 bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="amountPaid">Amount Paid</Label>
            <Input
              id="amountPaid"
              value={totalPaid.toFixed(2)}
              disabled
              className="mt-1 bg-muted"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="balance">Balance Due</Label>
          <Input
            id="balance"
            value={remainingBalance > 0 ? remainingBalance.toFixed(2) : "0.00"}
            disabled
            className="mt-1 bg-muted"
          />
        </div>

        <div>
          <Label htmlFor="amount">Payment Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="mt-1"
            required
          />
        </div>

        <div>
          <Label htmlFor="paymentMethod">Payment Method</Label>
          <Select
            value={paymentMethod}
            onValueChange={setPaymentMethod}
            required
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select a payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="mpesa">M-Pesa</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="transactionId">Transaction ID (Optional)</Label>
          <Input
            id="transactionId"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            className="mt-1"
            placeholder="Enter transaction ID if applicable"
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1"
            placeholder="Add any additional notes"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Record Payment"
          )}
        </Button>
      </div>
    </form>
  );
}
