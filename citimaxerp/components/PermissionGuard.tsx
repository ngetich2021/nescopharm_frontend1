"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ShieldAlert } from "lucide-react";
import { ReactNode } from "react";

interface PermissionGuardProps {
  /**
   * The permission key(s) required to view the children
   */
  permissions: string | string[];
  
  /**
   * Whether the user needs all permissions (true) or any permission (false)
   * @default false
   */
  requireAll?: boolean;
  
  /**
   * Children to render if permission is granted
   */
  children: ReactNode;
  
  /**
   * Fallback component to render if permission is denied
   */
  fallback?: ReactNode;
  
  /**
   * Loading component to render while checking permissions
   */
  loading?: ReactNode;
  
  /**
   * If true, renders nothing instead of fallback when permission is denied
   * Useful for conditional UI elements like buttons
   * @default false
   */
  hideOnDenied?: boolean;
}

/**
 * PermissionGuard Component
 * 
 * A component that conditionally renders its children based on user permissions.
 * 
 * @example
 * ```tsx
 * <PermissionGuard permissions="can_view_customers">
 *   <CustomerList />
 * </PermissionGuard>
 * ```
 * 
 * @example
 * ```tsx
 * <PermissionGuard 
 *   permissions={["can_create_users", "can_manage_roles"]} 
 *   requireAll={true}
 * >
 *   <UserManagement />
 * </PermissionGuard>
 * ```
 * 
 * @example
 * ```tsx
 * // Hide button if no permission (instead of showing "Access Denied")
 * <PermissionGuard permissions="can_delete_users" hideOnDenied>
 *   <Button>Delete User</Button>
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  permissions,
  requireAll = false,
  children,
  fallback,
  loading,
  hideOnDenied = false
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();
  const { isLoading } = useAuth();
  
  // Show loading state while auth is initializing
  if (isLoading) {
    return loading || (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // If permissions is a string, convert to array
  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
  
  // Check if user has required permissions
  let hasRequiredPermissions = false;
  
  if (requireAll) {
    hasRequiredPermissions = hasAllPermissions(permissionArray);
  } else {
    hasRequiredPermissions = hasAnyPermission(permissionArray);
  }
  
  // Render children if user has required permissions
  if (hasRequiredPermissions) {
    return <>{children}</>;
  }
  
  // If hideOnDenied is true, render nothing
  if (hideOnDenied) {
    return null;
  }
  
  // Render custom fallback or default "Access Denied" message
  return <>{fallback || (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <ShieldAlert className="h-12 w-12 text-gray-400" />
      <h2 className="text-2xl font-bold text-gray-700">Access Denied</h2>
      <p className="text-gray-500 text-center max-w-md">
        You do not have permission to view this content.<br />
        Please contact your administrator to request access.
      </p>
    </div>
  )}</>;
}