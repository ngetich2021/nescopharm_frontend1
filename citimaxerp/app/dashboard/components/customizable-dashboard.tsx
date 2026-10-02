"use client";

import { useState, useEffect } from "react";
import { DashboardSummaryCards } from "./dashboard-summary-cards";
// @ts-ignore - react-grid-layout doesn't have TypeScript definitions
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { SalesOverview } from "./sales-overview";
import { CustomerMetrics } from "./customer-metrics";
import { InventoryOverview } from "./inventory-overview";
import { TicketSummary } from "./ticket-summary";
import { RecentActivity } from "./recent-activity";
import { PerformanceMetrics } from "./performance-metrics";
import { TopProducts } from "./top-products";
import { SalesForecast } from "./sales-forecast";
import { fetchDashboardWidgets, fetchDashboardOverview } from "@/lib/dashboards";
import { BatchSummaryWidget } from "./batch-summary-widget";

// Types
type BreakpointLayouts = Record<string, any>;

// Map backend widget_type to frontend component and permission
const widgetTypeMap = {
  sales_overview: {
    component: SalesOverview,
    title: "Sales Overview",
    description: "Total orders, revenue, and trends",
  },
  revenue_chart: {
    component: PerformanceMetrics, // You may want a dedicated RevenueChart component
    title: "Revenue Chart",
    description: "Revenue trends over 12 months",
  },
  recent_orders: {
    component: TicketSummary, // Replace with RecentOrders if you have it
    title: "Recent Orders",
    description: "Latest 10 customer orders",
  },
  top_products: {
    component: TopProducts,
    title: "Top Products",
    description: "Top 10 products by revenue",
  },
  inventory_alerts: {
    component: InventoryOverview, // Replace with InventoryAlerts if you have it
    title: "Inventory Alerts",
    description: "Low/out of stock notifications",
  },
  batch_summary: {
    component: BatchSummaryWidget,
    title: "Batch Summary",
    description: "Batch tracking overview with expiries",
  },
  customer_insights: {
    component: CustomerMetrics,
    title: "Customer Insights",
    description: "New vs repeat customers, retention",
  },
  expense_summary: {
    component: SalesForecast, // Replace with ExpenseSummary if you have it
    title: "Expense Summary",
    description: "Current month expense breakdown",
  },
  cash_flow: {
    component: PerformanceMetrics, // Replace with CashFlow if you have it
    title: "Cash Flow",
    description: "6-month cash flow analysis",
  },
  payment_methods: {
    component: SalesForecast, // Replace with PaymentMethods if you have it
    title: "Payment Methods",
    description: "30-day payment distribution",
  },
  customer_lifetime_value: {
    component: CustomerMetrics, // Replace with CustomerLifetimeValue if you have it
    title: "Customer Lifetime Value",
    description: "Top 15 customers by value",
  },
};

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function CustomizableDashboard() {
  const { userProfile } = useAuth?.() || {};
  const [overview, setOverview] = useState<any>(null);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [widgetData, setWidgetData] = useState<Record<string, any>>({});
  const [layouts, setLayouts] = useState<BreakpointLayouts>({});
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>("lg");
  const [editMode] = useState(false); // Edit mode not implemented in UI yet
  const [isClient, setIsClient] = useState(false);

  // Ensure dashboard renders only on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch widgets for dashboard
  useEffect(() => {
    async function getWidgets() {
      const json = await fetchDashboardWidgets();
      console.log("/api/dashboard/widgets response:", json); // Debug log
      // @ts-ignore - Type definition mismatch
      if (Array.isArray(json)) {
        setWidgets(json);
      }
    }
    getWidgets();
  }, []);

  // Fetch dashboard overview for summary cards
  useEffect(() => {
    async function getOverview() {
      const json = await fetchDashboardOverview();
      // @ts-ignore - Type definition mismatch
      if (json) {
        setOverview(json);
      }
    }
    getOverview();
  }, []);
  // Permissions mapping from user profile
  const userPermissions: string[] = (userProfile && userProfile.role && userProfile.role.permissions 
    ? userProfile.role.permissions.map((p: any) => p.key || p.name) 
    : []) || [];

  // Build layouts dynamically from widget positions
  useEffect(() => {
    if (!widgets.length) return;
    const breakpoints = ["lg", "md", "sm", "xs", "xxs"];
    const rowHeight = 2;
    const layouts: BreakpointLayouts = {};
    breakpoints.forEach((bp) => {
      layouts[bp] = widgets.map((w) => {
        return {
          i: w.id,
          x: w.position_x || 0,
          y: w.position_y || 0,
          w: w.size === "large" ? 6 : w.size === "medium" ? 4 : 2,
          h: rowHeight,
          minW: 2,
          minH: 2,
        };
      });
    });
    setLayouts(layouts);
  }, [widgets]);

  // Only show widgets user has permission for
  const widgetTypeMapDynamic = widgetTypeMap as Record<string, typeof widgetTypeMap[keyof typeof widgetTypeMap]>;
  // Only show widgets with a valid mapping; permissions are handled by backend
  const visibleWidgets = widgets.filter((w: any) => {
    const type: string = w.widget_type;
    return !!widgetTypeMapDynamic[type];
  });

  if (!isClient) {
    return <div className="h-screen flex items-center justify-center">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 className="text-xl font-bold">My Dashboard</h2>
      </div>
      {/* High-level summary cards */}
      <DashboardSummaryCards data={overview} />
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={150}
        isDraggable={editMode}
        isResizable={editMode}
        onLayoutChange={() => {}}
        onBreakpointChange={(breakpoint: string) => setCurrentBreakpoint(breakpoint)}
        margin={[8, 8]}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
        preventCollision={false}
        compactType="vertical"
      >
        {visibleWidgets.map((w: any) => {
          const type: string = w.widget_type;
          const map = widgetTypeMapDynamic[type];
          if (!map) return null;
          const WidgetComponent = map.component;
          const widgetProps: any = {};
          try {
            if (WidgetComponent.length > 1) {
              widgetProps.data = widgetData[w.id];
            }
          } catch {}
          return (
            <div key={w.id} className="widget">
              <Card className="h-full overflow-hidden shadow-sm hover:shadow transition-shadow">
                <CardHeader className="p-3 sm:p-4 pb-2 flex flex-row items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm sm:text-base truncate">{w.title || map.title}</CardTitle>
                    <CardDescription className="text-xs hidden sm:block">{w.description || map.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-2 sm:p-4 pt-2 h-[calc(100%-60px)] overflow-auto">
                  <WidgetComponent {...widgetProps} />
                </CardContent>
              </Card>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
