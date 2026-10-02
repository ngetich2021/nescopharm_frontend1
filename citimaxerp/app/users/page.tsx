"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersTable } from "@/app/users/components/users-table"
import { RolesManagementTable } from "@/app/users/components/roles-management-table"
import { PermissionsTable } from "@/app/users/components/permissions-table"
import { useAuth } from "@/lib/auth-context"
import { hasPermission } from "@/lib/rbac"
import { Loader2 } from "lucide-react"

export default function UsersPage() {
  const { userProfile, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState("users")
  const [hasLoadedRoles, setHasLoadedRoles] = useState(false)
  const [hasLoadedPermissions, setHasLoadedPermissions] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Simplified permission check for now
  const hasAccess = true // In a real implementation, you would check actual permissions

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-600">
        <h2 className="text-2xl font-semibold mb-4">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (value === "roles" && !hasLoadedRoles) {
      setHasLoadedRoles(true)
    }
    if (value === "permissions" && !hasLoadedPermissions) {
      setHasLoadedPermissions(true)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">User & Role Management</h1>
        <p className="text-sm text-gray-600 mt-1">Manage users, define roles, and assign permissions.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTable />
        </TabsContent>
        <TabsContent value="roles">
          {hasLoadedRoles && <RolesManagementTable />}
        </TabsContent>
        <TabsContent value="permissions">
          {hasLoadedPermissions && <PermissionsTable />}
        </TabsContent>
      </Tabs>
    </div>
  )
}