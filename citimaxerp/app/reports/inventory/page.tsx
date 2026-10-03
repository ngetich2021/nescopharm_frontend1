"use client"

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import * as XLSX from "xlsx"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { getInventoryReport } from "@/lib/reports"
import { getProductCategories, type ProductCategory } from "@/lib/product-categories"
import { getStores, type Store } from "@/lib/stores"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  Loader2,
  PackageX,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react"

type ReportType = "balance" | "low_stock" | "movement" | "stock_management"
type Row = Record<string, any>

interface Column {
  key: string
  header: string
  align?: "right" | "center"
  className?: string
  render?: (row: Row) => ReactNode
  exportValue?: (row: Row) => string | number | null
  total?: (rows: Row[]) => ReactNode
}

const PAGE_SIZES = ["10", "20", "50", "100", "all"]
const EXPIRY_WARN_DAYS = 90

const qty = (n: unknown) => (n === null || n === undefined || n === "" ? "-" : Number(n).toLocaleString())
const money = (n: unknown) =>
  n === null || n === undefined ? "-" : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const isLine = (r: Row) => r.row_type !== "parent"
const sumOf = (rows: Row[], key: string) => rows.filter(isLine).reduce((s, r) => s + Number(r[key] || 0), 0)

const daysUntil = (date?: string | null) => (date ? Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000) : null)

function ExpiryCell({ date }: { date?: string | null }) {
  const days = daysUntil(date)
  if (!date || days === null) return <span className="text-gray-400">-</span>
  const label = new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
  if (days < 0) return <span className="font-medium text-red-600">{label} (expired)</span>
  if (days <= EXPIRY_WARN_DAYS) return <span className="font-medium text-amber-600">{label} ({days}d)</span>
  return <span>{label}</span>
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null
  const styles: Record<string, string> = {
    in_stock: "bg-emerald-50 text-emerald-700 border-emerald-200",
    low_stock: "bg-amber-50 text-amber-700 border-amber-200",
    out_of_stock: "bg-red-50 text-red-700 border-red-200",
  }
  const labels: Record<string, string> = { in_stock: "In stock", low_stock: "Low", out_of_stock: "Out of stock" }
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", styles[status])}>
      {labels[status] ?? status}
    </Badge>
  )
}

function SummaryCard({ label, value, hint, icon, tone = "default" }: { label: string; value: ReactNode; hint?: string; icon: ReactNode; tone?: "default" | "red" | "amber" | "green" }) {
  const tones = {
    default: "bg-slate-100 text-slate-600",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
    green: "bg-emerald-100 text-emerald-600",
  }
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("rounded-lg p-2", tones[tone])}>{icon}</div>
      </CardContent>
    </Card>
  )
}

// Sized items come back as a parent row followed by its sizes; keep them together
// so search, pagination and collapsing treat an item and its sizes as one block.
function groupRows(rows: Row[]): Row[][] {
  const groups: Row[][] = []
  for (const row of rows) {
    if (row.row_type === "size" && groups.length && groups[groups.length - 1][0].row_type === "parent") {
      groups[groups.length - 1].push(row)
    } else {
      groups.push([row])
    }
  }
  return groups
}

