import { ReactNode } from "react";
import apiCall from "./api";

// ==================== INTERFACES ====================

// Permission Interfaces
export interface Permission {
  id: string;
  name: string;
  key: string;
  description: string;
  category: string;
  company_id: string | null;
  is_system: boolean;
  is_active: boolean;
  created_by: string;
  metadata: any[];
  created_at: string;
  updated_at: string;
  company?: {
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
  } | null;
  creator?: {
    id: string;
    company_id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    avatar_url: string | null;
    is_active: boolean;
    email_verified: boolean;
    last_login_at: string;
    role_id: string;
    created_at: string;
    updated_at: string;
    password_setup_token: string | null;
    password_setup_token_expires_at: string | null;
  } | null;
  is_system_permission?: boolean; // Computed field
}

export interface CreatePermissionPayload {
  name: string;
  key: string;
  description: string;
  category: string;
  company_id?: string;
  is_system?: boolean;
  is_active?: boolean;
}

export interface BulkCreatePermissionsPayload {
  permissions: Array<{
    name: string;
    key: string;
    description: string;
    category: string;
  }>;
  company_id?: string;
  is_system?: boolean;
}

// ==================== PERMISSION MANAGEMENT ====================

/**
 * Get all permissions with optional filters
 */
export async function getPermissions(category?: string, search?: string): Promise<{ permissions: Permission[]; categories: string[] }> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getPermissions must be called client-side");
    }

    // Build query params if needed
    const queryParams = new URLSearchParams();
    if (category) queryParams.append('category', category);
    if (search) queryParams.append('search', search);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    // Use user-level endpoint
    const response = await apiCall<{
      status: string;
      message: string;
      permissions: Record<string, Permission[]> | Permission[]; // Updated to handle both object and array formats
      categories: string[];
    }>(
      `/permissions${queryString}`,
      "GET",
      undefined,
      true
    );

    let permissionsArray: Permission[] = [];
    let categoriesArray: string[] = [];

    // Handle the case where permissions is an object grouped by categories
    if (response.permissions && !Array.isArray(response.permissions)) {
      // Flatten the permissions object into a single array
      permissionsArray = Object.values(response.permissions).flat().map(p => ({
        ...p,
        is_system_permission: p.is_system ?? false
      }));
      // Extract categories from the keys of the permissions object
      categoriesArray = Object.keys(response.permissions);
    } else if (Array.isArray(response.permissions)) {
      // Handle the case where permissions is already a flat array
      permissionsArray = response.permissions.map(p => ({
        ...p,
        is_system_permission: p.is_system ?? false
      }));
      categoriesArray = Array.isArray(response.categories) ? response.categories : [];
    }

    console.log('Permissions API response:', { permissions: permissionsArray, categories: categoriesArray });
    
    // Return the permissions and categories
    return {
      permissions: permissionsArray,
      categories: categoriesArray
    };
  } catch (error: any) {
    console.error('Error in getPermissions:', error);
    // Return empty arrays on error to prevent app crashes
    return {
      permissions: [],
      categories: []
    };
  }
}

/**
 * Create a new permission
 */
export async function createPermission(payload: CreatePermissionPayload): Promise<Permission> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("createPermission must be called client-side");
    }

    const response = await apiCall<{
      status: string;
      message: string;
      permission: Permission;
    }>(
      `/permissions`,
      "POST",
      payload,
      true
    );

    // Transform the response to match our expected structure
    return {
      ...response.permission,
      is_system_permission: response.permission.is_system ?? false
    };
  } catch (error: any) {
    throw new Error(`Failed to create permission: ${error.message || "Unknown error"}`);
  }
}

/**
 * Update a permission
 */
export async function updatePermission(id: string, payload: Partial<CreatePermissionPayload>): Promise<Permission> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("updatePermission must be called client-side");
    }

    const response = await apiCall<{
      status: string;
      message: string;
      permission: Permission;
    }>(
      `/permissions/${id}`,
      "PUT",
      payload,
      true
    );

    // Transform the response to match our expected structure
    return {
      ...response.permission,
      is_system_permission: response.permission.is_system ?? false
    };
  } catch (error: any) {
    throw new Error(`Failed to update permission: ${error.message || "Unknown error"}`);
  }
}

/**
 * Delete a permission
 */
export async function deletePermission(id: string): Promise<void> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("deletePermission must be called client-side");
    }

    await apiCall<{
      status: string;
      message: string;
    }>(
      `/permissions/${id}`,
      "DELETE",
      undefined,
      true
    );
  } catch (error: any) {
    throw new Error(`Failed to delete permission: ${error.message || "Unknown error"}`);
  }
}

/**
 * Get permission details by ID
 */
export async function getPermissionById(id: string): Promise<Permission> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getPermissionById must be called client-side");
    }

    const response = await apiCall<{
      status: string;
      message: string;
      permission: Permission;
    }>(
      `/permissions/${id}`,
      "GET",
      undefined,
      true
    );

    return {
      ...response.permission,
      is_system_permission: response.permission.is_system ?? false
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch permission details: ${error.message || "Unknown error"}`);
  }
}

/**
 * Bulk create permissions
 */
export async function bulkCreatePermissions(payload: BulkCreatePermissionsPayload): Promise<{ count: number }> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("bulkCreatePermissions must be called client-side");
    }

    const response = await apiCall<{
      status: string;
      message: string;
      count: number;
    }>(
      `/permissions/bulk`,
      "POST",
      payload,
      true
    );

    return { count: response.count || 0 };
  } catch (error: any) {
    throw new Error(`Failed to bulk create permissions: ${error.message || "Unknown error"}`);
  }
}

/**
 * Assign permissions to a user
 */
export async function assignPermissionsToUser(userId: string, permissionIds: string[]): Promise<void> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("assignPermissionsToUser must be called client-side");
    }

    await apiCall<{
      status: string;
      message: string;
    }>(
      `/users/${userId}/permissions`,
      "POST",
      { permission_ids: permissionIds },
      true
    );
  } catch (error: any) {
    throw new Error(`Failed to assign permissions to user: ${error.message || "Unknown error"}`);
  }
}

// ==================== ROLE MANAGEMENT ====================
// Role management functions have been moved to roles.ts
