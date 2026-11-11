"use client"

// "Where it went": the sales behind one line's Sold figure in Stock Management - each NSK invoice,
// its customer, quantity and value - with links to open the invoice or the customer's statement.

import Link from "next/link"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { getInventoryReport } from "@/lib/reports"
import { displayDate } from "@/lib/date-format"
import { documentFileName, filePeriod, sessionCompanyName } from "@/lib/document-names"
import { History, Loader2 } from "lucide-react"

export interface LineSalesTarget {
  name: string
  product_id: string
  variant_id: string // a size, "none" (item without sizes) or "all" (a sized item, every size)
  date_from: string
  date_to: string
  price_list?: string
}

type Sale = {
  date: string
  invoice_date?: string | null
  reference_number: string
  reference_link?: string | null
  party?: string | null
  party_link?: string | null
  size?: string | null
  price_label?: string | null
  quantity: number
  unit_price: number
  value: number
}

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function LineSalesDialog({ target, onClose, onShowMovements }: { target: LineSalesTarget | null; onClose: () => void; onShowMovements: (t: LineSalesTarget) => void }) {
  const [rows, setRows] = useState<Sale[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!target) return
    let live = true
    setLoading(true)
    setError(null)
    getInventoryReport({
      type: "line_sales",
      product_id: target.product_id,
      variant_id: target.variant_id,
      date_from: target.date_from,
      date_to: target.date_to,
      price_list: target.price_list,
    })
      .then((resp) => live && setRows(Array.isArray(resp?.data) ? resp.data : []))
      .catch((e) => live && (setRows([]), setError(e?.message || "Could not load the sales for this item.")))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [target])

  const showSize = rows.some((r) => r.size)
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0)
  const totalValue = rows.reduce((s, r) => s + r.value, 0)
  const period = target ? `${displayDate(new Date(target.date_from))} to ${displayDate(new Date(target.date_to))}` : ""

  const exportRows = useTableExport(() => ({
    fileName: documentFileName([sessionCompanyName(), `${target?.name ?? ""} - where it went`, target ? filePeriod(target.date_from, target.date_to) : ""]),
    title: `${target?.name ?? ""}: where it went`,
    subtitle: period,
    headers: ["S/No.", "Date", "Invoice", "Customer", ...(showSize ? ["Size"] : []), "Price Code", "Quantity", "Unit Price (KES)", "Value (KES)"],
    rows: rows.map((r, i) => [
      i + 1,
      displayDate(new Date(r.date)),
      r.reference_number,
      r.party ?? "",
      ...(showSize ? [r.size ?? ""] : []),
      r.price_label ?? "",
      r.quantity,
      r.unit_price,
      r.value,
    ]),
    footer: [["", "Total", "", "", ...(showSize ? [""] : []), "", totalQty, "", Math.round(totalValue * 100) / 100]],
  }))

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{target?.name}: where it went</DialogTitle>
          <DialogDescription>
            Sales that took this stock, {period}
            {target?.price_list ? ` (price code ${target.price_list === "none" ? "none" : target.price_list})` : ""}. Click an invoice or customer to open it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => target && onShowMovements(target)}>
            <History className="mr-2 h-4 w-4" /> All movements of this item
          </Button>
          <ExportMenu onExport={exportRows} disabled={loading || rows.length === 0} />
        </div>
        <Table scroll="max-h-[60vh]">
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead className="w-12 text-center">S/No.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              {showSize && <TableHead>Size</TableHead>}
              <TableHead>Price Code</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Unit Price (KES)</TableHead>
              <TableHead className="text-right">Value (KES)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-red-600">{error}</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No sales took this stock in the period.</TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={`${r.reference_number}-${i}`}>
                  <TableCell className="text-center text-gray-700">{i + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{displayDate(new Date(r.date))}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.reference_link ? <Link href={r.reference_link} className="font-medium text-primary hover:underline">{r.reference_number}</Link> : r.reference_number}
                  </TableCell>
                  <TableCell>{r.party_link ? <Link href={r.party_link} className="text-primary hover:underline">{r.party}</Link> : r.party ?? "-"}</TableCell>
                  {showSize && <TableCell>{r.size ?? "-"}</TableCell>}
                  <TableCell>{r.price_label || "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.value)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {!loading && rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={showSize ? 6 : 5} className="font-semibold">
                  Total: {new Set(rows.map((r) => r.reference_number)).size} invoices, {new Set(rows.map((r) => r.party).filter(Boolean)).size} customers
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{totalQty.toLocaleString()}</TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">{money(totalValue)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </DialogContent>
    </Dialog>
  )
}