export default function InventoryReportPage() {
  const [reportType, setReportType] = useState<ReportType>("balance")
  const [data, setData] = useState<Row[]>([])
  const [summary, setSummary] = useState<Row | null>(null)
  const [period, setPeriod] = useState<Row | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [stores, setStores] = useState<Store[]>([])

  const [categoryId, setCategoryId] = useState("all")
  const [storeId, setStoreId] = useState("all")
  const [status, setStatus] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")
  const [reorderOnly, setReorderOnly] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState("20")

  const { toast } = useToast()
  const usesDates = reportType === "movement" || reportType === "stock_management"

  useEffect(() => {
    Promise.all([getProductCategories({ is_active: true }), getStores()])
      .then(([cats, strs]) => {
        setCategories(cats)
        setStores(strs)
      })
      .catch((error) => console.error("Error fetching filters:", error))
  }, [])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { type: reportType }
      if (categoryId !== "all") params.category_id = categoryId
      if (storeId !== "all") params.store_id = storeId
      if (status !== "all") params.status = status
      if (usesDates && dateFrom) params.date_from = dateFrom
      if (usesDates && dateTo) params.date_to = dateTo

      const resp = await getInventoryReport(params as any)
      setData(Array.isArray(resp?.data) ? resp.data : [])
      setSummary(resp?.summary ?? null)
      setPeriod(resp?.period ?? null)
    } catch (error: any) {
      setData([])
      setSummary(null)
      toast({ title: "Error", description: error.message || "Failed to fetch inventory report", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [reportType, categoryId, storeId, status, usesDates, dateFrom, dateTo, toast])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  useEffect(() => setPage(1), [reportType, search, pageSize, reorderOnly, categoryId, storeId, status, dateFrom, dateTo])

  const columns = useMemo<Column[]>(() => {
    const itemNo: Column = {
      key: "item_no",
      header: "Item No.",
      className: "w-20",
      render: (r) => <span className={cn("font-mono", r.row_type === "size" ? "pl-3 text-gray-600" : "font-semibold text-gray-900")}>{r.item_no || "-"}</span>,
    }
    const description: Column = {
      key: "name",
      header: "Item Description",
      className: "min-w-[260px]",
      render: (r) =>
        r.row_type === "parent" ? (
          <button
            type="button"
            className="flex items-center gap-2 text-left font-semibold text-gray-900"
            onClick={() =>
              setCollapsed((prev) => {
                const next = new Set(prev)
                next.has(r.item_no) ? next.delete(r.item_no) : next.add(r.item_no)
                return next
              })
            }
          >
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-gray-500 transition-transform", collapsed.has(r.item_no) && "-rotate-90")} />
            <span>{r.name}</span>
            <Badge variant="secondary" className="shrink-0 font-normal">{r.size_count} sizes</Badge>
          </button>
        ) : (
          <span className={cn(r.row_type === "size" ? "pl-6 text-gray-700" : "font-medium text-gray-900", r.is_active === false && "text-gray-400 line-through")}>
            {r.name}
          </span>
        ),
    }

    switch (reportType) {
      case "low_stock":
        return [
          itemNo,
          description,
          { key: "stock_quantity", header: "In Stock", align: "right", render: (r) => qty(r.stock_quantity), total: (rows) => qty(sumOf(rows, "stock_quantity")) },
          { key: "low_stock_threshold", header: "Reorder Level", align: "right", render: (r) => (isLine(r) ? qty(r.low_stock_threshold) : "") },
          {
            key: "shortfall",
            header: "Shortfall",
            align: "right",
            render: (r) => (isLine(r) ? <span className="font-medium text-red-600">{qty(Math.max(r.low_stock_threshold - r.stock_quantity, 0))}</span> : ""),
            exportValue: (r) => (isLine(r) ? Math.max(r.low_stock_threshold - r.stock_quantity, 0) : null),
          },
          { key: "nearest_expiry", header: "Nearest Expiry", render: (r) => <ExpiryCell date={r.nearest_expiry} /> },
          { key: "stock_status", header: "Status", align: "center", render: (r) => <StatusBadge status={r.stock_status} /> },
        ]
      case "movement":
        return [
          {
            key: "movement_date",
            header: "Date",
            className: "whitespace-nowrap",
            render: (r) => new Date(r.movement_date).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
            exportValue: (r) => new Date(r.movement_date).toLocaleString(),
          },
          itemNo,
          description,
          { key: "type", header: "Type", render: (r) => <span className="capitalize">{String(r.type || "").replace(/_/g, " ")}</span> },
          {
            key: "in",
            header: "In",
            align: "right",
            render: (r) => (r.direction === "in" ? <span className="font-medium text-emerald-600">+{qty(r.quantity)}</span> : ""),
            exportValue: (r) => (r.direction === "in" ? r.quantity : null),
            total: (rows) => <span className="text-emerald-600">+{qty(rows.filter((r) => r.direction === "in").reduce((s, r) => s + r.quantity, 0))}</span>,
          },
          {
            key: "out",
            header: "Out",
            align: "right",
            render: (r) => (r.direction === "out" ? <span className="font-medium text-red-600">-{qty(r.quantity)}</span> : ""),
            exportValue: (r) => (r.direction === "out" ? r.quantity : null),
            total: (rows) => <span className="text-red-600">-{qty(rows.filter((r) => r.direction === "out").reduce((s, r) => s + r.quantity, 0))}</span>,
          },
          { key: "quantity_before", header: "Before", align: "right", render: (r) => qty(r.quantity_before) },
          { key: "quantity_after", header: "After", align: "right", render: (r) => qty(r.quantity_after) },
          {
            key: "reference",
            header: "Reference",
            render: (r) => <span className="text-gray-600">{[r.reference_type, r.reference_number].filter(Boolean).join(" · ") || "-"}</span>,
            exportValue: (r) => [r.reference_type, r.reference_number].filter(Boolean).join(" "),
          },
        ]
      case "stock_management":
        return [
          itemNo,
          description,
          { key: "opening_stock", header: "Opening", align: "right", render: (r) => qty(r.opening_stock), total: (rows) => qty(sumOf(rows, "opening_stock")) },
          { key: "stock_received", header: "Received", align: "right", render: (r) => qty(r.stock_received), total: (rows) => qty(sumOf(rows, "stock_received")) },
          { key: "sales_quantity", header: "Sold", align: "right", render: (r) => qty(r.sales_quantity), total: (rows) => qty(sumOf(rows, "sales_quantity")) },
          { key: "closing_stock", header: "Closing", align: "right", render: (r) => qty(r.closing_stock), total: (rows) => qty(sumOf(rows, "closing_stock")) },
          { key: "closing_stock_value", header: "Closing Value (KES)", align: "right", render: (r) => money(r.closing_stock_value), total: (rows) => money(sumOf(rows, "closing_stock_value")) },
          {
            key: "gross_profit",
            header: "Gross Profit (KES)",
            align: "right",
            render: (r) => <span className={cn(Number(r.gross_profit) < 0 && "text-red-600")}>{money(r.gross_profit)}</span>,
            total: (rows) => money(rows.filter((r) => r.row_type !== "size").reduce((s, r) => s + Number(r.gross_profit || 0), 0)),
          },
          { key: "months_of_stock", header: "Cover", align: "right", render: (r) => (r.months_of_stock === null || r.months_of_stock === undefined ? "-" : `${r.months_of_stock} mo`) },
          {
            key: "needs_reorder",
            header: "Reorder",
            align: "center",
            render: (r) =>
              r.needs_reorder ? (
                <Badge variant="outline" className="gap-1 whitespace-nowrap border-red-200 bg-red-50 text-red-700">
                  <AlertTriangle className="h-3 w-3" /> Reorder
                </Badge>
              ) : isLine(r) ? (
                <span className="text-gray-400">OK</span>
              ) : null,
            exportValue: (r) => (r.needs_reorder ? "Reorder" : isLine(r) ? "OK" : ""),
          },
        ]
      default:
        return [
          itemNo,
          description,
          { key: "stock_quantity", header: "In Stock", align: "right", render: (r) => qty(r.stock_quantity), total: (rows) => qty(sumOf(rows, "stock_quantity")) },
          { key: "allocated", header: "Allocated", align: "right", render: (r) => qty(r.allocated), total: (rows) => qty(sumOf(rows, "allocated")) },
          { key: "available", header: "Available", align: "right", render: (r) => qty(r.available), total: (rows) => qty(sumOf(rows, "available")) },
          { key: "unit_cost", header: "Unit Cost (KES)", align: "right", render: (r) => (isLine(r) ? money(r.unit_cost) : "") },
          { key: "stock_value", header: "Stock Value (KES)", align: "right", render: (r) => money(r.stock_value), total: (rows) => money(sumOf(rows, "stock_value")) },
          { key: "batch_count", header: "Batches", align: "right", render: (r) => qty(r.batch_count) },
          { key: "nearest_expiry", header: "Nearest Expiry", render: (r) => <ExpiryCell date={r.nearest_expiry} /> },
          { key: "stock_status", header: "Status", align: "center", render: (r) => <StatusBadge status={r.stock_status} /> },
        ]
    }
  }, [reportType, collapsed])

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matches = (r: Row) => !term || String(r.name ?? "").toLowerCase().includes(term) || String(r.item_no ?? "").toLowerCase().startsWith(term)

    return groupRows(data)
      .map((group) => {
        const [head, ...sizes] = group
        let keptSizes = sizes
        if (reportType === "stock_management" && reorderOnly) keptSizes = keptSizes.filter((r) => r.needs_reorder)
        if (head.row_type !== "parent") {
          const keep = matches(head) && (!(reportType === "stock_management" && reorderOnly) || head.needs_reorder)
          return keep ? group : null
        }
        if (!matches(head)) keptSizes = keptSizes.filter(matches)
        return keptSizes.length ? [head, ...keptSizes] : null
      })
      .filter((g): g is Row[] => g !== null)
  }, [data, search, reorderOnly, reportType])

  const visibleRows = useMemo(() => visibleGroups.flat(), [visibleGroups])
  const totalGroups = visibleGroups.length
  const size = pageSize === "all" ? Math.max(totalGroups, 1) : Number(pageSize)
  const pageCount = Math.max(Math.ceil(totalGroups / size), 1)
  const currentPage = Math.min(page, pageCount)
  const pageGroups = visibleGroups.slice((currentPage - 1) * size, currentPage * size)
  const hasTotals = columns.some((c) => c.total)
  const hasGroups = data.some((r) => r.row_type === "parent")

  const exportReport = () => {
    const header = columns.map((c) => c.header)
    const body = visibleRows.map((r) =>
      columns.map((c) => {
        if (c.exportValue) return c.exportValue(r) ?? ""
        if (c.key === "nearest_expiry") return r.nearest_expiry ?? ""
        if (c.key === "stock_status") return String(r.stock_status ?? "").replace(/_/g, " ")
        if (c.key === "months_of_stock") return r.months_of_stock ?? ""
        const v = r[c.key]
        return v === null || v === undefined ? "" : v
      }),
    )
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
    sheet["!cols"] = header.map((h) => ({ wch: h === "Item Description" ? 55 : Math.max(h.length + 2, 12) }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, "Report")
    XLSX.writeFile(book, `inventory_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const renderSummary = () => {
    if (!summary) return null
    if (reportType === "movement") {
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Movements" value={qty(summary.total_movements)} icon={<Layers className="h-5 w-5" />} />
          <SummaryCard label="Units In" value={qty(summary.total_in)} icon={<ArrowDownLeft className="h-5 w-5" />} tone="green" />
          <SummaryCard label="Units Out" value={qty(summary.total_out)} icon={<ArrowUpRight className="h-5 w-5" />} tone="red" />
        </div>
      )
    }
    if (reportType === "stock_management") {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Closing Stock" value={qty(summary.total_closing_stock)} hint={period ? `as of ${period.date_to}` : undefined} icon={<Boxes className="h-5 w-5" />} />
          <SummaryCard label="Closing Value" value={`KES ${money(summary.total_closing_stock_value)}`} hint="at buying price" icon={<Wallet className="h-5 w-5" />} />
          <SummaryCard label="Gross Profit" value={`KES ${money(summary.total_gross_profit)}`} hint={period ? `${period.date_from} to ${period.date_to}` : undefined} icon={<TrendingUp className="h-5 w-5" />} tone="green" />
          <button type="button" className="text-left" onClick={() => setReorderOnly((v) => !v)} disabled={!summary.reorder_alert_count}>
            <SummaryCard
              label="Reorder Alerts"
              value={qty(summary.reorder_alert_count)}
              hint={summary.reorder_alert_count ? (reorderOnly ? "Showing only these - click to show all" : "Under 3 months of cover - click to filter") : "All lines have 3+ months of cover"}
              icon={<CalendarClock className="h-5 w-5" />}
              tone="red"
            />
          </button>
        </div>
      )
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={reportType === "low_stock" ? "Lines Needing Stock" : "Stock Lines"}
          value={qty(summary.total_items)}
          hint={`${qty(summary.total_products)} items · each size counts as a line`}
          icon={<Layers className="h-5 w-5" />}
        />
        <SummaryCard label="Units In Stock" value={qty(summary.total_stock)} hint={`${qty(summary.total_available)} available`} icon={<Boxes className="h-5 w-5" />} />
        <SummaryCard label="Stock Value" value={`KES ${money(summary.total_value)}`} hint="at cost price" icon={<Wallet className="h-5 w-5" />} tone="green" />
        <SummaryCard
          label="Low / Out of Stock"
          value={`${qty(summary.low_stock_count)} / ${qty(summary.out_of_stock_count)}`}
          hint="lines at or below reorder level"
          icon={<PackageX className="h-5 w-5" />}
          tone={summary.out_of_stock_count ? "red" : "amber"}
        />
      </div>
    )
  }

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_view_inventory_reports", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Inventory Reports</h1>
            <p className="text-sm text-muted-foreground">Stock levels, values and movements. Each size of a sized item is reported as its own line.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportReport} disabled={loading || visibleRows.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export Excel
            </Button>
          </div>
        </div>

        <Tabs
          value={reportType}
          onValueChange={(v) => {
            setReportType(v as ReportType)
            setReorderOnly(false)
            setData([])
            setSummary(null)
          }}
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="balance">Stock Balance</TabsTrigger>
            <TabsTrigger value="low_stock">Low &amp; Out of Stock</TabsTrigger>
            <TabsTrigger value="movement">Stock Movement</TabsTrigger>
            <TabsTrigger value="stock_management">Stock Management</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search item no. or description" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger><SelectValue placeholder="All stores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((store) => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {usesDates ? (
              <>
                <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </>
            ) : (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="All items" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Active &amp; inactive</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {!loading && renderSummary()}

        <Card className="overflow-hidden">
          {hasGroups && !loading && (
            <div className="flex items-center justify-between border-b bg-gray-50/60 px-4 py-2 text-xs text-muted-foreground">
              <span>Sized items are numbered by size, e.g. 164.1, 164.2 under item 164. Click an item to collapse its sizes.</span>
              <div className="flex gap-3">
                <button type="button" className="hover:text-gray-900" onClick={() => setCollapsed(new Set())}>Expand all</button>
                <button type="button" className="hover:text-gray-900" onClick={() => setCollapsed(new Set(data.filter((r) => r.row_type === "parent").map((r) => r.item_no)))}>Collapse all</button>
              </div>
            </div>
          )}
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_hsl(var(--border))]">
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={cn("whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-gray-600", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                      {c.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-48 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                      <p className="mt-2 text-sm text-muted-foreground">Loading report...</p>
                    </TableCell>
                  </TableRow>
                ) : pageGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-40 text-center text-muted-foreground">
                      {search || reorderOnly ? "No lines match the current filters." : "Nothing to report for this selection."}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageGroups.map((group) => (
                    <Fragment key={`${group[0].item_no}-${group[0].id ?? group[0].product_id}`}>
                      {group.map((row, i) => {
                        if (row.row_type === "size" && collapsed.has(group[0].item_no)) return null
                        return (
                          <TableRow
                            key={row.id ?? `${row.product_id}-${row.variant_id ?? ""}-${i}`}
                            className={cn(
                              row.row_type === "parent" && "bg-slate-50 hover:bg-slate-100",
                              row.row_type === "size" && "border-b-slate-100",
                              row.stock_status === "out_of_stock" && reportType === "balance" && "bg-red-50/40",
                            )}
                          >
                            {columns.map((c) => (
                              <TableCell key={c.key} className={cn("py-2.5 text-sm tabular-nums", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                                {c.render ? c.render(row) : row[c.key] ?? "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        )
                      })}
                    </Fragment>
                  ))
                )}
              </TableBody>
              {hasTotals && !loading && visibleRows.length > 0 && (
                <TableFooter className="sticky bottom-0 bg-gray-100">
                  <TableRow>
                    {columns.map((c, i) => (
                      <TableCell key={c.key} className={cn("py-2.5 text-sm font-semibold tabular-nums", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                        {i === 0 ? "Total" : c.total ? c.total(visibleRows) : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>

          {!loading && totalGroups > 0 && (
            <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Rows per page</span>
                <Select value={pageSize} onValueChange={setPageSize}>
                  <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All" : s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span>
                  {hasGroups ? "items" : "rows"} {(currentPage - 1) * size + 1}-{Math.min(currentPage * size, totalGroups)} of {totalGroups}
                  {visibleRows.length !== totalGroups && ` (${visibleRows.filter(isLine).length} stock lines)`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-muted-foreground">Page {currentPage} of {pageCount}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PermissionGuard>
  )
}
