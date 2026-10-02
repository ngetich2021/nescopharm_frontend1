import { ReactNode } from "react";
import apiCall from "./api";
import { type Permission } from "./permissions";
import { type PermissionKey } from "../types/rbac";

// ==================== INTERFACES ====================

// Permissions type for role management
export type Permissions = Record<PermissionKey, boolean>;

// Role Interfaces
export interface Role {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_warehouse_incharge?: boolean;
  created_at: string;
  updated_at: string;
  company_id: string | null;
  company_name?: string;
  is_system_role: boolean;
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
  users?: Array<{
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
  }>;
  permissions?: Array<{
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
    pivot?: {
      role_id: string;
      permission_id: string;
      granted_by: string;
      granted_at: string;
      created_at: string | null;
      updated_at: string;
    };
  }>;
}

export interface RoleDetails extends Role {
  updated_at: string;
  users: Array<{
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
  }>;
}

export interface CreateRolePayload {
  name: string;
  description: string;
  company_id: string;
  permission_ids: string[];
  is_warehouse_incharge?: boolean;
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  is_active?: boolean;
  is_warehouse_incharge?: boolean;
  permissions?: Record<string, boolean>;
}

// ==================== ROLE MANAGEMENT ====================

/**
 * Get all roles
 */
export async function getRoles(): Promise<Role[]> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getRoles must be called client-side");
    }

    const response = await apiCall<{
      status: string;
      message: string;
      roles: Role[];
    }>(
      `/roles`,
      "GET",
      undefined,
      true
    );

    return response.roles || [];
  } catch (error: any) {
    console.error('Error in getRoles:', error);
    throw new Error(`Failed to fetch roles: ${error.message || "Unknown error"}`);
  }
}

/**
 * Create a new role
 */
export async function createRole(payload: CreateRolePayload): Promise<Role> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("createRole must be called client-side");
    }

    const response = await apiCall<{
      status: string;
      message: string;
      role: Role;
    }>(
      `/roles`,
      "POST",
      payload,
      true
    );

    return response.role;
  } catch (error: any) {
    throw new Error(`Failed to create role: ${error.message || "Unknown error"}`);
  }
}

/**
 * Update a role
 */
export async function updateRole(id: string, payload: UpdateRolePayload): Promise<Role> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("updateRole must be called client-side");
    }

    const response = await apiCall<{
      status: string;
      message: string;
      role: Role;
    }>(
      `/roles/${id}`,
      "PUT",
      payload,
      true
    );

    return response.role;
  } catch (error: any) {
    throw new Error(`Failed to update role: ${error.message || "Unknown error"}`);
  }
}

/**
 * Delete a role
 */
export async function deleteRole(id: string): Promise<void> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("deleteRole must be called client-side");
    }

    await apiCall<{
      status: string;
      message: string;
    }>(
      `/roles/${id}`,
      "DELETE",
      undefined,
      true
    );
  } catch (error: any) {
    throw new Error(`Failed to delete role: ${error.message || "Unknown error"}`);
  }
}

/**
 * Assign permissions to a role
 */
export async function assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<Role> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("assignPermissionsToRole must be called client-side");
    }

    const response = await apiCall<{
      status: string;
      message: string;
      role: Role;
    }>(
      `/roles/${roleId}/assign-permissions`,
      "POST",
      { permission_ids: permissionIds },
      true
    );

    return response.role;
  } catch (error: any) {
    throw new Error(`Failed to assign permissions to role: ${error.message || "Unknown error"}`);
  }
}

/**
 * Fetch permissions for a specific role
 */
export async function getRolePermissions(roleId: string): Promise<Permission[]> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("getRolePermissions must be called client-side");
    }

    const response = await apiCall<{
      status: string;
      message: string;
      role: {
        permissions: Permission[];
      };
    }>(
      `/roles/${roleId}/permissions`,
      "GET",
      undefined,
      true
    );

    return response.role.permissions || [];
  } catch (error: any) {
    throw new Error(`Failed to fetch role permissions: ${error.message || "Unknown error"}`);
  }
}