"use client"

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { format, startOfMonth, startOfWeek } from "date-fns"
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Coins, Loader2, Percent, RefreshCw, Search, ShoppingCart, TrendingUp } from "lucide-react"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TablePager, usePaged } from "@/components/ui/table-pager"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { useToast } from "@/hooks/use-toast"
import { displayDate } from "@/lib/date-format"
import { getProfitReport, type ProfitCredit, type ProfitLine, type ProfitReport } from "@/lib/profit-report"
import { updateProduct } from "@/lib/products"

const iso = (d: Date) => format(d, "yyyy-MM-dd")
const kes = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (s?: string) => (s ? displayDate(new Date(`${s}T00:00:00`)) : "")
const NO_CODE = "No price code"
const SOURCES: Record<ProfitLine["cost_source"], string> = {
  dispatch: "Dispatched batch",
  batch: "Batch cost (avg)",
  cost_price: "Cost Price",
  none: "No cost",
}

/** Profit % = profit ÷ cost × 100 (the user's definition). Null without a cost. */
const pct = (profit: number, cost: number) => (cost > 0 ? Math.round((profit / cost) * 1000) / 10 : null)
const pctText = (p: number | null) => (p === null ? "—" : `${p.toLocaleString("en-KE", { maximumFractionDigits: 1 })}%`)

function PctBadge({ p }: { p: number | null }) {
  if (p === null) return <span className="text-muted-foreground">—</span>
  const cls = p < 0 ? "bg-red-100 text-red-800" : p < 15 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
  return <Badge className={`${cls} tabular-nums`}>{pctText(p)}</Badge>
}

type View = "list" | "product" | "lines"
type Group = { key: string; name: string; sub?: string; lines: number; quantity: number; sales: number; cost: number; costedSales: number; uncosted: number; profit: number; pct: number | null }

/** Sums lines into a group. Profit = total value - cost value; lines with no cost recorded count at cost 0 and are flagged. */
function summarise(key: string, name: string, rows: ProfitLine[], sub?: string): Group {
  const costed = rows.filter((r) => r.cost !== null)
  const sales = rows.reduce((s, r) => s + r.sales, 0)
  const cost = costed.reduce((s, r) => s + (r.cost ?? 0), 0)
  const costedSales = costed.reduce((s, r) => s + r.sales, 0)
  const profit = sales - cost // TV - CV
  return { key, name, sub, lines: rows.length, quantity: rows.reduce((s, r) => s + r.quantity, 0), sales, cost, costedSales, uncosted: rows.length - costed.length, profit, pct: pct(profit, cost) }
}

/**
 * Reports > Profit: sales from the go-live date on at the invoice price (negotiated prices included),
 * against the buying cost of the batches the goods left from. By price list, by product, or line by
 * line; Profit % = profit ÷ cost × 100. Tables scroll in a screen-high box, so the sideways scrollbar
 * is always in view.
 */
