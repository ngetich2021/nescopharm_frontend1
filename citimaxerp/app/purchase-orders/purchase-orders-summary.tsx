"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReceiptText, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { getPurchaseOrders, PurchaseOrder } from "@/lib/purchaseorders"
import { Skeleton } from "@/components/ui/skeleton"

interface PurchaseOrdersSummaryProps {
  refreshKey?: number
}

export function PurchaseOrdersSummary({ refreshKey }: PurchaseOrdersSummaryProps) {
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    received: 0,
    partial: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetchSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function fetchSummary() {
    setIsLoading(true)
    setError(null)
    try {
      const orders = await getPurchaseOrders()
      setSummary({
        total: orders.length,
        pending: orders.filter(o => o.status === "pending").length,
        received: orders.filter(o => o.status === "received").length,
        partial: orders.filter(o => o.status === "partial").length,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch purchase order summary'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          <ReceiptText className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.total}</div>
          <p className="text-xs text-muted-foreground">All purchase orders</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.pending}</div>
          <p className="text-xs text-muted-foreground">Awaiting receipt</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Received</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.received}</div>
          <p className="text-xs text-muted-foreground">Fully received</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Partial</CardTitle>
          <AlertCircle className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.partial}</div>
          <p className="text-xs text-muted-foreground">Partially received</p>
        </CardContent>
      </Card>
    </div>
  )
} 