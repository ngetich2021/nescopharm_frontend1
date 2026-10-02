import apiCall from "./api";

// ============================================
// Order Dispatch Types
// ============================================

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string | null;
  role_id?: string;
  is_active?: boolean;
}

export interface OrderDispatchApprover {
  order: number;
  status: 'pending' | 'approved' | 'rejected';
  user_id: string;
  comments?: string | null;
  approved_at?: string | null;
}

export interface ApproverDetail {
  // An approver account may be removed after the dispatch was created.
  user: User | null;
  order: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_at?: string | null;
  comments?: string | null;
}

export interface ApprovalProgress {
  total: number;
  approved: number;
  pending: number;
  percentage: number;
}

export interface OrderDispatchItem {
  id: string;
  order_dispatch_id: string;
  order_item_id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  delivered_quantity: number;
  damaged_quantity: number;
  batch_allocations?: Array<{
    batch_id: string;
    batch_number: string;
    quantity: number;
    expiry_date: string | null;
  }> | null;
  created_at: string;
  updated_at: string;
  // A historic dispatch can outlive a product removed from the catalogue.
  product?: {
    id: string;
    name: string;
    product_number: string;
    price: string;
    description?: string | null;
    unit_cost: string;
    stock_quantity: number;
    sku: string;
    image_url?: string | null;
    images: string[];
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: string;
    stock_quantity: number;
  } | null;
}

export interface OrderDispatch {
  id: string;
  dispatch_number: string;
  order_id: string;
  company_id: string;
  from_store_id?: string | null;
  delivery_location_id?: string | null;
  logistic_id?: string | null;

  status: 'draft' | 'pending' | 'approved' | 'in_transit' | 'delivered' | 'cancelled';
  approval_status: 'draft' | 'pending' | 'in_progress' | 'approved' | 'rejected';

  dispatch_date?: string | null;
  estimated_delivery_date?: string | null;
  actual_delivery_date?: string | null;

  notes?: string | null;
  special_instructions?: string | null;

  created_by: User;
  final_approved_at?: string | null;
  created_at: string;
  updated_at: string;

  // Arrays and Objects
  approvers: OrderDispatchApprover[];
  approver_details: ApproverDetail[];
  current_approver?: User | null;
  approval_progress: ApprovalProgress;

  items: OrderDispatchItem[];

  // Relations
  order: {
    id: string;
    order_number: string;
    customer_id: string;
    total_amount: string;
    status: string;
    payment_status?: string;
    created_at: string;
    customer: {
      id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      customer_number?: string;
      customer_type?: string | null;
      business_name?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      region?: string | null;
      county?: string | null;
      country?: string | null;
      postal_code?: string | null;
    };
  };

  from_store?: {
    id: string;
    name: string;
  } | null;

  // Note: delivery_locations has no single "address"/"name" column - the
  // full address is assembled from house_number + street + estate +
  // landmark, and it has no region/state/county (that granularity only
  // lives on the customer record).
  delivery_location?: {
    id: string;
    customer_id?: string;
    house_number?: string | null;
    estate?: string | null;
    street?: string | null;
    city?: string | null;
    country?: string | null;
    landmark?: string | null;
    location_note?: string | null;
    is_default?: boolean;
    [key: string]: any;
  } | null;

  logistic?: {
    id: string;
    status: string;
    delivery_status?: string;
    payment_status?: string;
    delivery_invoice_id?: string | null;
    tracking_number?: string | null;
    driver_name?: string | null;
    driver_contact?: string | null;
    vehicle_registration?: string | null;
    vehicle_type?: string | null;
    vehicle_id?: string | null;
    delivery_method?: string | null;
    logistics_provider?: string | null;
    recipient_name?: string | null;
    recipient_phone?: string | null;
    delivery_address?: string | null;
    delivery_location?: string | null;
    city?: string | null;
    state?: string | null;
    region?: string | null;
    country?: string | null;
    estimated_delivery_time?: string | null;
    actual_delivery_time?: string | null;
    notes?: string | null;
    delivery_note_file?: string | null;
    delivery_note_url?: string | null;
    delivery_note_status?: 'pending_review' | 'approved' | 'resubmit_requested' | null;
    delivery_note_uploaded_at?: string | null;
    delivery_note_review_comment?: string | null;
    delivery_note_reviewed_at?: string | null;
    delivery_person?: {
      id: string;
      full_name?: string;
      phone_number?: string;
      [key: string]: any;
    } | null;
    [key: string]: any;
  } | null;

  // Legacy or optional fields kept for compatibility if needed, but primary source is above
  dispatch_items?: OrderDispatchItem[]; // Alias for items if needed by legacy code, but we should switch to items
}

// ============================================
// Request Types
// ============================================

