"use client"

import { displayDate } from "@/lib/date-format"
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { BookOpen, Loader2, RefreshCw } from "lucide-react"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { getSupplierLedger, type SupplierLedger as Ledger } from "@/lib/suppliers"

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 08-Sept-26, as the client's Tally ledgers print dates.
const tallyDate = (date?: string | null) => {
  if (!date) return ""
  const d = new Date(date)
  if (isNaN(d.getTime())) return date
  return displayDate(d)
}

/**
 * The supplier's (or transporter's) ledger account from the books, in the Tally layout: Date,
 * Dr/Cr and Particulars (the other side of each double entry), Vch Type, Vch No, Debit, Credit,
 * opening balance first, then Total and Closing Balance with its side (Cr = we owe them).
 */
export function SupplierLedger({ supplierId, supplierName }: { supplierId: string; supplierName: string }) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [corrections, setCorrections] = useState(false)
  const [data, setData] = useState<Ledger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (period = { from, to, corrections }) => {
    setLoading(true)
    setError(null)
    try {
      setData(await getSupplierLedger(supplierId, period))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the ledger")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId])

  useEffect(() => { load({ from: "", to: "", corrections: false }) }, [load])

  const period = data?.date_from || data?.date_to
    ? `${data?.date_from ? tallyDate(data.date_from) : "Start"} to ${data?.date_to ? tallyDate(data.date_to) : "date"}`
    : "All time"

  // Same columns as on screen, Opening Balance first and Total / Closing Balance last.
  const onExport = useTableExport(() => {
    const l = data!
    return {
      fileName: `Ledger ${supplierName} ${new Date().toISOString().slice(0, 10)}`,
      title: `Ledger Account: ${supplierName}`,
      subtitle: period,
      headers: ["S/No", "Date", "Dr/Cr", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit"],
      moneyColumns: [6, 7],
      rows: [
        ["", l.date_from ? tallyDate(l.date_from) : "", l.opening_balance.side, "Opening Balance", "", "",
          l.opening_balance.side === "Dr" ? l.opening_balance.amount : null, l.opening_balance.side === "Cr" ? l.opening_balance.amount : null],
        ...l.rows.map((r, i) => [i + 1, tallyDate(r.date), r.side, r.particulars, r.voucher_type, r.voucher_no, r.debit || null, r.credit || null]),
      ],
      footer: [
        ["", "", "", "Total", "", "", totalDebit, totalCredit],
        ["", "", l.closing_balance.side, "Closing Balance", "", "",
          l.closing_balance.side === "Cr" ? l.closing_balance.amount : null, l.closing_balance.side === "Dr" ? l.closing_balance.amount : null],
      ],
    }
  })

  // Totals include the opening balance on its side, as Tally adds it in.
  const totalDebit = (data?.totals.debit ?? 0) + (data?.opening_balance.side === "Dr" ? data.opening_balance.amount : 0)
  const totalCredit = (data?.totals.credit ?? 0) + (data?.opening_balance.side === "Cr" ? data?.opening_balance.amount ?? 0 : 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Ledger (Double Entry)
          </span>
          {data && (
            <span className={`text-base ${data.closing_balance.side === "Cr" && data.closing_balance.amount > 0 ? "text-red-600" : "text-green-700"}`}>
              {money(data.closing_balance.amount)} {data.closing_balance.side}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="sl_from" className="text-xs">From</Label>
            <Input id="sl_from" type="date" className="h-8 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sl_to" className="text-xs">To</Label>
            <Input id="sl_to" type="date" className="h-8 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => load({ from, to, corrections })} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); load({ from: "", to: "", corrections }) }}>All Time</Button>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={corrections} onCheckedChange={(v) => { setCorrections(v); load({ from, to, corrections: v }) }} />
            Show edits &amp; reversals
          </label>
          <ExportMenu onExport={onExport} disabled={!data} />
        </div>

        {loading && !data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading ledger...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : data && (
          <>
            <p className="text-xs text-muted-foreground">
              {period} · {data.payable_accounts.join(", ") || "Accounts Payable"}. Debit: payments and debit notes (less owed). Credit: bills,
              delivery invoices and goods received (more owed). Particulars is the other side of each entry.
            </p>
            <div className="max-h-[520px] overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-gray-600">
                  <tr className="[&>th]:whitespace-nowrap [&>th]:border-b [&>th]:px-2 [&>th]:py-1.5">
                    <th className="text-left">S/No</th>
                    <th className="text-left">Date</th>
                    <th className="text-left">Dr/Cr</th>
                    <th className="text-left">Particulars</th>
                    <th className="text-left">Vch Type</th>
                    <th className="text-left">Vch No.</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-muted/40 font-semibold [&>td]:border-b [&>td]:px-2 [&>td]:py-1.5">
                    <td />
                    <td className="whitespace-nowrap">{tallyDate(data.date_from)}</td>
                    <td>{data.opening_balance.side}</td>
                    <td>Opening Balance</td>
                    <td />
                    <td />
                    <td className="text-right tabular-nums">{data.opening_balance.side === "Dr" ? money(data.opening_balance.amount) : ""}</td>
                    <td className="text-right tabular-nums">{data.opening_balance.side === "Cr" ? money(data.opening_balance.amount) : ""}</td>
                  </tr>
                  {data.rows.length === 0 && (
                    <tr><td colSpan={8} className="px-2 py-3 text-center text-muted-foreground">No entries in this period.</td></tr>
                  )}
                  {data.rows.map((r, i) => (
                    <tr key={r.id} className={`align-top [&>td]:border-b [&>td]:px-2 [&>td]:py-1.5 ${r.reversed ? "text-muted-foreground line-through" : ""}`}>
                      <td className="text-muted-foreground">{i + 1}</td>
                      <td className="whitespace-nowrap">{tallyDate(r.date)}</td>
                      <td>{r.side}</td>
                      <td className="min-w-[140px]">
                        <span className="font-semibold">{r.particulars}</span>
                        {r.other_accounts.length > 0 && <span className="block text-[10px] text-muted-foreground">{r.other_accounts.join(" · ")}</span>}
                      </td>
                      <td className="whitespace-nowrap">{r.voucher_type}</td>
                      <td className="whitespace-nowrap">{r.voucher_no}</td>
                      <td className="text-right tabular-nums font-medium">{r.debit ? money(r.debit) : ""}</td>
                      <td className="text-right tabular-nums font-medium">{r.credit ? money(r.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-bold">
                  <tr className="[&>td]:border-b [&>td]:px-2 [&>td]:py-1.5">
                    <td colSpan={6}>Total</td>
                    <td className="text-right tabular-nums">{money(totalDebit)}</td>
                    <td className="text-right tabular-nums">{money(totalCredit)}</td>
                  </tr>
                  <tr className="bg-muted/40 [&>td]:px-2 [&>td]:py-1.5">
                    <td />
                    <td />
                    <td>{data.closing_balance.side}</td>
                    <td colSpan={3}>Closing Balance</td>
                    {/* Tally writes the closing balance on the other column, the figure that balances the two. */}
                    <td className="text-right tabular-nums">{data.closing_balance.side === "Cr" ? money(data.closing_balance.amount) : ""}</td>
                    <td className="text-right tabular-nums">{data.closing_balance.side === "Dr" ? money(data.closing_balance.amount) : ""}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
