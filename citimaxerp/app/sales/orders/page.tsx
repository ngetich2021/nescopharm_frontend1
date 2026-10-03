"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock, ShoppingCart, DollarSign } from "lucide-react"
import { OrdersTable } from "./orders-table"
import { formatCurrency } from "@/lib/utils"
import { useState, useEffect } from "react"
import { fetchOrders } from "@/lib/orders"
import { useDataCache } from "@/lib/data-cache"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Order } from "@/lib/orders"

export default function OrdersPage() {
  // Use the data cache hook for orders
  const { 
    data: orders = [],
    isLoading: isLoadingOrders,
    refetch: refreshOrders
  } = useDataCache<Order[]>(
    'orders', 
    fetchOrders,
    {
      expirationMs: 5 * 60 * 1000 // 5 minutes cache
    }
  )

  // Ensure orders is always an array
  const safeOrders = Array.isArray(orders) ? orders : []

  // Calculate summary data for orders dynamically
  const ordersSummaryData = {
    totalOrders: safeOrders.length || 0,
    completedOrders: safeOrders.filter((o: Order) => o.status?.toLowerCase() === "completed").length || 0,
    pendingOrders: safeOrders.filter((o: Order) => o.status?.toLowerCase() === "pending").length || 0,
    // @ts-ignore - Allow accessing different property names from different API versions
    totalRevenue: safeOrders.reduce((sum, o) => sum + Number.parseFloat(o.total_amount || o.final_amount || "0"), 0) || 0,
  }

  return (
    <PermissionGuard permissions={["can_view_orders_menu", "can_view_orders", "can_manage_system", "can_manage_company"]}>
      <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Orders</h1>
        </div>

        {/* Summary Cards for Orders */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{ordersSummaryData.totalOrders}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">All time orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Completed Orders</CardTitle>
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{ordersSummaryData.completedOrders}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Successfully delivered</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending Orders</CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{ordersSummaryData.pendingOrders}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Awaiting processing</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{formatCurrency(ordersSummaryData.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Total value of all orders</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <h3 className="text-xl font-semibold">Recent Orders</h3>
          <OrdersTable initialOrders={safeOrders} isLoading={isLoadingOrders} />
        </div>
      </div>
    </PermissionGuard>
  )
}