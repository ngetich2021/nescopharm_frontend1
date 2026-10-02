import apiCall from "@/lib/api"

interface SalesDataPoint {
  date: string
  sales: number
}

interface ProductData {
  name: string
  quantity: number
}

interface CustomerData {
  created_at: string
}

interface ExpenseData {
  amount: number
  category_name: string
}

interface OrderData {
  status: string
  total_amount: number
  created_at: string
  customer_id: string
}

interface PaymentData {
  amount: number
  payment_method: string
}

interface TicketData {
  created_at: string
  resolved_at: string
  status: string
}

interface ProductInventoryData {
  name: string
  stock_quantity: number
  price: number
  category: string
}

export interface CustomerLocationData {
  city: string
}

interface ExpenseTimeData {
  created_at: string
  amount: number
}

interface OrderItemData {
  product_id: string
  quantity: number
  product_name: string
}

// Sales Report Interfaces
export interface DailySummary {
  date: string
  total: string
  count: number
  item_count: number
}

export interface TopCategory {
  category: string
  total_revenue: string
}

export interface TopProduct {
  name: string
  sku: string
  total_quantity: number
  total_revenue: string
}

export interface TopCustomer {
  name: string
  location: string
  order_count: number
  total_spent: string
}

export interface PaymentStatusBreakdown {
  payment_status: string
  count: number
  total: string
}

export interface SalesReportData {
  total_sales: string
  total_subtotal: string
  total_discount: string
  total_tax: string
  order_count: number
  average_order_value: string
  total_items_count: number
  summary_by_date: DailySummary[]
  top_categories: TopCategory[]
  top_products: TopProduct[]
  top_customers: TopCustomer[]
  payment_status_breakdown: PaymentStatusBreakdown[]
}

export interface SalesReportResponse {
  status: string
  data: SalesReportData
  message?: string
}

/**
 * Fetches inventory report data.
 */
export async function getInventoryReport(params: {
  type?: 'balance' | 'low_stock' | 'movement' | 'stock_management';
  category?: string;
  category_id?: string;
  store_id?: string;
  status?: string;
  brand?: string;
  date_from?: string;
  date_to?: string;
}): Promise<any> {
  try {
    const queryParams = new URLSearchParams();
    if (params.type) queryParams.append('type', params.type);
    if (params.category) queryParams.append('category', params.category);
    if (params.category_id) queryParams.append('category_id', params.category_id);
    if (params.store_id) queryParams.append('store_id', params.store_id);
    if (params.status) queryParams.append('status', params.status);
    if (params.brand) queryParams.append('brand', params.brand);
    if (params.date_from) queryParams.append('date_from', params.date_from);
    if (params.date_to) queryParams.append('date_to', params.date_to);

    const data = await apiCall<any>(`/reports/inventory?${queryParams.toString()}`, "GET");
    return data;
  } catch (error) {
    console.error("Error fetching inventory report:", error);
    throw error;
  }
}

/**
 * Fetches sales report data with comprehensive filtering options.
 * All filters are optional and apply uniformly across all report sections.
 */
export async function getSalesReport(params: {
  type?: 'performance' | 'ranking' | 'conversion';
  date_from?: string;
  date_to?: string;
  customer_id?: string;
  status?: string;
  payment_status?: string;
  location_id?: string;
  city?: string;
  category_id?: string;
  category?: string;
}): Promise<SalesReportResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.type) queryParams.append('type', params.type);
    if (params.date_from) queryParams.append('date_from', params.date_from);
    if (params.date_to) queryParams.append('date_to', params.date_to);
    if (params.customer_id) queryParams.append('customer_id', params.customer_id);
    if (params.status) queryParams.append('status', params.status);
    if (params.payment_status) queryParams.append('payment_status', params.payment_status);
    if (params.location_id) queryParams.append('location_id', params.location_id);
    if (params.city) queryParams.append('city', params.city);
    if (params.category_id) queryParams.append('category_id', params.category_id);
    if (params.category) queryParams.append('category', params.category);

    const data = await apiCall<SalesReportResponse>(`/reports/sales?${queryParams.toString()}`, "GET");
    return data;
  } catch (error) {
    console.error("Error fetching sales report:", error);
    throw error;
  }
}

/**
 * Fetches logistics report data.
 */
export async function getLogisticsReport(type: 'efficiency' | 'success_rate'): Promise<any> {
  try {
    const data = await apiCall<any>(`/reports/logistics?type=${type}`, "GET");
    return data;
  } catch (error) {
    console.error("Error fetching logistics report:", error);
    throw error;
  }
}

/**
 * Fetches procurement report data.
 */
export async function getProcurementReport(): Promise<any> {
  try {
    const data = await apiCall<any>("/reports/procurement", "GET");
    return data;
  } catch (error) {
    console.error("Error fetching procurement report:", error);
    throw error;
  }
}

/**
 * Fetches customer report data.
 */
