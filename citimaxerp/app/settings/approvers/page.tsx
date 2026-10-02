"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DispatchApproversTable } from "./components/dispatch-approvers-table"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import { PermissionGuard } from "@/components/PermissionGuard"

export default function ApproversManagementPage() {
  const { userProfile, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <PermissionGuard permissions={["can_manage_dispatch_settings", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Approvers Management</h1>
          <p className="text-sm text-gray-600 mt-1">Configure approval workflows for different processes.</p>
        </div>

        <Tabs defaultValue="dispatch" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="dispatch">Dispatch Approvers</TabsTrigger>
          </TabsList>
          <TabsContent value="dispatch">
            <DispatchApproversTable />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
