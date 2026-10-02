import apiCall from "./api"

export interface PurchaseOrderItem {
  received_quantity: number
  id?: string
  product_id: string
  variant_id?: string | null
  quantity: number
  unit_price: number
  store_id: string
  // Add related objects for UI
  product?: any
  variant?: any
  store?: any
}

export interface PurchaseOrder {
  id: string
  order_number: string
  company_id: string
  supplier_id: string
  discount?: number | null
  shipping_cost?: number | string | null
  logistics_cost?: number | string | null
  supplier_invoice_date?: string | null
  tax_rate?: number | null
  order_date: string
  delivery_date: string
  exchange_rate?: string | null
  template?: string | null
  currency_code?: string | null
  status: string
  comments?: string | null
  created_by?: string | null
  updated_by?: string | null
  parent_id?: string | null
  store_id: string
  created_at?: string
  updated_at?: string
  // Financial fields
  total_amount?: string | null
  amount_paid?: string | null
  payment_status?: string | null
  // Approval fields
  approval_status?: string | null
  approved_by?: string | null
  // Nested objects
  items: PurchaseOrderItem[]
  supplier?: any
  store?: any
  // Legacy compatibility
  expected_delivery_date?: any
}

export interface CreatePurchaseOrderPayload {
  supplier_id: string
  order_date: string
  delivery_date: string
  store_id: string
  comments?: string
  shipping_cost?: number
  logistics_cost?: number
  items: Array<{
    product_id: string
    variant_id?: string | null
    quantity: number
    unit_price: number
    store_id: string
  }>
}

export interface UpdatePurchaseOrderPayload {
  supplier_id: string
  order_date: string
  delivery_date: string
  store_id: string
  status: string
  comments?: string
  shipping_cost?: number
  logistics_cost?: number
  items: Array<{
    product_id: string
    variant_id?: string | null
    quantity: number
    unit_price: number
    store_id: string
  }>
}

export interface ReceiptPurchaseOrderPayload {
  items: { id: string; received_quantity: number }[]
  // Actual shipping/logistics cost for THIS shipment - distributed across the
  // products being received in this call to update their landed-cost basis.
  shipping_cost?: number
  logistics_cost?: number
}

// List purchase orders
export async function getPurchaseOrders(params?: { status?: string; supplier_id?: string }): Promise<PurchaseOrder[]> {
  const query = params ? "?" + Object.entries(params).filter(([_, v]) => v).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`).join("&") : ""

  // Use a more flexible type for the response to handle pagination
  const response = await apiCall<{ status: string; data: PurchaseOrder[] | { data: PurchaseOrder[] }; message?: string }>(
    `/purchase-orders${query}`,
    "GET",
    undefined,
    true
  )

  if (response.status === "success" && response.data) {
    // Check if response.data is an array (direct list) or object (paginated)
    if (Array.isArray(response.data)) {
      return response.data
    } else if (response.data && 'data' in response.data && Array.isArray(response.data.data)) {
      return response.data.data
    }
    return []
  } else {
    throw new Error(response.message || "Failed to fetch purchase orders")
  }
}

// Get a single purchase order
export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const response = await apiCall<{ status: string; data: PurchaseOrder; message?: string }>(
    `/purchase-orders/${id}`,
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  } else {
    throw new Error(response.message || "Failed to fetch purchase order")
  }
}

// Create a purchase order
export async function createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrder> {
  const response = await apiCall<{ status: string; data: PurchaseOrder; message?: string }>(
    "/purchase-orders",
    "POST",
    payload,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  } else {
    throw new Error(response.message || "Failed to create purchase order")
  }
}

// Update a purchase order
export async function updatePurchaseOrder(id: string, payload: UpdatePurchaseOrderPayload): Promise<PurchaseOrder> {
  const response = await apiCall<{ status: string; order: PurchaseOrder; message?: string }>(
    `/purchase-orders/${id}`,
    "PUT",
    payload,
    true
  )
  if (response.status === "success" && response.order) {
    return response.order
  } else {
    throw new Error(response.message || "Failed to update purchase order")
  }
}

// Approve a purchase order
export async function approvePurchaseOrder(id: string, notes?: string): Promise<PurchaseOrder> {
  const response = await apiCall<{ status: string; data: PurchaseOrder; message?: string }>(
    `/purchase-orders/${id}/approve`,
    "POST",
    {
      approval_status: "approved",
      notes: notes || undefined
    },
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  } else {
    throw new Error(response.message || "Failed to approve purchase order")
  }
}

// Delete a purchase order
export async function deletePurchaseOrder(id: string): Promise<void> {
  const response = await apiCall<{ status: string; message?: string }>(
    `/purchase-orders/${id}`,
    "DELETE",
    undefined,
    true
  )
  if (response.status !== "success") {
    throw new Error(response.message || "Failed to delete purchase order")
  }
}

// Receipt a purchase order (partial or full)
export async function receiptPurchaseOrder(id: string, payload: ReceiptPurchaseOrderPayload): Promise<{ order: PurchaseOrder; new_purchase_order?: PurchaseOrder; pricing_warnings: string[] }> {
  const response = await apiCall<{ status: string; purchase_order: PurchaseOrder; new_purchase_order?: PurchaseOrder; pricing_warnings?: string[]; message?: string }>(
    `/purchase-orders/${id}/receipt`,
    "POST",
    payload,
    true
  )
  if (response.status === "success" && response.purchase_order) {
    return { order: response.purchase_order, new_purchase_order: response.new_purchase_order, pricing_warnings: response.pricing_warnings || [] }
  } else {
    throw new Error(response.message || "Failed to receipt purchase order")
  }
}

// Return a purchase order
export async function returnPurchaseOrder(id: string, payload: { items: { id: string; returned_quantity: number }[]; reason?: string }): Promise<{ order: PurchaseOrder }> {
  const response = await apiCall<{ status: string; order: PurchaseOrder; message?: string }>(
    `/purchase-orders/${id}/return`,
    "POST",
    payload,
    true
  )
  if (response.status === "success" && response.order) {
    return { order: response.order }
  } else {
    throw new Error(response.message || "Failed to return purchase order")
  }
} 