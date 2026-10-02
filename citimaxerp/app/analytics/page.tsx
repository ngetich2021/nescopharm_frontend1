"use client"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PermissionGuard } from "@/components/PermissionGuard"
import { usePermissions } from "@/hooks/use-permissions"

export default function AnalyticsDashboardPage() {
  const { userProfile, isLoading } = useAuth()
  const { hasPermission } = usePermissions()

  if (isLoading) {
    return <div>Loading user permissions...</div>
  }

  return (
    <PermissionGuard permissions={["can_view_analytics_dashboard_menu", "can_manage_system", "can_manage_company"]}>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
        <Card>
          <CardHeader>
            <CardTitle>Sales Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Displaying sales data here...</p>
            <PermissionGuard permissions={["can_export_analytics_data", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button className="mt-4">Export Data</Button>
            </PermissionGuard>
          </CardContent>
        </Card>
        {/* ... other analytics components */}
      </div>
    </PermissionGuard>
  )
}