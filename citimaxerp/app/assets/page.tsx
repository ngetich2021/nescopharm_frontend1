"use client"

import { useState } from "react"
import { AssetsSummary } from "./assets-summary"
import { AssetsTable } from "./assets-table"
import { PermissionGuard } from "@/components/PermissionGuard"

export const dynamic = "force-dynamic"

export default function AssetsPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const handleRefresh = () => setRefreshKey((k) => k + 1)

  return (
    <PermissionGuard permissions={["can_view_assets_menu", "can_view_assets", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Assets Register</h1>
          <p className="text-muted-foreground">Track and manage company assets, with Excel import and export.</p>
        </div>

        <AssetsSummary refreshKey={refreshKey} />

        <AssetsTable onDataChanged={handleRefresh} />
      </div>
    </PermissionGuard>
  )
}
