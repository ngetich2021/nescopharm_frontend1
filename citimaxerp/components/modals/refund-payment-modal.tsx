"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { refundPaymentOverpayment } from "@/lib/invoices"
import { formatCurrency } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface RefundPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  paymentId: string
  availableAmount: number
  onRefunded?: () => void
}

export function RefundPaymentModal({
  isOpen,
  onClose,
  paymentId,
  availableAmount,
  onRefunded,
}: RefundPaymentModalProps) {
  const [amount, setAmount] = useState(availableAmount.toFixed(2))
  const [refundMethod, setRefundMethod] = useState("")
  const [reference, setReference] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [refundDate, setRefundDate] = useState(new Date().toISOString().split("T")[0])
  const [chequeNumber, setChequeNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [maturityDate, setMaturityDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCheque = refundMethod === "cheque"

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const numericAmount = parseFloat(amount)
    if (!numericAmount || numericAmount <= 0) {
      toast({ title: "Error", description: "Enter a valid refund amount", variant: "destructive" })
      return
    }
    if (numericAmount > availableAmount) {
      toast({
        title: "Error",
        description: `Refund amount cannot exceed the available balance of ${formatCurrency(availableAmount)}`,
        variant: "destructive",
      })
      return
    }
    if (!refundMethod) {
      toast({ title: "Error", description: "Select a refund method", variant: "destructive" })
      return
    }
    if (!reason.trim()) {
      toast({ title: "Error", description: "A reason is required", variant: "destructive" })
      return
    }
    if (isCheque && (!chequeNumber || !bankName || !maturityDate)) {
      toast({
        title: "Error",
        description: "Cheque number, bank name, and maturity date are required for a cheque refund",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await refundPaymentOverpayment(paymentId, {
        amount: numericAmount,
        refund_method: refundMethod as any,
        reference: reference || undefined,
        reason,
        notes: notes || undefined,
        refund_date: refundDate,
        cheque_number: isCheque ? chequeNumber : undefined,
        bank_name: isCheque ? bankName : undefined,
        maturity_date: isCheque ? maturityDate : undefined,
      })

      toast({ title: "Success", description: result.message })
      onRefunded?.()
      onClose()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to record refund", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund Overpayment</DialogTitle>
          <DialogDescription>
            Hand back the excess the customer paid on this payment - available: {formatCurrency(availableAmount)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="refund_amount">Amount *</Label>
              <Input
                id="refund_amount"
                type="number"
                step="0.01"
                min="0.01"
                max={availableAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund_date">Refund Date *</Label>
              <Input
                id="refund_date"
                type="date"
                value={refundDate}
                onChange={(e) => setRefundDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund_method">Refund Method *</Label>
            <Select value={refundMethod} onValueChange={setRefundMethod}>
              <SelectTrigger id="refund_method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCheque && (
            <div className="grid grid-cols-2 gap-4 rounded-md border p-3 bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="refund_cheque_number">Cheque Number *</Label>
                <Input
                  id="refund_cheque_number"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="e.g. 000123"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refund_bank_name">Bank Name *</Label>
                <Input
                  id="refund_bank_name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Equity Bank"
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="refund_maturity_date">Maturity Date *</Label>
                <Input
                  id="refund_maturity_date"
                  type="date"
                  min={refundDate}
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This cheque stays pending and won't reduce the available balance until it's approved/cleared.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="refund_reason">Reason *</Label>
            <Input
              id="refund_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer overpaid invoice, returning excess"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund_reference">Reference (optional)</Label>
            <Input
              id="refund_reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="M-Pesa code, bank ref, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund_notes">Notes (optional)</Label>
            <Textarea
              id="refund_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCheque ? "Record Refund Cheque" : "Submit Refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
