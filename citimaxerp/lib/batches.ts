import apiCall from "./api"
import type {
  Batch,
  BatchMovement,
  BatchSummary,
  ProductBatchAvailability,
  ExpiringBatch,
  LowStockProduct,
  InventorySummary
} from "@/types/batches"


// List all batches with filtering and pagination
export async function getBatches(filters: {
  store_id?: string
  product_id?: string
  status?: string
  expiring_soon?: boolean
  batch_number?: string
  sort_by?: string
  sort_order?: string
  page?: number
  per_page?: number
} = {}): Promise<{ data: Batch[]; total: number; current_page: number; per_page: number }> {
  try {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await apiCall<any>(`/inventory/batches${queryString}`, "GET", undefined, true)
    
    return {
      data: response.data?.data || [],
      total: response.data?.total || 0,
      current_page: response.data?.current_page || 1,
      per_page: response.data?.per_page || 20
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch batches: ${error.message || "Unknown error"}`)
  }
}

// Create new batch
export async function createBatch(productId: string, batchData: Partial<Batch>): Promise<Batch> {
  try {
    const response = await apiCall<{ status: string; data: Batch }>(
      `/products/${productId}/inventory/batches`,
      "POST",
      batchData,
      true
    )
    
    if (response.status === "success") {
      return response.data
    } else {
      throw new Error("Failed to create batch")
    }
  } catch (error: any) {
    throw new Error(`Failed to create batch: ${error.message || "Unknown error"}`)
  }
}

// Get batch details
export async function getBatchDetails(productId: string, batchId: string): Promise<Batch> {
  try {
    const response = await apiCall<{ status: string; data: Batch }>(
      `/products/${productId}/inventory/batches/${batchId}`,
      "GET",
      undefined,
      true
    )
    
    if (response.status === "success") {
      return response.data
    } else {
      throw new Error("Failed to fetch batch details")
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch batch details: ${error.message || "Unknown error"}`)
  }
}

// Allocate stock (reserve for orders)
export async function allocateStock(
  productId: string,
  batchId: string,
  allocationData: {
    quantity: number
    reference_type?: string
    reference_id?: string
    reference_number?: string
    notes?: string
  }
): Promise<any> {
  try {
    const response = await apiCall(
      `/products/${productId}/inventory/batches/${batchId}/allocate`,
      "POST",
      allocationData,
      true
    )
    return response
  } catch (error: any) {
    throw new Error(`Failed to allocate stock: ${error.message || "Unknown error"}`)
  }
}

// Bulk FIFO allocation
export async function bulkAllocateInventory(
  allocations: Array<{
    product_id: string
    variant_id?: string
    quantity: number
    notes?: string
  }>,
  reference?: {
    type?: string
    id?: string
    number?: string
  }
): Promise<any> {
  try {
    const payload = {
      allocations,
      reference_type: reference?.type,
      reference_id: reference?.id,
      reference_number: reference?.number
    }

    const response = await apiCall(
      `/inventory/bulk-allocate`,
      "POST",
      payload,
      true
    )
    return response
  } catch (error: any) {
    throw new Error(`Failed to bulk allocate inventory: ${error.message || "Unknown error"}`)
  }
}

// Record sale
export async function recordSale(
  productId: string,
  batchId: string,
  saleData: {
    quantity: number
    unit_price?: number
    reference_type?: string
    reference_id?: string
    reference_number?: string
    notes?: string
  }
): Promise<any> {
  try {
    const response = await apiCall(
      `/products/${productId}/inventory/batches/${batchId}/sell`,
      "POST",
      saleData,
      true
    )
    return response
  } catch (error: any) {
    throw new Error(`Failed to record sale: ${error.message || "Unknown error"}`)
  }
}

