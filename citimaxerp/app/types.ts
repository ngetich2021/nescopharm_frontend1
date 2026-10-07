export interface LogisticsStats {
  totalDeliveries: number
  totalDeliveriesChange: number
  completedDeliveries: number
  completedDeliveriesChange: number
  pendingDeliveries: number
  averageDeliveryTime: number
}

export interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export interface User {
    id: string;
    email?: string;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    is_active?: boolean;
    created_at?: string;
    company_id?: string | null;
    role_id?: string | null;
    updated_at?: string | null;
    avatar_url?: string | null;
    company?: Company | null;
    role?: Role | null;
}

export type PermissionKey =
  | "can_view_dashboard_menu"
  | "can_view_customers_menu"
  | "can_view_sales_menu"
  | "can_view_orders_menu"
  | "can_view_quotes_menu"
  | "can_view_invoices_menu"
  | "can_view_inventory_menu"
  | "can_view_products_menu"
  | "can_view_stock_counts_menu"
  | "can_view_logistics_menu"
  | "can_view_dispatch_menu"
  | "can_view_product_receipt_menu"
  | "can_view_requisitions_menu"
  | "can_view_breakages_menu"
  | "can_view_repairs_menu"
  | "can_view_payments_menu"
  | "can_view_payment_reports_menu"
  | "can_view_suppliers_menu"
  | "can_view_purchase_orders_menu"
  | "can_view_expenses_menu"
  | "can_view_finance_menu"
  | "can_view_employees_menu"
  | "can_view_payroll_menu"
  | "can_view_pos_menu"
  | "can_view_chat_menu"
  | "can_view_settings_menu"
  | "can_view_reports_menu"
  | "can_view_assets_menu"
  | "can_view_assets"
  | "can_create_assets"
  | "can_update_assets"
  | "can_delete_assets"
  | "can_manage_assets"
  | "can_view_analytics_dashboard_menu"
  | "can_view_finance_dashboard_menu"
  | "can_view_hr_dashboard_menu"
  | "can_manage_system"
  | "can_manage_company"
  | "can_manage_users_and_roles"
  | "can_access_admin_portal"
  | "can_manage_companies"
  | "can_manage_all_users"
  | "can_manage_permissions"
  | "can_manage_roles"
  | "can_view_balance_sheet"
  | "can_view_income_statement"
  | "can_view_cash_flow_statement"
  | "can_view_financial_ratios"
  | "can_view_account_aging"
  | "can_view_budget_variance"
  | "can_view_chart_of_accounts"
  | "can_view_journal_entries"
  | "can_view_general_ledger"
  | "can_view_trial_balance"
  | "can_view_bank_accounts"
  | "can_view_budgets"

export type Permissions = {
  [key in PermissionKey]: boolean
}

export interface Role {
  id: string
  name: string
  description: string | null
  permissions: Permissions
  is_active: boolean
  created_at: string
  company_id?: string;
}

export interface Subscription {
  id: string;
  plan_id: string;
  company_id: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  plan_type?: string; // from relation
}

export interface Payment {
  id: string;
  amount: number;
  status: string;
  provider: string;
  transaction_id: string;
  created_at: string;
  company_id: string;
  subscription_id: string;
  company?: Pick<Company, "id" | "name"> | null;
  subscription?: Pick<Subscription, "id" | "plan_type"> | null;
}

