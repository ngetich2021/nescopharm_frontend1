import apiCall from "./api"

// ==================== TYPES & INTERFACES ====================

export interface StockAdjustmentUser {
  id: string
  first_name: string
  last_name: string
  email: string
  full_name: string
}

export interface StockAdjustmentProduct {
  id: string
  name: string
  sku: string
  product_code: string
  image_urls?: string[]
  primary_image_url?: string | null
  stock_quantity?: number
  unit_cost?: string
  price?: string
}

export interface StockAdjustmentVariant {
  id: string
  name: string
  sku: string
  stock_quantity?: number
}

export interface StockAdjustmentBatch {
  id: string
  batch_number: string
  expiry_date?: string
}

export interface StockAdjustmentStore {
  id: string
  name: string
}

// Item within a bulk stock adjustment
export interface StockAdjustmentItem {
  id: string
  stock_adjustment_id: string
  product_id: string
  variant_id?: string | null
  batch_id?: string | null
  unit_id?: string | null
  store_id?: string | null
  adjustment_type: AdjustmentType
  quantity_before?: number
  quantity_adjusted: number
  quantity_after?: number
  unit_cost?: string | null
  total_cost?: string | null
  unit_price?: string | null
  total_value?: string | null
  notes?: string | null
  item_status: "pending" | "completed" | "failed"
  error_message?: string | null
  product: StockAdjustmentProduct
  variant?: StockAdjustmentVariant | null
  batch?: StockAdjustmentBatch | null
  store?: StockAdjustmentStore | null
}

export type AdjustmentType = "increase" | "decrease" | "set"

export type ReasonType =
  | "damage"
  | "expiry"
  | "theft"
  | "loss"
  | "found"
  | "recount"
  | "correction"
  | "return"
  | "donation"
  | "sample"
  | "write_off"
  | "other"

export type AdjustmentStatus = "draft" | "pending" | "approved" | "rejected" | "completed"

export interface StockAdjustment {
  id: string
  company_id: string
  store_id: string | null
  adjustment_number: string
  product_id: string | null
  variant_id?: string | null
  batch_id?: string | null
  unit_id?: string | null
  adjustment_type: AdjustmentType
  reason_type: ReasonType
  quantity_before: number
  quantity_adjusted: number | null
  quantity_after: number
  unit_cost: string | null
  total_cost: string
  unit_price: string | null
  total_value: string
  status: AdjustmentStatus
  created_by: StockAdjustmentUser
  approved_by?: StockAdjustmentUser | null
  rejected_by?: StockAdjustmentUser | null
  approved_at?: string | null
  rejected_at?: string | null
  reason: string
  notes?: string | null
  rejection_reason?: string | null
  attachments?: string[] | null
  metadata?: Record<string, any> | null
  inventory_movement_id?: string | null
  created_at: string
  updated_at: string
  // For single-product adjustments
  product: StockAdjustmentProduct | null
  variant?: StockAdjustmentVariant | null
  batch?: StockAdjustmentBatch | null
  store: StockAdjustmentStore | null
  // For bulk adjustments
  items: StockAdjustmentItem[]
  total_items: number
  total_quantity_adjusted: number
  items_count: number
}

export interface StockAdjustmentActivity {
  id: string
  user: StockAdjustmentUser
  action: string
  description: string
  ip_address?: string
  user_agent?: string
  properties?: Record<string, any>
  created_at: string
}

export interface StockAdjustmentStatistics {
  total_adjustments: number
  pending_adjustments: number
  approved_adjustments: number
  completed_adjustments: number
  rejected_adjustments: number
  total_value_impact: number
  total_cost_impact: number
  by_reason_type: Array<{
    reason_type: string
    count: number
    total_value: number
  }>
  by_adjustment_type: Array<{
    adjustment_type: string
    count: number
    total_value: number
  }>
}

export interface CreateStockAdjustmentData {
  product_id: string
  variant_id?: string
  batch_id?: string
  unit_id?: string
  store_id?: string
  adjustment_type: AdjustmentType
  reason_type: ReasonType
  quantity_adjusted: number
  reason: string
  notes?: string
  unit_cost?: number
  unit_price?: number
  status?: "draft" | "pending"
  attachments?: string[]
  metadata?: Record<string, any>
}

export interface UpdateStockAdjustmentData {
  quantity_adjusted?: number
  reason?: string
  notes?: string
  status?: "draft" | "pending"
  attachments?: string[]
  metadata?: Record<string, any>
}

export interface StockAdjustmentFilters {
  store_id?: string
  product_id?: string
  status?: AdjustmentStatus
  reason_type?: ReasonType
  adjustment_type?: AdjustmentType
  start_date?: string
  end_date?: string
  search?: string
  sort_by?: string
  sort_order?: "asc" | "desc"
  per_page?: number
  page?: number
}

export interface PaginatedResponse<T> {
  current_page: number
  data: T[]
  total: number
  per_page: number
  last_page: number
}

// ==================== API FUNCTIONS ====================

/**
 * Get all stock adjustments with optional filters
 */
