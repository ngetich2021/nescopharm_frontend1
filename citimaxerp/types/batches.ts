// Batch data types for the batch tracking system

export interface Batch {
  id: string
  batch_number: string
  serial_number?: string
  lot_number?: string
  product_id: string
  variant_id?: string
  quantity_received: number
  quantity_available: number
  quantity_allocated: number
  quantity_sold: number
  quantity_damaged: number
  quantity_expired: number
  received_date: string
  expiry_date?: string
  manufacture_date?: string
  unit_cost?: number
  selling_price?: number
  status: "active" | "expired" | "recalled" | "damaged" | "sold_out"
  supplier?: string | { id: string; name: string } | null
  supplier_id?: string
  store_id?: string
  product_receipt_id?: string
  purchase_order_number?: string
  notes?: string
  custom_attributes?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface BatchMovement {
  id: string
  batch_id: string
  type: "receipt" | "sale" | "adjustment" | "transfer_out" | "transfer_in" | "return" | "damage" | "expiry" | "recount"
  quantity: number
  quantity_before: number
  quantity_after: number
  movement_date: string
  reference_type?: string
  reference_number?: string
  unit_cost?: number
  unit_price?: number
  total_value?: number
  notes?: string
  created_by?: string
  created_at: string
}

export interface BatchSummary {
  total_batches: number
  active_batches: number
  expired_batches: number
  expiring_soon: number
  batch_total_quantity: number
  batch_total_allocated: number
  batch_total_value: number
}

export interface ProductBatchAvailability {
  product: {
    id: string
    name: string
    sku: string
    current_stock_quantity: number
  }
  batch_totals: {
    total_available: number
    total_allocated: number
    total_on_hand: number
    batch_count: number
  }
  batches: Batch[]
}

export interface ExpiringBatch {
  id: string
  batch_number: string
  expiry_date: string
  days_until_expiry: number
  quantity_available: number
  product: {
    id: string
    name: string
    sku: string
  }
}

export interface LowStockProduct {
  id: string
  name: string
  stock_quantity: number
  low_stock_threshold: number
  store?: {
    id: string
    name: string
  }
}

export interface InventorySummary {
  batch_summary: BatchSummary
  product_summary: {
    total_products: number
    active_products: number
    tracked_products: number
    low_stock_products: number
    out_of_stock_products: number
    total_stock_value: number
  }
  recent_movements: BatchMovement[]
}