export default function ProfitReportPage() {
  const { toast } = useToast()
  const [from, setFrom] = useState(() => iso(startOfMonth(new Date())))
  const [to, setTo] = useState(() => iso(new Date()))
  const [data, setData] = useState<ProfitReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>("list")
  const [search, setSearch] = useState("")
  const [list, setList] = useState("all")
  const [source, setSource] = useState("all")
  const [sortKey, setSortKey] = useState("sales")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  // Credit notes and the Net line show only when switched on (as on Stock Management); every visit starts with them hidden.
  const [showCredit, setShowCredit] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      setData(await getProfitReport({ date_from: from, date_to: to }))
    } catch (e: any) {
      toast({ title: "Could not load the profit report", description: e?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [from, to, toast])

  useEffect(() => { load() }, [load])
  // Lines that just got a cost drop out of the No-cost list: reload in place, without the table spinner.
  const reloadQuietly = useCallback(() => load(true), [load])

  const preset = (p: string) => {
    const today = new Date()
    if (p === "today") { setFrom(iso(today)); setTo(iso(today)) }
    if (p === "week") { setFrom(iso(startOfWeek(today, { weekStartsOn: 1 }))); setTo(iso(today)) }
    if (p === "month") { setFrom(iso(startOfMonth(today))); setTo(iso(today)) }
  }

  const lists = useMemo(() => Array.from(new Set((data?.lines ?? []).map((l) => l.price_list ?? NO_CODE))).sort(), [data])

  // Lines after the filters; every view, total and export follows them.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.lines ?? []).filter((l) =>
      (list === "all" || (l.price_list ?? NO_CODE) === list)
      && (source === "all" || l.cost_source === source)
      && (!q || [l.description, l.price_code, l.invoice_number, l.customer].some((v) => (v || "").toLowerCase().includes(q))))
  }, [data, search, list, source])

  const groups = useMemo<Group[]>(() => {
    const by = new Map<string, ProfitLine[]>()
    for (const l of filtered) {
      const key = view === "list" ? (l.price_list ?? NO_CODE) : (l.product_id ?? l.description)
      by.set(key, [...(by.get(key) ?? []), l])
    }
    return Array.from(by.entries()).map(([key, rows]) => view === "list"
      ? summarise(key, key, rows)
      : summarise(key, rows[0].description, rows, Array.from(new Set(rows.map((r) => r.price_code).filter(Boolean))).join(", ")))
  }, [filtered, view])

  const sorted = useMemo(() => {
    const val = (r: any) => r[sortKey]
    const rows: any[] = view === "lines"
      ? filtered.map((l) => ({ ...l, profit: l.sales - (l.cost ?? 0), pct: l.cost === null ? null : pct(l.sales - l.cost, l.cost) }))
      : groups
    return [...rows].sort((a, b) => {
      const av = val(a), bv = val(b)
      const cmp = typeof av === "string" || typeof bv === "string"
        ? String(av ?? "").localeCompare(String(bv ?? ""), undefined, { sensitivity: "base" })
        : (av ?? -Infinity) - (bv ?? -Infinity)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, groups, view, sortKey, sortDir])

  const totals = useMemo(() => summarise("all", "Total", filtered), [filtered])

  // Credit notes dated in the range, deducted at the end (they follow the price list and search filters).
  // Credited lines with no cost anywhere come off sales but stay out of profit, as sales without a cost do.
  const credits = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows: ProfitCredit[] = (data?.credits ?? []).filter((c) =>
      (list === "all" || (c.price_list ?? NO_CODE) === list)
      && (!q || [c.description, c.price_code, c.invoice_number, c.credit_note_number, c.customer].some((v) => (v || "").toLowerCase().includes(q))))
    const costed = rows.filter((c) => c.cost !== null)
    const amount = rows.reduce((s, c) => s + c.amount, 0)
    const cost = costed.reduce((s, c) => s + (c.cost ?? 0), 0)
    const profit = amount - cost // TV - CV
    return {
      rows, amount, cost, profit,
      quantity: rows.reduce((s, c) => s + c.quantity, 0),
      uncosted: rows.filter((c) => c.cost === null).reduce((s, c) => s + c.amount, 0),
      numbers: Array.from(new Set(rows.map((c) => c.credit_note_number))),
    }
  }, [data, search, list])
  const net = useMemo(() => {
    const sales = totals.sales - credits.amount
    const cost = totals.cost - credits.cost
    const profit = totals.profit - credits.profit
    return { sales, cost, profit, pct: pct(profit, cost) }
  }, [totals, credits])
  // What the cards show: after credit notes when they are switched on, else the invoiced figures.
  const shownTotals = showCredit ? net : { sales: totals.sales, cost: totals.cost, profit: totals.profit, pct: totals.pct }
  const creditLabel = credits.numbers.length ? `Less credit notes (${credits.numbers.join(", ")})` : "Less credit notes (none in this range)"
  const totalLabel = showCredit ? "Gross" : "Total"
  const { pageRows, start, pager } = usePaged(sorted, 50, `${view}|${search}|${list}|${source}|${from}|${to}|${sortKey}|${sortDir}`)

  const toggleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir(["name", "description", "invoice_number", "customer", "price_code", "invoice_date"].includes(key) ? "asc" : "desc") }
  }
  const changeView = (v: string) => {
    setView(v as View)
    setSortKey(v === "lines" ? "invoice_date" : "sales")
    setSortDir(v === "lines" ? "asc" : "desc")
  }

  const range = from === to ? dmy(from) : `${dmy(from)} to ${dmy(to)}`
  const viewName = view === "list" ? "By price list" : view === "product" ? "By product" : "Invoice lines"
  const exportReport = useTableExport(() => {
    if (view === "lines") {
      const rows = sorted as (ProfitLine & { profit: number | null; pct: number | null })[]
      return {
        fileName: `profit-invoice-lines-${from}-to-${to}`,
        title: "Profit - Invoice Lines",
        subtitle: range,
        headers: ["S/No", "Invoice", "Date", "Customer", "Item", "Price Code", "Qty", "Per", "Rate", "Total Value", "Cost Value", "Profit (TV - CV)", "Profit %", "Cost From"],
        moneyColumns: [8, 9, 10, 11],
        rows: rows.map((r, i) => [i + 1, r.invoice_number, dmy(r.invoice_date), r.customer ?? "", r.description, r.price_code ?? "", r.quantity, r.unit, r.unit_price, r.sales, r.cost, r.profit, pctText(r.pct), SOURCES[r.cost_source]]),
        footer: [
          ["", totalLabel, "", "", "", "", totals.quantity, "", "", totals.sales, totals.cost, totals.profit, pctText(totals.pct), ""],
          ...(!showCredit ? [] : [
            ["", creditLabel, "", "", "", "", -credits.quantity, "", "", -credits.amount, -credits.cost, -credits.profit, "", ""],
            ["", "Net (after credit notes)", "", "", "", "", totals.quantity - credits.quantity, "", "", net.sales, net.cost, net.profit, pctText(net.pct), ""],
          ]),
        ],
      }
    }
    const rows = sorted as Group[]
    return {
      fileName: `profit-${view === "list" ? "by-price-list" : "by-product"}-${from}-to-${to}`,
      title: `Profit - ${viewName}`,
      subtitle: range,
      headers: ["S/No", view === "list" ? "Price List" : "Item", ...(view === "product" ? ["Price Codes"] : []), "Lines", "Qty", "Total Value", "Cost Value", "Profit (TV - CV)", "Profit %"],
      moneyColumns: view === "product" ? [5, 6, 7] : [4, 5, 6],
      rows: rows.map((r, i) => [i + 1, r.name, ...(view === "product" ? [r.sub ?? ""] : []), r.lines, r.quantity, r.sales, r.cost, r.profit, pctText(r.pct)]),
      footer: [
        ["", totalLabel, ...(view === "product" ? [""] : []), totals.lines, totals.quantity, totals.sales, totals.cost, totals.profit, pctText(totals.pct)],
        ...(!showCredit ? [] : [
          ["", creditLabel, ...(view === "product" ? [""] : []), "", -credits.quantity, -credits.amount, -credits.cost, -credits.profit, ""],
          ["", "Net (after credit notes)", ...(view === "product" ? [""] : []), "", totals.quantity - credits.quantity, net.sales, net.cost, net.profit, pctText(net.pct)],
        ]),
      ],
    }
  })

  const Sortable = ({ k, label, right }: { k: string; label: string; right?: boolean }) => (
    <TableHead className={`whitespace-nowrap ${right ? "text-right" : ""}`}>
      <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${right ? "flex-row-reverse" : ""}`}>
        {label}
        {sortKey !== k ? <ArrowUpDown className="h-3.5 w-3.5 opacity-40" /> : sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      </button>
    </TableHead>
  )
  const money = (n: number | null) => (n === null ? <span className="text-muted-foreground">—</span> : kes(n))
  const cols = view === "lines" ? 14 : view === "product" ? 9 : 8

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profit</h1>
            <p className="text-muted-foreground">
              Total value (TV) is each invoice line as billed, after discount, including VAT - a month's TV is its Sales Accounts total.
              Cost value (CV) is what the goods cost. Profit = TV − CV; Profit % = profit ÷ CV × 100.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
              <Switch checked={showCredit} onCheckedChange={setShowCredit} aria-label="Show credit notes and Net" />
              Credit notes &amp; Net
            </label>
            <Button variant="outline" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <ExportMenu onExport={exportReport} size="default" disabled={loading || filtered.length === 0} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Stat icon={<ShoppingCart className="h-5 w-5" />} tone="bg-blue-100 text-blue-700" label={showCredit ? "Net total value (incl. VAT)" : "Total value (incl. VAT)"} value={`KES ${kes(shownTotals.sales)}`} />
          <Stat icon={<Coins className="h-5 w-5" />} tone="bg-slate-100 text-slate-600" label={showCredit ? "Net cost value" : "Cost value"} value={`KES ${kes(shownTotals.cost)}`} />
          <Stat icon={<TrendingUp className="h-5 w-5" />} tone="bg-emerald-100 text-emerald-700" label={showCredit ? "Net profit (after credit notes)" : "Profit (before credit notes)"} value={`KES ${kes(shownTotals.profit)}`} />
          <Stat icon={<Percent className="h-5 w-5" />} tone="bg-rose-100 text-rose-700" label="Profit % (on cost)" value={pctText(shownTotals.pct)} />
        </div>

        {data && <NoCostPanel lines={data.lines} credits={showCredit ? data.credits : []} onFixed={reloadQuietly} />}

        {showCredit && credits.rows.length > 0 && (
          <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            {credits.numbers.join(", ")} (credit {credits.numbers.length === 1 ? "note" : "notes"} dated in this range) {credits.numbers.length === 1 ? "is" : "are"} deducted at the end of the table:
            KES {kes(credits.amount)} credited comes off sales and KES {kes(credits.cost)} cost of the goods back comes off cost.
            {credits.uncosted > 0 && ` KES ${kes(credits.uncosted)} of it is on items with no cost recorded, so it comes off profit in full - set their Cost Price to correct it.`}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{viewName} · {range}</CardTitle>
            <CardDescription>
              Cost is what the stock cost in the batches it left from on the dispatch; else the item&apos;s batch cost, else its Cost Price.
              Click a column to sort. Totals and Export follow the filters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={view} onValueChange={changeView}>
              <TabsList>
                <TabsTrigger value="list">By Price List</TabsTrigger>
                <TabsTrigger value="product">By Product</TabsTrigger>
                <TabsTrigger value="lines">Invoice Lines</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Range</Label>
                <Select onValueChange={preset}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This week</SelectItem>
                    <SelectItem value="month">This month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-[160px]" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Price list</Label>
                <Select value={list} onValueChange={setList}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {lists.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cost from</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {Object.entries(SOURCES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1 min-w-[220px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <Search className="absolute left-3 bottom-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Item, price code (NSPH 067), NSK no., customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            {from < (data?.earliest ?? "") && (
              <p className="text-xs text-muted-foreground">Sales before {dmy(data?.earliest)} never moved stock, so their cost is the item&apos;s batch cost or Cost Price (see Cost From).</p>
            )}

            {/* Scrolls inside a screen-high box with the heading pinned: the sideways scrollbar is always in view. */}
            <Table scroll>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">S/No</TableHead>
                  {view === "lines" ? (
                    <>
                      <Sortable k="invoice_number" label="Invoice" />
                      <Sortable k="invoice_date" label="Date" />
                      <Sortable k="customer" label="Customer" />
                      <Sortable k="description" label="Item" />
                      <Sortable k="price_code" label="Price Code" />
                      <Sortable k="quantity" label="Qty" right />
                      <TableHead>Per</TableHead>
                      <Sortable k="unit_price" label="Rate" right />
                    </>
                  ) : (
                    <>
                      <Sortable k="name" label={view === "list" ? "Price List" : "Item"} />
                      {view === "product" && <TableHead>Price Codes</TableHead>}
                      <Sortable k="lines" label="Lines" right />
                      <Sortable k="quantity" label="Qty" right />
                    </>
                  )}
                  <Sortable k="sales" label="Total Value (KES)" right />
                  <Sortable k="cost" label="Cost Value (KES)" right />
                  <Sortable k="profit" label="Profit (TV − CV)" right />
                  <Sortable k="pct" label="Profit %" right />
                  {view === "lines" && <Sortable k="cost_source" label="Cost From" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={cols} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
                ) : sorted.length === 0 ? (
                  <TableRow><TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">No sales match in this range.</TableCell></TableRow>
                ) : view === "lines" ? (
                  (pageRows as (ProfitLine & { profit: number | null; pct: number | null })[]).map((r, i) => (
                    <TableRow key={`${r.invoice_id}-${start + i}`}>
                      <TableCell className="text-muted-foreground">{start + i + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/sales/invoices/${r.invoice_id}`} className="text-primary hover:underline">{r.invoice_number}</Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{dmy(r.invoice_date)}</TableCell>
                      <TableCell className="min-w-[180px]">{r.customer ?? "—"}</TableCell>
                      <TableCell className="min-w-[220px] font-medium">{r.description}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.price_code ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity.toLocaleString()}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">{kes(r.unit_price)}</TableCell>
                      <TableCell className="text-right tabular-nums">{kes(r.sales)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(r.cost)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${r.profit !== null && r.profit < 0 ? "text-red-600" : ""}`}>{money(r.profit)}</TableCell>
                      <TableCell className="text-right"><PctBadge p={r.pct} /></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{SOURCES[r.cost_source]}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  (pageRows as Group[]).map((r, i) => (
                    <TableRow key={r.key}>
                      <TableCell className="text-muted-foreground">{start + i + 1}</TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="font-medium">{r.name}</div>
                        {r.uncosted > 0 && <div className="text-xs text-amber-700">{r.uncosted} line{r.uncosted === 1 ? "" : "s"} with no cost recorded (counted at 0)</div>}
                      </TableCell>
                      {view === "product" && <TableCell className="whitespace-nowrap text-sm">{r.sub || <span className="text-muted-foreground">—</span>}</TableCell>}
                      <TableCell className="text-right tabular-nums">{r.lines}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{kes(r.sales)}</TableCell>
                      <TableCell className="text-right tabular-nums">{kes(r.cost)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${r.profit < 0 ? "text-red-600" : ""}`}>{kes(r.profit)}</TableCell>
                      <TableCell className="text-right"><PctBadge p={r.pct} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {!loading && sorted.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={view === "lines" ? 6 : view === "product" ? 3 : 2} className="font-semibold">
                      {totalLabel} ({sorted.length} {view === "list" ? "price list" : view === "product" ? "item" : "line"}{sorted.length === 1 ? "" : "s"})
                    </TableCell>
                    {view !== "lines" && <TableCell className="text-right font-semibold tabular-nums">{totals.lines}</TableCell>}
                    <TableCell className="text-right font-semibold tabular-nums">{totals.quantity.toLocaleString()}</TableCell>
                    {view === "lines" && <><TableCell /><TableCell /></>}
                    <TableCell className="text-right font-semibold tabular-nums">{kes(totals.sales)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{kes(totals.cost)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{kes(totals.profit)}</TableCell>
                    <TableCell className="text-right"><PctBadge p={totals.pct} /></TableCell>
                    {view === "lines" && <TableCell />}
                  </TableRow>
                  {showCredit && (
                    <>
                      <TableRow>
                        <TableCell colSpan={view === "lines" ? 6 : view === "product" ? 3 : 2} className="text-muted-foreground">
                          {creditLabel}
                          {credits.uncosted > 0 && <span className="block text-xs text-amber-700">KES {kes(credits.uncosted)} on items with no cost recorded</span>}
                        </TableCell>
                        {view !== "lines" && <TableCell />}
                        <TableCell className="text-right tabular-nums text-red-600">-{credits.quantity.toLocaleString()}</TableCell>
                        {view === "lines" && <><TableCell /><TableCell /></>}
                        <TableCell className="text-right tabular-nums text-red-600">-{kes(credits.amount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">-{kes(credits.cost)}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">-{kes(credits.profit)}</TableCell>
                        <TableCell />
                        {view === "lines" && <TableCell />}
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={view === "lines" ? 6 : view === "product" ? 3 : 2} className="font-bold">Net (after credit notes)</TableCell>
                        {view !== "lines" && <TableCell />}
                        <TableCell className="text-right font-bold tabular-nums">{(totals.quantity - credits.quantity).toLocaleString()}</TableCell>
                        {view === "lines" && <><TableCell /><TableCell /></>}
                        <TableCell className="text-right font-bold tabular-nums">{kes(net.sales)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{kes(net.cost)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{kes(net.profit)}</TableCell>
                        <TableCell className="text-right"><PctBadge p={net.pct} /></TableCell>
                        {view === "lines" && <TableCell />}
                      </TableRow>
                    </>
                  )}
                </TableFooter>
              )}
            </Table>
            {!loading && <TablePager {...pager} />}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}

type NoCostDoc = { key: string; kind: "invoice" | "credit"; id: string; number: string; date: string; customer: string | null; quantity: number; unit: string; pieces: number | null; amount: number }
type NoCostItem = { key: string; productId: string | null; name: string; docs: NoCostDoc[]; pieces: number; amount: number }

/**
 * Every line in the range with no cost anywhere (no batch cost, no Cost Price), grouped by item and always
 * on show above the table. Expand an item to see the invoices (and credit notes, when shown) it is on, each
 * linked for corrections; type its Cost Price (per piece) and Save - the report reloads and the item drops
 * out once it has a cost. Lines not linked to a product can only be fixed on the invoice.
 */
function NoCostPanel({ lines, credits, onFixed }: { lines: ProfitLine[]; credits: ProfitCredit[]; onFixed: () => Promise<void> | void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [costs, setCosts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const items = useMemo<NoCostItem[]>(() => {
    const by = new Map<string, NoCostItem>()
    const add = (productId: string | null, name: string, doc: NoCostDoc) => {
      const key = productId ?? `name:${name}`
      const item = by.get(key) ?? { key, productId, name, docs: [], pieces: 0, amount: 0 }
      item.docs.push(doc)
      if (doc.kind === "invoice") { item.pieces += doc.pieces ?? doc.quantity; item.amount += doc.amount }
      by.set(key, item)
    }
    lines.forEach((l, i) => l.cost === null && add(l.product_id, l.description, {
      key: `i${i}`, kind: "invoice", id: l.invoice_id, number: l.invoice_number, date: l.invoice_date, customer: l.customer,
      quantity: l.quantity, unit: l.unit, pieces: l.pieces ?? null, amount: l.sales,
    }))
    credits.forEach((c, i) => c.cost === null && add(c.product_id, c.description, {
      key: `c${i}`, kind: "credit", id: c.credit_note_id, number: c.credit_note_number, date: c.date, customer: c.customer,
      quantity: c.quantity, unit: c.unit, pieces: null, amount: -c.amount,
    }))
    return Array.from(by.values()).sort((a, b) => b.amount - a.amount)
  }, [lines, credits])

  if (items.length === 0) return null
  const lineCount = items.reduce((s, it) => s + it.docs.length, 0)
  const amount = items.reduce((s, it) => s + it.amount, 0)
  const toggle = (key: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const save = async (item: NoCostItem) => {
    const value = Number(costs[item.key])
    if (!item.productId || !(value > 0)) {
      toast({ title: "Type the Cost Price", description: "Enter what one piece costs (more than 0), then Save.", variant: "destructive" })
      return
    }
    setSaving(item.key)
    try {
      const res = await updateProduct(item.productId, { unit_cost: value })
      if (res?.status === "error" || res?.status === "failed") throw new Error(res.message || "The Cost Price was not saved.")
      toast({ title: "Cost Price saved", description: `${item.name}: KES ${kes(value)} per piece. Its ${item.docs.length} line${item.docs.length === 1 ? " is" : "s are"} now costed.` })
      setCosts((prev) => { const next = { ...prev }; delete next[item.key]; return next })
      await onFixed()
    } catch (e: any) {
      toast({ title: "Could not save the Cost Price", description: e?.message || "Please try again.", variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-3 text-left text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span className="flex-1">
          <span className="font-semibold">{lineCount} line{lineCount === 1 ? "" : "s"} on {items.length} item{items.length === 1 ? "" : "s"} with no cost recorded</span>
          {" "}(no batch cost or Cost Price) - KES {kes(amount)} of sales counted at cost 0, which overstates profit.
          Expand an item to see its invoices, set its Cost Price and Save; it leaves this list once costed.
        </span>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
      </button>
      {open && (
        <div className="max-h-[480px] overflow-auto border-t border-amber-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-14">S/No</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead className="text-right">Pieces sold</TableHead>
                <TableHead className="text-right">Total Value (KES)</TableHead>
                <TableHead className="text-right">Sold at / piece</TableHead>
                <TableHead>Cost Price / piece (KES)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => {
                const isOpen = expanded.has(item.key)
                const perPiece = item.pieces > 0 ? item.amount / item.pieces : null
                return (
                  <Fragment key={item.key}>
                    <TableRow className="align-top">
                      <TableCell>
                        <button type="button" onClick={() => toggle(item.key)} aria-label={isOpen ? "Hide invoices" : "Show invoices"} className="rounded p-1 hover:bg-muted">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="min-w-[220px] font-medium">
                        {item.productId
                          ? <Link href={`/inventory/products/${item.productId}`} className="text-primary hover:underline">{item.name}</Link>
                          : item.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <button type="button" onClick={() => toggle(item.key)} className="text-primary hover:underline">{item.docs.length}</button>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{item.pieces.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{kes(item.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{perPiece === null ? "—" : kes(perPiece)}</TableCell>
                      <TableCell>
                        {item.productId ? (
                          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); save(item) }}>
                            <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" className="h-9 w-[140px] tabular-nums"
                              value={costs[item.key] ?? ""} onChange={(e) => setCosts((prev) => ({ ...prev, [item.key]: e.target.value }))} />
                            <Button type="submit" size="sm" disabled={saving !== null || !costs[item.key]}>
                              {saving === item.key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                            </Button>
                          </form>
                        ) : (
                          <span className="text-xs text-amber-800">Not linked to a product - open the invoice and pick the product on the line.</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={7} className="py-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-14">S/No</TableHead>
                                <TableHead>Document</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead>Per</TableHead>
                                <TableHead className="text-right">Pieces</TableHead>
                                <TableHead className="text-right">Total Value (KES)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {item.docs.map((d, j) => (
                                <TableRow key={d.key}>
                                  <TableCell className="text-muted-foreground">{j + 1}</TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Link href={d.kind === "invoice" ? `/sales/invoices/${d.id}` : `/sales/credit-notes/${d.id}`} className="text-primary hover:underline">{d.number}</Link>
                                    {d.kind === "credit" && <Badge variant="outline" className="ml-2">Credit note</Badge>}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">{dmy(d.date)}</TableCell>
                                  <TableCell className="min-w-[180px]">{d.customer ?? "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{d.quantity.toLocaleString()}</TableCell>
                                  <TableCell className="whitespace-nowrap">{d.unit}</TableCell>
                                  <TableCell className="text-right tabular-nums">{d.pieces === null ? "—" : d.pieces.toLocaleString()}</TableCell>
                                  <TableCell className={`text-right tabular-nums ${d.amount < 0 ? "text-red-600" : ""}`}>{kes(d.amount)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, tone, label, value }: { icon: ReactNode; tone: string; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      </CardContent>
    </Card>
  )
}
