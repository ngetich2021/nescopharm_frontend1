// Serial number data types for the serial number tracking system

export interface SerialNumber {
  id: string
  company_id: string
  store_id: string
  product_id: string
  variant_id: string | null
  batch_id: string | null
  serial_number: string
  barcode: string | null
  qr_code: string | null
  status: "active" | "inactive" | "sold" | "returned" | "damaged" | "expired"
  unit_cost: string
  unit_price: string
  received_date: string
  sold_date: string | null
  warranty_expiry_date: string | null
  purchase_reference: string | null
  sale_reference: string | null
  customer_id: string | null
  custom_attributes: any
  notes: string | null
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
  product?: {
    id: string
    name: string
    sku: string
    // ... other product fields
  }
  variant?: any
  batch?: {
    id: string
    batch_number: string
    // ... other batch fields
  }
  store?: {
    id: string
    name: string
    // ... other store fields
  }
  customer?: any
}

export interface SerialNumberSummary {
  total_serial_numbers: number
  active_serial_numbers: number
  sold_serial_numbers: number
  damaged_serial_numbers: number
  expired_serial_numbers: number
}

export interface SerialNumberStatistics {
  total_serials: number
  by_status: {
    active: number
    sold: number
    returned: number
    damaged: number
    lost: number
    recalled: number
  }
  warranty_stats: {
    under_warranty: number
    warranty_expired: number
    expiring_soon: number
    no_warranty: number
  }
  value_stats: {
    total_cost_value: number
    total_retail_value: number
    sold_value: number
  }
  recent_activity: {
    added_today: number
    added_this_week: number
    sold_today: number
    sold_this_week: number
  }
  calculated_at: string
}