export interface CreateOrderDispatchRequest {
  order_id: string;
  // delivery_location_id might be optional if not in payload, but keeping it to be safe or making it optional if user didn't specify
  delivery_location_id?: string;
  notes?: string;
  estimated_delivery_date?: string;
  special_instructions?: string;
  items?: Array<{
    order_item_id: string;
    product_id: string;
    quantity_dispatched: number;
    // adding available quantity just in case it's needed for validation on shared types
    // but strictly for payload usually we just send minimal data
  }>;
  // User payload shows simple string array for approvers
  approvers?: string[];
}

export interface UpdateOrderDispatchRequest {
  delivery_location_id?: string;
  notes?: string;
  items?: Array<{
    id?: string;
    order_item_id: string;
    product_id: string;
    quantity_dispatched: number;
  }>;
  approvers?: Array<{
    id?: string;
    user_id: string;
    order: number;
  }>;
}

export interface ApproveDispatchRequest {
  comments?: string;
}

export interface RejectDispatchRequest {
  reason: string;
}

export interface CreateLogisticsFromDispatchRequest {
  // Option A: Using delivery_person_id (driver_name and driver_contact are auto-filled)
  delivery_person_id?: string;
  // Option B: Manual driver details (required if delivery_person_id is not provided)
  driver_name?: string;
  driver_contact?: string;
  // Required
  vehicle_registration: string;
  // Optional
  vehicle_type?: string;
  estimated_delivery_time?: string;
  pickup_location?: string;
  delivery_location?: string;
  notes?: string;
}

export interface MarkDeliveredRequest {
  items: Array<{
    item_id: string;
    delivered_quantity: number;
    damaged_quantity: number;
    delivery_notes?: string;
  }>;
}

// ============================================
// Company Dispatch Settings Types
// ============================================

