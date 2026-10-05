import { PERMISSIONS_MAP, PERMISSION_KEYS } from "./permissions-map";

// Define the Permission type based on the new API response
interface Permission {
  id: string;
  name: string;
  key: string;
  description: string;
  category: string;
  company_id: string;
  is_system: boolean;
  is_active: boolean;
  created_by: string;
  metadata: any[];
  created_at: string;
  updated_at: string;
  pivot: {
    role_id: string;
    permission_id: string;
    granted_by: string;
    granted_at: string;
    created_at: string;
    updated_at: string;
  };
}

// Support for both old API type and new API user type
type UserProfile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  email_verified: boolean;
  company?: {
    id: string;
    name: string;
  };
  role?: {
    id: string;
    name: string;
    permissions?: Permission[];
  } | null;
} | null;

type ApiUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  email_verified: boolean;
  company?: {
    id: string;
    name: string;
  };
  role?: {
    id: string;
    name: string;
    permissions?: Permission[];
  } | null;
} | null;

export function hasPermission(userProfile: UserProfile | ApiUser, permission: string): boolean {
  if (!userProfile || !userProfile.role) return false;
  
  // Check if user has system management capability
  // This grants access to all operations across all companies
  const hasSystemManagement = userProfile.role.permissions?.some(
    p => p.key === 'can_manage_system'
  ) || false;
  
  // Check if user has company management capability
  // This grants access to all operations within their company
  const hasCompanyManagement = userProfile.role.permissions?.some(
    p => p.key === 'can_manage_company'
  ) || false;
  
  // If user has system management capability, they have access to everything
  if (hasSystemManagement) {
    return true;
  }
  
  // If user has company management capability, they have access to all 
  // company-related operations within their company
  if (hasCompanyManagement) {
    return true;
  }
  
  // Special case: System admins and users with company management access 
  // should also have access to admin portal
  if (permission === 'can_access_admin_portal') {
    const hasCompanyManagementAccess = userProfile.role.permissions?.some(
      p => p.key === 'can_manage_companies'
    ) || false;
    if (hasSystemManagement || hasCompanyManagementAccess) {
      return true;
    }
  }
  
  // Check if the user's role has the specific permission by checking the key
  return userProfile.role.permissions?.some((perm) => perm.key === permission) || false;
}

// For permissions that admin rights must not imply, e.g. purchase order approval (GM/Director only).
export function hasExplicitPermission(userProfile: UserProfile | ApiUser | null | undefined, permission: string): boolean {
  return userProfile?.role?.permissions?.some((perm) => perm.key === permission) || false;
}

export function hasRole(userProfile: UserProfile | ApiUser, role: string): boolean {
  if (!userProfile) return false;
  
  // Check if the user has the specified role
  const apiUser = userProfile as ApiUser;
  return apiUser?.role?.name === role;
}

export function isSuperAdmin(userProfile: UserProfile | ApiUser): boolean {
  if (!userProfile) return false;
  
  const apiUser = userProfile as ApiUser;
  return apiUser?.role?.name === 'super_admin';
}

export function isAdmin(userProfile: UserProfile | ApiUser): boolean {
  if (!userProfile) return false;
  
  const apiUser = userProfile as ApiUser;
  const roleName = apiUser?.role?.name;
  return roleName === 'admin' || roleName === 'super_admin';
}

// Define all possible permissions for UI display and management based on our permissions map
export const ALL_PERMISSIONS: string[] = PERMISSION_KEYS;

// Define permission groups for better UI organization based on our permissions map
export const PERMISSION_GROUPS: { title: string; permissions: string[] }[] = 
  Object.entries(
    PERMISSIONS_MAP.reduce((acc: Record<string, string[]>, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm.key);
      return acc;
    }, {})
  ).map(([category, permissions]) => ({
    title: category,
    permissions
  }));

// Function to fetch permissions dynamically from the backend
// This would be replaced with an actual API call to fetch permissions
export async function fetchPermissions(): Promise<{ groups: typeof PERMISSION_GROUPS; allPermissions: string[] }> {
  try {
    // For now, we'll return the predefined structure
    // In a real implementation, this would fetch from a user-level endpoint
    return {
      groups: PERMISSION_GROUPS,
      allPermissions: ALL_PERMISSIONS
    };
  } catch (error) {
    console.error('Failed to fetch permissions:', error);
    // Return predefined structure on error
    return {
      groups: PERMISSION_GROUPS,
      allPermissions: ALL_PERMISSIONS
    };
  }
}