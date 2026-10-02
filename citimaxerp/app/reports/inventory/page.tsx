"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getInventoryReport } from "@/lib/reports"
import { getProductCategories, type ProductCategory } from "@/lib/product-categories"
import { getStores, type Store } from "@/lib/stores"
import { DataTable } from "@/components/ui/data-table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Package, AlertTriangle, TrendingUp, Filter, DollarSign, CalendarClock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export default function InventoryReportPage() {
  const [reportType, setReportType] = useState<'balance' | 'low_stock' | 'movement' | 'stock_management'>('balance')
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [stores, setStores] = useState<Store[]>([])

  // Filters
  const [categoryId, setCategoryId] = useState<string>("all")
  const [storeId, setStoreId] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  // Stock Management report period - defaults (month-to-date) come from the
  // backend when left blank, so these start empty.
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  // Stock Management report: show only the reorder-alert lines when true.
  const [showReorderOnly, setShowReorderOnly] = useState(false)

  const { toast } = useToast()

  const fetchFilters = useCallback(async () => {
    try {
      const [cats, strs] = await Promise.all([
        getProductCategories({ is_active: true }),
        getStores()
      ])
      setCategories(cats)
      setStores(strs)
    } catch (error) {
      console.error("Error fetching filters:", error)
    }
  }, [])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { type: reportType }
      if (categoryId !== "all") params.category_id = categoryId
      if (storeId !== "all") params.store_id = storeId
      if (status !== "all") params.status = status
      if (reportType === "stock_management") {
        if (dateFrom) params.date_from = dateFrom
        if (dateTo) params.date_to = dateTo
      }

      const resp = await getInventoryReport(params)
      if (resp.status === "success") {
        setData(resp.data || [])
        setSummary(resp.summary || null)
        setPeriod(resp.period || null)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch inventory report",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [reportType, categoryId, storeId, status, dateFrom, dateTo, toast])

  useEffect(() => {
    fetchFilters()
  }, [fetchFilters])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const balanceColumns = [
    { accessorKey: "sku", header: "SKU" },
    { accessorKey: "name", header: "Product Name" },
    { accessorKey: "category", header: "Category" },
    { accessorKey: "stock_quantity", header: "Stock Qty" },
    { accessorKey: "on_hand", header: "On Hand" },
    { accessorKey: "allocated", header: "Allocated" },
    { accessorKey: "price", header: "Price", cell: ({ row }: any) => `KES ${parseFloat(row.original.price).toLocaleString()}` },
  ]

  const lowStockColumns = [
    { accessorKey: "sku", header: "SKU" },
    { accessorKey: "name", header: "Product Name" },
    { accessorKey: "stock_quantity", header: "Current Stock" },
    { accessorKey: "low_stock_threshold", header: "Threshold" },
    { accessorKey: "inventory_status", header: "Status" },
  ]

  const movementColumns = [
    { 
      accessorKey: "movement_date", 
      header: "Date",
      cell: ({ row }: any) => new Date(row.original.movement_date).toLocaleString()
    },
    { accessorKey: "product.name", header: "Product", cell: ({ row }: any) => row.original.product?.name },
    { accessorKey: "type", header: "Type" },
    { accessorKey: "quantity", header: "Quantity" },
    { accessorKey: "quantity_before", header: "Before" },
    { accessorKey: "quantity_after", header: "After" },
    { accessorKey: "reference_type", header: "Reference" },
  ]

  const stockManagementColumns = [
    { accessorKey: "sku", header: "SKU" },
    { accessorKey: "name", header: "Product Name" },
    { accessorKey: "opening_stock", header: "Opening Stock" },
    { accessorKey: "sales_quantity", header: "Sales Qty" },
    { accessorKey: "closing_stock", header: "Closing Stock" },
    {
      accessorKey: "closing_stock_value",
      header: "Closing Value (Buying Price)",
      cell: ({ row }: any) => `KES ${Number(row.original.closing_stock_value).toLocaleString()}`,
    },
    {
      accessorKey: "gross_profit",
      header: "Gross Profit",
      cell: ({ row }: any) => `KES ${Number(row.original.gross_profit).toLocaleString()}`,
    },
    {
      accessorKey: "months_of_stock",
      header: "Stock Cover",
      cell: ({ row }: any) =>
        row.original.months_of_stock === null ? "—" : `${row.original.months_of_stock} mo`,
    },
    {
      accessorKey: "needs_reorder",
      header: "Reorder",
      cell: ({ row }: any) =>
        row.original.needs_reorder ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Reorder Now
          </Badge>
        ) : (
          <span className="text-muted-foreground">OK</span>
        ),
    },
  ]

  const getColumns = () => {
    switch (reportType) {
      case 'low_stock': return lowStockColumns;
      case 'movement': return movementColumns;
      case 'stock_management': return stockManagementColumns;
      default: return balanceColumns;
    }
  }

  return (
    <PermissionGuard permissions={["can_view_reports_menu", "can_view_inventory_reports", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Inventory Reports</h1>
            <p className="text-sm text-gray-600">Analyze stock levels and movements</p>
          </div>
          <Button onClick={fetchReport} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Store/Warehouse</label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {reportType === 'stock_management' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">From</label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">To</label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {summary && reportType === 'balance' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total_items}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total_stock}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Allocated</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total_allocated}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <CardTitle className="text-sm font-medium">KES</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">KES {parseFloat(summary.total_value).toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {summary && reportType === 'stock_management' && (
          <>
            {summary.reorder_alert_count > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium flex-1">
                  {summary.reorder_alert_count} product{summary.reorder_alert_count === 1 ? "" : "s"} will run out
                  within 3 months at the current sales rate - reorder now.
                </p>
                <Button
                  size="sm"
                  variant={showReorderOnly ? "default" : "outline"}
                  className={showReorderOnly ? "bg-red-600 hover:bg-red-700" : "border-red-300 text-red-700 hover:bg-red-100"}
                  onClick={() => setShowReorderOnly((prev) => !prev)}
                >
                  {showReorderOnly ? "Showing Reorder Alerts" : "View Reorder Alerts"}
                </Button>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Closing Stock</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.total_closing_stock}</div>
                  {period && <p className="text-xs text-muted-foreground">as of {period.date_to}</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Closing Stock Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">KES {Number(summary.total_closing_stock_value).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">at buying price</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">KES {Number(summary.total_gross_profit).toLocaleString()}</div>
                  {period && <p className="text-xs text-muted-foreground">{period.date_from} to {period.date_to}</p>}
                </CardContent>
              </Card>
              <Card
                role="button"
                tabIndex={0}
                onClick={() => summary.reorder_alert_count > 0 && setShowReorderOnly((prev) => !prev)}
                className={`transition-colors ${summary.reorder_alert_count > 0 ? "cursor-pointer hover:border-red-300 hover:bg-red-50" : ""} ${showReorderOnly ? "border-red-400 bg-red-50" : ""}`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Reorder Alerts</CardTitle>
                  <CalendarClock className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{summary.reorder_alert_count}</div>
                  <p className="text-xs text-muted-foreground">
                    {summary.reorder_alert_count > 0 ? (showReorderOnly ? "click to show all" : "click to view only these") : "less than 3 months of cover"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {summary && reportType === 'low_stock' && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{summary.total_low_stock_items}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Stock (Low Items)</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total_stock}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Report Content */}
        <Tabs
          value={reportType}
          onValueChange={(v: any) => {
            setReportType(v)
            setShowReorderOnly(false)
          }}
        >
          <TabsList>
            <TabsTrigger value="balance">Stock Balance</TabsTrigger>
            <TabsTrigger value="low_stock">Low Stock</TabsTrigger>
            <TabsTrigger value="movement">Stock Movement</TabsTrigger>
            <TabsTrigger value="stock_management">Stock Management</TabsTrigger>
          </TabsList>

          <TabsContent value={reportType} className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <DataTable
                columns={getColumns()}
                data={reportType === "stock_management" && showReorderOnly ? data.filter((row) => row.needs_reorder) : data}
                filterColumn="name"
                exportFileName={`inventory_${reportType}_report`}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
