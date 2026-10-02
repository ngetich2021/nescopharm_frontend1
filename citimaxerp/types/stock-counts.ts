export type StockCountType = "cycle_count" | "full_count" | "spot_check" | "receiving_count" | "full_inventory"
export type StockCountStatus = "draft" | "in_progress" | "completed" | "approved" | "cancelled"

export interface StockCount {
  id: string
  company_id: string
  store_id: string
  count_number: string
  name: string
  description?: string | null
  count_type: StockCountType
  status: StockCountStatus
  location?: string | null
  category_filter?: string | null
  scheduled_date: string | null
  started_at?: string | null
  completed_at?: string | null
  approved_at?: string | null
  created_by?: string
  assigned_to?: string | null
  approved_by?: string | null
  total_products_expected: number
  total_products_counted: number
  total_variances: number
  total_variance_value: string | number
  created_at: string
  updated_at: string
  store?: {
    id: string;
    name: string;
  }
}

export interface StockCountOverview {
  id: string
  company_id: string
  store_id: string
  count_number: string
  name: string
  count_type: StockCountType
  status: StockCountStatus
  location: string | null
  scheduled_date: string | null
  created_by: string
  assigned_to: string | null
  total_products_expected: number
  total_products_counted: number
  total_variances: number
  total_variance_value: number
  completion_percentage: number
  created_at: string
  updated_at: string
}

export interface StockCountVariance {
  company_id: string
  store_id: string
  count_number: string
  stock_count_name: string
  product_name: string
  product_sku: string
  product_category: string | null
  expected_quantity: number
  counted_quantity: number
  variance_quantity: number
  variance_value: number
  unit_cost: number
  counted_by: string | null
  counted_at: string | null
  notes: string | null
}

export interface StoreStockCountSummary {
  company_id: string
  store_id: string
  total_stock_counts: number
  completed_counts: number
  in_progress_counts: number
  draft_counts: number
  total_variance_value: number
  avg_variance_value: number
  last_stock_count_date: string
}

export interface StockCountSummary {
  totalCounts: number
  completedCounts: number
  pendingCounts: number
  inProgressCounts: number
  cancelledCounts: number
}

export interface StockCountDetails {
  overview: StockCountOverview
  variances: StockCountVariance[]
  full_details: StockCount
}