export async function getCustomerReport(): Promise<any> {
  try {
    const data = await apiCall<any>("/reports/customers", "GET");
    return data;
  } catch (error) {
    console.error("Error fetching customer report:", error);
    throw error;
  }
}

/**
 * Fetches sales data for a given date range.
 */
export async function getSalesData(startDate: string, endDate: string): Promise<SalesDataPoint[]> {
  try {
    const data = await apiCall<SalesDataPoint[]>(`/reports/sales?start_date=${startDate}&end_date=${endDate}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches top selling products.
 */
export async function getTopSellingProducts(limit: number = 10): Promise<ProductData[]> {
  try {
    const data = await apiCall<ProductData[]>(`/reports/products/top-selling?limit=${limit}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches customer growth data.
 */
export async function getCustomerGrowthData(startDate: string, endDate: string): Promise<CustomerData[]> {
  try {
    const data = await apiCall<CustomerData[]>(`/reports/customers/growth?start_date=${startDate}&end_date=${endDate}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches expense data by category.
 */
export async function getExpenseDataByCategory(): Promise<ExpenseData[]> {
  try {
    const data = await apiCall<ExpenseData[]>("/reports/expenses/by-category", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches order status distribution.
 */
export async function getOrderStatusDistribution(): Promise<{ status: string; count: number }[]> {
  try {
    const data = await apiCall<{ status: string; count: number }[]>("/reports/orders/status-distribution", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches sales forecast data.
 */
export async function getSalesForecast(periods: number = 12): Promise<SalesDataPoint[]> {
  try {
    const data = await apiCall<SalesDataPoint[]>(`/reports/sales/forecast?periods=${periods}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches top products by stock level.
 */
export async function getTopProductsByStock(limit: number = 10): Promise<ProductInventoryData[]> {
  try {
    const data = await apiCall<ProductInventoryData[]>(`/reports/products/stock?limit=${limit}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches ticket resolution time data.
 */
export async function getTicketResolutionData(startDate: string, endDate: string): Promise<TicketData[]> {
  try {
    const data = await apiCall<TicketData[]>(`/reports/tickets/resolution?start_date=${startDate}&end_date=${endDate}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches payment method distribution.
 */
export async function getPaymentMethodDistribution(): Promise<PaymentData[]> {
  try {
    const data = await apiCall<PaymentData[]>("/reports/payments/method-distribution", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches order items data for product analysis.
 */
export async function getOrderItemsData(limit: number = 1000): Promise<OrderItemData[]> {
  try {
    const data = await apiCall<OrderItemData[]>(`/reports/orders/items?limit=${limit}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches delivery performance data.
 */
export async function getDeliveryPerformanceData(): Promise<{ status: string; count: number }[]> {
  try {
    const data = await apiCall<{ status: string; count: number }[]>("/reports/logistics/delivery-performance", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches revenue data.
 */
export async function getRevenueData(startDate: string, endDate: string): Promise<SalesDataPoint[]> {
  try {
    const data = await apiCall<SalesDataPoint[]>(`/reports/revenue?start_date=${startDate}&end_date=${endDate}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches expense data.
 */
export async function getExpenseData(startDate: string, endDate: string): Promise<ExpenseTimeData[]> {
  try {
    const data = await apiCall<ExpenseTimeData[]>(`/reports/expenses?start_date=${startDate}&end_date=${endDate}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches profit data.
 */
export async function getProfitData(startDate: string, endDate: string): Promise<SalesDataPoint[]> {
  try {
    const data = await apiCall<SalesDataPoint[]>(`/reports/profit?start_date=${startDate}&end_date=${endDate}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches customer location data.
 */
export async function getCustomerLocationData(): Promise<CustomerLocationData[]> {
  try {
    const data = await apiCall<CustomerLocationData[]>("/reports/customers/locations", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches product inventory data.
 */
export async function getProductInventoryData(): Promise<ProductInventoryData[]> {
  try {
    const data = await apiCall<ProductInventoryData[]>("/reports/products/inventory", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches expense trend data.
 */
export async function getExpenseTrendData(startDate: string, endDate: string): Promise<ExpenseTimeData[]> {
  try {
    const data = await apiCall<ExpenseTimeData[]>(`/reports/expenses/trend?start_date=${startDate}&end_date=${endDate}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches expense category trend data.
 */
export async function getExpenseCategoryTrendData(): Promise<ExpenseData[]> {
  try {
    const data = await apiCall<ExpenseData[]>("/reports/expenses/category-trend", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches order count data.
 */
export async function getOrderCountData(): Promise<{ total: number; returned: number }> {
  try {
    const data = await apiCall<{ total: number; returned: number }>("/reports/orders/count", "GET")
    return data || { total: 0, returned: 0 }
  } catch (error) {
    return { total: 0, returned: 0 }
  }
}
