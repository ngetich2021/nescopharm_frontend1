"use client"

import { useState } from "react"
import { StockCountsTable } from "./stock-counts/stock-counts-table"
import { getStockCounts, getStockCountSummary } from "@/lib/stock-counts"
import { useDataCache } from "@/lib/data-cache"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import type { StockCount } from "@/app/types"
import { StockCountsSkeleton } from "./stock-counts/stock-counts-skeleton" // Import the skeleton

export function StockCountsTab() {
  const { toast } = useToast()
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)

  // Use data cache for stock counts
  const {
    data: stockCountsData,
    isLoading: isLoadingCounts,
    error: countsError,
    refetch: refetchCounts,
  } = useDataCache<{ data: StockCount[]; count: number }>(
    "stock-counts-list",
    () => getStockCounts(), // Fetch with default pagination
    {
      expirationMs: 5 * 60 * 1000, // 5 minutes cache
      retryOnError: true,
      onSuccess: () => {
        setLastRefreshTime(new Date())
      },
      onError: (error) => {
        toast({
          title: "Error loading stock counts",
          description: error.message || "Failed to load stock counts",
          variant: "destructive",
        })
      },
    },
  )

  // Use data cache for summary data
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useDataCache("stock-counts-summary", getStockCountSummary, {
    expirationMs: 5 * 60 * 1000, // 5 minutes cache
    retryOnError: true,
  })

  const handleRefresh = () => {
    refetchCounts()
    refetchSummary()
  }

  const handleStockCountCreated = (newCount: StockCount) => {
    refetchCounts()
    refetchSummary()
  }

  const isLoading = isLoadingCounts || isLoadingSummary
  const hasError = countsError || summaryError
  const stockCounts = stockCountsData?.data || []

  if (hasError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {countsError?.message || summaryError?.message || "Failed to load stock counts"}.
          <Button variant="link" onClick={handleRefresh} className="p-0 h-auto font-normal">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading && !stockCounts.length) {
    // Use the StockCountsSkeleton when loading and no stock counts are available
    return <StockCountsSkeleton />
  }

  return (
    <StockCountsTable
      stockCounts={stockCounts}
      summaryData={
        summaryData || {
          totalCounts: 0,
          completedCounts: 0,
          inProgressCounts: 0,
          pendingCounts: 0,
          cancelledCounts: 0,
        }
      }
      onStockCountCreated={handleStockCountCreated}
      onRefresh={handleRefresh}
    />
  )
}
