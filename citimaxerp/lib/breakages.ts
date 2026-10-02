import apiCall from "./api";
import { type User } from "./users";

// Types for Breakage and BreakageItem based on API response
export interface BreakageItem {
  id: string;
  breakage_id: string;
  replacement_requested: boolean;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  cause: string;
  notes?: string | null;
  company_id: string;
  image_path?: string | null;
  created_at: string;
  updated_at: string;
  product?: any; // Will be populated by API
  variant?: any | null;
  // Added for assignable item support
  assignable_item_id: string;
  assignableItem?: AssignableItem;
}

export interface Breakage {
  id: string;
  company_id: string;
  reported_by: string;
  breakage_number: string;
  notes?: string | null;
  approval_status: "pending" | "approved" | "rejected";
  approved_by?: string | null;
  approved_at?: string | null;
  status: "pending" | "approved" | "rejected" | "replaced" | "dispatch_initiated";
  created_at: string;
  updated_at: string;
  items: BreakageItem[];
  reporter?: User;
  approver?: User | null;
}

export interface BreakageResponse {
  status: string;
  message: string;
  breakages: {
    current_page: number;
    data: Breakage[];
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

// List Breakages
export async function listBreakages(params?: { 
  reported_by?: string; 
  approval_status?: string; 
  status?: string; 
  page?: number; 
  per_page?: number 
}): Promise<BreakageResponse> {
  const query = params ? "?" + Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&") : "";
  const response = await apiCall<BreakageResponse>(`/whs/breakages${query}`, "GET", undefined, true);
  return response;
}

// Create Breakage
export async function createBreakage(payload: {
  approver_id: string;
  notes?: string;
  items: Array<{
    assignable_item_id: string;
    product_id: string;
    quantity: number;
    cause: string;
    notes?: string;
    replacement_requested: boolean;
    image_path?: string;
  }>;
}): Promise<{ status: string; message: string; breakage: Breakage }> {
  const response = await apiCall<{ status: string; message: string; breakage: Breakage }>("/whs/breakages", "POST", payload, true);
  return response;
}

// View Breakage Details
export async function getBreakage(id: string): Promise<Breakage> {
  const response = await apiCall<{ data: Breakage }>(`/whs/breakages/${id}`, "GET", undefined, true);
  return response.data;
}

// Approve Breakage
export async function approveBreakage(
  breakageId: string,
  payload: {
    approval_status: "approved" | "rejected";
    notes?: string;
  }
): Promise<{ status: string; message: string; breakage: Breakage }> {
  const response = await apiCall<{ status: string; message: string; breakage: Breakage }>(`/whs/breakages/${breakageId}/approve`, "PATCH", payload, true);
  return response;
}

// Update Breakage Status
export async function updateBreakageStatus(
  breakageId: string,
  status: "pending" | "approved" | "rejected" | "replaced" | "dispatch_initiated"
): Promise<{ status: string; message: string; breakage: Breakage }> {
  const response = await apiCall<{ status: string; message: string; breakage: Breakage }>(`/whs/breakages/${breakageId}`, "PUT", { status }, true);
  return response;
}

// Update Breakage
export async function updateBreakage(
  breakageId: string,
  payload: {
    notes?: string;
    items?: Array<{
      id?: string;
      assignable_item_id: string;
      quantity: number;
      cause: string;
      notes?: string;
      replacement_requested: boolean;
      image_path?: string;
    }>;
  }
): Promise<{ status: string; message: string; breakage: Breakage }> {
  const response = await apiCall<{ status: string; message: string; breakage: Breakage }>(`/whs/breakages/${breakageId}`, "PUT", payload, true);
  return response;
}

// Delete Breakage
export async function deleteBreakage(breakageId: string): Promise<{ status: string; message: string }> {
  const response = await apiCall<{ status: string; message: string }>(`/whs/breakages/${breakageId}`, "DELETE", undefined, true);
  return response;
}

// Get Assignable Items for Breakage Reporting
export async function getAssignableItems(): Promise<{ status: string; message: string; items: AssignableItem[] }> {
  const response = await apiCall<{ status: string; message: string; items: AssignableItem[] }>("/whs/breakages/my-assignable-items", "GET", undefined, true);
  return response;
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