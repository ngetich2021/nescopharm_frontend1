"use client"

import { useEffect, useState } from "react"
import { Landmark, Wallet, BookOpen } from "lucide-react"
import apiCall from "@/lib/api"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const METHOD_LABELS: Record<string, string> = {
  cheque: "Cheque",
  check: "Cheque",
  bank_transfer: "Bank Transfer",
  mpesa: "M-Pesa",
}

/** Whether a payment method comes out of Petty Cash (cash) or Prime Bank (everything else). */
export const sourceOfMethod = (method?: string | null): "petty_cash" | "prime_bank" =>
  !method || method === "cash" || method === "other" ? "petty_cash" : "prime_bank"

/** "Petty Cash" / "Prime Bank (Cheque)" for lists and exports. */
export function paidFromLabel(method?: string | null): string {
  if (sourceOfMethod(method) === "petty_cash") return "Petty Cash"
  return `Prime Bank (${METHOD_LABELS[method || ""] || String(method).replace(/_/g, " ")})`
}

/**
 * Who pays: Petty Cash / Cash at Hand (cash) or Prime Bank (cheque, transfer, M-Pesa). Works on the
 * payment method the forms already send: "cash" is Petty Cash, anything else is Prime Bank. With
 * `supplierName`, also says which ledger account the payment is charged to - the supplier's
 * Accounts Payables, since the bill already carried the cost.
 */
export function PaidFromPicker({
  method,
  onMethodChange,
  bankMethods = ["bank_transfer", "cheque", "mpesa"],
  defaultBankMethod = "bank_transfer",
  supplierName,
  className,
}: {
  method: string
  onMethodChange: (method: string) => void
  bankMethods?: string[]
  defaultBankMethod?: string
  supplierName?: string | null
  className?: string
}) {
  const [payables, setPayables] = useState<{ code: string; name: string } | null>(null)

  useEffect(() => {
    if (supplierName === undefined) return
    let cancelled = false
    apiCall<{ status: string; data?: { payables: { code: string; name: string } | null } }>("/finance/payment-sources", "GET")
      .then((r) => { if (!cancelled) setPayables(r?.data?.payables ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [supplierName])

  const source = sourceOfMethod(method)
  const card = (key: "petty_cash" | "prime_bank", title: string, Icon: typeof Wallet) => {
    const active = source === key
    return (
      <button
        type="button"
        onClick={() => {
          if (key === "petty_cash") onMethodChange("cash")
          else if (source !== "prime_bank") onMethodChange(defaultBankMethod)
        }}
        className={cn(
          "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
          active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
        <span className="text-sm font-medium">{title}</span>
      </button>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Paid from *</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {card("petty_cash", "Petty Cash / Cash at Hand", Wallet)}
          {card("prime_bank", "Prime Bank", Landmark)}
        </div>
      </div>
      {source === "prime_bank" && (
        <div className="space-y-2 sm:max-w-[50%] sm:pr-1.5">
          <Label className="text-sm font-medium">Paid by *</Label>
          <Select value={bankMethods.includes(method) ? method : defaultBankMethod} onValueChange={onMethodChange}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bankMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {METHOD_LABELS[m] || m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {supplierName !== undefined && payables && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span>
            Ledger account: <span className="font-medium text-foreground">{payables.name}</span>
            {supplierName ? ` - ${supplierName}` : ""} (the supplier's bill already carried the cost)
          </span>
        </div>
      )}
    </div>
  )
}
