"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { INSTANT_PAYMENT_METHODS } from "@/lib/payment-methods"
import { formatCurrency } from "@/lib/utils"
import { Wallet } from "lucide-react"

interface InstantPaymentPromptProps {
  total: number
  amountPaid: number
  paymentMethod: string
  onPaymentMethodChange: (value: string) => void
  transactionRef: string
  onTransactionRefChange: (value: string) => void
}

// Shown for a "Cash / Instant" sale - unlike credit, there's no terms to fall
// back on, so the full amount needs to actually be recorded as paid (via the
// Amount Paid field below), with a method, before the order can go through.
export function InstantPaymentPrompt({
  total,
  amountPaid,
  paymentMethod,
  onPaymentMethodChange,
  transactionRef,
  onTransactionRefChange,
}: InstantPaymentPromptProps) {
  const shortfall = Math.max(0, total - amountPaid)

  return (
    <div className="rounded-md bg-green-50 border border-green-200 p-3 space-y-3">
      <p className="text-sm text-green-900 flex items-start gap-2">
        <Wallet className="h-4 w-4 mt-0.5 shrink-0" />
        <span>An instant sale needs to be paid in full - set the Amount Paid below to {formatCurrency(total)} and say how it was paid.</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="instant_payment_method">Paid via *</Label>
          <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
            <SelectTrigger id="instant_payment_method">
              <SelectValue placeholder="How is it being paid?" />
            </SelectTrigger>
            <SelectContent>
              {INSTANT_PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="instant_payment_ref">Reference (optional)</Label>
          <Input
            id="instant_payment_ref"
            value={transactionRef}
            onChange={(e) => onTransactionRefChange(e.target.value)}
            placeholder="M-Pesa code, bank ref, etc."
          />
        </div>
      </div>
      {shortfall > 0 && (
        <p className="text-xs text-green-700">
          Still short {formatCurrency(shortfall)}.
        </p>
      )}
    </div>
  )
}
