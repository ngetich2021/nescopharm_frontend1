"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSalesReport } from "@/lib/reports"
import { getCustomers, getCustomerDisplayName, Customer } from "@/lib/customers"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ArrowUpDown, Check, ChevronsUpDown, UserCheck } from "lucide-react"
import { getProductCategories, ProductCategory } from "@/lib/product-categories"
import { DataTable } from "@/components/ui/data-table"
import { TableCell, TableRow } from "@/components/ui/table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { 
  Loader2, TrendingUp, BarChart3, Filter, Calendar, Search, 
  ShoppingBag, Target, Sparkles, RefreshCw, DollarSign, 
  CreditCard, Package, Users, Percent, MapPin
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EnhancedMetricCard } from "@/app/dashboard/components/enhanced-metric-card"
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts"
import { cn, matchesDocNumber } from "@/lib/utils"

type DateRangeType = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'this_year' | 'custom'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// Rows per page on every table (plus "All").
const PAGE_SIZES = [20, 50, 100, 250]

const kes = (v: any) => `KES ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Clickable column header that sorts the table (click again to reverse).
const sortable = (label: string, align: "left" | "right" = "left") => ({ column }: any) => (
  <button
    type="button"
    className={cn("inline-flex items-center gap-1 font-medium hover:text-foreground", align === "right" && "ml-auto")}
    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
  >
    {label}
    <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
  </button>
)
// Sort numbers as numbers (the API sends amounts as strings).
const num = (key: string) => (row: any) => Number(row[key] || 0)

// Region / county / town / sales rep tables share the same columns.
const breakdownColumns = (label: string) => [
  { accessorKey: "name", header: sortable(label) },
  { id: "total", accessorFn: num("total"), header: sortable("Sales"), cell: ({ row }: any) => kes(row.original.total) },
  { id: "share", accessorFn: num("share"), header: sortable("Share"), cell: ({ row }: any) => `${row.original.share}%` },
  { id: "order_count", accessorFn: num("order_count"), header: sortable("Orders") },
  { id: "customer_count", accessorFn: num("customer_count"), header: sortable("Customers") },
  { id: "average_order", accessorFn: num("average_order"), header: sortable("Avg Order"), cell: ({ row }: any) => kes(row.original.average_order) },
]

export default function SalesReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Filter States
  const [dateRange, setDateRange] = useState<DateRangeType>('last_30_days')
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [region, setRegion] = useState<string>("all")
  const [county, setCounty] = useState<string>("all")
  const [city, setCity] = useState<string>("all")
  const [salesRepId, setSalesRepId] = useState<string>("all")
  const [orderStatus, setOrderStatus] = useState<string>("all")
  const [paymentStatus, setPaymentStatus] = useState<string>("all")
  const [customerId, setCustomerId] = useState<string>("all")
  const [customerOpen, setCustomerOpen] = useState(false)
  const [categoryId, setCategoryId] = useState<string>("all")

  // Options Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  // Region / county / town / rep choices come with the report; kept from the first load so
  // filtering doesn't shrink the lists.
  const [options, setOptions] = useState<{ regions: string[]; counties: string[]; cities: string[]; reps: { id: string; name: string }[] }>({ regions: [], counties: [], cities: [], reps: [] })

  const { toast } = useToast()

  // Fetch filter options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const [custData, catData] = await Promise.all([
            getCustomers(),
            getProductCategories({ is_active: true }),
        ])
        setCustomers(custData || [])
        setCategories(catData || [])
      } catch (e) {
        console.error("Failed to load filter options", e)
      }
    }
    loadOptions()
  }, [])

  // Local dates (toISOString is UTC, which turns Kenyan "today" into yesterday around midnight).
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }

  const calculateDateFrom = (range: DateRangeType) => {
    const today = new Date()
    switch (range) {
      case 'today':
        return ymd(today)
      case 'yesterday':
        return daysAgo(1)
      case 'last_7_days':
        return daysAgo(7)
      case 'last_30_days':
        return daysAgo(30)
      case 'this_month':
        return ymd(new Date(today.getFullYear(), today.getMonth(), 1))
      case 'this_year':
        return ymd(new Date(today.getFullYear(), 0, 1))
      case 'custom':
        return dateFrom
      default:
        return ""
    }
  }

  const latestRequest = useRef(0)

  const fetchReport = useCallback(async () => {
    const requestId = ++latestRequest.current
    setLoading(true)
    try {
      const params: any = { type: 'performance' }
      const effectiveDateFrom = calculateDateFrom(dateRange)
      if (effectiveDateFrom) params.date_from = effectiveDateFrom
      if (dateRange === 'yesterday') params.date_to = daysAgo(1)
      if (dateRange === 'custom' && dateTo) params.date_to = dateTo
      if (region !== 'all') params.region = region
      if (county !== 'all') params.county = county
      if (city !== 'all') params.city = city
      if (salesRepId !== 'all') params.sales_rep_id = salesRepId
      if (orderStatus && orderStatus !== 'all') params.status = orderStatus
      if (paymentStatus && paymentStatus !== 'all') params.payment_status = paymentStatus
      if (customerId && customerId !== 'all') params.customer_id = customerId
      if (categoryId && categoryId !== 'all') params.category_id = categoryId

      const resp = await getSalesReport(params)
      if (requestId !== latestRequest.current) return

      if (resp.status === "success") {
        setData(resp.data)
        const d: any = resp.data
        // The server narrows these to what still applies (the chosen customer's region,
        // the chosen region's counties...); refreshed with every load.
        setOptions({
          regions: d?.location_options?.regions ?? [],
          counties: d?.location_options?.counties ?? [],
          cities: d?.location_options?.cities ?? [],
          reps: d?.sales_rep_options ?? [],
        })
      } else {
        toast({
            title: "Could not load the sales report",
            description: resp.message || "Please try again.",
            variant: "destructive",
        })
      }
    } catch (error: any) {
      if (requestId !== latestRequest.current) return
      toast({
        title: "Error",
        description: error.message || "Failed to fetch sales report",
        variant: "destructive",
      })
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [dateRange, dateFrom, dateTo, region, county, city, salesRepId, orderStatus, paymentStatus, customerId, categoryId, toast])

  // Real figures straight away, and again whenever a filter changes (a custom range waits for
  // its start date).
  useEffect(() => {
    if (dateRange === 'custom' && !dateFrom) return
    fetchReport()
  }, [fetchReport]) // eslint-disable-line react-hooks/exhaustive-deps

  // The current choice always stays in its list, even while the next load is narrowing it.
  const withSelected = (list: string[], selected: string) =>
    selected === 'all' || list.includes(selected) ? list : [selected, ...list]
  const regionChoices = withSelected(options.regions, region)
  const countyChoices = withSelected(options.counties, county)
  const cityChoices = withSelected(options.cities, city)

  // A different customer starts from their own region / county / town / rep.
  const chooseCustomer = (id: string) => {
    setCustomerId(id)
    setRegion("all")
    setCounty("all")
    setCity("all")
    setSalesRepId("all")
    setCustomerOpen(false)
  }

  const chartData = useMemo(() => {
    if (!data?.summary_by_date) return []
    return data.summary_by_date.map((item: any) => ({
      date: item.date,
      revenue: parseFloat(item.total),
      orders: parseInt(item.count)
    }))
  }, [data])

  const paymentStatusData = useMemo(() => {
    if (!data?.payment_status_breakdown) return []
    return data.payment_status_breakdown.map((item: any) => ({
        name: item.payment_status.charAt(0).toUpperCase() + item.payment_status.slice(1),
        value: parseFloat(item.total),
        count: item.count
    }))
  }, [data])

  // Every column header sorts; amounts sort as numbers.
  const topProductsColumns = [
    { accessorKey: "name", header: sortable("Product Name") },
    { accessorKey: "sku", header: sortable("SKU") },
    { id: "total_quantity", accessorFn: num("total_quantity"), header: sortable("Units Sold") },
    { id: "total_revenue", accessorFn: num("total_revenue"), header: sortable("Total Revenue"), cell: ({ row }: any) => kes(row.original.total_revenue) },
  ]

  // Customers by business name (the server sends it as "name"), with where they are.
  const topCustomersColumns = [
    { accessorKey: "name", header: sortable("Customer") },
    { accessorKey: "county", header: sortable("County") },
    { accessorKey: "region", header: sortable("Region") },
    { accessorKey: "location", header: sortable("Town") },
    { id: "order_count", accessorFn: num("order_count"), header: sortable("Orders") },
    { id: "total_spent", accessorFn: num("total_spent"), header: sortable("Total Spent"), cell: ({ row }: any) => kes(row.original.total_spent) },
  ]

  const summaryColumns = [
    { accessorKey: "date", header: sortable("Date") },
    { id: "count", accessorFn: num("count"), header: sortable("Orders") },
    { id: "item_count", accessorFn: num("item_count"), header: sortable("Items Sold") },
    { id: "total", accessorFn: num("total"), header: sortable("Total Revenue"), cell: ({ row }: any) => kes(row.original.total) },
  ]

  // Every order behind the figures, each linking to the order.
  const ordersColumns = [
    {
      accessorKey: "order_number",
      header: sortable("Order"),
      cell: ({ row }: any) => (
        <a href={`/sales/orders/${row.original.id}`} className="font-medium text-primary hover:underline">{row.original.order_number}</a>
      ),
    },
    {
      accessorKey: "invoice_number",
      header: sortable("Invoice"),
      cell: ({ row }: any) => <span className="whitespace-nowrap">{row.original.invoice_number || "-"}</span>,
    },
    { accessorKey: "order_date", header: sortable("Date") },
    { accessorKey: "customer", header: sortable("Customer") },
    { accessorKey: "county", header: sortable("County"), cell: ({ row }: any) => row.original.county || "-" },
    { accessorKey: "town", header: sortable("Town"), cell: ({ row }: any) => row.original.town || "-" },
    { accessorKey: "sales_rep", header: sortable("Sales Rep") },
    { accessorKey: "status", header: sortable("Status"), cell: ({ row }: any) => <span className="capitalize">{row.original.status}</span> },
    { accessorKey: "payment_status", header: sortable("Payment"), cell: ({ row }: any) => <span className="capitalize">{row.original.payment_status}</span> },
    { id: "total", accessorFn: num("total"), header: sortable("Total"), cell: ({ row }: any) => kes(row.original.total) },
    { id: "paid", accessorFn: num("paid"), header: sortable("Paid"), cell: ({ row }: any) => kes(row.original.paid) },
  ]

  // The selected period in words, e.g. "01 Oct 2026 – 30 Oct 2026", for the totals.
  const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  const periodLabel = (() => {
    const from = calculateDateFrom(dateRange)
    const to = dateRange === 'yesterday' ? daysAgo(1) : dateRange === 'custom' && dateTo ? dateTo : ymd(new Date())
    if (!from) return "All dates"
    return from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`
  })()

  // The orders table's search: customer, order number, or invoice number however typed (NSK/0427, nsk 427...).
  const [orderSearch, setOrderSearch] = useState("")
  const shownOrders = useMemo(() => {
    const rows: any[] = data?.orders || []
    const q = orderSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      String(r.customer ?? "").toLowerCase().includes(q) ||
      String(r.order_number ?? "").toLowerCase().includes(q) ||
      matchesDocNumber(r.invoice_number, orderSearch))
  }, [data, orderSearch])

  // Totals of the orders shown (every page of the table, and only those matching the search).
  const orderTotals = useMemo(() => {
    const rows: any[] = shownOrders
    const total = rows.reduce((s, r) => s + Number(r.total || 0), 0)
    const paid = rows.reduce((s, r) => s + Number(r.paid || 0), 0)
    return { count: rows.length, total, paid, balance: total - paid }
  }, [shownOrders])

  // Sales accounts, laid out like the old system's: Date, Particulars, Vch Type, Vch No (NSK/0427),
  // Debit (credit notes), Credit (sales) and a running Balance over the rows shown, oldest first.
  const [ledgerSearch, setLedgerSearch] = useState("")
  const ledgerRows = useMemo(() => {
    const rows: any[] = data?.sales_accounts || []
    const q = ledgerSearch.trim().toLowerCase()
    const shown = q
      ? rows.filter((r) =>
          String(r.particulars ?? "").toLowerCase().includes(q) ||
          String(r.vch_type ?? "").toLowerCase().includes(q) ||
          matchesDocNumber(r.vch_no, ledgerSearch))
      : rows
    let balance = 0
    return shown.map((r, i) => {
      balance += Number(r.credit || 0) - Number(r.debit || 0)
      return { ...r, sno: i + 1, balance }
    })
  }, [data, ledgerSearch])
  const ledgerTotals = useMemo(() => ({
    debit: ledgerRows.reduce((s, r) => s + Number(r.debit || 0), 0),
    credit: ledgerRows.reduce((s, r) => s + Number(r.credit || 0), 0),
  }), [ledgerRows])
  // 02-Oct-26
  const ledgerDate = (iso?: string) => {
    if (!iso) return "-"
    const d = new Date(`${iso}T00:00:00`)
    return `${String(d.getDate()).padStart(2, "0")}-${d.toLocaleString("en-GB", { month: "short" })}-${String(d.getFullYear()).slice(-2)}`
  }
  const amount = (v: any) => Number(v) ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
  // Not sortable: the balance runs down the rows in date order.
  const ledgerColumns = [
    { accessorKey: "sno", header: "S/No" },
    { id: "date", accessorFn: (r: any) => ledgerDate(r.date), header: "Date" },
    {
      accessorKey: "particulars",
      header: "Particulars",
      cell: ({ row }: any) => row.original.order_id
        ? <a href={`/sales/orders/${row.original.order_id}`} className="text-primary hover:underline">{row.original.particulars}</a>
        : row.original.particulars,
    },
    { accessorKey: "vch_type", header: "Vch Type" },
    { id: "vch_no", accessorFn: (r: any) => r.vch_no || "", header: "Vch No.", cell: ({ row }: any) => <span className="whitespace-nowrap">{row.original.vch_no || ""}</span> },
    { id: "debit", accessorFn: (r: any) => Number(r.debit || 0), header: () => <div className="text-right">Debit</div>, cell: ({ row }: any) => <div className="text-right tabular-nums">{amount(row.original.debit)}</div> },
    { id: "credit", accessorFn: (r: any) => Number(r.credit || 0), header: () => <div className="text-right">Credit</div>, cell: ({ row }: any) => <div className="text-right tabular-nums">{amount(row.original.credit)}</div> },
    { id: "balance", accessorFn: (r: any) => Number(r.balance.toFixed(2)), header: () => <div className="text-right">Balance</div>, cell: ({ row }: any) => <div className="text-right tabular-nums font-medium">{row.original.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div> },
  ]

  const customerLabel = (id: string) => {
    const c = customers.find((x) => x.id === id)
    return c ? getCustomerDisplayName(c) : "All Customers"
  }

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Sales Intelligence
            </h1>
            <p className="text-muted-foreground mt-1">Comprehensive analytics on revenue, products, and customer trends</p>
          </div>
          <div className="flex items-center gap-4">
             <Button onClick={fetchReport} variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5" disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh Data
             </Button>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="border-border/40 bg-background/60 backdrop-blur-md shadow-sm">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Period
                </label>
                <Select value={dateRange} onValueChange={(v: DateRangeType) => setDateRange(v)}>
                  <SelectTrigger className="h-9 bg-background/50">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Input */}
              {dateRange === 'custom' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                    <Input 
                      type="date" 
                      value={dateFrom} 
                      onChange={(e) => setDateFrom(e.target.value)} 
                      className="h-9 bg-background/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">End Date</label>
                    <Input 
                      type="date" 
                      value={dateTo} 
                      onChange={(e) => setDateTo(e.target.value)} 
                      className="h-9 bg-background/50" 
                    />
                  </div>
                </>
              )}

              {/* Where the customer is */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Region
                </label>
                <Select value={region} onValueChange={(v) => { setRegion(v); setCounty("all"); setCity("all") }}>
                   <SelectTrigger className="h-9 bg-background/50"><SelectValue /></SelectTrigger>
                   <SelectContent>
                       <SelectItem value="all">All Regions</SelectItem>
                       {regionChoices.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  County
                </label>
                <Select value={county} onValueChange={(v) => { setCounty(v); setCity("all") }}>
                   <SelectTrigger className="h-9 bg-background/50"><SelectValue /></SelectTrigger>
                   <SelectContent>
                       <SelectItem value="all">All Counties</SelectItem>
                       {countyChoices.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Town
                </label>
                <Select value={city} onValueChange={setCity}>
                   <SelectTrigger className="h-9 bg-background/50"><SelectValue /></SelectTrigger>
                   <SelectContent>
                       <SelectItem value="all">All Towns</SelectItem>
                       {cityChoices.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" />
                  Sales Rep
                </label>
                <Select value={salesRepId} onValueChange={setSalesRepId}>
                   <SelectTrigger className="h-9 bg-background/50"><SelectValue /></SelectTrigger>
                   <SelectContent>
                       <SelectItem value="all">All Sales Reps</SelectItem>
                       {options.reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                       {salesRepId !== "all" && salesRepId !== "unassigned" && !options.reps.some((r) => r.id === salesRepId) && (
                         <SelectItem value={salesRepId}>{data?.sales_by_rep?.find((r: any) => r.id === salesRepId)?.name ?? "Selected rep"}</SelectItem>
                       )}
                       <SelectItem value="unassigned">Unassigned</SelectItem>
                   </SelectContent>
                </Select>
              </div>

              {/* Order Status Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Order Status
                </label>
                <Select value={orderStatus} onValueChange={setOrderStatus}>
                   <SelectTrigger className="h-9 bg-background/50">
                       <SelectValue placeholder="All Statuses" />
                   </SelectTrigger>
                   <SelectContent>
                       <SelectItem value="all">All Statuses</SelectItem>
                       <SelectItem value="pending">Pending</SelectItem>
                       <SelectItem value="processing">Processing</SelectItem>
                       <SelectItem value="completed">Completed</SelectItem>
                       <SelectItem value="dispatched">Dispatched</SelectItem>
                   </SelectContent>
                </Select>
              </div>

              {/* Payment Status Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Payment Status
                </label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                   <SelectTrigger className="h-9 bg-background/50">
                       <SelectValue placeholder="All Statuses" />
                   </SelectTrigger>
                   <SelectContent>
                       <SelectItem value="all">All Statuses</SelectItem>
                       <SelectItem value="paid">Paid</SelectItem>
                       <SelectItem value="unpaid">Unpaid</SelectItem>
                       <SelectItem value="partial">Partial</SelectItem>
                   </SelectContent>
                </Select>
              </div>

              {/* Customer Filter */}
              <div className="space-y-2">
                 <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Customer
                 </label>
                 {/* Searchable, by business name (or contact name), number, phone or town. */}
                 <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                   <PopoverTrigger asChild>
                     <Button variant="outline" role="combobox" className="h-9 w-full justify-between bg-background/50 font-normal">
                       <span className="truncate">{customerId === "all" ? "All Customers" : customerLabel(customerId)}</span>
                       <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-[320px] p-0" align="start">
                     <Command>
                       <CommandInput placeholder="Search customer..." />
                       <CommandList>
                         <CommandEmpty>No customer found.</CommandEmpty>
                         <CommandGroup>
                           <CommandItem value="all customers" onSelect={() => chooseCustomer("all")}>
                             <Check className={cn("mr-2 h-4 w-4", customerId === "all" ? "opacity-100" : "opacity-0")} />
                             All Customers
                           </CommandItem>
                           {[...customers]
                             .sort((a, b) => getCustomerDisplayName(a).localeCompare(getCustomerDisplayName(b)))
                             .map((c) => (
                               <CommandItem
                                 key={c.id}
                                 value={`${getCustomerDisplayName(c)} ${c.name} ${(c as any).customer_number ?? ""} ${(c as any).phone ?? ""} ${(c as any).city ?? ""} ${c.id}`}
                                 onSelect={() => chooseCustomer(c.id)}
                               >
                                 <Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} />
                                 <div className="min-w-0">
                                   <p className="truncate">{getCustomerDisplayName(c)}</p>
                                   {getCustomerDisplayName(c) !== c.name && <p className="truncate text-xs text-muted-foreground">{c.name}</p>}
                                 </div>
                               </CommandItem>
                             ))}
                         </CommandGroup>
                       </CommandList>
                     </Command>
                   </PopoverContent>
                 </Popover>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                     <Package className="h-3.5 w-3.5" />
                     Category
                  </label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-9 bg-background/50">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                         {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
              </div>

              {/* Action Button */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground invisible">Action</label>
                <Button onClick={fetchReport} className="w-full h-9 gap-2 shadow-sm" disabled={loading}>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
             <div className="flex flex-col items-center justify-center py-32">
                 <Loader2 className="h-10 w-10 animate-spin text-primary" />
                 <p className="mt-4 text-muted-foreground">Gathering intelligence...</p>
             </div>
        ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <p className="text-sm text-muted-foreground">
                    Figures for <span className="font-semibold text-foreground">{periodLabel}</span>
                </p>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <EnhancedMetricCard
                        title="Sales"
                        value={parseFloat(data?.total_sales || 0)}
                        currency="KES"
                        icon={TrendingUp}
                        gradient="from-emerald-500/10 to-teal-500/10"
                        description="Order totals incl. VAT, less credit notes"
                    />
                    <EnhancedMetricCard
                        title="Subtotal (excl. VAT)"
                        value={parseFloat(data?.total_subtotal || 0)}
                        currency="KES"
                        icon={DollarSign}
                        gradient="from-blue-500/10 to-indigo-500/10"
                        description="Order lines before VAT and discounts"
                    />
                    <EnhancedMetricCard
                        title="Total Orders"
                        value={data?.order_count || 0}
                        icon={ShoppingBag}
                        gradient="from-purple-500/10 to-pink-500/10"
                        description="Orders in the period (excl. cancelled)"
                    />
                    <EnhancedMetricCard
                        title="Avg Order Value"
                        value={parseFloat(data?.average_order_value || 0)}
                        currency="KES"
                        icon={Target}
                        gradient="from-amber-500/10 to-orange-500/10"
                        description="Average revenue per order"
                    />
                    <EnhancedMetricCard
                        title="Items Sold"
                        value={data?.total_items_count || 0}
                        icon={Package}
                        gradient="from-cyan-500/10 to-sky-500/10"
                        description="Total quantity of products sold"
                    />
                     <EnhancedMetricCard
                        title="Discounts"
                        value={parseFloat(data?.total_discount || 0)}
                        currency="KES"
                        icon={Percent}
                        gradient="from-red-500/10 to-rose-500/10"
                        description="Total value of discounts given"
                    />
                     <EnhancedMetricCard
                        title="Tax Collected"
                        value={parseFloat(data?.total_tax || 0)}
                        currency="KES"
                        icon={CreditCard}
                        gradient="from-indigo-500/10 to-violet-500/10"
                        description="Total tax amount"
                    />
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sales Trend Chart */}
                    <Card className="lg:col-span-2 shadow-md">
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-primary" />
                                Revenue Trend
                            </CardTitle>
                            <CardDescription>Daily revenue performance over the selected period</CardDescription>
                         </CardHeader>
                         <CardContent>
                             <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.1)" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                                            dy={10}
                                        />
                                        <YAxis 
                                            yAxisId="left"
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                            tickFormatter={(value) => `KES ${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                                            width={80}
                                        />
                                        <YAxis 
                                            yAxisId="right"
                                            orientation="right"
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                        />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'hsl(var(--background))', 
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                            }}
                                            formatter={(value: any, name: string) => [
                                                name === 'revenue' ? `KES ${value.toLocaleString()}` : value,
                                                name.charAt(0).toUpperCase() + name.slice(1)
                                            ]}
                                        />
                                        <Legend verticalAlign="top" height={36} />
                                        <Area 
                                            yAxisId="left"
                                            type="monotone" 
                                            dataKey="revenue" 
                                            stroke="hsl(var(--primary))" 
                                            name="Revenue"
                                            strokeWidth={3}
                                            fillOpacity={1} 
                                            fill="url(#colorRevenue)" 
                                        />
                                        <Bar 
                                            yAxisId="right"
                                            dataKey="orders" 
                                            name="Orders"
                                            fill="hsl(var(--muted)/0.5)" 
                                            radius={[4, 4, 0, 0]} 
                                            barSize={20}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                             </div>
                         </CardContent>
                    </Card>

                    {/* Payment Status Breakdown */}
                    <Card className="shadow-md">
                         <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-primary" />
                                Payment Status
                            </CardTitle>
                            <CardDescription>Revenue distribution by payment status</CardDescription>
                         </CardHeader>
                         <CardContent>
                             <div className="h-[350px] w-full flex flex-col items-center justify-center">
                                {paymentStatusData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={paymentStatusData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {paymentStatusData.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                 formatter={(value: any) => `KES ${value.toLocaleString()}`}
                                                 contentStyle={{ 
                                                    backgroundColor: 'hsl(var(--background))', 
                                                    border: '1px solid hsl(var(--border))',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-center text-muted-foreground">No payment data available</div>
                                )}
                             </div>
                         </CardContent>
                    </Card>
                </div>

                {/* Detailed Data Tabs */}
                <Card className="shadow-sm">
                    <Tabs defaultValue="accounts" className="w-full">
                        <CardHeader className="flex flex-col gap-3 pb-2 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <CardTitle>Detailed Breakdown</CardTitle>
                                <CardDescription>Click a column heading to sort. Every table can be exported.</CardDescription>
                            </div>
                            <TabsList className="flex h-auto flex-wrap">
                                <TabsTrigger value="accounts">Sales Accounts</TabsTrigger>
                                <TabsTrigger value="orders">Orders ({(data?.orders || []).length})</TabsTrigger>
                                <TabsTrigger value="products">Products</TabsTrigger>
                                <TabsTrigger value="customers">Customers</TabsTrigger>
                                <TabsTrigger value="region">By Region</TabsTrigger>
                                <TabsTrigger value="county">By County</TabsTrigger>
                                <TabsTrigger value="town">By Town</TabsTrigger>
                                <TabsTrigger value="rep">By Sales Rep</TabsTrigger>
                                <TabsTrigger value="daily">Daily Log</TabsTrigger>
                            </TabsList>
                        </CardHeader>
                        <CardContent>
                            <TabsContent value="accounts" className="mt-0">
                                <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Sales Accounts</p>
                                        <p className="font-semibold">{periodLabel}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {ledgerRows.length} entr{ledgerRows.length === 1 ? "y" : "ies"}
                                            {ledgerSearch.trim() && ` matching "${ledgerSearch.trim()}"`}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Debit (credit notes)</p>
                                        <p className="font-semibold text-red-700">{kes(ledgerTotals.debit)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Credit (sales)</p>
                                        <p className="font-semibold text-emerald-700">{kes(ledgerTotals.credit)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Balance</p>
                                        <p className="font-semibold">{kes(ledgerTotals.credit - ledgerTotals.debit)}</p>
                                    </div>
                                </div>
                                <Input
                                    value={ledgerSearch}
                                    onChange={(e) => setLedgerSearch(e.target.value)}
                                    placeholder="Search customer, Vch No (NSK/0427) or type..."
                                    className="mb-3 max-w-sm"
                                />
                                <DataTable
                                    pageSizeOptions={PAGE_SIZES}
                                    columns={ledgerColumns}
                                    data={ledgerRows}
                                    hideSearch
                                    exportFileName="sales_accounts"
                                    // As the old system printed it: totals of every entry shown, then the closing balance under Credit.
                                    footer={ledgerRows.length > 0 && (
                                        <>
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-right font-semibold">Current Total:</TableCell>
                                                <TableCell className="text-right font-semibold tabular-nums">{ledgerTotals.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="text-right font-semibold tabular-nums">{ledgerTotals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                <TableCell />
                                            </TableRow>
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-right font-semibold">Closing Balance:</TableCell>
                                                <TableCell className="text-right font-bold tabular-nums">
                                                    {(ledgerTotals.credit - ledgerTotals.debit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell />
                                            </TableRow>
                                        </>
                                    )}
                                />
                            </TabsContent>
                            <TabsContent value="orders" className="mt-0">
                                <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Period</p>
                                        <p className="font-semibold">{periodLabel}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {orderTotals.count} order{orderTotals.count === 1 ? "" : "s"}
                                            {orderSearch.trim() && ` matching "${orderSearch.trim()}"`}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Total</p>
                                        <p className="font-semibold">{kes(orderTotals.total)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Paid</p>
                                        <p className="font-semibold text-emerald-700">{kes(orderTotals.paid)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Balance</p>
                                        <p className="font-semibold text-red-700">{kes(orderTotals.balance)}</p>
                                    </div>
                                </div>
                                <Input
                                    value={orderSearch}
                                    onChange={(e) => setOrderSearch(e.target.value)}
                                    placeholder="Search customer, order or invoice (NSK/0427)..."
                                    className="mb-3 max-w-sm"
                                />
                                <DataTable pageSizeOptions={PAGE_SIZES} columns={ordersColumns} data={shownOrders} hideSearch exportFileName="sales_orders" />
                            </TabsContent>
                            <TabsContent value="products" className="mt-0">
                                <DataTable pageSizeOptions={PAGE_SIZES}
                                    columns={topProductsColumns} 
                                    data={data?.top_products || []} 
                                    filterColumn="name"
                                    exportFileName="top_products_sales"
                                />
                            </TabsContent>
                            <TabsContent value="customers" className="mt-0">
                                <DataTable pageSizeOptions={PAGE_SIZES}
                                    columns={topCustomersColumns} 
                                    data={data?.top_customers || []} 
                                    filterColumn="name"
                                    exportFileName="top_customers_sales"
                                />
                            </TabsContent>
                            <TabsContent value="region" className="mt-0">
                                <DataTable pageSizeOptions={PAGE_SIZES} columns={breakdownColumns("Region")} data={data?.sales_by_region || []} filterColumn="name" exportFileName="sales_by_region" />
                            </TabsContent>
                            <TabsContent value="county" className="mt-0">
                                <DataTable pageSizeOptions={PAGE_SIZES} columns={breakdownColumns("County")} data={data?.sales_by_county || []} filterColumn="name" exportFileName="sales_by_county" />
                            </TabsContent>
                            <TabsContent value="town" className="mt-0">
                                <DataTable pageSizeOptions={PAGE_SIZES} columns={breakdownColumns("Town")} data={data?.sales_by_city || []} filterColumn="name" exportFileName="sales_by_town" />
                            </TabsContent>
                            <TabsContent value="rep" className="mt-0">
                                <DataTable pageSizeOptions={PAGE_SIZES} columns={breakdownColumns("Sales Rep")} data={data?.sales_by_rep || []} filterColumn="name" exportFileName="sales_by_rep" />
                                {(data?.sales_by_rep || []).every((r: any) => r.id === "unassigned") && (
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        No orders have a sales rep yet. Pick the rep when creating or editing an order (roles marked as sales reps appear in that list).
                                    </p>
                                )}
                            </TabsContent>
                            <TabsContent value="daily" className="mt-0">
                                <DataTable pageSizeOptions={PAGE_SIZES}
                                    columns={summaryColumns} 
                                    data={data?.summary_by_date || []} 
                                    filterColumn="date"
                                    exportFileName="daily_sales_log"
                                />
                            </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>
            </div>
        )}
      </div>
    </PermissionGuard>
  )
}
