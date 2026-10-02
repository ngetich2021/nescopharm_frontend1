"use client";

import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/use-permissions";

export default function DebugPage() {
  const { userProfile, isLoading } = useAuth();
  const { hasPermission, isSystemAdmin, isCompanyAdmin } = usePermissions();

  if (isLoading) {
    return <div className="p-8">Loading user data...</div>;
  }

  if (!userProfile) {
    return <div className="p-8">No user profile loaded</div>;
  }

  const permissions = userProfile.role?.permissions || [];
  const hasCanManageSystem = hasPermission('can_manage_system');
  const hasCanViewCustomersMenu = hasPermission('can_view_customers_menu');

  // Log to console for debugging
  console.log('=== PERMISSION DEBUG ===');
  console.log('User Profile:', userProfile);
  console.log('Role:', userProfile.role);
  console.log('Permissions:', permissions);
  console.log('Has can_manage_system:', hasCanManageSystem);
  console.log('Has can_view_customers_menu:', hasCanViewCustomersMenu);
  console.log('Is System Admin:', isSystemAdmin());
  console.log('========================');

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug User Permissions</h1>
      <div className="p-4 bg-gray-100 rounded-lg">
        <h3 className="font-bold mb-2">User Information</h3>
        <div className="space-y-2 text-sm">
          <div><strong>User:</strong> {userProfile.first_name} {userProfile.last_name}</div>
          <div><strong>Email:</strong> {userProfile.email}</div>
          <div><strong>Role:</strong> {userProfile.role?.name || 'No role'}</div>
          <div><strong>Role ID:</strong> {userProfile.role?.id || 'No role ID'}</div>
          <div><strong>Company:</strong> {userProfile.company?.name || 'No company'}</div>
          
          <div className="mt-4">
            <strong>Permission Checks:</strong>
          </div>
          <div><strong>Is System Admin:</strong> {isSystemAdmin() ? 'Yes' : 'No'}</div>
          <div><strong>Is Company Admin:</strong> {isCompanyAdmin() ? 'Yes' : 'No'}</div>
          <div><strong>Has can_manage_system:</strong> {hasCanManageSystem ? 'Yes' : 'No'}</div>
          <div><strong>Has can_view_customers_menu:</strong> {hasCanViewCustomersMenu ? 'Yes' : 'No'}</div>
          <div><strong>Total permissions:</strong> {permissions.length}</div>
          
          <div className="mt-4">
            <strong>All Permissions:</strong>
            <div className="mt-2 max-h-40 overflow-y-auto bg-white p-2 rounded text-xs">
              {permissions.length === 0 ? (
                <div className="text-red-500">No permissions found!</div>
              ) : (
                permissions.map((perm, index) => (
                  <div key={index} className="mb-1">
                    <span className="font-mono">{perm.key}</span> - {perm.name}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4">
            <strong>Raw Role Object:</strong>
            <pre className="mt-2 bg-white p-2 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(userProfile.role, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}