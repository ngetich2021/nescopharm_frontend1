import apiCall from "./api"

// ==================== INTERFACES ====================

export interface UserData {
  id: string
  company_id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  email_verified: boolean
  last_login_at: string | null
  role_id: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  terminated_at?: string | null
  termination_reason?: string | null
  terminated_by?: string | null
  password_setup_token: string | null
  password_setup_token_expires_at: string | null
  company: {
    id: string
    name: string
    description: string | null
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    postal_code: string | null
    website: string | null
    logo_url: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    is_first_time: boolean
    current_subscription_id: string | null
  }
  role: {
    id: string
    name: string
    description: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    company_id: string
  } | null
}

export interface Role {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  company_id: string | null
}

// ==================== USER MANAGEMENT ====================

export interface FetchUsersFilters {
  role_scope?: "warehouse_incharge" | string
  is_active?: boolean
  email?: string
  first_name?: string
  last_name?: string
  company_id?: string
  include_deleted?: boolean
  only_deleted?: boolean
}

/**
 * Fetch all users, optionally filtered by query params (e.g. role_scope to
 * restrict to users whose role is flagged for a particular purpose, such as
 * "warehouse_incharge").
 */
export async function fetchUsers(filters: FetchUsersFilters = {}): Promise<UserData[]> {
  try {
    const queryParams = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, String(value))
      }
    })
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ""
    const response: any = await apiCall<any>(`/users${queryString}`, "GET")
    return response.users || []
  } catch (error: any) {
    throw new Error(`Failed to fetch users: ${error.message || "Unknown error"}`)
  }
}

/**
 * Get all users (alias for fetchUsers), optionally filtered by query params.
 */
export async function getUsers(filters: FetchUsersFilters = {}): Promise<UserData[]> {
  return fetchUsers(filters);
}

/**
 * Create a new user
 */
export async function createUser(userData: any): Promise<UserData> {
  try {
    const response = await apiCall<UserData>(
      `/users`,
      "POST",
      userData,
      true
    )
    return response
  } catch (error: any) {
    throw new Error(`Failed to create user: ${error.message || "Unknown error"}`)
  }
}

/**
 * Update an existing user
 */
export async function updateUser(userId: string, userData: any): Promise<UserData> {
  try {
    const response = await apiCall<UserData>(
      `/users/${userId}`,
      "PUT",
      userData,
      true
    )
    return response
  } catch (error: any) {
    throw new Error(`Failed to update user: ${error.message || "Unknown error"}`)
  }
}

/**
 * Delete a user (soft-delete by default, ?hard=true for permanent)
 */
export async function deleteUser(userId: string, hard: boolean = false): Promise<void> {
  try {
    const suffix = hard ? "?hard=true" : ""
    await apiCall<void>(`/users/${userId}${suffix}`, "DELETE", undefined, true)
  } catch (error: any) {
    throw new Error(`Failed to delete user: ${error.message || "Unknown error"}`)
  }
}

/**
 * Soft-delete user explicitly
 */
export async function softDeleteUser(userId: string): Promise<void> {
  try {
    await apiCall<void>(`/users/${userId}/soft-delete`, "POST", {}, true)
  } catch (error: any) {
    throw new Error(`Failed to soft delete user: ${error.message || "Unknown error"}`)
  }
}

/**
 * Terminate user account with optional reason
 */
export async function terminateUser(userId: string, reason?: string): Promise<void> {
  try {
    await apiCall<void>(`/users/${userId}/terminate`, "POST", { reason }, true)
  } catch (error: any) {
    throw new Error(`Failed to terminate user: ${error.message || "Unknown error"}`)
  }
}

/**
 * Restore soft-deleted / terminated user
 */
export async function restoreUser(userId: string): Promise<void> {
  try {
    await apiCall<void>(`/users/${userId}/restore`, "POST", {}, true)
  } catch (error: any) {
    throw new Error(`Failed to restore user: ${error.message || "Unknown error"}`)
  }
}

/**
 * Update user with role and permissions support
 */
export async function updateUserWithRole(
  userId: string,
  data: {
    first_name?: string
    last_name?: string
    phone?: string
    email?: string
    avatar_url?: string
    is_active?: boolean
    email_verified?: boolean
    role_id?: string | null
    permission_ids?: string[]
  }
): Promise<UserData> {
  return updateUser(userId, data)
}

/**
 * Assign a role to a user
 */
export async function assignRoleToUser(userId: string, roleId: string): Promise<UserData> {
  try {
    const response = await apiCall<UserData>(
      `/users/${userId}/assign-role`,
      "POST",
      { role_id: roleId },
      true
    )
    return response
  } catch (error: any) {
    throw new Error(`Failed to assign role to user: ${error.message || "Unknown error"}`)
  }
}