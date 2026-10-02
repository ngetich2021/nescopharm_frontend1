import apiCall from "./api";

// Types for Dispatch and DispatchItem based on API documentation
export interface Product {
  id: string;
  company_id: string;
  store_id: string;
  name: string;
  description?: string | null;
  short_description?: string | null;
  price: string;
  unit_cost: string;
  last_price?: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  category: string;
  sku: string;
  barcode?: string | null;
  brand?: string | null;
  supplier?: string | null;
  unit_of_measurement: string;
  is_active: boolean;
  is_featured: boolean;
  is_digital: boolean;
  track_inventory: boolean;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  shipping_class?: string | null;
  image_url?: string | null;
  images: string[];
  primary_image_index: number;
  has_variations: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  on_hand?: number | null;
  allocated?: number | null;
  category_id?: string | null;
  expiry_date?: string | null;
}

export interface Variant {
  id: string;
  product_id: string;
  company_id: string;
  store_id: string;
  name: string;
  sku: string;
  price: string;
  cost: string;
  stock_quantity: number;
  attributes: any[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  options: any[];
  images?: string | null;
  on_hand: number;
  allocated: number;
}

export interface Store {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  store_code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  manager_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  company_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url?: string | null;
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: string | null;
  role_id: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryBatch {
  id: string;
  product_id: string;
  variant_id?: string | null;
  store_id: string;
  batch_number: string;
  expiry_date?: string | null;
  quantity_available: number;
  quantity_allocated: number;
  status: string;
  store?: { id: string; name: string } | null;
}

export interface DispatchItem {
  id: string;
  dispatch_id: string;
  product_id: string;
  variant_id?: string | null;
  batch_id?: string | null;
  quantity: number;
  received_quantity: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  is_returnable: boolean;
  is_returned: boolean;
  return_date?: string | null;
  returned_quantity?: number | null;
  return_notes?: string | null;
  reminder_status?: string | null;
  product: Product;
  variant?: Variant | null;
  batch?: InventoryBatch | null;
}

export interface Dispatch {
  id: string;
  dispatch_number: string;
  from_store_id: string;
  to_entity?: string | null;
  to_user_id?: string | null;
  type: string;
  is_returnable: boolean;
  return_date?: string | null;
  is_returned: boolean;
  returned_by?: string | null;
  notes?: string | null;
  acknowledged_by?: User | null;
  created_at: string;
  updated_at: string;
  dispatch_items: DispatchItem[];
  from_store: Store;
  to_user?: User | null;
}

export interface DispatchResponse {
  status: string;
  message: string;
  dispatches: {
    current_page: number;
    data: Dispatch[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: {
      url?: string | null;
      label: string;
      active: boolean;
    }[];
    next_page_url?: string | null;
    path: string;
    per_page: number;
    prev_page_url?: string | null;
    to: number;
    total: number;
  };
}

// Create Dispatch
export async function createDispatch(payload: {
  from_store_id: string;
  to_entity: string;
  to_user_id: string;
  type: string;
  notes?: string;
  requisition_id?: string;
  items: Array<{
    product_id: string;
    variant_id?: string;
    batch_id?: string;
    quantity: number;
    is_returnable: boolean;
    return_date?: string;
    notes?: string;
  }>;
}): Promise<{ status: string; message: string; dispatch: Dispatch }> {
  const response = await apiCall<{ status: string; message: string; dispatch: Dispatch }>("/whs/dispatches", "POST", payload, true);
  return response;
}

// List available batches for a product (FEFO-sorted), optionally scoped to a store/variant
export async function getProductBatches(
  productId: string,
  params?: { store_id?: string; variant_id?: string }
): Promise<InventoryBatch[]> {
  const q = new URLSearchParams();
  if (params?.store_id) q.append("store_id", params.store_id);
  if (params?.variant_id) q.append("variant_id", params.variant_id);
  const qs = q.toString() ? `?${q}` : "";
  const response = await apiCall<{ status: string; data: { batches: InventoryBatch[] } }>(`/products/${productId}/inventory/availability${qs}`, "GET", undefined, true);
  return response.data?.batches ?? [];
}

// List Dispatches
export async function listDispatches(params?: { 
  from_store_id?: string; 
  to_user_id?: string; 
  type?: string; 
  page?: number; 
  per_page?: number 
}): Promise<DispatchResponse> {
  const query = params ? "?" + Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&") : "";
  const response = await apiCall<DispatchResponse>(`/whs/dispatches${query}`, "GET", undefined, true);
  return response;
}

// View Dispatch Details
export async function getDispatch(id: string): Promise<Dispatch> {
  const response = await apiCall<{ data: Dispatch }>(`/whs/dispatches/${id}`, "GET", undefined, true);
  return response.data;
}

// Acknowledge Receipt (Product Receipting)
export async function acknowledgeReceipt(dispatchId: string, payload: {
  items: Array<{
    id: string;
    received_quantity: number;
  }>;
}): Promise<{ status: string; message: string; dispatch: Dispatch }> {
  const response = await apiCall<{ status: string; message: string; dispatch: Dispatch }>(`/whs/dispatches/${dispatchId}/acknowledge`, "PATCH", payload, true);
  return response;
}

// Mark Items as Returned
export async function markItemsReturned(dispatchId: string, items: { id: string; returned_quantity: number; return_notes?: string }[]): Promise<Dispatch> {
  const response = await apiCall<{ data: Dispatch }>(`/whs/dispatches/${dispatchId}/mark-returned`, "POST", { items }, true);
  return response.data;
}

// Return Items
export async function returnItems(
  dispatchId: string,
  payload: {
    items: Array<{
      id: string;
      returned_quantity: number;
      return_notes?: string;
    }>;
  }
): Promise<{ status: string; message: string; dispatch: Dispatch }> {
  const response = await apiCall<{ status: string; message: string; dispatch: Dispatch }>(`/whs/dispatches/${dispatchId}/return`, "PATCH", payload, true);
  return response;
}

// List Overdue Returns
export async function listOverdueReturns(): Promise<DispatchItem[]> {
  const response = await apiCall<{ data: DispatchItem[] }>(`/whs/dispatches/overdue`, "GET", undefined, true);
  return response.data;
}

// Update Dispatch
export async function updateDispatch(
  dispatchId: string,
  payload: {
    from_store_id?: string;
    to_entity?: string;
    to_user_id?: string;
    type?: string;
    notes?: string;
    items?: Array<{
      id?: string;
      product_id: string;
      variant_id?: string;
      quantity: number;
      is_returnable: boolean;
      return_date?: string;
      notes?: string;
    }>;
  }
): Promise<{ status: string; message: string; dispatch: Dispatch }> {
  const response = await apiCall<{ status: string; message: string; dispatch: Dispatch }>(`/whs/dispatches/${dispatchId}`, "PUT", payload, true);
  return response;
}

// Delete Dispatch
export async function deleteDispatch(dispatchId: string): Promise<{ status: string; message: string }> {
  const response = await apiCall<{ status: string; message: string }>(`/whs/dispatches/${dispatchId}`, "DELETE", undefined, true);
  return response;
}
