"use client"
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Building2, Receipt, Truck } from "lucide-react"
import { SuppliersSummary } from "./suppliers-summary"
import { SuppliersTable } from "./suppliers-table"
import { SuppliersTableSkeleton } from "./suppliers-table-skeleton"
import { SupplierInvoicesTable } from "./supplier-invoices-table"
import { DeliveryInvoicesTable } from "./delivery-invoices-table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth-context"
import { hasPermission } from "@/lib/rbac"
import { SUPPLIER_INVOICE_PERMISSIONS, DELIVERY_INVOICE_PERMISSIONS, SUPPLIERS_PAGE_PERMISSIONS } from "@/lib/suppliers-access"

// Force dynamic rendering to avoid authentication issues during build
export const dynamic = 'force-dynamic'

function SuppliersContent() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { userProfile } = useAuth()
  const searchParams = useSearchParams()
  const can = (permissions: string[]) => permissions.some((p) => hasPermission(userProfile as any, p))

  // Handler to trigger refresh
  const handleRefresh = () => setRefreshKey((k) => k + 1)

  // Each tab shows only to those allowed it, so someone who only sees delivery invoices opens on those.
  const tabs = [
    can(["can_view_suppliers_menu"]) && "suppliers",
    can(DELIVERY_INVOICE_PERMISSIONS) && "delivery-invoices",
    can(SUPPLIER_INVOICE_PERMISSIONS) && "supplier-invoices",
  ].filter(Boolean) as string[]
  const requested = searchParams.get("tab")

  if (tabs.length === 0) return null

  return (
    <Tabs defaultValue={requested && tabs.includes(requested) ? requested : tabs[0]} className="space-y-6">
      <TabsList>
        {tabs.includes("suppliers") && (
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Suppliers
          </TabsTrigger>
        )}
        {tabs.includes("delivery-invoices") && (
          <TabsTrigger value="delivery-invoices" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Delivery Invoices
          </TabsTrigger>
        )}
        {tabs.includes("supplier-invoices") && (
          <TabsTrigger value="supplier-invoices" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Supplier Invoices
          </TabsTrigger>
        )}
      </TabsList>

      {tabs.includes("suppliers") && (
        <TabsContent value="suppliers" className="space-y-6">
          <SuppliersSummary refreshKey={refreshKey} />
          <Suspense fallback={<SuppliersTableSkeleton />}>
            <SuppliersTable onDataChanged={handleRefresh} />
          </Suspense>
        </TabsContent>
      )}
      {tabs.includes("delivery-invoices") && (
        <TabsContent value="delivery-invoices">
          <DeliveryInvoicesTable />
        </TabsContent>
      )}
      {tabs.includes("supplier-invoices") && (
        <TabsContent value="supplier-invoices">
          <SupplierInvoicesTable />
        </TabsContent>
      )}
    </Tabs>
  )
}

export default function SuppliersPage() {
  return (
    <PermissionGuard permissions={[...SUPPLIERS_PAGE_PERMISSIONS, "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Supplier Management</h1>
          <p className="text-muted-foreground">Track, manage, and analyze your suppliers in one place.</p>
        </div>

        <Suspense fallback={<SuppliersTableSkeleton />}>
          <SuppliersContent />
        </Suspense>
      </div>
    </PermissionGuard>
  )
}
