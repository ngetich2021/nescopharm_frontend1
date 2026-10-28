"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { BookOpen, RefreshCw } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CustomerLedger, fetchCustomerLedger } from "@/lib/customer-balance"

const ENTRY_TYPE_LABELS: Record<string, string> = {
  sales_invoice: "Invoice",
  customer_payment: "Receipt",
  customer_refund: "Refund",
  credit_note: "Credit Note",
  credit_note_refund: "Credit Refund",
  reversal: "Reversal",
}

const amount = (n: number) => (n > 0.005 ? formatCurrency(n) : "")

/**
 * The customer's double entries: each journal entry touching them with every line (debit and
 * credit sides), and their receivable balance after each entry. Laid out as stacked blocks so it
 * reads in the narrow profile sheet as well as full width.
 */
export function CustomerLedgerEntries({ customerId }: { customerId: string }) {
  const [data, setData] = useState<CustomerLedger | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  // Entries replaced when a document was edited, and their reversals: they cancel out.
  const [showCorrections, setShowCorrections] = useState(false)

  const load = useCallback(async (from = dateFrom, to = dateTo, corrections = showCorrections) => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await fetchCustomerLedger(customerId, { date_from: from, date_to: to, hide_corrections: !corrections }))
    } catch (err: any) {
      setError(err.message || "Failed to load ledger entries")
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  useEffect(() => {
    if (customerId) load()
  }, [customerId, load])

  const glLink = `/finance/general-ledger?customer_id=${customerId}${dateFrom ? `&date_from=${dateFrom}` : ""}${dateTo ? `&date_to=${dateTo}` : ""}`
  const receivable = data?.receivable_accounts.map((a) => `${a.code} ${a.name}`).join(", ")

  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-3">
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Ledger Entries (Double Entry)
          </CardTitle>
          <Link href={glLink}>
            <Button variant="outline" size="sm">Open in General Ledger</Button>
          </Link>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="cl_from" className="text-xs">From</Label>
            <Input id="cl_from" type="date" className="h-8 w-[150px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cl_to" className="text-xs">To</Label>
            <Input id="cl_to" type="date" className="h-8 w-[150px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => load()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> Apply
          </Button>
          <Button variant="ghost" size="sm" disabled={isLoading} onClick={() => { setDateFrom(""); setDateTo(""); load("", "") }}>
            All Time
          </Button>
          <div className="flex items-center gap-2 h-8">
            <Switch
              id="cl_corrections"
              checked={showCorrections}
              onCheckedChange={(v) => { setShowCorrections(v); load(dateFrom, dateTo, v) }}
            />
            <Label htmlFor="cl_corrections" className="text-xs">Show edits &amp; reversals</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : isLoading && !data ? (
          <p className="text-sm text-muted-foreground">Loading ledger entries...</p>
        ) : !data || data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ledger entries for this customer{dateFrom || dateTo ? " in this period" : ""}.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span>Opening balance{dateFrom ? ` (${formatDate(dateFrom)})` : ""}</span>
              <span className="font-medium">{formatCurrency(data.opening_balance)}</span>
            </div>

            {data.entries.map((entry, idx) => (
              <div key={entry.id} className={`rounded-md border ${entry.status === "reversed" ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b bg-muted/40 px-3 py-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="text-muted-foreground">{idx + 1}.</span>
                      <span className="whitespace-nowrap">{entry.date ? formatDate(entry.date) : "—"}</span>
                      <span className="font-semibold">{entry.reference || entry.entry_number}</span>
                      {entry.transaction_type && ENTRY_TYPE_LABELS[entry.transaction_type] && (
                        <Badge variant="outline" className="text-[10px]">{ENTRY_TYPE_LABELS[entry.transaction_type]}</Badge>
                      )}
                      {entry.status === "reversed" && <Badge variant="secondary" className="text-[10px]">Reversed</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground break-words">
                      {entry.description}
                      {entry.reference && entry.reference !== entry.entry_number && <> · {entry.entry_number}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Customer balance</p>
                    <p className="text-sm font-semibold whitespace-nowrap">{formatCurrency(entry.balance)}</p>
                  </div>
                </div>

                <div className="px-3 py-1.5 text-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <span>Account</span>
                    <span className="w-28 text-right">Debit</span>
                    <span className="w-28 text-right">Credit</span>
                  </div>
                  {entry.lines.map((line, li) => (
                    <div key={li} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 py-1 border-t border-dashed first:border-t-0">
                      <span className={`min-w-0 break-words ${line.credit > 0 && line.debit <= 0 ? "pl-6" : ""}`}>
                        <span className="font-mono text-xs text-muted-foreground mr-1">{line.account_code}</span>
                        {line.account_name}
                      </span>
                      <span className="w-28 text-right font-mono whitespace-nowrap">{amount(line.debit)}</span>
                      <span className="w-28 text-right font-mono whitespace-nowrap">{amount(line.credit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 rounded-md bg-muted/50 px-3 py-2 text-sm font-medium">
              <span>Totals</span>
              <span className="w-28 text-right font-mono whitespace-nowrap">{formatCurrency(data.totals.debit)}</span>
              <span className="w-28 text-right font-mono whitespace-nowrap">{formatCurrency(data.totals.credit)}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">Closing balance</span>
              <span className="font-semibold">{formatCurrency(data.totals.closing_balance)}</span>
            </div>

            <p className="text-xs text-muted-foreground">
              Customer balance is what the customer owes on {receivable || "Accounts Receivable"} after each entry (negative: in the customer&apos;s favour).
              {!showCorrections && data.hidden_corrections > 0 && (
                <> {data.hidden_corrections} entries from edited documents (each with the reversal that cancels it) are hidden; balances are unchanged.</>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