export interface CompanyDispatchSettings {
  id: string;
  company_id: string;
  require_approval: boolean;
  default_approvers: Array<{
    user_id: string;
    order: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface UpdateCompanyDispatchSettingsRequest {
  require_approval: boolean;
  default_approvers: Array<{
    user_id: string;
    order: number;
  }>;
}

export interface PotentialApprover {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
  is_active: boolean;
}

// ============================================
// API Functions
// ============================================

/**
 * Create a new order dispatch from an order
 */
export async function createOrderDispatch(
  data: CreateOrderDispatchRequest
): Promise<{ status: string; message: string; data: OrderDispatch }> {
  const response = await apiCall<{ status: string; message: string; data: OrderDispatch }>(
    "/order-dispatches",
    "POST",
    data,
    true
  );
  return response;
}

/**
 * Get a specific order dispatch by ID
 */
export async function getOrderDispatch(
  dispatchId: string
): Promise<{ status: string; data: OrderDispatch }> {
  const response = await apiCall<{ status: string; data: OrderDispatch }>(
    `/order-dispatches/${dispatchId}`,
    "GET",
    undefined,
    true
  );
  return response;
}

/**
 * List all order dispatches with optional filters
 */
export async function listOrderDispatches(params?: {
  order_id?: string;
  status?: string;
  approval_status?: string;
  page?: number;
  per_page?: number;
}): Promise<{
  status: string;
  data: OrderDispatch[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}> {
  const query = params
    ? "?" +
    Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
      .join("&")
    : "";

  const response = await apiCall<{
    status: string;
    data: OrderDispatch[];
    meta?: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  }>(`/order-dispatches${query}`, "GET", undefined, true);
  return response;
}

/**
 * Update an order dispatch (only in draft status)
 */
export async function updateOrderDispatch(
  dispatchId: string,
  data: UpdateOrderDispatchRequest
): Promise<{ status: string; message: string; data: OrderDispatch }> {
  const response = await apiCall<{ status: string; message: string; data: OrderDispatch }>(
    `/order-dispatches/${dispatchId}`,
    "PUT",
    data,
    true
  );
  return response;
}

/**
 * Submit dispatch for approval
 */
export async function submitDispatchForApproval(
  dispatchId: string
): Promise<{ status: string; message: string; data: OrderDispatch }> {
  const response = await apiCall<{ status: string; message: string; data: OrderDispatch }>(
    `/order-dispatches/${dispatchId}/submit`,
    "POST",
    undefined,
    true
  );
  return response;
}

/**
 * Approve dispatch (current approver only)
 */
export async function approveDispatch(
  dispatchId: string,
  data?: ApproveDispatchRequest
): Promise<{ status: string; message: string; data: OrderDispatch }> {
  const response = await apiCall<{ status: string; message: string; data: OrderDispatch }>(
    `/order-dispatches/${dispatchId}/approve`,
    "POST",
    data,
    true
  );
  return response;
}

/**
 * Reject dispatch (current approver only)
 */
export async function rejectDispatch(
  dispatchId: string,
  data: RejectDispatchRequest
): Promise<{ status: string; message: string; data: OrderDispatch }> {
  const response = await apiCall<{ status: string; message: string; data: OrderDispatch }>(
    `/order-dispatches/${dispatchId}/reject`,
    "POST",
    data,
    true
  );
  return response;
}

/**
 * Create logistics from an approved dispatch
 */
export async function createLogisticsFromDispatch(
  dispatchId: string,
  data: CreateLogisticsFromDispatchRequest
): Promise<{
  status: string;
  message: string;
  data: {
    logistics: any;
    dispatch: OrderDispatch;
  };
}> {
  const response = await apiCall<{
    status: string;
    message: string;
    data: {
      logistics: any;
      dispatch: OrderDispatch;
    };
  }>(`/order-dispatches/${dispatchId}/create-logistics`, "POST", data, true);
  return response;
}

/**
 * Mark dispatch as delivered
 */
export async function markDispatchDelivered(
  dispatchId: string,
  data: MarkDeliveredRequest
): Promise<{ status: string; message: string; data: OrderDispatch }> {
  const response = await apiCall<{ status: string; message: string; data: OrderDispatch }>(
    `/order-dispatches/${dispatchId}/mark-delivered`,
    "POST",
    data,
    true
  );
  return response;
}

/**
 * Delete an order dispatch (draft only)
 */
export async function deleteOrderDispatch(
  dispatchId: string
): Promise<{ status: string; message: string }> {
  const response = await apiCall<{ status: string; message: string }>(
    `/order-dispatches/${dispatchId}`,
    "DELETE",
    undefined,
    true
  );
  return response;
}

// ============================================
// Company Dispatch Settings API Functions
// ============================================

/**
 * Get company dispatch settings
 */
export async function getCompanyDispatchSettings(): Promise<{
  status: string;
  data: CompanyDispatchSettings;
}> {
  const response = await apiCall<{ status: string; data: CompanyDispatchSettings }>(
    "/company/dispatch-settings",
    "GET",
    undefined,
    true
  );
  return response;
}

/**
 * Update company dispatch settings
 */
export async function updateCompanyDispatchSettings(
  data: UpdateCompanyDispatchSettingsRequest
): Promise<{
  status: string;
  message: string;
  data: CompanyDispatchSettings;
}> {
  const response = await apiCall<{
    status: string;
    message: string;
    data: CompanyDispatchSettings;
  }>("/company/dispatch-settings", "PUT", data, true);
  return response;
}

/**
 * Get list of potential approvers (active users)
 */
export async function getPotentialApprovers(): Promise<{
  status: string;
  data: PotentialApprover[];
}> {
  const response = await apiCall<{ status: string; data: PotentialApprover[] }>(
    "/company/dispatch-settings/potential-approvers",
    "GET",
    undefined,
    true
  );
  return response;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get status badge color
 */
export function getDispatchStatusColor(
  status: OrderDispatch['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'pending':
      return 'outline';
    case 'approved':
      return 'default';
    case 'in_transit':
      return 'default';
    case 'delivered':
      return 'default';
    case 'cancelled':
      return 'destructive';
    default:
      return 'default';
  }
}

/**
 * Get approval status badge color
 */
export function getApprovalStatusColor(
  status: OrderDispatch['approval_status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'pending':
      return 'outline';
    case 'in_progress':
      return 'outline';
    case 'approved':
      return 'default';
    case 'rejected':
      return 'destructive';
    default:
      return 'default';
  }
}

/**
 * Format status text for display
 */
export function formatDispatchStatus(status: OrderDispatch['status']): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format approval status text for display
 */
export function formatApprovalStatus(status: OrderDispatch['approval_status']): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Check if user can edit dispatch
 */
export function canEditDispatch(dispatch: OrderDispatch): boolean {
  return dispatch.status === 'draft' && dispatch.approval_status === 'draft';
}

/**
 * Check if user can submit dispatch
 */
export function canSubmitDispatch(dispatch: OrderDispatch): boolean {
  return (
    dispatch.status === 'draft' &&
    dispatch.approval_status === 'draft' &&
    !!dispatch.items &&
    dispatch.items.length > 0 &&
    !!dispatch.approvers &&
    dispatch.approvers.length > 0
  );
}

/**
 * Check if dispatch can be approved/rejected
 */
export function canApproveDispatch(dispatch: OrderDispatch, userId: string): boolean {
  if (dispatch.approval_status !== 'pending' && dispatch.approval_status !== 'in_progress') {
    return false;
  }

  const currentApprover = dispatch.approvers?.find(
    (a) => a.status === 'pending' && a.order === Math.min(...dispatch.approvers!.filter(ap => ap.status === 'pending').map(ap => ap.order))
  );

  return currentApprover?.user_id === userId;
}

/**
 * Check if logistics can be created
 */
export function canCreateLogistics(dispatch: OrderDispatch): boolean {
  return (
    dispatch.status === 'approved' &&
    dispatch.approval_status === 'approved' &&
    !dispatch.logistic
  );
}

/**
 * Check if dispatch can be marked as delivered
 */
export function canMarkDelivered(dispatch: OrderDispatch): boolean {
  return dispatch.status === 'in_transit' && !!dispatch.logistic;
}
