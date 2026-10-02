"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSalesReport, getCustomerLocationData, CustomerLocationData } from "@/lib/reports"
import { getCustomers, Customer } from "@/lib/customers"
import { getProductCategories, ProductCategory } from "@/lib/product-categories"
import { DataTable } from "@/components/ui/data-table"
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
import { cn } from "@/lib/utils"

// Mock Data from User Request
const MOCK_DATA = {
    "status": "success",
    "data": {
        "total_sales": "3652338.00",
        "total_subtotal": "3652338.00",
        "total_discount": "0.00",
        "total_tax": "0.00",
        "order_count": 59,
        "average_order_value": "61904.033898305085",
        "total_items_count": 597265,
        "summary_by_date": [
            {
                "date": "2026-01-27",
                "total": "825618.30",
                "count": 4,
                "item_count": 152261
            },
            {
                "date": "2026-01-28",
                "total": "2826719.70",
                "count": 55,
                "item_count": 445004
            }
        ],
        "top_categories": [
            {
                "category": "Medical Supplies", // Added name for demo
                "total_revenue": "3652338.00"
            }
        ],
        "top_products": [
            {
                "name": "Syringe",
                "sku": "SYR-001",
                "total_quantity": 535240,
                "total_revenue": "1687214.00"
            },
            {
                "name": "Tape",
                "sku": "TAP-002",
                "total_quantity": 10568,
                "total_revenue": "730179.00"
            },
            {
                "name": "Bandage",
                "sku": "BND-003",
                "total_quantity": 21293,
                "total_revenue": "394208.80"
            },
            {
                "name": "Suture",
                "sku": "STR-004",
                "total_quantity": 11112,
                "total_revenue": "323231.00"
            },
            {
                "name": "Catheter",
                "sku": "CTH-005",
                "total_quantity": 3610,
                "total_revenue": "114335.20"
            }
        ],
        "top_customers": [
            {
                "name": "Lenexa Healthcare Ltd",
                "location": "Nairobi",
                "order_count": 9,
                "total_spent": "1388604.10"
            },
            {
                "name": "Stofix Kenya Ltd",
                "location": "Nairobi",
                "order_count": 3,
                "total_spent": "292831.00"
            },
            {
                "name": "Veteran Pharmaceuticals Ltd",
                "location": "Nairobi",
                "order_count": 6,
                "total_spent": "242607.00"
            },
            {
                "name": "Arap Tosha Chemist",
                "location": "Kakamega",
                "order_count": 1,
                "total_spent": "205140.00"
            },
            {
                "name": "Pharma Choice Pharmaceutical Ltd",
                "location": "Nairobi",
                "order_count": 1,
                "total_spent": "188208.48"
            }
        ],
        "payment_status_breakdown": [
            {
                "payment_status": "unpaid",
                "count": 59,
                "total": "3652338.00"
            }
        ]
    }
}

