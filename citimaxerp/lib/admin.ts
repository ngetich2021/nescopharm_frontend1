import { ReactNode } from "react";
import apiCall from "./api";
import {
  Permission,
  CreatePermissionPayload,
  BulkCreatePermissionsPayload,
  getPermissions,
  createPermission,
  updatePermission,
  deletePermission
} from "./permissions";
import {
  Role,
  CreateRolePayload,
  UpdateRolePayload,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  assignPermissionsToRole
} from "./roles";

// ==================== INTERFACES ====================

// Company Interfaces
export interface Company {
  id: string; // Backend uses UUID strings
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'suspended' | 'inactive'; // Derived from is_active
  subscription_status: 'active' | 'inactive' | 'expired'; // Derived from subscription_status object
  users_count: number;
  created_at: string;
  updated_at: string;
  current_subscription?: {
    id: string;
    plan_name: string;
    status: string;
    expires_at: string;
  };
}

export interface CompanyDetails extends Company {
  users: Array<{
    id: string; // Changed to string for UUID
    name: string;
    email: string;
    role: string;
    status: string;
    last_login: string;
  }>;
  subscription_history: Array<{
    id: string; // Changed to string for UUID
    plan_name: string;
    status: string;
    started_at: string;
    expires_at: string;
    amount: number;
    currency: string;
  }>;
  activity_logs: Array<{
    id: string; // Changed to string for UUID
    action: string;
    description: string;
    performed_by: string;
    created_at: string;
  }>;
}

export interface CreateCompanyPayload {
  name: string;
  email: string;
  phone: string;
  address: string;
  subscription_plan_id?: string; // Changed to string for UUID
}

export interface UpdateCompanyPayload {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: 'active' | 'suspended' | 'inactive';
}

// Subscription Interfaces
export interface SubscriptionPlan {
  id: string; // Changed to string for UUID
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  features: string[];
  max_users: number | null;
  max_storage_gb: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateSubscriptionPlanPayload {
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  features: string[];
  max_users: number | null;
  max_storage_gb: number;
  is_active: boolean;
}

export interface CompanySubscription {
  id: string; // Changed to string for UUID
  plan_name: string;
  status: string;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  payments: Array<{
    id: string; // Changed to string for UUID
    amount: number;
    currency: string;
    status: string;
    payment_method: string;
    transaction_id: string;
    paid_at: string;
  }>;
}

export interface AssignSubscriptionPayload {
  subscription_plan_id: string; // Changed to string for UUID
  start_date: string;
  end_date: string;
  auto_renew: boolean;
}

// User Interfaces
export interface AdminUser {
  name: ReactNode;
  status: string;
  role_name: any;
  id: string;
  company_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string | null;
  is_active: boolean;
  email_verified: boolean;
  last_login_at: string | null;
  role_id: string;
  created_at: string;
  updated_at: string;
  company: {
    id: string;
    name: string;
    description: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;
    website: string | null;
    logo_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    is_first_time: boolean;
    current_subscription_id: string | null;
  };
  role: {
    id: string;
    name: string;
    description: string;
    permissions: Record<string, boolean>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    company_id: string;
  };
}

export interface AdminUserDetails extends AdminUser {
  activity_logs: Array<{
    id: string;
    action: string;
    description: string;
    created_at: string;
  }>;
}

export interface CreateUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone?: string;
  company_id: string;
  role_id: string;
  is_active?: boolean;
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role_id?: string;
  is_active?: boolean;
}

// Role Interfaces - imported from roles.ts


// Permission Interfaces - imported from permissions.ts


// Activity Log Interfaces
export interface ActivityLog {
  id: string; // Changed to string for UUID
  user_id: string; // Changed to string for UUID
  user_name: string;
  company_id: string; // Changed to string for UUID
  company_name: string;
  action: string;
  description: string;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, any>;
  created_at: string;
}

// API Response Interfaces
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from?: number;
    to?: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// Filter Interfaces
