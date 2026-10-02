// Fetch customer analytics
export async function fetchCustomerAnalytics({ period = "last_30_days", group_by = "month" }: { period?: string; group_by?: string } = {}): Promise<CustomerAnalytics | null> {
  try {
    const params = new URLSearchParams({ period, group_by });
    const response = await apiCall<{ status: string; data: CustomerAnalytics; message?: any }>(
      `/dashboard/customer-analytics?${params.toString()}`,
      "GET",
      undefined,
      true
    );
    console.log("fetchCustomerAnalytics response:", response);
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch customer analytics", e);
    return null;
  }
}

// Fetch inventory analytics
export async function fetchInventoryAnalytics({ period = "last_30_days", group_by = "month" }: { period?: string; group_by?: string } = {}): Promise<InventoryAnalytics | null> {
  try {
    const params = new URLSearchParams({ period, group_by });
    const response = await apiCall<{ status: string; data: InventoryAnalytics; message?: any }>(
      `/dashboard/inventory-analytics?${params.toString()}`,
      "GET",
      undefined,
      true
    );
    console.log("fetchInventoryAnalytics response:", response);
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch inventory analytics", e);
    return null;
  }
}
// Fetch financial analytics
export async function fetchFinancialAnalytics({ period = "last_30_days", group_by = "month" }: { period?: string; group_by?: string } = {}): Promise<FinancialAnalytics | null> {
  try {
    const params = new URLSearchParams({ period, group_by });
    const response = await apiCall<{ status: string; data: FinancialAnalytics; message?: any }>(
      `/dashboard/financial-analytics?${params.toString()}`,
      "GET",
      undefined,
      true
    );
    console.log("fetchFinancialAnalytics response:", response); // Log the full API response
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch financial analytics", e);
    return null;
  }
}
// Fetch sales analytics
export async function fetchSalesAnalytics({ period = "last_30_days", group_by = "day" }: { period?: string; group_by?: string } = {}): Promise<SalesAnalytics | null> {
  try {
    const params = new URLSearchParams({ period, group_by });
    const response = await apiCall<{ status: string; data: SalesAnalytics; message?: any }>(
      `/dashboard/sales-analytics?${params.toString()}`,
      "GET",
      undefined,
      true
    );
    console.log("fetchSalesAnalytics response:", response); // Log the full API response
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch sales analytics", e);
    return null;
  }
}

// Quick test function to verify fetchSalesAnalytics works (run manually)
export async function testFetchSalesAnalytics() {
  const result = await fetchSalesAnalytics({ period: "last_30_days", group_by: "day" });
  console.log("testFetchSalesAnalytics result:", result);
  return result;
}

import apiCall from "./api";

// Dashboard interfaces
export interface DashboardWidget {
  id: string;
  widget_type: string;
  title?: string;
  description?: string;
  position_x?: number;
  position_y?: number;
  size?: "small" | "medium" | "large";
  config?: Record<string, any>;
  [key: string]: any;
}


// --- Dashboard Overview ---
export interface DashboardOverviewPeriod {
  from: string;
  to: string;
  label: string;
}
export interface DashboardOverviewMetric {
  current: number;
  previous: number;
  change_percent: number;
}
export interface DashboardOverviewSalesMetrics {
  total_orders: DashboardOverviewMetric;
  total_revenue: DashboardOverviewMetric;
  avg_order_value: DashboardOverviewMetric;
  paid_orders: number;
  conversion_rate: number;
}
export interface DashboardOverviewFinancialMetrics {
  total_payments: DashboardOverviewMetric;
  total_expenses: DashboardOverviewMetric;
  net_profit: DashboardOverviewMetric;
  outstanding_amount: number;
  outstanding_invoices_count: number;
}
export interface DashboardOverviewCustomerMetrics {
  total_customers: number;
  new_customers: DashboardOverviewMetric;
  repeat_customers: number;
  customer_retention_rate: number;
}
export interface DashboardOverviewInventoryMetrics {
  total_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  total_inventory_value: number;
  stock_health_score: number;
}
export interface DashboardOverviewRecentActivity {
  id: string;
  type: string;
  description: string;
  amount: number;
  status: string;
  created_at: string;
}
export interface DashboardOverview {
  period: DashboardOverviewPeriod;
  sales_metrics: DashboardOverviewSalesMetrics;
  financial_metrics: DashboardOverviewFinancialMetrics;
  customer_metrics: DashboardOverviewCustomerMetrics;
  inventory_metrics: DashboardOverviewInventoryMetrics;
  recent_activity: DashboardOverviewRecentActivity[];
}