type DateRangeType = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'this_year' | 'custom'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function SalesReportPage() {
  const [data, setData] = useState<any>(MOCK_DATA.data) // Initialize with MOCK_DATA for check
  const [loading, setLoading] = useState(false)
  
  // Filter States
  const [dateRange, setDateRange] = useState<DateRangeType>('last_30_days')
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [city, setCity] = useState<string>("all")
  const [orderStatus, setOrderStatus] = useState<string>("all")
  const [paymentStatus, setPaymentStatus] = useState<string>("all")
  const [customerId, setCustomerId] = useState<string>("all")
  const [categoryId, setCategoryId] = useState<string>("all")

  // Options Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [locations, setLocations] = useState<CustomerLocationData[]>([])

  const { toast } = useToast()

  // Fetch filter options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const [custData, catData, locData] = await Promise.all([
            getCustomers(),
            getProductCategories({ is_active: true }),
            getCustomerLocationData()
        ])
        setCustomers(custData || [])
        setCategories(catData || [])
        setLocations(locData || [])
      } catch (e) {
        console.error("Failed to load filter options", e)
      }
    }
    loadOptions()
  }, [])

  const calculateDateFrom = (range: DateRangeType) => {
    const today = new Date()
    switch (range) {
      case 'today':
        return today.toISOString().split('T')[0]
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(today.getDate() - 1)
        return yesterday.toISOString().split('T')[0]
      case 'last_7_days':
        const last7 = new Date(today)
        last7.setDate(today.getDate() - 7)
        return last7.toISOString().split('T')[0]
      case 'last_30_days':
        const last30 = new Date(today)
        last30.setDate(today.getDate() - 30)
        return last30.toISOString().split('T')[0]
      case 'this_month':
        return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
      case 'this_year':
        return new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0]
      case 'custom':
        return dateFrom
      default:
        return ""
    }
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { type: 'performance' }
      const effectiveDateFrom = calculateDateFrom(dateRange)
      if (effectiveDateFrom) params.date_from = effectiveDateFrom
      if (dateRange === 'custom' && dateTo) params.date_to = dateTo
      if (city && city !== 'all') params.city = city
      if (orderStatus && orderStatus !== 'all') params.status = orderStatus
      if (paymentStatus && paymentStatus !== 'all') params.payment_status = paymentStatus
      if (customerId && customerId !== 'all') params.customer_id = customerId
      if (categoryId && categoryId !== 'all') params.category_id = categoryId

      console.log("Fetching report with params:", params)
      const resp = await getSalesReport(params)
      
      if (resp.status === "success") {
        setData(resp.data)
      } else {
        // Fallback or error - for now keeping MOCK data on error might be confusing, but explicit error is better
        toast({
            title: "Warning",
            description: resp.message || "Could not fetch fresh data. Showing cached/mock data.",
            variant: "destructive", // Changed to destructive to signal actual api fail
        })
        // In real app, maybe don't overwrite with mock data if real fetch failed, providing the mock was just for dev
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch sales report",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [dateRange, dateFrom, dateTo, city, orderStatus, paymentStatus, customerId, categoryId, toast])

  // Trigger fetch on initial load or filters change? 
  // Let's make it manual to avoid spamming or auto for UX? 
  // The 'Identify Trends' button suggests manual. Let's stick to manual or Effect if desired.
  // Existing code had manual button. I'll keep the button but also initial load.
  useEffect(() => {
    // Initial fetch
    // fetchReport() 
    // Commented out to use Mock Data by default as requested for development
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const topProductsColumns = [
    { accessorKey: "name", header: "Product Name" },
    { accessorKey: "sku", header: "SKU" },
    { accessorKey: "total_quantity", header: "Units Sold" },
    { 
        accessorKey: "total_revenue", 
        header: "Total Revenue", 
        cell: ({ row }: any) => `KES ${parseFloat(row.original.total_revenue).toLocaleString()}` 
    },
  ]

  const topCustomersColumns = [
    { accessorKey: "name", header: "Customer" },
    { accessorKey: "location", header: "Location" },
    { accessorKey: "order_count", header: "Orders" },
    { 
        accessorKey: "total_spent", 
        header: "Total Spent", 
        cell: ({ row }: any) => `KES ${parseFloat(row.original.total_spent).toLocaleString()}` 
    },
  ]

  const summaryColumns = [
    { accessorKey: "date", header: "Date" },
    { accessorKey: "count", header: "Orders" },
    { accessorKey: "item_count", header: "Items Sold" },
    { 
        accessorKey: "total", 
        header: "Total Revenue", 
        cell: ({ row }: any) => `KES ${parseFloat(row.original.total).toLocaleString()}` 
    },
  ]

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
        <Card className="border-border/40 bg-background/60 backdrop-blur-md shadow-sm sticky top-0 z-20">
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

              {/* Location Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Location
                </label>
                <Select value={city} onValueChange={setCity}>
                   <SelectTrigger className="h-9 bg-background/50">
                       <SelectValue placeholder="All Locations" />
                   </SelectTrigger>
                   <SelectContent>
                       <SelectItem value="all">All Locations</SelectItem>
                       {locations.map((loc, idx) => (
                           <SelectItem key={idx} value={loc.city}>{loc.city}</SelectItem>
                       ))}
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
                 <Select value={customerId} onValueChange={setCustomerId}>
                   <SelectTrigger className="h-9 bg-background/50">
                       <SelectValue placeholder="All Customers" />
                   </SelectTrigger>
                   <SelectContent>
                       <SelectItem value="all">All Customers</SelectItem>
                       {customers.map((c) => (
                           <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                       ))}
                   </SelectContent>
                 </Select>
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
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <EnhancedMetricCard
                        title="Total Sales"
                        value={parseFloat(data?.total_sales || 0)}
                        currency="KES"
                        icon={TrendingUp}
                        gradient="from-emerald-500/10 to-teal-500/10"
                        description="Gross revenue before deductions"
                    />
                    <EnhancedMetricCard
                        title="Net Sales"
                        value={parseFloat(data?.total_subtotal || 0)}
                        currency="KES"
                        icon={DollarSign}
                        gradient="from-blue-500/10 to-indigo-500/10"
                        description="Revenue after discounts"
                    />
                    <EnhancedMetricCard
                        title="Total Orders"
                        value={data?.order_count || 0}
                        icon={ShoppingBag}
                        gradient="from-purple-500/10 to-pink-500/10"
                        description="Number of completed transactions"
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
                    <Tabs defaultValue="products" className="w-full">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>Detailed Breakdown</CardTitle>
                            <TabsList className="grid w-full max-w-[400px] grid-cols-3">
                                <TabsTrigger value="products">Top Products</TabsTrigger>
                                <TabsTrigger value="customers">Top Customers</TabsTrigger>
                                <TabsTrigger value="daily">Daily Log</TabsTrigger>
                            </TabsList>
                        </CardHeader>
                        <CardContent>
                            <TabsContent value="products" className="mt-0">
                                <DataTable 
                                    columns={topProductsColumns} 
                                    data={data?.top_products || []} 
                                    filterColumn="name"
                                    exportFileName="top_products_sales"
                                />
                            </TabsContent>
                            <TabsContent value="customers" className="mt-0">
                                <DataTable 
                                    columns={topCustomersColumns} 
                                    data={data?.top_customers || []} 
                                    filterColumn="name"
                                    exportFileName="top_customers_sales"
                                />
                            </TabsContent>
                            <TabsContent value="daily" className="mt-0">
                                <DataTable 
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
