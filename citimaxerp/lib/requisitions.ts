import apiCall from "./api";
import { getApiUrl } from "./config";
import { getToken } from "./token-manager";

// Types for Requisition and RequisitionItem based on API documentation
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

export interface User {
  id: string;
  company_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string | null;
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: string | null;
  role_id: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  website?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_first_time: boolean;
  current_subscription_id?: string | null;
}

export interface RequisitionItem {
  id: string;
  requisition_id: string;
  product_id?: string | null;
  custom_item_name?: string | null;
  variant_id?: string | null;
  quantity: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  product?: Product | null;
  variant?: Variant | null;
}

export interface Requisition {
  id: string;
  requisition_number: string;
  company_id: string;
  requester_id: string;
  approval_status: "pending" | "approved" | "rejected";
  status: "pending" | "approved" | "rejected" | "dispatched" | "acknowledged";
  approver_id?: string | null;
  dispatch_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items: RequisitionItem[];
  requester: User;
  company: Company;
  approver?: User | null;
}

export interface RequisitionResponse {
  status: string;
  message: string;
  data: {
    current_page: number;
    data: Requisition[];
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

// Create Requisition
export async function createRequisition(payload: {
  notes?: string;
  items: Array<{
    product_id?: string;
    custom_item_name?: string;
    variant_id?: string;
    quantity: number;
    notes?: string;
  }>;
}): Promise<{ status: string; message: string; requisition: Requisition }> {
  const response = await apiCall<{ status: string; message: string; requisition: Requisition }>("/whs/requisitions", "POST", payload, true);
  return response;
}

// List Requisitions
export async function listRequisitions(params?: { 
  requester_id?: string; 
  approval_status?: string; 
  status?: string; 
  page?: number; 
  per_page?: number 
}): Promise<RequisitionResponse> {
  const query = params ? "?" + Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&") : "";
  const response = await apiCall<RequisitionResponse>(`/whs/requisitions${query}`, "GET", undefined, true);
  return response;
}

// View Requisition Details
export async function getRequisition(id: string): Promise<Requisition> {
  const response = await apiCall<{ data: Requisition }>(`/whs/requisitions/${id}`, "GET", undefined, true);
  return response.data;
}

// Approve Requisition
export async function approveRequisition(
  requisitionId: string,
  payload: {
    approver_id: string;
    approval_status: "approved";
    notes?: string;
  }
): Promise<{ status: string; message: string; requisition: Requisition }> {
  const response = await apiCall<{ status: string; message: string; requisition: Requisition }>(`/whs/requisitions/${requisitionId}/approve`, "PATCH", payload, true);
  return response;
}

// Reject Requisition
// Backend has no standalone /reject route — rejection goes through the same
// /approve endpoint used for approval, with approval_status set to "rejected".
export async function rejectRequisition(
  requisitionId: string,
  payload: {
    approver_id: string;
    notes?: string;
  }
): Promise<{ status: string; message: string; requisition: Requisition }> {
  const response = await apiCall<{ status: string; message: string; requisition: Requisition }>(`/whs/requisitions/${requisitionId}/approve`, "PATCH", {
    approver_id: payload.approver_id,
    approval_status: "rejected",
    notes: payload.notes,
  }, true);
  return response;
}

// Acknowledge Requisition
export async function acknowledgeRequisition(
  requisitionId: string,
  payload?: {
    notes?: string;
  }
): Promise<{ status: string; message: string; requisition: Requisition }> {
  const response = await apiCall<{ status: string; message: string; requisition: Requisition }>(`/whs/requisitions/${requisitionId}/acknowledge`, "PATCH", payload, true);
  return response;
}

// Update Requisition
export async function updateRequisition(
  requisitionId: string,
  payload: {
    notes?: string;
    items?: Array<{
      id?: string;
      product_id?: string;
      custom_item_name?: string;
      variant_id?: string;
      quantity: number;
      notes?: string;
    }>;
  }
): Promise<{ status: string; message: string; requisition: Requisition }> {
  const response = await apiCall<{ status: string; message: string; requisition: Requisition }>(`/whs/requisitions/${requisitionId}`, "PUT", payload, true);
  return response;
}

// Update Requisition Status
export async function updateRequisitionStatus(
  requisitionId: string,
  payload: {
    status?: "pending" | "approved" | "rejected" | "dispatched" | "acknowledged";
    dispatch_id?: string;
  }
): Promise<{ status: string; message: string; requisition: Requisition }> {
  const response = await apiCall<{ status: string; message: string; requisition: Requisition }>(`/whs/requisitions/${requisitionId}`, "PATCH", payload, true);
  return response;
}

// Download Requisition Note PDF (keyed by the dispatch created from the requisition)
export async function downloadRequisitionNote(dispatchId: string): Promise<Blob> {
  const url = getApiUrl(`/whs/dispatches/${dispatchId}/requisition-note`);
  const token = getToken();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/pdf",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download requisition note: ${response.statusText}`);
  }

  return response.blob();
}

export async function downloadOfficialPurpose(requisitionId: string, type: "stock" | "custom"): Promise<Blob> {
  const response = await fetch(getApiUrl(`/whs/requisitions/${requisitionId}/official-purpose?type=${type}`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/pdf",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download official purpose document: ${response.statusText}`);
  }

  return response.blob();
}

// Delete Requisition
export async function deleteRequisition(requisitionId: string): Promise<{ status: string; message: string }> {
  const response = await apiCall<{ status: string; message: string }>(`/whs/requisitions/${requisitionId}`, "DELETE", undefined, true);
  return response;
}