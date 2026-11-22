"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Filter, Search, Wallet, Landmark, Hourglass, Hash } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { getPayments, type Payment } from "@/lib/payments"
import { fetchCheques, type Cheque } from "@/lib/cheques"
import { orderRef } from "@/lib/order-ref"
import { displayDate } from "@/lib/date-format"
import { formatCurrency } from "@/lib/utils"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { PeriodFilter, inPeriod, periodLabel, presetPeriod, toDayKey, type Period } from "@/components/period-filter"
import { PaymentsTableSkeleton } from "./payments-table-skeleton"
import { receiptDate } from "./payments-table"

// Collections = all money collected from customers: completed receipts (cash, M-Pesa, bank and
// cheques that have matured and cleared) plus received cheques still in hand (pending - not yet
// matured or not yet cleared). An approved cheque already shows as its receipt, so only pending
// cheques are added; bounced and cancelled cheques, and failed or pending receipts, are left out.

type Kind = "receipt" | "cheque"

interface CollectionRow {
  id: string
  kind: Kind
  reference: string
  customer: string
  invoices: string
  method: string
  date: string // when collected (receipt date / cheque received date)
  maturity: string // cheques only
  amount: number
  status: string
}

function customerName(c?: { name?: string | null; business_name?: string | null } | null): string {
  return c?.business_name?.trim() || c?.name || "N/A"
}

function receiptRow(p: Payment): CollectionRow {
  return {
    id: `p-${p.id}`,
    kind: "receipt",
    reference: p.transaction_id || "N/A",
    customer: customerName(p.customer),
    invoices: orderRef(p.order as any) || "N/A",
    method: paymentMethodLabel(p.payment_method),
    date: receiptDate(p),
    maturity: "",
    amount: parseFloat(p.amount_paid) || 0,
    status: "Received",
  }
}

function chequeRow(c: Cheque, today: string): CollectionRow {
  const invoices = c.invoice_numbers?.length ? c.invoice_numbers.join(", ") : c.invoice?.invoice_number || "On account"
  const matured = toDayKey(c.maturity_date) <= today
  return {
    id: `c-${c.id}`,
    kind: "cheque",
    reference: c.cheque_number,
    customer: customerName(c.customer),
    invoices,
    method: `Cheque${c.bank_name ? ` - ${c.bank_name}` : ""}`,
    date: c.issue_date,
    maturity: c.maturity_date,
    amount: Number(c.amount) || 0,
    status: matured ? "Matured, not cleared" : "Not matured",
  }
}

const STATUS_CLASS: Record<string, string> = {
  Received: "bg-green-100 text-green-800",
  "Not matured": "bg-blue-100 text-blue-800",
  "Matured, not cleared": "bg-yellow-100 text-yellow-800",
}

