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
    const others = entry.lines
      .filter((l) => !own.includes(l))
      .map((l) => `${l.debit > 0 ? "Dr" : "Cr"} ${l.account_code ?? ""} ${l.account_name ?? ""} ${formatCurrency(l.debit || l.credit)}`.replace(/\s+/g, " "))
      .join(" · ")
    return { entry, debit, credit, others }
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
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">S/No</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Running Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ entry, debit, credit, others }, idx) => (
                    <TableRow key={entry.id} className={entry.status === "reversed" ? "text-muted-foreground" : ""}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">{entry.date ? formatDate(entry.date) : "—"}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{entry.reference || entry.entry_number}</TableCell>
                      <TableCell>
                        <span className="break-words">{entry.description}</span>
                        {entry.status === "reversed" && <Badge variant="secondary" className="ml-2 text-[10px]">Reversed</Badge>}
                        {others && <p className="text-[11px] text-muted-foreground">{others}</p>}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">{debit > 0.005 ? formatCurrency(debit) : "-"}</TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">{credit > 0.005 ? formatCurrency(credit) : "-"}</TableCell>
                      <TableCell className="text-right font-mono font-medium whitespace-nowrap">{formatCurrency(entry.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t pt-3 text-sm text-center">
              <div>
                <p className="font-medium">Total Debits</p>
                <p className="font-mono">{formatCurrency(totalDebit)}</p>
              </div>
              <div>
                <p className="font-medium">Total Credits</p>
                <p className="font-mono">{formatCurrency(totalCredit)}</p>
              </div>
              <div>
                <p className="font-medium">Net Change</p>
                <p className="font-mono">{formatCurrency(totalDebit - totalCredit)}</p>
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
