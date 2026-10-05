import apiCall from "./api"

export interface PurchaseOrderItem {
  id?: string
  product_id: string
  variant_id?: string | null
  quantity: number
  received_quantity: number
  returned_quantity?: number
  unit_price: number | string
  subtotal?: number | string
  store_id: string | null
  description?: string | null
  // Computed by the API
  item_name?: string
  item_number?: number | null
  size?: string | null
  pending_quantity?: number
  over_received_quantity?: number
  returnable_quantity?: number
  product?: any
  variant?: any
  store?: any
}

export interface PurchaseOrder {
  id: string
  order_number: string
  company_id: string
  supplier_id: string
  discount?: number | string | null
  shipping_cost?: number | string | null
  logistics_cost?: number | string | null
  order_date: string
  delivery_date: string | null
  currency_code?: string | null
  // pending -> partial -> received, driven by the product receipts recorded against it; or cancelled
  status: string
  comments?: string | null
  created_by?: string | null
  updated_by?: string | null
  parent_id?: string | null
  store_id: string | null
  created_at?: string
  updated_at?: string
  total_amount?: string | null
  amount_paid?: string | null
  payment_status?: string | null
  approval_status?: string | null
  // The approver relation serialises over the id column, so this is the approver user when loaded.
  approved_by?: { first_name?: string; last_name?: string } | string | null
  items: PurchaseOrderItem[]
  product_receipts?: { id: string; product_receipt_number: string; reference_number?: string | null; created_at: string }[]
  supplier?: any
  store?: any
}

export interface PurchaseOrderLineInput {
  product_id: string
  variant_id?: string | null
  quantity: number
  unit_price: number
  store_id?: string | null
}

export interface CreatePurchaseOrderPayload {
  supplier_id: string
  order_date: string
  delivery_date?: string | null
  store_id?: string | null
  comments?: string
  items: PurchaseOrderLineInput[]
}

export interface UpdatePurchaseOrderPayload extends Partial<CreatePurchaseOrderPayload> {
  status?: "pending" | "cancelled"
}

type ApiResponse<T> = { status: string; data: T; message?: string | Record<string, string[]> }

const messageOf = (response: { message?: unknown }, fallback: string) =>
  typeof response.message === "string" ? response.message : fallback

export const itemLabel = (item: PurchaseOrderItem): string =>
  item.item_name || item.description || item.product?.name || "-"

export async function getPurchaseOrders(params?: { status?: string; supplier_id?: string }): Promise<PurchaseOrder[]> {
  const query = params
    ? "?" + Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`).join("&")
    : ""
  const response = await apiCall<ApiResponse<PurchaseOrder[]>>(`/purchase-orders${query}`, "GET", undefined, true)
  if (response.status === "success" && Array.isArray(response.data)) return response.data
  throw new Error(messageOf(response, "Failed to fetch purchase orders"))
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const response = await apiCall<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`, "GET", undefined, true)
  if (response.status === "success" && response.data) return response.data
  throw new Error(messageOf(response, "Failed to fetch purchase order"))
}

export async function createPurchaseOrder(payload: CreatePurchaseOrderPayload): Promise<PurchaseOrder> {
  const response = await apiCall<ApiResponse<PurchaseOrder>>("/purchase-orders", "POST", payload, true)
  if (response.status === "success" && response.data) return response.data
  throw new Error(messageOf(response, "Failed to create purchase order"))
}

export async function updatePurchaseOrder(id: string, payload: UpdatePurchaseOrderPayload): Promise<PurchaseOrder> {
  const response = await apiCall<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`, "PUT", payload, true)
  if (response.status === "success" && response.data) return response.data
  throw new Error(messageOf(response, "Failed to update purchase order"))
}

export async function approvePurchaseOrder(id: string, notes?: string, decision: "approved" | "rejected" = "approved"): Promise<PurchaseOrder> {
  const response = await apiCall<ApiResponse<PurchaseOrder>>(
    `/purchase-orders/${id}/approve`,
    "POST",
    { approval_status: decision, notes: notes || undefined },
    true
  )
  if (response.status === "success" && response.data) return response.data
  throw new Error(messageOf(response, "Failed to update approval"))
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const response = await apiCall<{ status: string; message?: string }>(`/purchase-orders/${id}`, "DELETE", undefined, true)
  if (response.status !== "success") throw new Error(messageOf(response, "Failed to delete purchase order"))
}

// Approved orders still awaiting goods, for raising a product receipt against.
export async function getReceivablePurchaseOrders(): Promise<PurchaseOrder[]> {
  const response = await apiCall<ApiResponse<PurchaseOrder[]>>("/purchase-orders?receivable=1", "GET", undefined, true)
  if (response.status === "success" && Array.isArray(response.data)) return response.data
  throw new Error(messageOf(response, "Failed to fetch open purchase orders"))
}

export const receiveGoodsUrl = (orderId: string) => `/product-receipt?purchase_order=${encodeURIComponent(orderId)}`

export async function returnPurchaseOrder(
  id: string,
  payload: { items: { id: string; returned_quantity: number }[]; reason: string }
): Promise<PurchaseOrder> {
  const response = await apiCall<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/return`, "POST", payload, true)
  if (response.status === "success" && response.data) return response.data
  throw new Error(messageOf(response, "Failed to record return"))
}
