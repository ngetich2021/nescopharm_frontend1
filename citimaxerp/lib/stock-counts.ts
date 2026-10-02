import apiCall from "./api"
import type { 
  StockCount, 
  CreateStockCountRequest, 
  UpdateStockCountRequest,
  StockCountStatus,
  StockCountType
} from "@/app/types"

export interface StockCountsResponse {
  status: "success" | "failed"
  stock_counts: StockCount[]
}

export interface StockCountResponse {
  status: "success" | "failed"
  message: string
  stock_count: StockCount
}

export interface DeleteStockCountResponse {
  status: "success" | "failed"
  message: string
}

/**
 * Fetches stock counts from the API
 * @param filters Optional filters for company_id, store_id, status, count_type
 * @returns Promise with stock counts data and total count
 */
export async function getStockCounts(filters: {
  company_id?: string
  store_id?: string
  status?: StockCountStatus
  count_type?: StockCountType
} = {}): Promise<{ data: StockCount[]; count: number }> {
  try {
    const queryParams = new URLSearchParams()
    
    if (filters.company_id) queryParams.append("company_id", filters.company_id)
    if (filters.store_id) queryParams.append("store_id", filters.store_id)
    if (filters.status) queryParams.append("status", filters.status)
    if (filters.count_type) queryParams.append("count_type", filters.count_type)
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ""
    
    const response = await apiCall<StockCountsResponse>(
      `/stock-counts${queryString}`,
      "GET",
      undefined,
      true
    )
    
    if (response.status === "success" && Array.isArray(response.stock_counts)) {
      return {
        data: response.stock_counts,
        count: response.stock_counts.length
      }
    }
    
    throw new Error("Unexpected API response structure")
  } catch (error: any) {
    console.error("Error fetching stock counts:", error)
    throw new Error(`Failed to fetch stock counts: ${error.message || "Unknown error"}`)
  }
}

/**
 * Gets detailed information about a specific stock count
 * @param stockCountId ID of the stock count
 * @returns Promise with stock count details
 */
