"use client"
import { Suspense, useState } from "react"
import { SuppliersSummary } from "./suppliers-summary"
import { SuppliersTable } from "./suppliers-table"
import { SuppliersTableSkeleton } from "./suppliers-table-skeleton"
import { PermissionGuard } from "@/components/PermissionGuard"

// Force dynamic rendering to avoid authentication issues during build
export const dynamic = 'force-dynamic'

export default function SuppliersPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  // Handler to trigger refresh
  const handleRefresh = () => setRefreshKey((k) => k + 1)

  return (
    <PermissionGuard permissions={["can_view_suppliers_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Supplier Management</h1>
          <p className="text-muted-foreground">Track, manage, and analyze your suppliers in one place.</p>
        </div>

        <SuppliersSummary refreshKey={refreshKey} />
        
        <Suspense fallback={<SuppliersTableSkeleton />}>
          <SuppliersTable onDataChanged={handleRefresh} />
        </Suspense>
      </div>
    </PermissionGuard>
  )
}