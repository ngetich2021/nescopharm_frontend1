"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersTable } from "./components/users-table"
import { RolesTable } from "./components/roles-table"
import { PermissionsTable } from "./components/permissions-table"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import { PermissionGuard } from "@/components/PermissionGuard"

export default function UserManagementPage() {
  const { userProfile, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <PermissionGuard permissions={["can_manage_users_and_roles", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">User & Role Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage users, define roles, and assign permissions.</p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            <UsersTable />
          </TabsContent>
          <TabsContent value="roles">
            <RolesTable />
          </TabsContent>
          <TabsContent value="permissions">
            <PermissionsTable />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}