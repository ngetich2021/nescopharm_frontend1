import { useAuth } from "@/lib/auth-context";

/**
 * Custom hook for checking user permissions
 * Provides a simple interface for permission checks in components
 */
export function usePermissions() {
  const { userProfile, hasPermission } = useAuth();

  /**
   * Check if the current user has a specific permission
   * @param permissionKey The permission key to check
   * @returns boolean indicating if the user has the permission
   */
  const hasPerm = (permissionKey: string): boolean => {
    return hasPermission(permissionKey);
  };

  /**
   * Check if the current user has any of the specified permissions
   * @param permissionKeys Array of permission keys to check
   * @returns boolean indicating if the user has any of the permissions
   */
  const hasAnyPermission = (permissionKeys: string[]): boolean => {
    return permissionKeys.some(key => hasPerm(key));
  };

  /**
   * Check if the current user has all of the specified permissions
   * @param permissionKeys Array of permission keys to check
   * @returns boolean indicating if the user has all of the permissions
   */
  const hasAllPermissions = (permissionKeys: string[]): boolean => {
    return permissionKeys.every(key => hasPerm(key));
  };

  /**
   * Check if user has system management capability
   */
  const isSystemAdmin = (): boolean => {
    return hasPerm('can_manage_system');
  };

  /**
   * Check if user has company management capability
   */
  const isCompanyAdmin = (): boolean => {
    return hasPerm('can_manage_company');
  };

  /**
   * Check if user has admin access (either system or company admin)
   */
  const isAdmin = (): boolean => {
    return isSystemAdmin() || isCompanyAdmin();
  };

  return {
    hasPermission: hasPerm,
    hasAnyPermission,
    hasAllPermissions,
    isSystemAdmin,
    isCompanyAdmin,
    isAdmin,
    userProfile
  };
}