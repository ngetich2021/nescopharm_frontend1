"use client"

import { useState, useEffect, useCallback } from "react"
import { OrdersStats } from "./orders-stats"
import { OrdersTable } from "./orders-table"
import { fetchOrders, type Order } from "@/lib/orders"
import { toast } from "@/components/ui/use-toast"
import { OrdersTableSkeleton } from "./orders-table-skeleton" // Import the new skeleton

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    unpaidOrders: 0,
  })

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const fetchedOrders = await fetchOrders()
      setOrders(fetchedOrders)

      // Calculate stats
      const totalRevenue = fetchedOrders.reduce((sum, order) => sum + Number.parseFloat(order.total_amount || "0"), 0)
      const pendingOrders = fetchedOrders.filter((order) => order.status?.toLowerCase() === "pending").length
      const unpaidOrders = fetchedOrders.filter(
        (order) => order.status?.toLowerCase() !== "paid" && order.status?.toLowerCase() !== "completed",
      ).length

      setStats({
        totalOrders: fetchedOrders.length,
        totalRevenue,
        pendingOrders,
        unpaidOrders,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load orders.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Orders</h1>
      </div>
      {isLoading ? (
        <OrdersTableSkeleton />
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <OrdersStats stats={stats} />
          <OrdersTable initialOrders={orders} />
        </div>
      )}
    </>
  )
}