export interface CompanyFilters {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  plan?: string;
  created_from?: string;
  created_to?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface UserFilters {
  page?: number;
  per_page?: number;
  search?: string;
  company_id?: string;
  role_id?: string;
  status?: 'active' | 'inactive' | 'suspended' | '';
  is_active?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ActivityLogFilters {
  page?: number;
  per_page?: number;
  user_id?: string; // Changed to string for UUID
  company_id?: string; // Changed to string for UUID
  action?: string;
  date_from?: string;
  date_to?: string;
}

// ==================== COMPANY MANAGEMENT ====================

/**
 * Get all companies with optional filters
 */
export async function getCompanies(filters: CompanyFilters = {}): Promise<PaginatedResponse<Company>> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getCompanies must be called client-side");
    }

    const queryParams = new URLSearchParams();
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.per_page) queryParams.append('per_page', filters.per_page.toString());
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.sort_by) queryParams.append('sort_by', filters.sort_by);
    if (filters.sort_order) queryParams.append('sort_order', filters.sort_order);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await apiCall<{
      status: string;
      message: string;
      data: {
        current_page: number;
        data: any[];
        first_page_url: string;
        from: number;
        last_page: number;
        last_page_url: string;
        next_page_url: string | null;
        path: string;
        per_page: number;
        prev_page_url: string | null;
        to: number;
        total: number;
      }
    }>(
      `/admin/companies${queryString}`,
      "GET",
      undefined,
      true
    );

    // Transform the backend response to match our expected format
    const transformedCompanies: Company[] = response.data.data.map((company: any) => ({
      id: company.id || '', // Keep as string UUID
      name: company.name || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      status: company.is_active ? 'active' : 'inactive', // Map is_active to status
      subscription_status: company.subscription_status?.status === 'no_subscription' ? 'inactive' : 
                          company.subscription_status?.is_expired ? 'expired' : 'active',
      users_count: company.users_count || 0,
      created_at: company.created_at || '',
      updated_at: company.updated_at || '',
      current_subscription: company.current_subscription ? {
        id: company.current_subscription.id || '',
        plan_name: company.current_subscription.plan_name || '',
        status: company.current_subscription.status || '',
        expires_at: company.current_subscription.expires_at || ''
      } : undefined
    }));

    return {
      success: true,
      data: transformedCompanies,
      pagination: {
        current_page: response.data.current_page,
        per_page: response.data.per_page,
        total: response.data.total,
        last_page: response.data.last_page,
        from: response.data.from,
        to: response.data.to
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch companies: ${error.message || "Unknown error"}`);
  }
}

/**
 * Get company details by ID
 */
export async function getCompanyById(id: string): Promise<CompanyDetails> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getCompanyById must be called client-side");
    }

    const response = await apiCall<ApiResponse<{ company: CompanyDetails }>>(
      `/admin/companies/${id}`,
      "GET",
      undefined,
      true
    );

    return response.data.company;
  } catch (error: any) {
    throw new Error(`Failed to fetch company details: ${error.message || "Unknown error"}`);
  }
}

/**
 * Create a new company
 */
export async function createCompany(payload: CreateCompanyPayload): Promise<Company> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("createCompany must be called client-side");
    }

    const response = await apiCall<ApiResponse<{ company: Company }>>(
      `/admin/companies`,
      "POST",
      payload,
      true
    );

    return response.data.company;
  } catch (error: any) {
    throw new Error(`Failed to create company: ${error.message || "Unknown error"}`);
  }
}

/**
 * Update a company
 */
export async function updateCompany(id: string, payload: UpdateCompanyPayload): Promise<Company> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("updateCompany must be called client-side");
    }

    const response = await apiCall<ApiResponse<{ company: Company }>>(
      `/admin/companies/${id}`,
      "PUT",
      payload,
      true
    );

    return response.data.company;
  } catch (error: any) {
    throw new Error(`Failed to update company: ${error.message || "Unknown error"}`);
  }
}

/**
 * Delete a company
 */
export async function deleteCompany(id: string): Promise<void> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("deleteCompany must be called client-side");
    }

    await apiCall<ApiResponse<void>>(
      `/admin/companies/${id}`,
      "DELETE",
      undefined,
      true
    );
  } catch (error: any) {
    throw new Error(`Failed to delete company: ${error.message || "Unknown error"}`);
  }
}

/**
 * Toggle company status (suspend/activate)
 */
export async function toggleCompanyStatus(
  id: string, 
  is_active: boolean, 
  reason?: string
): Promise<Company> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("toggleCompanyStatus must be called client-side");
    }

    const payload = { is_active, ...(reason && { reason }) };

    // Backend uses PATCH method for status updates
    const response = await apiCall<Company>(
      `/admin/companies/${id}/status`,
      "PATCH",
      payload,
      true
    );

    return response;
  } catch (error: any) {
    throw new Error(`Failed to toggle company status: ${error.message || "Unknown error"}`);
  }
}

// ==================== SUBSCRIPTION MANAGEMENT ====================

/**
 * Get all subscription plans
 */
export async function getSubscriptionPlans(includeInactive: boolean = false): Promise<SubscriptionPlan[]> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getSubscriptionPlans must be called client-side");
    }

    // Note: Backend endpoint is /subscription-plans, not /admin/subscription-plans
    const response = await apiCall<ApiResponse<{ subscription_plans: SubscriptionPlan[] }>>(
      `/subscription-plans`,
      "GET",
      undefined,
      true
    );

    // Extract plans from response structure
    const plans = response?.data?.subscription_plans || [];

    // Filter on client side if needed since backend might not support include_inactive
    if (!includeInactive && Array.isArray(plans)) {
      return plans.filter(plan => plan.is_active);
    }

    return Array.isArray(plans) ? plans : [];
  } catch (error: any) {
    console.error('Error in getSubscriptionPlans:', error);
    throw new Error(`Failed to fetch subscription plans: ${error.message || "Unknown error"}`);
  }
}

/**
 * Create a new subscription plan
 */
export async function createSubscriptionPlan(payload: CreateSubscriptionPlanPayload): Promise<SubscriptionPlan> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("createSubscriptionPlan must be called client-side");
    }

    const response = await apiCall<SubscriptionPlan>(
      `/subscription-plans`,
      "POST",
      payload,
      true
    );

    return response;
  } catch (error: any) {
    throw new Error(`Failed to create subscription plan: ${error.message || "Unknown error"}`);
  }
}

/**
 * Update a subscription plan
 */
export async function updateSubscriptionPlan(id: string, payload: Partial<CreateSubscriptionPlanPayload>): Promise<SubscriptionPlan> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("updateSubscriptionPlan must be called client-side");
    }

    const response = await apiCall<SubscriptionPlan>(
      `/subscription-plans/${id}`,
      "PUT",
      payload,
      true
    );

    return response;
  } catch (error: any) {
    throw new Error(`Failed to update subscription plan: ${error.message || "Unknown error"}`);
  }
}

/**
 * Get company subscriptions
 */
export async function getCompanySubscriptions(companyId: string): Promise<CompanySubscription[]> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getCompanySubscriptions must be called client-side");
    }

    const response = await apiCall<ApiResponse<{ subscriptions: CompanySubscription[] }>>(
      `/admin/companies/${companyId}/subscriptions`,
      "GET",
      undefined,
      true
    );

    return response.data.subscriptions;
  } catch (error: any) {
    throw new Error(`Failed to fetch company subscriptions: ${error.message || "Unknown error"}`);
  }
}

/**
 * Assign/Manage subscription to company
 */
export async function assignSubscriptionToCompany(companyId: string, payload: AssignSubscriptionPayload): Promise<CompanySubscription> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("assignSubscriptionToCompany must be called client-side");
    }

    const response = await apiCall<ApiResponse<{ subscription: CompanySubscription }>>(
      `/admin/companies/${companyId}/subscription`,
      "POST",
      payload,
      true
    );

    return response.data.subscription;
  } catch (error: any) {
    throw new Error(`Failed to assign subscription: ${error.message || "Unknown error"}`);
  }
}

// ==================== USER MANAGEMENT ====================

/**
 * Get all users with optional filters
 */
export async function getAdminUsers(filters: UserFilters = {}): Promise<PaginatedResponse<AdminUser>> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getAdminUsers must be called client-side");
    }

    const queryParams = new URLSearchParams();
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.per_page) queryParams.append('per_page', filters.per_page.toString());
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.company_id) queryParams.append('company_id', filters.company_id.toString());
    if (filters.role_id) queryParams.append('role_id', filters.role_id.toString());
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.is_active !== undefined) queryParams.append('is_active', filters.is_active.toString());

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    // Using /admin/users endpoint as per backend
    const response = await apiCall<ApiResponse<{
      current_page: number;
      data: AdminUser[];
      first_page_url: string;
      from: number;
      last_page: number;
      last_page_url: string;
      links: Array<{ url: string | null; label: string; active: boolean }>;
      next_page_url: string | null;
      path: string;
      per_page: number;
      prev_page_url: string | null;
      to: number;
      total: number;
    }>>(
      `/admin/users${queryString}`,
      "GET",
      undefined,
      true
    );

    // Transform the response to match our expected structure
    const paginationData = response.data;
    
    return {
      success: true,
      data: paginationData.data || [],
      pagination: {
        current_page: paginationData.current_page || 1,
        per_page: paginationData.per_page || 10,
        total: paginationData.total || 0,
        last_page: paginationData.last_page || 1
      }
    };
  } catch (error: any) {
    console.error('Error in getAdminUsers:', error);
    throw new Error(`Failed to fetch users: ${error.message || "Unknown error"}`);
  }
}

// ==================== ROLE MANAGEMENT ====================
// Role management functions are now imported from roles.ts


// ==================== PERMISSION MANAGEMENT ====================
// Permission management functions are now imported from permissions.ts

// ==================== ACTIVITY LOGS ====================

/**
 * Get activity logs with optional filters
 */
export async function getActivityLogs(filters: ActivityLogFilters = {}): Promise<PaginatedResponse<ActivityLog>> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getActivityLogs must be called client-side");
    }

    const queryParams = new URLSearchParams();
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.per_page) queryParams.append('per_page', filters.per_page.toString());
    if (filters.user_id) queryParams.append('user_id', filters.user_id);
    if (filters.company_id) queryParams.append('company_id', filters.company_id);
    if (filters.action) queryParams.append('action', filters.action);
    if (filters.date_from) queryParams.append('date_from', filters.date_from);
    if (filters.date_to) queryParams.append('date_to', filters.date_to);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await apiCall<ApiResponse<{
      current_page: number;
      data: ActivityLog[];
      first_page_url: string;
      from: number;
      last_page: number;
      last_page_url: string;
      links: Array<{ url: string | null; label: string; active: boolean }>;
      next_page_url: string | null;
      path: string;
      per_page: number;
      prev_page_url: string | null;
      to: number;
      total: number;
    }>>(
      `/admin/activity-logs${queryString}`,
      "GET",
      undefined,
      true
    );

    // Transform the response to match our expected structure
    const paginationData = response.data;
    
    return {
      success: true,
      data: paginationData.data || [],
      pagination: {
        current_page: paginationData.current_page || 1,
        per_page: paginationData.per_page || 10,
        total: paginationData.total || 0,
        last_page: paginationData.last_page || 1,
        from: paginationData.from || 0,
        to: paginationData.to || 0
      }
    };
  } catch (error: any) {
    console.error('Error in getActivityLogs:', error);
    throw new Error(`Failed to fetch activity logs: ${error.message || "Unknown error"}`);
  }
}