export async function getStockAdjustments(
  filters: StockAdjustmentFilters = {},
  withAuth = true
): Promise<{
  data: StockAdjustment[]
  pagination: {
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
}> {
  try {
    const queryParams = new URLSearchParams()

    if (filters.store_id) queryParams.append("store_id", filters.store_id)
    if (filters.product_id) queryParams.append("product_id", filters.product_id)
    if (filters.status) queryParams.append("status", filters.status)
    if (filters.reason_type) queryParams.append("reason_type", filters.reason_type)
    if (filters.adjustment_type) queryParams.append("adjustment_type", filters.adjustment_type)
    if (filters.start_date) queryParams.append("start_date", filters.start_date)
    if (filters.end_date) queryParams.append("end_date", filters.end_date)
    if (filters.search) queryParams.append("search", filters.search)
    if (filters.sort_by) queryParams.append("sort_by", filters.sort_by)
    if (filters.sort_order) queryParams.append("sort_order", filters.sort_order)
    if (filters.per_page) queryParams.append("per_page", filters.per_page.toString())
    if (filters.page) queryParams.append("page", filters.page.toString())

    const queryString = queryParams.toString()
    const endpoint = queryString ? `/stock-adjustments?${queryString}` : "/stock-adjustments"

    const response: any = await apiCall(endpoint, "GET", undefined, withAuth)

    return {
      data: response.data.data || [],
      pagination: {
        current_page: response.data.current_page || 1,
        per_page: response.data.per_page || 20,
        total: response.data.total || 0,
        last_page: response.data.last_page || 1,
      },
    }
  } catch (error: any) {
    console.error("Error fetching stock adjustments:", error)
    throw new Error(error.message || "Failed to fetch stock adjustments")
  }
}

/**
 * Get a single stock adjustment by ID
 */
export async function getStockAdjustment(
  id: string,
  withAuth = true
): Promise<StockAdjustment> {
  try {
    const response: any = await apiCall(`/stock-adjustments/${id}`, "GET", undefined, withAuth)
    return response.data
  } catch (error: any) {
    console.error("Error fetching stock adjustment:", error)
    throw new Error(error.message || "Failed to fetch stock adjustment")
  }
}

/**
 * Create a new stock adjustment
 */
export async function createStockAdjustment(
  data: CreateStockAdjustmentData,
  withAuth = true
): Promise<StockAdjustment> {
  try {
    const response: any = await apiCall("/stock-adjustments", "POST", data, withAuth)
    return response.data
  } catch (error: any) {
    console.error("Error creating stock adjustment:", error)
    throw new Error(error.message || "Failed to create stock adjustment")
  }
}

/**
 * Update a stock adjustment (only draft or pending)
 */
export async function updateStockAdjustment(
  id: string,
  data: UpdateStockAdjustmentData,
  withAuth = true
): Promise<StockAdjustment> {
  try {
    const response: any = await apiCall(`/stock-adjustments/${id}`, "PATCH", data, withAuth)
    return response.data
  } catch (error: any) {
    console.error("Error updating stock adjustment:", error)
    throw new Error(error.message || "Failed to update stock adjustment")
  }
}

/**
 * Delete a stock adjustment (only draft)
 */
export async function deleteStockAdjustment(
  id: string,
  withAuth = true
): Promise<void> {
  try {
    await apiCall(`/stock-adjustments/${id}`, "DELETE", undefined, withAuth)
  } catch (error: any) {
    console.error("Error deleting stock adjustment:", error)
    throw new Error(error.message || "Failed to delete stock adjustment")
  }
}

/**
 * Approve a stock adjustment
 */
export async function approveStockAdjustment(
  id: string,
  withAuth = true
): Promise<StockAdjustment> {
  try {
    const response: any = await apiCall(`/stock-adjustments/${id}/approve`, "POST", {}, withAuth)
    return response.data
  } catch (error: any) {
    console.error("Error approving stock adjustment:", error)
    throw new Error(error.message || "Failed to approve stock adjustment")
  }
}

/**
 * Reject a stock adjustment
 */
export async function rejectStockAdjustment(
  id: string,
  rejectionReason: string,
  withAuth = true
): Promise<StockAdjustment> {
  try {
    const response: any = await apiCall(
      `/stock-adjustments/${id}/reject`,
      "POST",
      { rejection_reason: rejectionReason },
      withAuth
    )
    return response.data
  } catch (error: any) {
    console.error("Error rejecting stock adjustment:", error)
    throw new Error(error.message || "Failed to reject stock adjustment")
  }
}

/**
 * Apply a stock adjustment to inventory (complete it)
 */
export async function applyStockAdjustment(
  id: string,
  withAuth = true
): Promise<StockAdjustment> {
  try {
    const response: any = await apiCall(`/stock-adjustments/${id}/apply`, "POST", {}, withAuth)
    return response.data
  } catch (error: any) {
    console.error("Error applying stock adjustment:", error)
    throw new Error(error.message || "Failed to apply stock adjustment")
  }
}

/**
 * Get stock adjustment statistics
 */
export async function getStockAdjustmentStatistics(
  filters: {
    store_id?: string
    start_date?: string
    end_date?: string
  } = {},
  withAuth = true
): Promise<StockAdjustmentStatistics> {
  try {
    const queryParams = new URLSearchParams()
    if (filters.store_id) queryParams.append("store_id", filters.store_id)
    if (filters.start_date) queryParams.append("start_date", filters.start_date)
    if (filters.end_date) queryParams.append("end_date", filters.end_date)

    const queryString = queryParams.toString()
    const endpoint = queryString
      ? `/stock-adjustments/statistics?${queryString}`
      : "/stock-adjustments/statistics"

    const response: any = await apiCall(endpoint, "GET", undefined, withAuth)
    return response.data
  } catch (error: any) {
    console.error("Error fetching stock adjustment statistics:", error)
    throw new Error(error.message || "Failed to fetch stock adjustment statistics")
  }
}

/**
 * Get all stock adjustment activities
 */
export async function getStockAdjustmentActivities(
  filters: {
    adjustment_id?: string
    product_id?: string
    action?: string
    start_date?: string
    end_date?: string
    per_page?: number
    page?: number
  } = {},
  withAuth = true
): Promise<{
  data: StockAdjustmentActivity[]
  pagination: {
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
}> {
  try {
    const queryParams = new URLSearchParams()
    if (filters.adjustment_id) queryParams.append("adjustment_id", filters.adjustment_id)
    if (filters.product_id) queryParams.append("product_id", filters.product_id)
    if (filters.action) queryParams.append("action", filters.action)
    if (filters.start_date) queryParams.append("start_date", filters.start_date)
    if (filters.end_date) queryParams.append("end_date", filters.end_date)
    if (filters.per_page) queryParams.append("per_page", filters.per_page.toString())
    if (filters.page) queryParams.append("page", filters.page.toString())

    const queryString = queryParams.toString()
    const endpoint = queryString
      ? `/stock-adjustments/activities?${queryString}`
      : "/stock-adjustments/activities"

    const response: any = await apiCall(endpoint, "GET", undefined, withAuth)

    return {
      data: response.data.data || [],
      pagination: {
        current_page: response.data.current_page || 1,
        per_page: response.data.per_page || 50,
        total: response.data.total || 0,
        last_page: response.data.last_page || 1,
      },
    }
  } catch (error: any) {
    console.error("Error fetching stock adjustment activities:", error)
    throw new Error(error.message || "Failed to fetch stock adjustment activities")
  }
}

/**
 * Get activities for a specific stock adjustment
 */
export async function getStockAdjustmentActivitiesById(
  id: string,
  withAuth = true
): Promise<{
  adjustment: StockAdjustment
  activities: StockAdjustmentActivity[]
  activity_count: number
}> {
  try {
    const response: any = await apiCall(`/stock-adjustments/${id}/activities`, "GET", undefined, withAuth)
    return response.data
  } catch (error: any) {
    console.error("Error fetching stock adjustment activities:", error)
    throw new Error(error.message || "Failed to fetch stock adjustment activities")
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get status badge color
 */
export function getStatusColor(status: AdjustmentStatus): string {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-800"
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "approved":
      return "bg-blue-100 text-blue-800"
    case "completed":
      return "bg-green-100 text-green-800"
    case "rejected":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

/**
 * Get reason type label
 */
export function getReasonTypeLabel(reasonType: ReasonType): string {
  const labels: Record<ReasonType, string> = {
    damage: "Damage",
    expiry: "Expiry",
    theft: "Theft",
    loss: "Loss",
    found: "Found",
    recount: "Recount",
    correction: "Correction",
    return: "Return",
    donation: "Donation",
    sample: "Sample",
    write_off: "Write-off",
    other: "Other",
  }
  return labels[reasonType] || reasonType
}

/**
 * Get adjustment type label
 */
export function getAdjustmentTypeLabel(adjustmentType: AdjustmentType): string {
  const labels: Record<AdjustmentType, string> = {
    increase: "Increase",
    decrease: "Decrease",
    set: "Set",
  }
  return labels[adjustmentType] || adjustmentType
}

/**
 * Format currency
 */
export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "KES 0.00"
  }
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) {
    return "KES 0.00"
  }
  return `KES ${num.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Check if adjustment can be edited
 */
export function canEditAdjustment(status: AdjustmentStatus): boolean {
  return status === "draft"
}

/**
 * Check if adjustment can be deleted
 */
export function canDeleteAdjustment(status: AdjustmentStatus): boolean {
  return status === "draft"
}

/**
 * Check if adjustment can be submitted for approval
 */
export function canSubmitAdjustment(status: AdjustmentStatus): boolean {
  return status === "draft"
}

/**
 * Check if adjustment can be approved
 */
export function canApproveAdjustment(status: AdjustmentStatus): boolean {
  return status === "pending"
}

/**
 * Check if adjustment can be applied
 */
export function canApplyAdjustment(status: AdjustmentStatus): boolean {
  return status === "approved"
}
