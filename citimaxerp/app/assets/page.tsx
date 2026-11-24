"use client"

import { useState } from "react"
import { AssetsSummary } from "./assets-summary"
import { AssetsTable } from "./assets-table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const dynamic = "force-dynamic"

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function AssetsPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  // Depreciation and net book value are worked out as at this date.
  const [asAt, setAsAt] = useState(today)
  const handleRefresh = () => setRefreshKey((k) => k + 1)

  return (
    <PermissionGuard permissions={["can_view_assets_menu", "can_view_assets", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Fixed Asset Register</h1>
            <p className="text-muted-foreground">
              Every asset with its ID, tag, location and the person it is assigned to, with straight-line depreciation and net book value.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="assets-as-at" className="whitespace-nowrap text-sm text-muted-foreground">As at</Label>
            <Input id="assets-as-at" type="date" className="w-[170px]" value={asAt} onChange={(e) => e.target.value && setAsAt(e.target.value)} />
          </div>
        </div>

        <AssetsSummary refreshKey={refreshKey} asAt={asAt} />

        <AssetsTable asAt={asAt} onDataChanged={handleRefresh} />
      </div>
    </PermissionGuard>
  )
}