// --- Sales Analytics ---
export interface SalesAnalyticsRevenueTrend {
  period: string;
  revenue: number;
  orders: number;
}
export interface SalesAnalyticsByProduct {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue: number;
  order_count: number;
}
export interface SalesAnalyticsByCategory {
  category: string;
  quantity_sold: number;
  revenue: number;
  order_count: number;
}
export interface SalesAnalyticsPaymentMethod {
  payment_method: string;
  transaction_count: number;
  total_amount: number;
}
export interface SalesAnalyticsOrderStatus {
  status: string;
  order_count: number;
  total_amount: number;
}
export interface SalesAnalyticsAvgOrderValue {
  period: string;
  avg_order_value: number;
}
export interface SalesAnalytics {
  revenue_trend: SalesAnalyticsRevenueTrend[];
  sales_by_product: SalesAnalyticsByProduct[];
  sales_by_category: SalesAnalyticsByCategory[];
  payment_methods: SalesAnalyticsPaymentMethod[];
  order_status_breakdown: SalesAnalyticsOrderStatus[];
  average_order_value: SalesAnalyticsAvgOrderValue[];
}

// --- Financial Analytics ---
export interface FinancialAnalyticsCashFlowTrend {
  month: string;
  cash_in: number;
}
export interface FinancialAnalyticsCashFlow {
  cash_in: number;
  cash_out: number;
  net_cash_flow: number;
  monthly_trend: FinancialAnalyticsCashFlowTrend[];
}
export interface FinancialAnalyticsExpenseByCategory {
  category: string;
  amount: number;
  count: number;
}
export interface FinancialAnalyticsExpenseByPaymentMethod {
  payment_method: string;
  amount: number;
  count: number;
}
export interface FinancialAnalyticsExpenseBreakdown {
  by_category: FinancialAnalyticsExpenseByCategory[];
  by_payment_method: FinancialAnalyticsExpenseByPaymentMethod[];
  total_expenses: number;
}
export interface FinancialAnalyticsProfitLoss {
  revenue: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
  gross_margin: number;
  net_margin: number;
}
export interface FinancialAnalyticsAccountsReceivableAging {
  current: number;
  "1_30_days": number;
  "31_60_days": number;
  over_60_days: number;
}
export interface FinancialAnalyticsAccountsReceivable {
  total_outstanding: number;
  invoice_count: number;
  avg_days_overdue: number;
  aging_buckets: FinancialAnalyticsAccountsReceivableAging;
}
export interface FinancialAnalyticsPaymentTrendByMethod {
  payment_method: string;
  trend: { date: string; amount: number }[];
}
export interface FinancialAnalyticsPaymentTrends {
  daily_payments: { date: string; amount: number; count: number }[];
  by_payment_method: FinancialAnalyticsPaymentTrendByMethod[];
}
export interface FinancialAnalytics {
  cash_flow: FinancialAnalyticsCashFlow;
  expense_breakdown: FinancialAnalyticsExpenseBreakdown;
  profit_loss: FinancialAnalyticsProfitLoss;
  accounts_receivable: FinancialAnalyticsAccountsReceivable;
  payment_trends: FinancialAnalyticsPaymentTrends;
}

// --- Customer Analytics ---
export interface CustomerAnalyticsAcquisitionDaily {
  date: string;
  new_customers: number;
}
export interface CustomerAnalyticsAcquisition {
  total_new_customers: number;
  acquisition_cost: number;
  daily_acquisition: CustomerAnalyticsAcquisitionDaily[];
}
export interface CustomerAnalyticsRetention {
  retention_rate: number;
  churn_rate: number;
  repeat_customers: number;
  total_customers_with_orders: number;
}
export interface CustomerAnalyticsLifetimeValueTop {
  id: string;
  name: string;
  lifetime_value: number;
  total_orders: number;
}
export interface CustomerAnalyticsLifetimeValue {
  avg_lifetime_value: number;
  avg_orders_per_customer: number;
  highest_lifetime_value: number;
  top_customers: CustomerAnalyticsLifetimeValueTop[];
}
export interface CustomerAnalyticsTopCustomer {
  id: string;
  name: string;
  email: string;
  total_spent: number;
  order_count: number;
  avg_order_value: number;
}
export interface CustomerAnalyticsSegments {
  high_value: number;
  medium_value: number;
  low_value: number;
  new_customers: number;
}
export interface CustomerAnalytics {
  customer_acquisition: CustomerAnalyticsAcquisition;
  customer_retention: CustomerAnalyticsRetention;
  customer_lifetime_value: CustomerAnalyticsLifetimeValue;
  top_customers: CustomerAnalyticsTopCustomer[];
  customer_segments: CustomerAnalyticsSegments;
}