// Track serial number
export async function trackSerialNumber(serialNumber: string): Promise<any> {
  try {
    const response = await apiCall(
      `/inventory/track-serial/${encodeURIComponent(serialNumber)}`,
      "GET",
      undefined,
      true
    )
    return response
  } catch (error: any) {
    throw new Error(`Failed to track serial number: ${error.message || "Unknown error"}`)
  }
}

// Get product batch availability (FIFO order)
export async function getProductBatchAvailability(
  productId: string,
  filters: {
    variant_id?: string
    store_id?: string
  } = {}
): Promise<ProductBatchAvailability> {
  try {
    const params = new URLSearchParams()
    if (filters.variant_id) params.append('variant_id', filters.variant_id)
    if (filters.store_id) params.append('store_id', filters.store_id)
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await apiCall<ProductBatchAvailability>(
      `/products/${productId}/inventory/availability${queryString}`,
      "GET",
      undefined,
      true
    )
    return response
  } catch (error: any) {
    throw new Error(`Failed to fetch product batch availability: ${error.message || "Unknown error"}`)
  }
}

// Get expiring batches
export async function getExpiringBatches(
  days: number = 30,
  filters: {
    store_id?: string
    product_id?: string
  } = {}
): Promise<ExpiringBatch[]> {
  try {
    const params = new URLSearchParams({ days: days.toString() })
    if (filters.store_id) params.append('store_id', filters.store_id)
    if (filters.product_id) params.append('product_id', filters.product_id)
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await apiCall<{ data: ExpiringBatch[] }>(
      `/inventory/expiring${queryString}`,
      "GET",
      undefined,
      true
    )
    return response.data || []
  } catch (error: any) {
    throw new Error(`Failed to fetch expiring batches: ${error.message || "Unknown error"}`)
  }
}

// Get low stock products
export async function getLowStockProducts(storeId?: string): Promise<LowStockProduct[]> {
  try {
    const params = new URLSearchParams()
    if (storeId) params.append('store_id', storeId)
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await apiCall<{ data: { low_stock_products: LowStockProduct[] } }>(
      `/inventory/low-stock${queryString}`,
      "GET",
      undefined,
      true
    )
    return response.data?.low_stock_products || []
  } catch (error: any) {
    throw new Error(`Failed to fetch low stock products: ${error.message || "Unknown error"}`)
  }
}

// Get inventory movements
export async function getInventoryMovements(filters: {
  product_id?: string
  store_id?: string
  batch_id?: string
  type?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
} = {}): Promise<{ data: BatchMovement[]; total: number; current_page: number; per_page: number }> {
  try {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await apiCall<any>(
      `/inventory/movements${queryString}`,
      "GET",
      undefined,
      true
    )
    
    return {
      data: response.data?.data || [],
      total: response.data?.total || 0,
      current_page: response.data?.current_page || 1,
      per_page: response.data?.per_page || 20
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch inventory movements: ${error.message || "Unknown error"}`)
  }
}

// Adjust batch quantities
export async function adjustBatch(
  productId: string,
  batchId: string,
  adjustmentData: {
    adjustment_quantity: number
    adjustment_type: "available" | "damaged" | "expired"
    reason: string
    notes?: string
  }
): Promise<any> {
  try {
    const response = await apiCall(
      `/products/${productId}/inventory/batches/${batchId}/adjust`,
      "POST",
      adjustmentData,
      true
    )
    return response
  } catch (error: any) {
    throw new Error(`Failed to adjust batch: ${error.message || "Unknown error"}`)
  }
}

// Get batch summary data
export async function getBatchSummary(filters: {
  store_id?: string
  product_id?: string
  supplier_id?: string
  status?: string
  expiry_days?: number
} = {}): Promise<any> {
  try {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await apiCall<any>(
      `/whs/product-receipts/batch-summary${queryString}`,
      "GET",
      undefined,
      true
    )
    
    return response.data
  } catch (error: any) {
    throw new Error(`Failed to fetch batch summary: ${error.message || "Unknown error"}`)
  }
}