export function CollectionsTable() {
  const { toast } = useToast()
  const { companyId } = useAuth()
  const [receipts, setReceipts] = useState<Payment[]>([])
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<"all" | Kind>("all")
  const [period, setPeriod] = useState<Period>(() => presetPeriod("this-month"))
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    setIsLoading(true)
    Promise.all([
      getPayments({ company_id: companyId, status: "completed" }),
      fetchCheques({ direction: "received", status: "pending" }),
    ])
      .then(([p, c]) => {
        if (cancelled) return
        setReceipts(p.filter((x) => x && x.status?.toLowerCase() === "completed"))
        setCheques(c)
      })
      .catch((err) => {
        if (!cancelled)
          toast({ title: "Could not load collections", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [companyId])

  const allRows = useMemo(() => {
    const today = toDayKey(new Date().toISOString())
    return [...receipts.map(receiptRow), ...cheques.map((c) => chequeRow(c, today))].sort((a, b) =>
      toDayKey(b.date).localeCompare(toDayKey(a.date))
    )
  }, [receipts, cheques])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows.filter(
      (r) =>
        (kind === "all" || r.kind === kind) &&
        inPeriod(r.date, period) &&
        (!q || [r.reference, r.customer, r.invoices, r.method].some((v) => v.toLowerCase().includes(q)))
    )
  }, [allRows, search, kind, period])

  useEffect(() => setCurrentPage(1), [search, kind, period, rowsPerPage])

  const received = rows.filter((r) => r.kind === "receipt")
  const inHand = rows.filter((r) => r.kind === "cheque")
  const receivedTotal = received.reduce((s, r) => s + r.amount, 0)
  const inHandTotal = inHand.reduce((s, r) => s + r.amount, 0)
  const total = receivedTotal + inHandTotal

  const handleExport = useTableExport(() => ({
    fileName: `collections-${period.from || "all"}-${period.to || "time"}`,
    title: "Collections",
    subtitle: periodLabel(period),
    headers: ["S/No", "Type", "Reference", "Customer", "Invoice #", "Method", "Date", "Maturity Date", "Amount", "Status"],
    rows: rows.map((r, i) => [
      i + 1,
      r.kind === "receipt" ? "Receipt" : "Cheque in hand",
      r.reference,
      r.customer,
      r.invoices,
      r.method,
      displayDate(r.date),
      r.maturity ? displayDate(r.maturity) : "-",
      r.amount,
      r.status,
    ]),
    footer: [
      ["", "", "", "Received", "", "", "", "", receivedTotal, `${received.length}`],
      ["", "", "", "Cheques in hand (not cleared)", "", "", "", "", inHandTotal, `${inHand.length}`],
      ["", "", "", "Total Collections", "", "", "", "", total, `${rows.length}`],
    ],
    moneyColumns: [8],
  }))

  if (isLoading) return <PaymentsTableSkeleton />

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage))
  const start = (currentPage - 1) * rowsPerPage
  const pageRows = rows.slice(start, start + rowsPerPage)

  const cards = [
    { title: "Total Collections", value: formatCurrency(total), note: `${periodLabel(period)} · received + cheques in hand`, icon: Wallet },
    { title: "Received", value: formatCurrency(receivedTotal), note: `${received.length} completed receipts (incl. cleared cheques)`, icon: Landmark },
    { title: "Cheques in Hand", value: formatCurrency(inHandTotal), note: `${inHand.length} cheques not yet matured / cleared`, icon: Hourglass },
    { title: "Number", value: String(rows.length), note: "collections in this list", icon: Hash },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map(({ title, value, note, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-[#E30040]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input className="pl-8 max-w-sm" placeholder="Search collections..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <Filter className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Select value={kind} onValueChange={(v) => setKind(v as "all" | Kind)}>
              <SelectTrigger className="w-[200px] pl-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All collections</SelectItem>
                <SelectItem value="receipt">Received only</SelectItem>
                <SelectItem value="cheque">Cheques in hand only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
        <ExportMenu onExport={handleExport} disabled={rows.length === 0} />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] font-semibold">S/No</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Reference</TableHead>
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">Invoice #</TableHead>
              <TableHead className="font-semibold">Method</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Maturity Date</TableHead>
              <TableHead className="text-right font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  No collections in this period
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r, i) => (
                <TableRow key={r.id} className="hover:bg-[#E30040]/5">
                  <TableCell>{start + i + 1}</TableCell>
                  <TableCell>{r.kind === "receipt" ? "Receipt" : "Cheque in hand"}</TableCell>
                  <TableCell className="font-medium">{r.reference}</TableCell>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell>{r.invoices}</TableCell>
                  <TableCell>{r.method}</TableCell>
                  <TableCell>{displayDate(r.date)}</TableCell>
                  <TableCell>{r.maturity ? displayDate(r.maturity) : "-"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_CLASS[r.status] ?? "bg-gray-100 text-gray-800"}>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
            {rows.length > 0 && (
              <TableRow className="bg-gray-50 font-semibold">
                <TableCell colSpan={8}>Total Collections ({rows.length})</TableCell>
                <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select value={rowsPerPage.toString()} onValueChange={(v) => setRowsPerPage(Number(v))}>
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[20, 50, 250, 100000].map((n) => (
                <SelectItem key={n} value={n.toString()}>
                  {n === 100000 ? "All" : n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="text-sm font-medium">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
