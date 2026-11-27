"use client"

import { useEffect, useState } from "react"
import { Landmark, Wallet, BookOpen } from "lucide-react"
import apiCall from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const METHOD_LABELS: Record<string, string> = {
  cheque: "Cheque",
  check: "Cheque",
  bank_transfer: "Bank Transfer",
  mpesa: "M-Pesa",
  cash: "Cash",
}

type Source = "prime_bank" | "petty_cash"

/** Whether a payment method comes out of Petty Cash (cash) or Prime Bank (everything else). */
export const sourceOfMethod = (method?: string | null): Source =>
  !method || method === "cash" || method === "other" ? "petty_cash" : "prime_bank"

/** "Petty Cash" / "Prime Bank (Cheque)" for lists and exports. */
export function paidFromLabel(method?: string | null): string {
  if (sourceOfMethod(method) === "petty_cash") return "Petty Cash"
  return `Prime Bank (${METHOD_LABELS[method || ""] || String(method).replace(/_/g, " ")})`
}

interface PaymentSource { key: Source; code?: string | null; name?: string | null; balance: number }

/**
 * Who pays a supplier, in this order: first Paid from - Prime Bank or Petty Cash / Cash at Hand - then
 * Paid by, which follows that choice (Bank Transfer / Cheque / M-Pesa for the bank, Cash for petty cash).
 * Nothing is picked until the user picks (method ""), so the form must require it. The payment is posted
 * out of the account picked, so it shows in that account's book (Bank Book or Petty Cash). Each card names
 * its ledger account and balance. With `supplierName`, also says the debit side is the supplier's
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
  const [sources, setSources] = useState<PaymentSource[]>([])

  useEffect(() => {
    let cancelled = false
    apiCall<{ status: string; data?: { payables: { code: string; name: string } | null; paid_from?: PaymentSource[] } }>("/finance/payment-sources", "GET")
      .then((r) => {
        if (cancelled) return
        setPayables(r?.data?.payables ?? null)
        setSources(r?.data?.paid_from ?? [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Nothing picked yet when the method is empty.
  const source: Source | null = method ? sourceOfMethod(method) : null
  const account = source ? sources.find((s) => s.key === source) : undefined

  const card = (key: Source, title: string, Icon: typeof Wallet) => {
    const active = source === key
    const s = sources.find((x) => x.key === key)
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
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {s && (
            <span className="block text-xs text-muted-foreground truncate">
              {s.code ? `${s.code} ` : ""}{s.name} - Bal {formatCurrency(s.balance)}
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <Label className="text-sm font-medium">1. Paid from *</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {card("prime_bank", "Bank - Prime Bank", Landmark)}
          {card("petty_cash", "Petty Cash / Cash at Hand", Wallet)}
        </div>
        {!source && <p className="text-xs text-muted-foreground">Pick Bank or Petty Cash first.</p>}
      </div>
      {source && (
        <div className="space-y-2 sm:max-w-[50%] sm:pr-1.5">
          <Label className="text-sm font-medium">2. Paid by *</Label>
          {source === "prime_bank" ? (
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
          ) : (
            <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">Cash</div>
          )}
        </div>
      )}
      {source && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span>
            Comes out of{" "}
            <span className="font-medium text-foreground">
              {account ? `${account.code ? `${account.code} ` : ""}${account.name}` : source === "prime_bank" ? "Prime Bank" : "Petty Cash"}
            </span>{" "}
            and shows in its {source === "prime_bank" ? "Bank Book" : "Petty Cash book"}
            {method === "cheque" ? " once the cheque clears" : ""}
            {supplierName !== undefined && payables && (
              <>
                ; charged to <span className="font-medium text-foreground">{payables.name}</span>
                {supplierName ? ` - ${supplierName}` : ""} (the supplier's bill already carried the cost)
              </>
            )}
            .
          </span>
        </div>
      )}
    </div>
  )
}
