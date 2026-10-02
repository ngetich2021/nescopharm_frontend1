"use client";

import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useEffect, useState } from "react";

export default function SimpleDebugPage() {
  const { userProfile, isLoading } = useAuth();
  const { hasPermission, isSystemAdmin, isCompanyAdmin } = usePermissions();
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && userProfile) {
      const info = {
        user: {
          name: `${userProfile.first_name} ${userProfile.last_name}`,
          email: userProfile.email,
          role: userProfile.role?.name || 'No role',
          roleId: userProfile.role?.id || 'No role ID'
        },
        company: {
          name: userProfile.company?.name || 'No company',
          isFirstTime: userProfile.company?.is_first_time,
          isActive: userProfile.company?.is_active
        },
        permissions: {
          total: userProfile.role?.permissions?.length || 0,
          hasCanManageSystem: hasPermission('can_manage_system'),
          hasCanViewCustomersMenu: hasPermission('can_view_customers_menu'),
          hasCanManageCompany: hasPermission('can_manage_company'),
          isSystemAdmin: isSystemAdmin(),
          isCompanyAdmin: isCompanyAdmin()
        },
        allPermissions: userProfile.role?.permissions?.map(p => p.key) || []
      };
      setDebugInfo(info);
    }
  }, [userProfile, isLoading, hasPermission, isSystemAdmin, isCompanyAdmin]);

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">❌ No User Profile</h1>
        <p>User is not logged in or profile failed to load.</p>
      </div>
    );
  }

  if (!debugInfo) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Calculating...</h1>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">🔍 Permission Debug Results</h1>
      
      <div className="grid gap-6">
        {/* User Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">👤 User Information</h2>
          <div className="space-y-1">
            <p><strong>Name:</strong> {debugInfo.user.name}</p>
            <p><strong>Email:</strong> {debugInfo.user.email}</p>
            <p><strong>Role:</strong> {debugInfo.user.role}</p>
            <p><strong>Role ID:</strong> {debugInfo.user.roleId}</p>
          </div>
        </div>

        {/* Company Info */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">🏢 Company Information</h2>
          <div className="space-y-1">
            <p><strong>Company:</strong> {debugInfo.company.name}</p>
            <p><strong>Is First Time:</strong> {debugInfo.company.isFirstTime ? '🔴 TRUE (This is the problem!)' : '✅ FALSE'}</p>
            <p><strong>Is Active:</strong> {debugInfo.company.isActive ? '✅ TRUE' : '❌ FALSE'}</p>
          </div>
          {debugInfo.company.isFirstTime && (
            <div className="mt-3 p-3 bg-red-100 rounded border-l-4 border-red-500">
              <p className="text-red-700 font-medium">⚠️ REDIRECT ISSUE FOUND!</p>
              <p className="text-red-600 text-sm">Your company is marked as "first time" which restricts access to only the dashboard. This is why you're being redirected.</p>
            </div>
          )}
        </div>

        {/* Permission Status */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">🔑 Permission Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p><strong>Total Permissions:</strong> {debugInfo.permissions.total}</p>
              <p><strong>Is System Admin:</strong> {debugInfo.permissions.isSystemAdmin ? '✅ YES' : '❌ NO'}</p>
              <p><strong>Is Company Admin:</strong> {debugInfo.permissions.isCompanyAdmin ? '✅ YES' : '❌ NO'}</p>
            </div>
            <div>
              <p><strong>can_manage_system:</strong> {debugInfo.permissions.hasCanManageSystem ? '✅ YES' : '❌ NO'}</p>
              <p><strong>can_view_customers_menu:</strong> {debugInfo.permissions.hasCanViewCustomersMenu ? '✅ YES' : '❌ NO'}</p>
              <p><strong>can_manage_company:</strong> {debugInfo.permissions.hasCanManageCompany ? '✅ YES' : '❌ NO'}</p>
            </div>
          </div>
        </div>

        {/* Expected Behavior */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">📋 Expected Behavior</h2>
          <div className="space-y-2">
            <p><strong>Should see CRM menu:</strong> {
              debugInfo.permissions.hasCanViewCustomersMenu || 
              debugInfo.permissions.hasCanManageSystem || 
              debugInfo.permissions.hasCanManageCompany ? '✅ YES' : '❌ NO'
            }</p>
            <p><strong>Should access customers page:</strong> {
              debugInfo.permissions.hasCanViewCustomersMenu || 
              debugInfo.permissions.hasCanManageSystem || 
              debugInfo.permissions.hasCanManageCompany ? '✅ YES' : '❌ NO'
            }</p>
          </div>
        </div>

        {/* All Permissions List */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">📜 All User Permissions ({debugInfo.permissions.total})</h2>
          {debugInfo.permissions.total === 0 ? (
            <p className="text-red-600 font-medium">❌ NO PERMISSIONS FOUND!</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <div className="grid grid-cols-1 gap-1 text-sm font-mono">
                {debugInfo.allPermissions.map((perm: string, index: number) => (
                  <div 
                    key={index} 
                    className={`p-1 rounded ${perm === 'can_manage_system' ? 'bg-red-200' : perm === 'can_view_customers_menu' ? 'bg-blue-200' : 'bg-white'}`}
                  >
                    {perm}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Items */}
        <div className="bg-red-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">🚨 Next Steps</h2>
          <div className="space-y-2">
            {debugInfo.permissions.total === 0 && (
              <p className="text-red-600">• Your user has NO permissions assigned. Check your role assignment.</p>
            )}
            {!debugInfo.permissions.hasCanManageSystem && (
              <p className="text-orange-600">• You don't have 'can_manage_system' permission.</p>
            )}
            {!debugInfo.permissions.hasCanViewCustomersMenu && !debugInfo.permissions.hasCanManageSystem && (
              <p className="text-orange-600">• You don't have 'can_view_customers_menu' permission.</p>
            )}
            {(debugInfo.permissions.hasCanManageSystem || debugInfo.permissions.hasCanViewCustomersMenu) && (
              <p className="text-green-600">• You should be able to access customers. If not, there's a frontend bug.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}