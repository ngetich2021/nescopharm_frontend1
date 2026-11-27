"use client"

import { useEffect, useState } from "react"
import { AssetsSummary } from "./assets-summary"
import { AssetsTable } from "./assets-table"
import { AssetsSchedule } from "./assets-schedule"
import { DepreciationJournal } from "./depreciation-journal"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const dynamic = "force-dynamic"

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function AssetsPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  // Depreciation and net book value are worked out as at this date.
  const [asAt, setAsAt] = useState(today)
  const [tab, setTab] = useState("register")
  // /assets?tab=journal opens the Depreciation Journal (links from the assistant and Finance).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t && ["register", "schedule", "journal"].includes(t)) setTab(t)
  }, [])
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
          {tab === "register" && (
            <div className="flex items-center gap-2">
              <Label htmlFor="assets-as-at" className="whitespace-nowrap text-sm text-muted-foreground">As at</Label>
              <Input id="assets-as-at" type="date" className="w-[170px]" value={asAt} onChange={(e) => e.target.value && setAsAt(e.target.value)} />
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="register">Register</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="journal">Depreciation Journal</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-6">
            <AssetsSummary refreshKey={refreshKey} asAt={asAt} />
            <AssetsTable asAt={asAt} onDataChanged={handleRefresh} />
          </TabsContent>

          <TabsContent value="schedule">
            {tab === "schedule" && <AssetsSchedule key={refreshKey} />}
          </TabsContent>

          <TabsContent value="journal">
            {tab === "journal" && <DepreciationJournal key={refreshKey} />}
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
