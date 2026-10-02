import apiCall from "./api";
import { type User } from "./users";

// Product interface for embedded product data
export interface Product {
  id: string;
  company_id: string;
  store_id: string;
  name: string;
  description?: string | null;
  short_description?: string | null;
  price?: string | null;
  unit_cost?: string | null;
  last_price?: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  category?: string | null;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  supplier?: string | null;
  unit_of_measurement?: string | null;
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

// Variant interface for embedded variant data
export interface Variant {
  id: string;
  product_id: string;
  company_id: string;
  store_id: string;
  name: string;
  sku?: string | null;
  price?: string | null;
  cost?: string | null;
  stock_quantity: number;
  attributes: any[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  options: any[];
  images?: string[] | null;
  on_hand: number;
  allocated: number;
}

// Types for Repair based on actual API response structure
export interface RepairItem {
  id: string;
  company_id: string;
  repair_id: string;
  product_id: string;
  product_variant: string | null;
  product_name?: string;
  variant_name?: string | null;
  unique_identifier: string;
  quantity: number;
  is_repairable: boolean;
  repaired: boolean;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | "assigned_repair";
  notes: string;
  // Assignment fields
  assigned_to?: string | User | null;
  repaired_by?: string | null;
  repaired_at?: string | null;
  repair_notes?: string | null;
  created_at: string;
  updated_at: string;
  // Embedded objects from API response
  product: Product;
  variant?: Variant | null;
  // Assigned user info (populated when fetched)
  assignedUser?: User | null;
}

export interface Repair {
  id: string;
  company_id: string;
  repair_number: string;
  reported_by: string;
  approved_by: string | null;
  approved_at: string | null;
  status: "pending" | "approved" | "rejected" | "resolved" | "reported" | "in_progress" | "completed" | "failed" | "cancelled";
  approval_status: "pending" | "approved" | "rejected";
  description: string;
  notes: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  estimated_completion_date?: string | null;
  actual_completion_date?: string | null;
  cost?: number | null;
  repair_notes?: string | null;
  created_at: string;
  updated_at: string;
  items: RepairItem[];
  reporter: User | null;
  approver: User | null;
}

export interface RepairResponse {
  status: string;
  message: string;
  data: {
    current_page: number;
    data: Repair[];
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

export interface AssignableItem {
  id: string;
  dispatch_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  received_quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_returnable: boolean;
  is_returned: boolean;
  return_date: string | null;
  returned_quantity: number | null;
  return_notes: string | null;
  reminder_status: string | null;
  dispatch_number: string;
  type: string;
  from_store_id: string;
  to_entity: string;
  product_name: string;
  variant_name: string | null;
}

// List Repairs with filtering options
export async function listRepairs(params?: { 
  reported_by?: string; 
  status?: string; 
  approval_status?: string;
  page?: number; 
  per_page?: number 
}): Promise<RepairResponse> {
  const query = params ? "?" + Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&") : "";
  const response = await apiCall<RepairResponse>(`/whs/repairs${query}`, "GET", undefined, true);
  return response;
}

// Create Repair (HOD role required)
export async function createRepair(payload: {
  approver_id: string;
  description: string;
  items: {
    product_id: string;
    product_variant?: string;
    quantity: number;
    notes?: string;
    is_repairable: boolean;
  }[];
}): Promise<{ status: string; message: string; repair: Repair }> {
  const response = await apiCall<{ status: string; message: string; repair: Repair }>("/whs/repairs", "POST", payload, true);
  return response;
}

// View Repair Details
export async function getRepair(id: string): Promise<Repair> {
  const response = await apiCall<{ data: Repair }>(`/whs/repairs/${id}`, "GET", undefined, true);
  return response.data;
}

// Approve Repair
export async function approveRepair(
  repairId: string,
  payload: {
    approval_status: "approved" | "rejected";
    notes?: string;
    rejection_reason?: string;
  }
): Promise<{ status: string; message: string; repair: Repair }> {
  const response = await apiCall<{ status: string; message: string; repair: Repair }>(`/whs/repairs/${repairId}/approve`, "PATCH", payload, true);
  return response;
}

// Assign Repair Items
export async function assignRepairItems(
  repairId: string,
  payload: {
    assignments: Array<{
      item_id: string;
      assigned_to: string;
    }>;
  }
): Promise<{ status: string; message: string; items: RepairItem[] }> {
  const response = await apiCall<{ status: string; message: string; items: RepairItem[] }>(`/whs/repairs/${repairId}/assign-items`, "POST", payload, true);
  return response;
}

// Update Repair Items Status
export async function updateRepairItemsStatus(
  repairId: string,
  payload: {
    items: Array<{
      id: string;
      status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | "assigned_repair";
    }>;
    repair_status?: "pending" | "reported" | "in_progress" | "completed" | "failed" | "cancelled";
  }
): Promise<{ status: string; message: string; repair: Repair }> {
  const response = await apiCall<{ status: string; message: string; repair: Repair }>(`/whs/repairs/${repairId}/items/status`, "PATCH", payload, true);
  return response;
}

// Update Repair Status and Progress
export async function updateRepairStatus(
  repairId: string,
  payload: {
    status: "reported" | "in_progress" | "completed" | "failed" | "cancelled";
    repaired?: boolean;
    repair_notes?: string;
    actual_completion_date?: string;
    cost?: number;
  }
): Promise<{ status: string; message: string; repair: Repair }> {
  const response = await apiCall<{ status: string; message: string; repair: Repair }>(`/whs/repairs/${repairId}/status`, "PATCH", payload, true);
  return response;
}

// Update Repair Details
export async function updateRepair(
  repairId: string,
  payload: {
    description?: string;
    notes?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    estimated_completion_date?: string;
  }
): Promise<{ status: string; message: string; repair: Repair }> {
  const response = await apiCall<{ status: string; message: string; repair: Repair }>(`/whs/repairs/${repairId}`, "PUT", payload, true);
  return response;
}

// Update Repair with Items and Details (comprehensive update)
export async function updateRepairWithItems(
  repairId: string,
  payload: {
    approver_id?: string;
    description?: string;
    notes?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    estimated_completion_date?: string;
    items?: {
      id?: string; // For existing items
      product_id: string;
      product_variant?: string;
      quantity: number;
      notes?: string;
      is_repairable: boolean;
    }[];
  }
): Promise<{ status: string; message: string; repair: Repair }> {
  // Comprehensive update endpoint that handles both repair details and items
  const response = await apiCall<{ status: string; message: string; repair: Repair }>(`/whs/repairs/${repairId}`, "PATCH", payload, true);
  return response;
}

// Delete Repair
export async function deleteRepair(repairId: string): Promise<{ status: string; message: string }> {
  const response = await apiCall<{ status: string; message: string }>(`/whs/repairs/${repairId}`, "DELETE", undefined, true);
  return response;
}

// Get User's Assignable Items for Repair Reporting
export async function getAssignableItemsForRepair(): Promise<{ status: string; message: string; items: AssignableItem[] }> {
  const response = await apiCall<{ status: string; message: string; items: AssignableItem[] }>("/whs/breakages/my-assignable-items", "GET", undefined, true);
  return response;
}

// Get Products available for repair (for HODs)
export async function getRepairableProducts(): Promise<{ status: string; message: string; products: any[] }> {
  const response = await apiCall<{ status: string; message: string; products: any[] }>("/whs/repairs/repairable-products", "GET", undefined, true);
  return response;
}

// Escalate repair to breakage if non-repairable
export async function escalateRepairToBreakage(
  repairId: string,
  payload: {
    quantity: number;
    cause: string;
    notes?: string;
    replacement_requested: boolean;
  }
): Promise<{ status: string; message: string; breakage: any }> {
  const response = await apiCall<{ status: string; message: string; breakage: any }>(`/whs/repairs/${repairId}/escalate-to-breakage`, "POST", payload, true);
  return response;
}