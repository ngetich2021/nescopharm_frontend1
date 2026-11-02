"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TablePager, usePaged } from "@/components/ui/table-pager"
import { ExportMenu } from "@/components/export-menu"
import { exportTable } from "@/lib/table-export"
import { getCustomerStats, type CustomerStats, type CustomerStatsRow } from "@/lib/reports"
import { useToast } from "@/hooks/use-toast"
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search } from "lucide-react"

type SortKey = "customer" | "customer_number" | "orders" | "order_value" | "invoices" | "invoiced" | "paid" | "balance" | "last_order_date"
type Show = "all" | "with" | "without"

const money = (v: number) => Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "-")

const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "customer", label: "Customer" },
  { key: "customer_number", label: "Customer No." },
  { key: "orders", label: "Orders", right: true },
  { key: "order_value", label: "Order Value (KES)", right: true },
  { key: "invoices", label: "Invoices", right: true },
  { key: "invoiced", label: "Invoiced (KES)", right: true },
  { key: "paid", label: "Paid (KES)", right: true },
  { key: "balance", label: "Balance (KES)", right: true },
  { key: "last_order_date", label: "Last Order" },
]

// Every customer with what they have ordered and been invoiced; a customer with none shows 0 / 0.00.
export function CustomerStatsTab() {
  const { toast } = useToast()
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")
  const [show, setShow] = useState<Show>("all")
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "order_value", desc: true })

  useEffect(() => {
    setLoading(true)
    getCustomerStats({ date_from: dateFrom, date_to: dateTo })
      .then(setStats)
      .catch((e: any) => toast({ title: "Error", description: e.message || "Failed to load customer stats", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo, toast])

  const rows = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean)
    const list = (stats?.rows || [])
      .filter((r) => show === "all" || (show === "with" ? r.orders > 0 : r.orders === 0))
      .filter((r) => {
        const text = `${r.customer} ${r.customer_number || ""} ${r.phone || ""}`.toLowerCase()
        return words.every((w) => text.includes(w))
      })
    const value = (r: CustomerStatsRow) => r[sort.key]
    return [...list].sort((a, b) => {
      const x = value(a), y = value(b)
      // Blanks (no number, never ordered) always last.
      if (x == null || x === "") return 1
      if (y == null || y === "") return -1
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" })
      return sort.desc ? -c : c
    })
  }, [stats, search, show, sort])

  const { pageRows, start, pager } = usePaged(rows, 20, `${search}|${show}|${sort.key}|${sort.desc}|${dateFrom}|${dateTo}`)

  const totals = useMemo(() => ({
    orders: rows.reduce((s, r) => s + r.orders, 0),
    order_value: rows.reduce((s, r) => s + r.order_value, 0),
    invoices: rows.reduce((s, r) => s + r.invoices, 0),
    invoiced: rows.reduce((s, r) => s + r.invoiced, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    balance: rows.reduce((s, r) => s + r.balance, 0),
  }), [rows])

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !["customer", "customer_number"].includes(key) }))

  const period = dateFrom || dateTo ? `${dateFrom ? day(dateFrom) : "Start"} to ${dateTo ? day(dateTo) : "today"}` : "All time"

  const handleExport = (format: Parameters<typeof exportTable>[0]) =>
    exportTable(format, {
      fileName: "customer_stats",
      title: "Customer Stats",
      subtitle: period,
      headers: ["S/No", "Customer", "Customer No.", "Phone", "Orders", "Order Value (KES)", "Invoices", "Invoiced (KES)", "Paid (KES)", "Balance (KES)", "Last Order"],
      rows: rows.map((r, i) => [i + 1, r.customer, r.customer_number || "", r.phone || "", r.orders, r.order_value, r.invoices, r.invoiced, r.paid, r.balance, day(r.last_order_date)]),
      footer: [["", "TOTAL", "", "", totals.orders, totals.order_value, totals.invoices, totals.invoiced, totals.paid, totals.balance, ""]],
      moneyColumns: [5, 7, 8, 9],
    })

  const summary = stats?.summary
  const cards = [
    { label: "Customers", value: (summary?.customers ?? 0).toLocaleString() },
    { label: "With orders", value: (summary?.with_orders ?? 0).toLocaleString() },
    { label: "Without orders", value: (summary?.without_orders ?? 0).toLocaleString() },
    { label: "Orders", value: (summary?.orders ?? 0).toLocaleString() },
    { label: "Order value", value: `KES ${money(summary?.order_value ?? 0)}` },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, number or phone..." className="pl-8" />
            </div>
            <Select value={show} onValueChange={(v) => setShow(v as Show)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                <SelectItem value="with">With orders</SelectItem>
                <SelectItem value="without">Without orders</SelectItem>
              </SelectContent>
            </Select>
            <label className="text-xs text-muted-foreground">From
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[150px]" />
            </label>
            <label className="text-xs text-muted-foreground">To
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[150px]" />
            </label>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo("") }}>All time</Button>
            )}
            <ExportMenu onExport={handleExport} disabled={!rows.length} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <Table scroll>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">S/No</TableHead>
                    {COLUMNS.map((c) => (
                      <TableHead key={c.key} className={c.right ? "text-right" : undefined}>
                        <button type="button" onClick={() => toggleSort(c.key)} className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground ${c.right ? "flex-row-reverse" : ""}`}>
                          {c.label}
                          {sort.key === c.key
                            ? (sort.desc ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />)
                            : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={COLUMNS.length + 1} className="text-center text-muted-foreground py-8">No customers match.</TableCell></TableRow>
                  ) : pageRows.map((r, i) => (
                    <TableRow key={r.customer_id} className={r.orders === 0 ? "text-muted-foreground" : undefined}>
                      <TableCell>{start + i + 1}</TableCell>
                      <TableCell className="font-medium">
                        {r.customer}
                        {r.phone && <span className="block text-xs text-muted-foreground font-normal">{r.phone}</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.customer_number || "-"}</TableCell>
                      <TableCell className="text-right">{r.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">{money(r.order_value)}</TableCell>
                      <TableCell className="text-right">{r.invoices.toLocaleString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(r.invoiced)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(r.paid)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(r.balance)}</TableCell>
                      <TableCell className="whitespace-nowrap">{day(r.last_order_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {rows.length > 0 && (
                  <TableFooter>
                    <TableRow className="font-bold">
                      <TableCell />
                      <TableCell>TOTAL ({rows.length})</TableCell>
                      <TableCell />
                      <TableCell className="text-right">{totals.orders.toLocaleString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(totals.order_value)}</TableCell>
                      <TableCell className="text-right">{totals.invoices.toLocaleString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(totals.invoiced)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(totals.paid)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(totals.balance)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
              <TablePager {...pager} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
