"use client"

import { useState } from "react"
import { PurchaseOrdersSummary } from "./purchase-orders-summary"
import { PurchaseOrdersTable } from "./purchase-orders-table"
// import { PurchaseOrdersTableSkeleton } from "./purchase-orders-table-skeleton"
import { PermissionGuard } from "@/components/PermissionGuard"

export const dynamic = 'force-dynamic'

export default function PurchaseOrdersPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const handleRefresh = () => setRefreshKey((k) => k + 1)

  return (
    <PermissionGuard permissions={["can_view_purchase_orders_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage and track your purchase orders in one place.</p>
        </div>

        <PurchaseOrdersSummary refreshKey={refreshKey} />
        {/* <Suspense fallback={<PurchaseOrdersTableSkeleton />}> */}
          <PurchaseOrdersTable onDataChanged={handleRefresh} />
        {/* </Suspense> */}
      </div>
    </PermissionGuard>
  )
} 