"use client";

import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/use-permissions";

export function DebugPermissions() {
  const { userProfile } = useAuth();
  const { hasPermission, isSystemAdmin, isCompanyAdmin } = usePermissions();

  if (!userProfile) {
    return <div>No user profile loaded</div>;
  }

  const permissions = userProfile.role?.permissions || [];
  const hasCanManageSystem = hasPermission('can_manage_system');
  const hasCanViewCustomersMenu = hasPermission('can_view_customers_menu');

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="font-bold mb-2">Debug: User Permissions</h3>
      <div className="space-y-2 text-sm">
        <div><strong>User:</strong> {userProfile.first_name} {userProfile.last_name}</div>
        <div><strong>Role:</strong> {userProfile.role?.name || 'No role'}</div>
        <div><strong>Is System Admin:</strong> {isSystemAdmin() ? 'Yes' : 'No'}</div>
        <div><strong>Is Company Admin:</strong> {isCompanyAdmin() ? 'Yes' : 'No'}</div>
        <div><strong>Has can_manage_system:</strong> {hasCanManageSystem ? 'Yes' : 'No'}</div>
        <div><strong>Has can_view_customers_menu:</strong> {hasCanViewCustomersMenu ? 'Yes' : 'No'}</div>
        <div><strong>Total permissions:</strong> {permissions.length}</div>
        
        <details>
          <summary className="cursor-pointer font-medium">All Permissions ({permissions.length})</summary>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {permissions.map((perm, index) => (
              <li key={index} className="text-xs">
                {perm.key} - {perm.name}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}