"use client"

import { InvoicesTable } from "./invoices-table"
import { DeliveryInvoicesTable } from "./delivery-invoices-table"
import { useState, useEffect } from "react"
import { fetchInvoices } from "@/lib/invoices"
import { useDataCache } from "@/lib/data-cache"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth-context"
import { hasPermission } from "@/lib/rbac"
import { FileText, Truck } from "lucide-react"

export default function InvoicesPage() {
  // Use the data cache hook for invoices
  const {
    data: invoicesResponse,
    isLoading: isLoadingInvoices,
    refetch: refreshInvoices
  } = useDataCache<{ data: import('@/lib/invoices').Invoice[], meta?: any }>(
    'invoices',
    fetchInvoices,
    {
      expirationMs: 5 * 60 * 1000 // 5 minutes cache
    }
  )

  const invoices = invoicesResponse?.data || [];
  const { userProfile } = useAuth();
  const canViewDeliveryInvoices = hasPermission(userProfile as any, "can_view_delivery_invoices");

  return (
    <PermissionGuard permissions={["can_view_sales_menu", "can_view_invoices", "can_manage_system", "can_manage_company"]}>
      <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Invoices</h1>
        </div>

        {canViewDeliveryInvoices ? (
          <Tabs defaultValue="invoices" className="space-y-6">
            <TabsList>
              <TabsTrigger value="invoices" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoices
              </TabsTrigger>
              <TabsTrigger value="delivery-invoices" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Delivery Invoices
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invoices">
              <InvoicesTable initialInvoices={invoices} />
            </TabsContent>

            <TabsContent value="delivery-invoices">
              <DeliveryInvoicesTable />
            </TabsContent>
          </Tabs>
        ) : (
          <InvoicesTable initialInvoices={invoices} />
        )}
      </div>
    </PermissionGuard>
  )
}
