"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { format, startOfMonth, startOfWeek, subDays } from "date-fns"
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, RefreshCw, Search, TrendingUp, Wallet, Receipt, FileText } from "lucide-react"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TablePager, usePaged } from "@/components/ui/table-pager"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { useToast } from "@/hooks/use-toast"
import { displayDate } from "@/lib/date-format"
import { getRepRoi, type RepRoiResponse, type RepRoiRow } from "@/lib/employees"

const iso = (d: Date) => format(d, "yyyy-MM-dd")
const kes = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const roiText = (r: number | null) => (r === null ? "—" : `${r.toLocaleString("en-KE", { maximumFractionDigits: 2 })}x`)
const dmy = (s?: string) => (s ? displayDate(new Date(`${s}T00:00:00`)) : "")

type SortKey = "name" | "allowance" | "invoices" | "invoiced" | "roi"
const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "name", label: "Rep" },
  { key: "allowance", label: "Allowance (KES)", right: true },
  { key: "invoices", label: "Invoices", right: true },
  { key: "invoiced", label: "Invoiced (KES)", right: true },
  { key: "roi", label: "ROI", right: true },
]

// ROI bands for the filter and the badge colour.
const band = (roi: number | null) => (roi === null ? "none" : roi >= 10 ? "high" : roi >= 1 ? "mid" : "low")

function RoiBadge({ roi }: { roi: number | null }) {
  if (roi === null) return <span className="text-muted-foreground">—</span>
  const cls = { high: "bg-green-100 text-green-800", mid: "bg-amber-100 text-amber-800", low: "bg-red-100 text-red-800", none: "" }[band(roi)]
  return <Badge className={cls}>{roiText(roi)}</Badge>
}

/**
 * ROI for Reps: allowances paid to each sales rep outside payroll (one-time ones from HR > Allowances,
 * monthly disbursed ones) against what was invoiced under the rep, over the range picked (a day, a
 * week, a month or any range). One table, sortable, filterable, paged with All.
 */