export interface Product {
  id: string
  company_id: string
  store_id: string
  name: string
  description: string | null
  short_description: string | null
  price: number
  unit_cost: number
  stock_quantity: number
  low_stock_threshold: number
  category: string | null
  sku: string | null
  barcode: string | null
  brand: string | null
  supplier: string | null
  unit_of_measurement: string
  is_active: boolean
  track_inventory: boolean
  weight: number | null
  length: number | null
  width: number | null
  height: number | null
  shipping_class: string | null
  image_url: string | null
  images: string[] | null
  primary_image_index: number
  has_variations: boolean
  variations: any[] | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface SalesDataPoint {
  date: string; // e.g., "YYYY-MM-DD"
  sales: number;
}

export interface RecentActivityItem {
  id: string;
  customerName?: string | null;
  action: string;
  value: string;
  time: string;
}

export interface InventoryCategoryStatus {
  category: string;
  stockPercentage: number;
  statusLabel: string;
}

export interface DashboardData {
  totalRevenue: number;
  totalCustomers: number;
  totalOrders: number;
  totalTickets: number;
  salesData: { date: string; sales: number }[];
  topProducts: { id: string; name: string; stock_quantity: number }[];
  inventoryStatus: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
  recentActivity: {
      id: string;
      customer_name: string;
      activity_type: string;
      timestamp: string;
  }[];
  performanceMetrics: { name: string; value: number; change: number }[];
  salesForecast: { date: string; prediction: number }[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export interface RecentActivity {
    id: string;
    customer_name: string;
    activity_type: 'order' | 'payment' | 'quote'; // Example activity types
    timestamp: string; // ISO 8601 date string
    details: {
        amount?: number;
        order_id?: string;
        quote_id?: string;
    };
}

// Payroll related types
export interface PayrollAllowance {
  type: string;
  amount: number;
}

export interface PayrollDeduction {
  type: string;
  amount: number;
}

export interface EmployeePayrollData {
  basic_salary: number;
  allowances: PayrollAllowance[];
  deductions: PayrollDeduction[];
  overtime_hours: number;
  overtime_type: 'regular' | 'weekend' | 'holiday';
  region: string;
  skill_level: 'unskilled' | 'semi_skilled' | 'skilled' | 'highly_skilled';
}

export interface BulkPayrollRequest {
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  employee_ids: string[];
  custom_data: Record<string, EmployeePayrollData>;
}

export interface PayrollResult {
  employee_id: string;
  status: 'success' | 'error';
  payroll_item_id?: string;
  error_message?: string;
}

export interface BulkPayrollResponse {
  status: 'success' | 'error';
  message: string;
  payroll_record_id?: string;
  results: PayrollResult[];
}

export interface DeliveryLocation {
  id: string;
  customer_id: string;
  house_number: string;
  estate: string;
  city: string;
  street: string;
  country: string;
  is_default: boolean;
  location_note: string;
  created_at: string;
  updated_at: string;
  landmark: string;
  company_id: string;
  postal_code: string;
  address_line1: string;
  address_line2: string;
  state: string;
}

export interface Order {
  id: string;
  customer_id: string;
  company_id: string;
  order_number: string;
  total_amount: string;
  final_amount: string;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  } | null;
}

// Stock Count types
export type StockCountStatus = 'draft' | 'in_progress' | 'completed' | 'approved' | 'cancelled';
export type StockCountType = 'cycle_count' | 'full_count';

export interface StockCountItem {
  id: string;
  company_id: string;
  store_id: string;
  stock_count_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  product_sku: string | null;
  product_category: string | null;
  unit_cost: string;
  expected_quantity: number;
  counted_quantity: number | null;
  variance_quantity: number | null;
  variance_value: string | null;
  counted_by: string | null;
  counted_at: string | null;
  notes: string | null;
  is_counted: boolean;
  requires_recount: boolean;
  is_variance: boolean | null;
  created_at: string;
  updated_at: string;
  product?: Pick<Product, 'id' | 'name' | 'unit_cost'>;
  variant?: {
    id: string;
    product_id: string;
    name: string;
    sku: string | null;
    stock_quantity: number;
  } | null;
}

export interface StockCount {
  id: string;
  company_id: string;
  store_id: string;
  count_number: string;
  name: string;
  description: string | null;
  count_type: StockCountType;
  status: StockCountStatus;
  location: string | null;
  category_filter: string | null;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  approved_at: string | null;
  created_by: string | null;
  assigned_to: string | null;
  approved_by: string | null;
  total_products_expected: number;
  total_products_counted: number;
  total_variances: number;
  total_variance_value: string;
  created_at: string;
  updated_at: string;
  store?: {
    id: string;
    name: string;
  };
  creator?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    full_name: string;
  };
  assigned_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    full_name: string;
  } | null;
  approver?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    full_name: string;
  } | null;
  items?: StockCountItem[];
}

export interface CreateStockCountItem {
  product_id: string;
  variant_id?: string;
  expected_quantity: number;
  counted_quantity?: number | null;
  notes?: string;
  requires_recount?: boolean;
}

export interface CreateStockCountRequest {
  company_id: string;
  store_id: string;
  name: string;
  description?: string;
  count_type: StockCountType;
  status: StockCountStatus;
  location?: string;
  category_filter?: string;
  assigned_to?: string;
  items: CreateStockCountItem[];
}

export interface UpdateStockCountItem extends CreateStockCountItem {
  id?: string;
}

export interface UpdateStockCountRequest {
  name?: string;
  description?: string;
  count_type?: StockCountType;
  status?: StockCountStatus;
  location?: string;
  category_filter?: string;
  started_at?: string;
  completed_at?: string;
  approved_at?: string;
  assigned_to?: string;
  approved_by?: string;
  items?: UpdateStockCountItem[];
}