// --- Inventory Analytics ---
export interface InventoryAnalyticsLevels {
  total_products: number;
  total_stock_units: number;
  total_inventory_value: number;
  avg_stock_per_product: number;
  stock_distribution: Record<string, number>;
}
export interface InventoryAnalyticsStockAlertProduct {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold?: number;
}
export interface InventoryAnalyticsStockAlerts {
  low_stock_products: InventoryAnalyticsStockAlertProduct[];
  out_of_stock_products: InventoryAnalyticsStockAlertProduct[];
  low_stock_count: number;
  out_of_stock_count: number;
}
export interface InventoryAnalyticsTurnover {
  product_id: string;
  product_name: string;
  current_stock: number;
  units_sold_12m: number;
  turnover_ratio: number;
}
export interface InventoryAnalyticsDeadStockProduct {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  unit_cost: number;
  dead_stock_value: number;
}
export interface InventoryAnalyticsDeadStock {
  dead_stock_products: InventoryAnalyticsDeadStockProduct[];
  total_dead_stock_value: number;
  dead_stock_count: number;
}
export interface InventoryAnalyticsProductPerformanceTop {
  product: any;
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue: number;
  order_frequency: number;
}
export interface InventoryAnalyticsProductPerformanceSlow {
  id: string;
  name: string;
  stock_quantity: number;
  unit_cost: number;
  recent_order_count: number;
}
export interface InventoryAnalyticsProductPerformance {
  top_performers: InventoryAnalyticsProductPerformanceTop[];
  slow_movers: InventoryAnalyticsProductPerformanceSlow[];
}
export interface InventoryAnalytics {
  inventory_levels: InventoryAnalyticsLevels;
  stock_alerts: InventoryAnalyticsStockAlerts;
  inventory_turnover: InventoryAnalyticsTurnover[];
  dead_stock: InventoryAnalyticsDeadStock;
  product_performance: InventoryAnalyticsProductPerformance;
}

// --- Dashboard Config ---
export interface DashboardConfig {
  id: string;
  user_id: string;
  company_id: string;
  dashboard_name: string;
  layout_configuration: Record<string, any>;
  is_default: boolean;
  is_shared: boolean;
  shared_with: string[];
  created_at: string;
  updated_at: string;
}
export interface DashboardConfigResponse {
  configuration: DashboardConfig;
  available_widgets: DashboardWidget[];
}

export interface DashboardLayout {
  id?: string;
  user_id?: string;
  layout: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

// Fetch all dashboard widgets
export async function fetchDashboardWidgets(): Promise<DashboardWidget[]> {
  try {
    const response = await apiCall<{ status: string; widgets: DashboardWidget[]; message?: any }>(
      "/dashboard/widgets",
      "GET",
      undefined,
      true
    );
    if (response.status === "success" && Array.isArray(response.widgets)) {
      return response.widgets;
    }
    return [];
  } catch (e) {
    console.error("Failed to fetch dashboard widgets", e);
    return [];
  }
}

// Fetch dashboard summary/overview
export async function fetchDashboardOverview(): Promise<DashboardOverview | null> {
  try {
    const response = await apiCall<{ status: string; data: DashboardOverview; message?: any }>(
      "/dashboard/overview",
      "GET",
      undefined,
      true
    );
    console.log("fetchDashboardOverview response:", response);
    if (response.status === "success" && response.data) {
      return response.data;
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch dashboard overview", e);
    return null;
  }
}

// Create a new dashboard widget
export async function createDashboardWidget(widget: Omit<DashboardWidget, "id">): Promise<DashboardWidget | null> {
  try {
    const response = await apiCall<{ status: string; widget: DashboardWidget; message?: any }>(
      "/dashboard/widgets",
      "POST",
      widget,
      true
    );
    if (response.status === "success" && response.widget) {
      return response.widget;
    }
    return null;
  } catch (e) {
    console.error("Failed to create dashboard widget", e);
    return null;
  }
}

// Update an existing dashboard widget (by id)
export async function updateDashboardWidget(id: string, updates: Partial<DashboardWidget>): Promise<DashboardWidget | null> {
  try {
    const response = await apiCall<{ status: string; widget: DashboardWidget; message?: any }>(
      `/dashboard/widgets/${id}`,
      "PUT",
      updates,
      true
    );
    if (response.status === "success" && response.widget) {
      return response.widget;
    }
    return null;
  } catch (e) {
    console.error("Failed to update dashboard widget", e);
    return null;
  }
}

// Delete a dashboard widget (by id)
export async function deleteDashboardWidget(id: string): Promise<boolean> {
  try {
    const response = await apiCall<{ status: string; message?: any }>(
      `/dashboard/widgets/${id}`,
      "DELETE",
      undefined,
      true
    );
    return response.status === "success";
  } catch (e) {
    console.error("Failed to delete dashboard widget", e);
    return false;
  }
}

// Save dashboard layout/preferences
export async function saveDashboardLayout(layout: DashboardLayout): Promise<boolean> {
  try {
    const response = await apiCall<{ status: string; message?: any }>(
      "/dashboard/layout",
      "POST",
      layout,
      true
    );
    return response.status === "success";
  } catch (e) {
    console.error("Failed to save dashboard layout", e);
    return false;
  }
}

// Fetch widget-specific data (if needed)
export async function fetchWidgetData(id: string): Promise<any> {
  try {
    const response = await apiCall<{ status: string; data: any; message?: any }>(
      `/dashboard/widgets/${id}/data`,
      "GET",
      undefined,
      true
    );
    if (response.status === "success") {
      return response.data;
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch widget data", e);
    return null;
  }
}
