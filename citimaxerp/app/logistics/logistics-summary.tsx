"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TruckIcon, PackageIcon, RefreshCwIcon, ClockIcon } from "lucide-react"
import { getLogisticsSummary, LogisticsSummary as LSummary } from "@/lib/logistics"
import { Skeleton } from "@/components/ui/skeleton"

export function LogisticsSummary() {
  const [summary, setSummary] = useState<LSummary>({
    total: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
    pending: 0,
    in_transit: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Fetch data when component mounts
    fetchSummary()
  }, [])

  async function fetchSummary() {
    setIsLoading(true)
    setError(null)
    
    try {
      const data = await getLogisticsSummary()
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch logistics summary'))
      
      // Still set a default summary to avoid breaking the UI
      setSummary({
        total: 0,
        dispatched: 0,
        delivered: 0,
        cancelled: 0,
        pending: 0,
        in_transit: 0,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Skeleton loader for loading state
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
          <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
          <TruckIcon className="h-4 w-4 text-[#1E2764]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.total}</div>
          <p className="text-xs text-muted-foreground">All delivery records</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Delivered</CardTitle>
          <PackageIcon className="h-4 w-4 text-[#1E2764]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.delivered}</div>
          <p className="text-xs text-muted-foreground">Successfully completed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">In Transit</CardTitle>
          <RefreshCwIcon className="h-4 w-4 text-[#1E2764]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.in_transit + summary.dispatched}</div>
          <p className="text-xs text-muted-foreground">Currently in delivery</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <ClockIcon className="h-4 w-4 text-[#1E2764]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.pending}</div>
          <p className="text-xs text-muted-foreground">Awaiting dispatch</p>
        </CardContent>
      </Card>
    </div>
  )
}