export default function RepRoiPage() {
  const { toast } = useToast()
  const [from, setFrom] = useState(() => iso(startOfMonth(new Date())))
  const [to, setTo] = useState(() => iso(new Date()))
  const [data, setData] = useState<RepRoiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roiFilter, setRoiFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getRepRoi({ date_from: from, date_to: to, group: "month" }))
    } catch (e: any) {
      toast({ title: "Could not load ROI for Reps", description: e?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [from, to, toast])

  useEffect(() => { load() }, [load])

  const preset = (p: string) => {
    const today = new Date()
    if (p === "today") { setFrom(iso(today)); setTo(iso(today)) }
    if (p === "week") { setFrom(iso(startOfWeek(today, { weekStartsOn: 1 }))); setTo(iso(today)) }
    if (p === "month") { setFrom(iso(startOfMonth(today))); setTo(iso(today)) }
    if (p === "90") { setFrom(iso(subDays(today, 89))); setTo(iso(today)) }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = (data?.reps ?? []).filter((r) =>
      (!q || [r.name, r.employee_number, r.position].some((v) => (v || "").toLowerCase().includes(q)))
      && (roiFilter === "all" || band(r.roi) === roiFilter))
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      const cmp = typeof av === "string" || typeof bv === "string"
        ? String(av ?? "").localeCompare(String(bv ?? ""), undefined, { sensitivity: "base" })
        : (av ?? -1) - (bv ?? -1)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [data, search, roiFilter, sortKey, sortDir])

  // Totals follow the search and filter.
  const totals = useMemo(() => {
    const allowance = visible.reduce((s, r) => s + r.allowance, 0)
    const invoiced = visible.reduce((s, r) => s + r.invoiced, 0)
    return { allowance, invoiced, invoices: visible.reduce((s, r) => s + r.invoices, 0), roi: allowance > 0 ? Math.round((invoiced / allowance) * 100) / 100 : null }
  }, [visible])

  const { pageRows, start, pager } = usePaged(visible, 20, `${search}|${roiFilter}|${from}|${to}`)

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc") }
  }

  const range = from === to ? dmy(from) : `${dmy(from)} to ${dmy(to)}`
  const exportReport = useTableExport(() => ({
    fileName: `roi-for-reps-${from}-to-${to}`,
    title: "ROI for Reps",
    subtitle: range,
    headers: ["S/No", "Rep", "Employee #", "Position", "Allowance (KES)", "Invoices", "Invoiced (KES)", "ROI"],
    moneyColumns: [4, 6],
    rows: visible.map((r, i) => [i + 1, r.name, r.employee_number ?? "", r.position ?? "", r.allowance, r.invoices, r.invoiced, roiText(r.roi)]),
    footer: [["", "Total", "", "", totals.allowance, totals.invoices, totals.invoiced, roiText(totals.roi)]],
  }))

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_view_employees", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ROI for Reps</h1>
            <p className="text-muted-foreground">
              Allowances paid to each sales rep against the invoices raised under them. ROI = invoiced ÷ allowance (KES invoiced per KES 1 paid).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <ExportMenu onExport={exportReport} size="default" disabled={loading || visible.length === 0} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Stat icon={<Wallet className="h-5 w-5" />} tone="bg-emerald-100 text-emerald-700" label="Allowances paid" value={`KES ${kes(totals.allowance)}`} />
          <Stat icon={<Receipt className="h-5 w-5" />} tone="bg-blue-100 text-blue-700" label="Invoiced under reps" value={`KES ${kes(totals.invoiced)}`} />
          <Stat icon={<FileText className="h-5 w-5" />} tone="bg-slate-100 text-slate-600" label="Invoices" value={String(totals.invoices)} />
          <Stat icon={<TrendingUp className="h-5 w-5" />} tone="bg-rose-100 text-rose-700" label="Overall ROI" value={roiText(totals.roi)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reps · {range}</CardTitle>
            <CardDescription>Click a column to sort. Totals and Export follow the filters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Range</Label>
                <Select onValueChange={preset}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This week</SelectItem>
                    <SelectItem value="month">This month</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
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
                <Label className="text-xs text-muted-foreground">ROI</Label>
                <Select value={roiFilter} onValueChange={setRoiFilter}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="high">10x and over</SelectItem>
                    <SelectItem value="mid">1x to 10x</SelectItem>
                    <SelectItem value="low">Under 1x</SelectItem>
                    <SelectItem value="none">No allowance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1 min-w-[220px]">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <Search className="absolute left-3 bottom-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rep name, employee #, position..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">S/No</TableHead>
                    {COLUMNS.map((c) => (
                      <TableHead key={c.key} className={c.right ? "text-right" : ""}>
                        <button type="button" onClick={() => toggleSort(c.key)}
                          className={`inline-flex items-center gap-1 hover:text-foreground ${c.right ? "flex-row-reverse" : ""}`}>
                          {c.label}
                          {sortKey !== c.key ? <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                            : sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
                  ) : visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        {search || roiFilter !== "all"
                          ? "No reps match the filters."
                          : "No allowances or rep invoices in this range. Invoices count once a sales rep is picked on the order or invoice."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((r, i) => (
                      <TableRow key={r.rep_key}>
                        <TableCell className="text-muted-foreground">{start + i + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[r.employee_number, r.position].filter(Boolean).join(" · ")}
                            {!r.linked && <span className="text-amber-700"> · no user account linked, so no invoices can be counted</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.allowance ? kes(r.allowance) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.invoices || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.invoiced ? kes(r.invoiced) : "—"}</TableCell>
                        <TableCell className="text-right"><RoiBadge roi={r.roi} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!loading && visible.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold">Total ({visible.length} rep{visible.length === 1 ? "" : "s"})</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{kes(totals.allowance)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{totals.invoices}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{kes(totals.invoiced)}</TableCell>
                      <TableCell className="text-right"><RoiBadge roi={totals.roi} /></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
            {!loading && <TablePager {...pager} />}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
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
