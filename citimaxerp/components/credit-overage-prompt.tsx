"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { INSTANT_PAYMENT_METHODS } from "@/lib/payment-methods"
import { coversOverage } from "@/lib/credit-overage"
import { Unlock } from "lucide-react"

interface CreditOveragePromptProps {
  overage: number
  downPaymentAmount: number
  onDownPaymentAmountChange: (value: number) => void
  downPaymentMethod: string
  onDownPaymentMethodChange: (value: string) => void
  downPaymentTransactionRef: string
  onDownPaymentTransactionRefChange: (value: string) => void
}

// Shown when a credit purchase would exceed the customer's available credit.
// Instead of blocking the sale outright, offers to cover just the excess now
// (cash/M-Pesa/etc.) so the rest can still go on credit as normal.
export function CreditOveragePrompt({
  overage,
  downPaymentAmount,
  onDownPaymentAmountChange,
  downPaymentMethod,
  onDownPaymentMethodChange,
  downPaymentTransactionRef,
  onDownPaymentTransactionRefChange,
}: CreditOveragePromptProps) {
  const covered = coversOverage(downPaymentAmount, overage)

  return (
    <div className="rounded-md bg-orange-50 border border-orange-200 p-3 space-y-3">
      <p className="text-sm text-orange-900 flex items-start gap-2">
        <Unlock className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          This is <strong>KES {overage.toLocaleString()}</strong> over the customer's available credit.
          Pay that amount now to unlock the sale — the rest still goes on credit as usual.
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="down_payment_amount">Amount to pay now *</Label>
          <Input
            id="down_payment_amount"
            type="number"
            step="0.01"
            min={overage}
            value={downPaymentAmount || ''}
            onChange={(e) => onDownPaymentAmountChange(parseFloat(e.target.value) || 0)}
            placeholder={overage.toString()}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="down_payment_method">Paid via *</Label>
          <Select value={downPaymentMethod} onValueChange={onDownPaymentMethodChange}>
            <SelectTrigger id="down_payment_method">
              <SelectValue placeholder="How was it paid?" />
            </SelectTrigger>
            <SelectContent>
              {INSTANT_PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="down_payment_ref">Reference (optional)</Label>
          <Input
            id="down_payment_ref"
            value={downPaymentTransactionRef}
            onChange={(e) => onDownPaymentTransactionRefChange(e.target.value)}
            placeholder="M-Pesa code, bank ref, etc."
          />
        </div>
      </div>
      <p className="text-xs text-orange-700">
        Paying by cheque? It can only be recorded against an invoice, and stays pending until it clears — it can't unlock this sale immediately.
      </p>
      {!covered && (
        <p className="text-xs text-orange-700">
          Needs to be at least KES {overage.toLocaleString()} to bring this within their credit limit.
        </p>
      )}
    </div>
  )
}
