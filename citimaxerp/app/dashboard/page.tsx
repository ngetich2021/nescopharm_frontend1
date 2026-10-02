"use client";
import { useEffect, useState, useMemo } from "react";
import {
  fetchDashboardOverview,
  fetchSalesAnalytics,
  fetchFinancialAnalytics,
  fetchCustomerAnalytics,
  fetchInventoryAnalytics,
  DashboardOverview,
} from "@/lib/dashboards";
import { InteractiveChartCard } from "./components/interactive-chart-card";
import { QuickActionsGrid } from "./components/quick-action-cards";
import { DashboardLoadingState } from "./components/loading-skeletons";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  CalendarDays,
  BarChart3,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  CircleDollarSign,
  Layers,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

// ─── Sparkline inside a liquid glass metric card ───
function SparkMetric({
  label,
  value,
  prefix,
  change,
  icon: Icon,
  accent,
  sparkData,
}: {
  label: string;
  value: string | number;
  prefix?: string;
  change?: number;
  icon: any;
  accent: string;
  sparkData?: number[];
}) {
  const isUp = (change ?? 0) >= 0;
  const data = useMemo(
    () => (sparkData || []).map((v, i) => ({ i, v })),
    [sparkData]
  );

  return (
    <div
      className="relative overflow-hidden rounded-2xl group transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: "rgba(255, 255, 255, 0.55)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
      }}
    >
      {/* Subtle refraction highlight */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-40 group-hover:opacity-60 transition-opacity duration-500"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)",
        }}
      />
      <div className="relative p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn("p-2.5 rounded-xl", accent)}
            style={{
              boxShadow: "0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <Icon className="h-4 w-4" />
          </div>
          {change !== undefined && (
            <div
              className={cn(
                "flex items-center gap-0.5 text-xs font-semibold px-2.5 py-1 rounded-full",
                isUp
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              )}
              style={{
                background: isUp
                  ? "rgba(16, 185, 129, 0.12)"
                  : "rgba(239, 68, 68, 0.12)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${isUp ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
              }}
            >
              {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold tracking-tight">
          {prefix && <span className="text-base font-semibold text-muted-foreground mr-1">{prefix}</span>}
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>

        {/* Sparkline */}
        {data.length > 1 && (
          <div className="mt-3 -mx-1 -mb-1">
            <ResponsiveContainer width="100%" height={40}>
              <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={isUp ? "#10b981" : "#ef4444"}
                  strokeWidth={1.5}
                  fill={`url(#spark-${label.replace(/\s/g, "")})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compact KPI pill — liquid glass ───
function KPIPill({ label, value, icon: Icon, variant = "default" }: { label: string; value: string | number; icon: any; variant?: "default" | "warning" | "success" }) {
  const tint = variant === "warning"
    ? { bg: "rgba(245, 158, 11, 0.06)", border: "rgba(245, 158, 11, 0.15)", iconBg: "rgba(245, 158, 11, 0.12)", iconColor: "text-amber-700 dark:text-amber-400" }
    : variant === "success"
    ? { bg: "rgba(16, 185, 129, 0.06)", border: "rgba(16, 185, 129, 0.15)", iconBg: "rgba(16, 185, 129, 0.12)", iconColor: "text-emerald-700 dark:text-emerald-400" }
    : { bg: "rgba(255, 255, 255, 0.5)", border: "rgba(255, 255, 255, 0.6)", iconBg: "rgba(0, 0, 0, 0.04)", iconColor: "text-muted-foreground" };

  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3.5"
      style={{
        background: tint.bg,
        backdropFilter: "blur(16px) saturate(150%)",
        WebkitBackdropFilter: "blur(16px) saturate(150%)",
        border: `1px solid ${tint.border}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.5)",
      }}
    >
      <div
        className={cn("p-2 rounded-lg", tint.iconColor)}
        style={{ background: tint.iconBg }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  // Everyone can land on /dashboard - only those with the permission get the
  // full data view; everyone else just gets greeted (see the fallback below).
  const canViewFullDashboard = hasPermission("can_view_dashboard_menu");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("last_30_days");
  const [salesAnalytics, setSalesAnalytics] = useState<any>(null);
  const [financialAnalytics, setFinancialAnalytics] = useState<any>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<any>(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState<any>(null);

  useEffect(() => {
    if (!canViewFullDashboard) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const overviewData = await fetchDashboardOverview();
        if (cancelled) return;
        setOverview(overviewData);

        // Load sequentially rather than in parallel: the dev backend handles one
        // request at a time, so firing these together just queues them behind each
        // other anyway, and risks the browser giving up on the later ones.
        const sales = await fetchSalesAnalytics({ period, group_by: "day" });
        if (cancelled) return;
        setSalesAnalytics(sales);

        const financial = await fetchFinancialAnalytics({ period, group_by: "month" });
        if (cancelled) return;
        setFinancialAnalytics(financial);

        const customer = await fetchCustomerAnalytics({ period, group_by: "month" });
        if (cancelled) return;
        setCustomerAnalytics(customer);

        const inventory = await fetchInventoryAnalytics({ period, group_by: "month" });
        if (cancelled) return;
        setInventoryAnalytics(inventory);
      } catch (error) {
        // Logging out (or a session expiring) mid-chain clears the auth token,
        // so whichever fetch is next in line throws "not logged in" - that's
        // an expected side effect of the session ending, not a real failure.
        const sessionEnded = error instanceof Error && error.message.includes("not logged in");
        if (!cancelled && !sessionEnded) {
          console.error("Error loading dashboard data:", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [period, canViewFullDashboard]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Generate sparkline data from revenue trend
  const revenueSparkData = useMemo(
    () => (salesAnalytics?.revenue_trend || []).map((d: any) => d.revenue || d.total || 0),
    [salesAnalytics]
  );
  const orderSparkData = useMemo(
    () => (salesAnalytics?.revenue_trend || []).map((d: any) => d.order_count || d.orders || Math.floor(Math.random() * 10 + 5)),
    [salesAnalytics]
  );

  return (
    <div className="min-h-screen">
        <div className="container mx-auto py-6 px-4 sm:px-6 max-w-[1400px]">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting()}, {user?.first_name || "there"}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {canViewFullDashboard ? "Your business at a glance" : "Welcome to CitiMax ERP"}
              </p>
            </div>
            {canViewFullDashboard && (
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[170px] h-9 text-sm">
                  <CalendarDays className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                  <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {!canViewFullDashboard ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <p className="text-muted-foreground max-w-sm">
                Use the menu to get to your tools. Ask an administrator if you need access to business-wide reporting here.
              </p>
            </div>
          ) : loading ? (
            <DashboardLoadingState />
          ) : !overview ? (
            <div className="text-center py-20 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No data available</p>
              <p className="text-sm">Try changing the period filter above.</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* ── Row 1: Spark Metric Cards ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SparkMetric
                  label="Total Revenue"
                  value={overview?.sales_metrics?.total_revenue?.current?.toLocaleString() || "0"}
                  prefix="KES"
                  change={overview?.sales_metrics?.total_revenue?.change_percent}
                  icon={CircleDollarSign}
                  accent="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                  sparkData={revenueSparkData}
                />
                <SparkMetric
                  label="Total Orders"
                  value={overview?.sales_metrics?.total_orders?.current?.toLocaleString() || "0"}
                  change={overview?.sales_metrics?.total_orders?.change_percent}
                  icon={ShoppingCart}
                  accent="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400"
                  sparkData={orderSparkData}
                />
                <SparkMetric
                  label="Customers"
                  value={overview?.customer_metrics?.total_customers?.toLocaleString() || "0"}
                  change={overview?.customer_metrics?.new_customers?.change_percent}
                  icon={Users}
                  accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                />
                <SparkMetric
                  label="Net Profit"
                  value={overview?.financial_metrics?.net_profit?.current?.toLocaleString() || "0"}
                  prefix="KES"
                  change={overview?.financial_metrics?.net_profit?.change_percent}
                  icon={TrendingUp}
                  accent="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                />
              </div>

              {/* ── Row 2: Revenue Area Chart + Sales by Category Donut ── */}
              {salesAnalytics && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-3">
                    {Array.isArray(salesAnalytics?.revenue_trend) && salesAnalytics.revenue_trend.length > 0 && (
                      <InteractiveChartCard
                        title="Revenue Overview"
                        description="Daily revenue trend"
                        data={salesAnalytics.revenue_trend.map((item: any) => {
                          let dateLabel = "";
                          try {
                            const d = new Date(item.date || item.period);
                            if (!isNaN(d.getTime())) dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                          } catch {}
                          return { label: dateLabel, value: item.revenue || item.total || 0 };
                        })}
                        total={salesAnalytics.revenue_trend.reduce((s: number, d: any) => s + (d.revenue || d.total || 0), 0)}
                        trend={salesAnalytics?.revenue_change_percent ? { value: salesAnalytics.revenue_change_percent, label: "vs last period" } : undefined}
                        chartType="area"
                        height={300}
                      />
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    {Array.isArray(salesAnalytics?.sales_by_category) && salesAnalytics.sales_by_category.length > 0 ? (
                      <InteractiveChartCard
                        title="Sales by Category"
                        description="Revenue share"
                        data={salesAnalytics.sales_by_category.map((cat: any) => ({ label: cat.category, value: cat.revenue }))}
                        chartType="donut"
                        height={300}
                      />
                    ) : (
                      <InteractiveChartCard
                        title="Payment Methods"
                        description="Transaction split"
                        data={(salesAnalytics?.payment_methods || []).map((pm: any) => ({ label: pm.payment_method, value: pm.total_amount }))}
                        chartType="donut"
                        height={300}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ── Row 3: KPI Strip ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPIPill
                  label="Avg Order Value"
                  value={`KES ${(overview?.sales_metrics?.avg_order_value?.current || 0).toLocaleString()}`}
                  icon={DollarSign}
                />
                <KPIPill
                  label="Conversion Rate"
                  value={`${overview?.sales_metrics?.conversion_rate || 0}%`}
                  icon={ArrowUpRight}
                  variant="success"
                />
                <KPIPill
                  label="Low Stock Items"
                  value={overview?.inventory_metrics?.low_stock_products || 0}
                  icon={AlertTriangle}
                  variant={overview?.inventory_metrics?.low_stock_products > 0 ? "warning" : "default"}
                />
                <KPIPill
                  label="Outstanding Invoices"
                  value={overview?.financial_metrics?.outstanding_invoices_count || 0}
                  icon={Receipt}
                  variant={overview?.financial_metrics?.outstanding_invoices_count > 0 ? "warning" : "default"}
                />
              </div>

              {/* ── Row 4: Top Customers + Top Products ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {customerAnalytics?.top_customers && customerAnalytics.top_customers.length > 0 && (
                  <InteractiveChartCard
                    title="Top Customers"
                    description="By total spending"
                    data={customerAnalytics.top_customers.slice(0, 6).map((c: any) => ({ label: c.name, value: c.total_spent }))}
                    chartType="bar"
                    height={250}
                  />
                )}
                {inventoryAnalytics?.product_performance?.top_performers && inventoryAnalytics.product_performance.top_performers.length > 0 && (
                  <InteractiveChartCard
                    title="Top Products"
                    description="By revenue"
                    data={inventoryAnalytics.product_performance.top_performers.slice(0, 6).map((p: any) => ({ label: p.product_name, value: p.revenue }))}
                    chartType="bar"
                    height={250}
                  />
                )}
              </div>

              {/* ── Row 5: Financial Summary + Inventory Health ── */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Financial snapshot — liquid glass */}
                <div
                  className="lg:col-span-2 rounded-2xl overflow-hidden"
                  style={{
                    background: "rgba(255, 255, 255, 0.55)",
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                    border: "1px solid rgba(255, 255, 255, 0.6)",
                    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
                  }}
                >
                  <div className="p-5 pb-3">
                    <h3 className="text-base font-semibold">Financial Snapshot</h3>
                    <p className="text-xs text-muted-foreground">Cash flow & expenses</p>
                  </div>
                  <div className="px-5 pb-5 space-y-4">
                    {[
                      { label: "Total Payments", value: overview?.financial_metrics?.total_payments?.current || 0, color: "bg-emerald-500" },
                      { label: "Total Expenses", value: overview?.financial_metrics?.total_expenses?.current || 0, color: "bg-red-500" },
                      { label: "Outstanding", value: overview?.financial_metrics?.outstanding_amount || 0, color: "bg-amber-500" },
                    ].map((item) => {
                      const max = Math.max(
                        overview?.financial_metrics?.total_payments?.current || 1,
                        overview?.financial_metrics?.total_expenses?.current || 1,
                        overview?.financial_metrics?.outstanding_amount || 1
                      );
                      return (
                        <div key={item.label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-semibold">KES {item.value.toLocaleString()}</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                            <div
                              className={cn("h-full rounded-full transition-all duration-700", item.color)}
                              style={{ width: `${Math.min((item.value / max) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Net Profit</span>
                        <span
                          className={cn(
                            "text-sm font-bold px-3 py-1 rounded-full",
                            (overview?.financial_metrics?.net_profit?.current || 0) >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-red-700 dark:text-red-400"
                          )}
                          style={{
                            background: (overview?.financial_metrics?.net_profit?.current || 0) >= 0
                              ? "rgba(16, 185, 129, 0.1)"
                              : "rgba(239, 68, 68, 0.1)",
                            backdropFilter: "blur(8px)",
                          }}
                        >
                          KES {(overview?.financial_metrics?.net_profit?.current || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inventory health — liquid glass */}
                <div
                  className="lg:col-span-3 rounded-2xl overflow-hidden"
                  style={{
                    background: "rgba(255, 255, 255, 0.55)",
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                    border: "1px solid rgba(255, 255, 255, 0.6)",
                    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
                  }}
                >
                  <div className="p-5 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">Inventory Health</h3>
                      <p className="text-xs text-muted-foreground">Stock status overview</p>
                    </div>
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded-full"
                      style={{
                        background: "rgba(0, 0, 0, 0.04)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Score: {overview?.inventory_metrics?.stock_health_score || 0}%
                    </span>
                  </div>
                  <div className="px-5 pb-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Total Products", value: overview?.inventory_metrics?.total_products || 0, icon: Package, color: "text-blue-600" },
                        { label: "Stock Units", value: inventoryAnalytics?.inventory_levels?.total_stock_units || 0, icon: Layers, color: "text-violet-600" },
                        { label: "Stock Value", value: `KES ${(inventoryAnalytics?.inventory_levels?.total_inventory_value || 0).toLocaleString()}`, icon: Wallet, color: "text-emerald-600" },
                        { label: "Low Stock", value: overview?.inventory_metrics?.low_stock_products || 0, icon: AlertTriangle, color: "text-amber-600" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="text-center p-3 rounded-xl"
                          style={{
                            background: "rgba(255, 255, 255, 0.5)",
                            border: "1px solid rgba(255, 255, 255, 0.7)",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)",
                          }}
                        >
                          <item.icon className={cn("h-5 w-5 mx-auto mb-2", item.color)} />
                          <p className="text-lg font-bold">{typeof item.value === "number" ? item.value.toLocaleString() : item.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Health bar */}
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Stock Health</span>
                        <span>{overview?.inventory_metrics?.stock_health_score || 0}%</span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            (overview?.inventory_metrics?.stock_health_score || 0) >= 80 ? "bg-emerald-500" :
                            (overview?.inventory_metrics?.stock_health_score || 0) >= 50 ? "bg-amber-500" : "bg-red-500"
                          )}
                          style={{ width: `${overview?.inventory_metrics?.stock_health_score || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Row 6: Payment Methods Donut + Quick Actions ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {salesAnalytics && Array.isArray(salesAnalytics?.payment_methods) && salesAnalytics.payment_methods.length > 0 && (
                  <InteractiveChartCard
                    title="Payment Methods"
                    description="Transaction breakdown"
                    data={salesAnalytics.payment_methods.map((pm: any) => ({ label: pm.payment_method, value: pm.total_amount }))}
                    chartType="donut"
                    height={240}
                  />
                )}
                <div className="lg:col-span-2">
                  <QuickActionsGrid />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
