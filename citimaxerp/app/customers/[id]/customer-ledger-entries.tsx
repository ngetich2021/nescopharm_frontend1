"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
 * credit sides), and their receivable balance after each entry.
 */
export function CustomerLedgerEntries({ customerId }: { customerId: string }) {
  const [data, setData] = useState<CustomerLedger | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const load = useCallback(async (from = dateFrom, to = dateTo) => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await fetchCustomerLedger(customerId, { date_from: from, date_to: to }))
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
    <Card>
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
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S/No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry / Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Customer Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dateFrom && (
                    <TableRow>
                      <TableCell />
                      <TableCell>{formatDate(dateFrom)}</TableCell>
                      <TableCell colSpan={4} className="font-medium">Opening balance</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(data.opening_balance)}</TableCell>
                    </TableRow>
                  )}
                  {data.entries.map((entry, idx) => (
                    <Fragment key={entry.id}>
                      <TableRow className="bg-muted/40">
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell className="whitespace-nowrap">{entry.date ? formatDate(entry.date) : "—"}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {entry.entry_number}
                          {entry.reference && <span className="text-muted-foreground font-normal"> • {entry.reference}</span>}
                          <span className="ml-2 inline-flex gap-1">
                            {entry.transaction_type && ENTRY_TYPE_LABELS[entry.transaction_type] && (
                              <Badge variant="outline" className="text-[10px]">{ENTRY_TYPE_LABELS[entry.transaction_type]}</Badge>
                            )}
                            {entry.status === "reversed" && <Badge variant="secondary" className="text-[10px]">Reversed</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{entry.description}</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right font-medium">{formatCurrency(entry.balance)}</TableCell>
                      </TableRow>
                      {entry.lines.map((line, li) => (
                        <TableRow key={`${entry.id}-${li}`} className="text-sm">
                          <TableCell />
                          <TableCell />
                          <TableCell className={line.credit > 0 && line.debit <= 0 ? "pl-10" : "pl-4"}>
                            <span className="font-mono text-xs text-muted-foreground mr-1">{line.account_code}</span>
                            {line.account_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{line.description}</TableCell>
                          <TableCell className="text-right font-mono">{amount(line.debit)}</TableCell>
                          <TableCell className="text-right font-mono">{amount(line.credit)}</TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-medium">Totals</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(data.totals.debit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(data.totals.credit)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(data.totals.closing_balance)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Customer Balance is what the customer owes on {receivable || "Accounts Receivable"} after each entry (negative: in the customer&apos;s favour).
              Reversed entries stay listed with the reversal that cancels them.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
