"use server"

import apiCall from "@/lib/api"
import { revalidatePath } from "next/cache"
import type { Permissions, Role, PermissionKey } from "@/types/rbac"
import { 
  getRoles, 
  createRole as createRoleAPI, 
  updateRole as updateRoleAPI, 
  deleteRole as deleteRoleAPI,
  assignPermissionsToRole
} from "@/lib/roles"

// Helper to get current user's company_id
async function getCurrentUserCompanyId() {
  // This uses the regular API client to get the current user's profile
  try {
    const userData = await apiCall<{ company?: { id: string } }>("/user/profile", "GET")
    return userData?.company?.id
  } catch (error) {
    throw new Error("Could not fetch user's company ID.")
  }
}

// --- User Management Actions ---

export async function fetchUsers() {
  const company_id = await getCurrentUserCompanyId()
  
  try {
    const data = await apiCall(`/users?company_id=${company_id}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    throw new Error("Failed to fetch users.")
  }
}

export async function createUser(formData: FormData) {
  const company_id = await getCurrentUserCompanyId()
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const first_name = formData.get("first_name") as string
  const last_name = formData.get("last_name") as string
  const phone = formData.get("phone") as string
  const role_id = formData.get("role_id") as string
  const is_active = formData.get("is_active") === "on"

  if (!email || !password || !first_name || !role_id) {
    throw new Error("Missing required fields for user creation.")
  }

  try {
    const userData = await apiCall("/admin/users", "POST", {
      email,
      password,
      first_name,
      last_name,
      phone,
      role_id,
      is_active,
      company_id,
    })

    revalidatePath("/settings/user-management")
    return { success: true, message: "User created successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create user." }
  }
}

export async function updateUser(userId: string, formData: FormData) {
  const first_name = formData.get("first_name") as string
  const last_name = formData.get("last_name") as string
  const phone = formData.get("phone") as string
  const role_id = formData.get("role_id") as string
  const is_active = formData.get("is_active") === "on"

  if (!first_name || !role_id) {
    throw new Error("Missing required fields for user update.")
  }

  try {
    await apiCall(`/admin/users/${userId}`, "PUT", {
      first_name,
      last_name,
      phone,
      role_id,
      is_active,
    })

    revalidatePath("/settings/user-management")
    return { success: true, message: "User updated successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update user." }
  }
}

export async function deleteUser(userId: string) {
  try {
    await apiCall(`/admin/users/${userId}`, "DELETE")
    revalidatePath("/settings/user-management")
    return { success: true, message: "User deleted successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete user." }
  }
}

// --- User Permission Management Actions ---

export async function assignUserPermissions(userId: string, permissions: PermissionKey[]) {
  try {
    await apiCall(`/admin/users/${userId}/permissions`, "POST", {
      permissions,
    })

    revalidatePath("/settings/user-management")
    return { success: true, message: "User permissions updated successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update user permissions." }
  }
}

// --- Role Management Actions ---

export async function fetchRoles() {
  const company_id = await getCurrentUserCompanyId()
  
  try {
    // Use the new getRoles function from roles.ts
    const allRoles = await getRoles()
    
    // Filter roles by company_id if needed
    if (company_id) {
      return allRoles.filter(role => role.company_id === company_id)
    }
    
    return allRoles
  } catch (error) {
    throw new Error("Failed to fetch roles.")
  }
}

export async function createRole(formData: FormData) {
  const company_id = await getCurrentUserCompanyId()
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const permissionsJson = formData.get("permissions") as string
  
  let permissions: PermissionKey[] = []
  if (permissionsJson) {
    try {
      permissions = JSON.parse(permissionsJson) as PermissionKey[]
    } catch (e) {
      // Handle parse error
    }
  }

  if (!name) {
    throw new Error("Role name is required.")
  }

  try {
    // Use the new createRole function from roles.ts
    await createRoleAPI({
      name,
      description,
      company_id: company_id || '',
      permission_ids: permissions
    })

    revalidatePath("/settings/user-management")
    return { success: true, message: "Role created successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create role." }
  }
}

export async function updateRole(roleId: string, formData: FormData) {
  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const permissionsJson = formData.get("permissions") as string
  
  let permissions: PermissionKey[] = []
  if (permissionsJson) {
    try {
      permissions = JSON.parse(permissionsJson) as PermissionKey[]
    } catch (e) {
      // Handle parse error
    }
  }

  if (!name) {
    throw new Error("Role name is required.")
  }

  try {
    // Use the new updateRole function from roles.ts
    // Convert permissions array to permissions object as expected by UpdateRolePayload
    const permissionsObject: Record<string, boolean> = {}
    permissions.forEach(permission => {
      permissionsObject[permission] = true
    })
    
    await updateRoleAPI(roleId, {
      name,
      description,
      permissions: permissionsObject
    })

    revalidatePath("/settings/user-management")
    return { success: true, message: "Role updated successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update role." }
  }
}

export async function deleteRole(roleId: string) {
  try {
    // Use the new deleteRole function from roles.ts
    await deleteRoleAPI(roleId)
    revalidatePath("/settings/user-management")
    return { success: true, message: "Role deleted successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete role." }
  }
}