export async function getStockCountDetails(stockCountId: string): Promise<StockCount | null> {
  try {
    const response = await apiCall<StockCountResponse>(
      `/stock-counts/${stockCountId}`,
      "GET",
      undefined,
      true
    )
    
    if (response.status === "success" && response.stock_count) {
      return response.stock_count
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to fetch stock count details"
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch stock count details: ${error.message || "Unknown error"}`)
  }
}

/**
 * Gets summary information about all stock counts
 * @returns Promise with stock count summary
 */
export async function getStockCountSummary() {
  try {
    const { data: stockCounts } = await getStockCounts()
    
    const totalCounts = stockCounts.length
    const completedCounts = stockCounts.filter(count => count.status === 'completed').length
    const inProgressCounts = stockCounts.filter(count => count.status === 'in_progress').length
    const pendingCounts = stockCounts.filter(count => count.status === 'draft').length
    const cancelledCounts = stockCounts.filter(count => count.status === 'cancelled').length
    
    return {
      totalCounts,
      completedCounts,
      inProgressCounts,
      pendingCounts,
      cancelledCounts
    }
  } catch (error: any) {
    return {
      totalCounts: 0,
      completedCounts: 0,
      inProgressCounts: 0,
      pendingCounts: 0,
      cancelledCounts: 0,
    }
  }
}

/**
 * Gets a list of unique locations for stock counts
 * @returns Promise with array of location names
 */
export async function getStockCountLocations(): Promise<string[]> {
  try {
    const { data: stockCounts } = await getStockCounts()
    
    // Extract unique locations
    const locations = Array.from(
      new Set(
        stockCounts
          .map(count => count.location)
          .filter(location => location !== null) as string[]
      )
    )
    
    return locations
  } catch (error: any) {
    return []
  }
}

/**
 * Creates a new stock count and associated product entries
 * @param data Stock count data with products to include
 * @returns Promise with the created stock count
 */
export async function createStockCount(data: CreateStockCountRequest): Promise<StockCount> {
  try {
    const response = await apiCall<StockCountResponse>(
      "/stock-counts",
      "POST",
      data,
      true
    )
    
    if (response.status === "success" && response.stock_count) {
      return response.stock_count
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to create stock count"
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    // Handle validation errors
    if (error.message && typeof error.message === "object") {
      const validationErrors = Object.values(error.message).flat().join(", ")
      throw new Error(validationErrors)
    }
    
    throw new Error(`Failed to create stock count: ${error.message || "Unknown error"}`)
  }
}

/**
 * Updates an existing stock count
 * @param id Stock count ID
 * @param data Update data
 * @returns Promise with the updated stock count
 */
export async function updateStockCount(
  id: string,
  data: UpdateStockCountRequest
): Promise<StockCount> {
  try {
    const response = await apiCall<StockCountResponse>(
      `/stock-counts/${id}`,
      "PATCH",
      data,
      true
    )
    
    if (response.status === "success" && response.stock_count) {
      return response.stock_count
    }
    
    throw new Error(response.message || "Failed to update stock count")
  } catch (error: any) {
    console.error("Error updating stock count:", error)
    
    // Handle validation errors
    if (error.message && typeof error.message === "object") {
      const validationErrors = Object.values(error.message).flat().join(", ")
      throw new Error(validationErrors)
    }
    
    throw new Error(`Failed to update stock count: ${error.message || "Unknown error"}`)
  }
}

/**
 * Deletes a stock count
 * @param id Stock count ID
 * @returns Promise with boolean indicating success
 */
export async function deleteStockCount(id: string): Promise<boolean> {
  try {
    const response = await apiCall<DeleteStockCountResponse>(
      `/stock-counts/${id}`,
      "DELETE",
      undefined,
      true
    )
    
    if (response.status === "success") {
      return true
    }
    
    throw new Error(response.message || "Failed to delete stock count")
  } catch (error: any) {
    console.error("Error deleting stock count:", error)
    throw new Error(`Failed to delete stock count: ${error.message || "Unknown error"}`)
  }
}

/**
 * Helper function to update stock count status
 * @param id Stock count ID
 * @param status New status
 * @param additionalData Optional additional data (e.g., timestamps, approver)
 * @returns Promise with the updated stock count
 */
export async function updateStockCountStatus(
  id: string,
  status: StockCountStatus,
  additionalData: {
    started_at?: string
    completed_at?: string
    approved_at?: string
    approved_by?: string
  } = {}
): Promise<StockCount> {
  return updateStockCount(id, {
    status,
    ...additionalData,
  })
}

/**
 * Helper function to record counted quantities for items
 * @param id Stock count ID
 * @param items Array of items with counted quantities
 * @returns Promise with the updated stock count
 */
export async function recordCountedQuantities(
  id: string,
  items: Array<{
    id?: string
    product_id: string
    expected_quantity: number
    counted_quantity: number
    notes?: string
  }>
): Promise<StockCount> {
  return updateStockCount(id, { items })
}

/**
 * Get stock count summary statistics
 * @param stockCounts Array of stock counts
 * @returns Summary statistics
 */
export function calculateStockCountSummary(stockCounts: StockCount[]) {
  if (!Array.isArray(stockCounts)) {
    return {
      total: 0,
      draft: 0,
      inProgress: 0,
      completed: 0,
      approved: 0,
      cancelled: 0,
      totalVariances: 0,
      totalVarianceValue: 0,
    }
  }

  const summary = {
    total: stockCounts.length,
    draft: stockCounts.filter(sc => sc.status === "draft").length,
    inProgress: stockCounts.filter(sc => sc.status === "in_progress").length,
    completed: stockCounts.filter(sc => sc.status === "completed").length,
    approved: stockCounts.filter(sc => sc.status === "approved").length,
    cancelled: stockCounts.filter(sc => sc.status === "cancelled").length,
    totalVariances: stockCounts.reduce((sum, sc) => sum + (sc.total_variances || 0), 0),
    totalVarianceValue: stockCounts.reduce(
      (sum, sc) => sum + parseFloat(sc.total_variance_value || "0"),
      0
    ),
  }

  return summary
}

/**
 * Get status badge color
 * @param status Stock count status
 * @returns Tailwind color class
 */
export function getStatusColor(status: StockCountStatus): string {
  const colors: Record<StockCountStatus, string> = {
    draft: "bg-gray-100 text-gray-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    approved: "bg-purple-100 text-purple-800",
    cancelled: "bg-red-100 text-red-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

/**
 * Get variance badge color based on variance value
 * @param varianceQuantity Variance quantity (positive or negative)
 * @returns Tailwind color class
 */
export function getVarianceColor(varianceQuantity: number | null): string {
  if (varianceQuantity === null || varianceQuantity === 0) {
    return "bg-gray-100 text-gray-800"
  }
  return varianceQuantity > 0
    ? "bg-green-100 text-green-800"
    : "bg-red-100 text-red-800"
}

/**
 * Format variance display
 * @param varianceQuantity Variance quantity
 * @returns Formatted string with sign
 */
export function formatVariance(varianceQuantity: number | null): string {
  if (varianceQuantity === null) return "-"
  if (varianceQuantity === 0) return "0"
  return varianceQuantity > 0 ? `+${varianceQuantity}` : `${varianceQuantity}`
}

