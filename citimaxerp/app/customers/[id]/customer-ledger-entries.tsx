"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { BookOpen, RefreshCw } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CustomerLedger, fetchCustomerLedger } from "@/lib/customer-balance"

// Compact cells for the profile sheet: amounts without the currency (it's in the column header)
// and dd/mm/yy dates.
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shortDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })

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

  // Each entry as one row on the customer's receivable, with the other side named underneath.
  const receivableIds = new Set(data?.receivable_accounts.map((a) => a.id) ?? [])
  const rows = (data?.entries ?? []).map((entry) => {
    const own = entry.lines.filter((l) => l.is_customer_line && receivableIds.has(l.account_id))
    const debit = own.reduce((s, l) => s + l.debit, 0)
    const credit = own.reduce((s, l) => s + l.credit, 0)
    // Kept short to fit the profile sheet: amounts only when the other side is split (e.g. Sales + VAT).
    const otherLines = entry.lines.filter((l) => !own.includes(l))
    const others = otherLines
      .map((l) => `${l.debit > 0 ? "Dr" : "Cr"} ${l.account_code ?? ""} ${l.account_name ?? ""}${otherLines.length > 1 ? ` ${money(l.debit || l.credit)}` : ""}`.replace(/\s+/g, " "))
      .join(" · ")
    // The reference has its own column, so drop it from the description.
    const ref = entry.reference || entry.entry_number
    const description = (entry.description ?? "").replace(ref, "").replace(/\s{2,}/g, " ").replace(/\s+[-:·]?\s*$/, "").trim() || entry.description
    return { entry, debit, credit, others, ref, description }
  })
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)

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
            {/* Same layout as the General Ledger's account view: one row per entry, the debit or
                credit on the customer's receivable, and the running balance. The other side of
                each double entry is listed under its description. */}
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-semibold">{receivable || "Accounts Receivable"}</p>
                <p className="text-xs text-muted-foreground">Opening Balance: {formatCurrency(data.opening_balance)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(data.totals.closing_balance)}</p>
                <p className="text-xs text-muted-foreground">Closing Balance</p>
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="[&>th]:h-8 [&>th]:px-2">
                    <TableHead className="w-8">S/No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit (Ksh)</TableHead>
                    <TableHead className="text-right">Credit (Ksh)</TableHead>
                    <TableHead className="text-right">Balance (Ksh)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ entry, debit, credit, others, ref, description }, idx) => (
                    <TableRow key={entry.id} className={`[&>td]:px-2 [&>td]:py-1.5 ${entry.status === "reversed" ? "text-muted-foreground" : ""}`}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">{entry.date ? shortDate(entry.date) : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{ref}</TableCell>
                      <TableCell className="min-w-[140px]">
                        <span>{description}</span>
                        {entry.status === "reversed" && <Badge variant="secondary" className="ml-1 px-1 py-0 text-[9px]">Reversed</Badge>}
                        {others && <p className="text-[10px] leading-tight text-muted-foreground">{others}</p>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{debit > 0.005 ? money(debit) : "-"}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{credit > 0.005 ? money(credit) : "-"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium whitespace-nowrap">{money(entry.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t pt-2 text-xs text-center">
              <div>
                <p className="font-medium">Total Debits</p>
                <p className="tabular-nums">{formatCurrency(totalDebit)}</p>
              </div>
              <div>
                <p className="font-medium">Total Credits</p>
                <p className="tabular-nums">{formatCurrency(totalCredit)}</p>
              </div>
              <div>
                <p className="font-medium">Net Change</p>
                <p className="tabular-nums">{formatCurrency(totalDebit - totalCredit)}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Running Balance is what the customer owes after each entry (negative: in the customer&apos;s favour). The line under each description is the other side of the double entry.
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
