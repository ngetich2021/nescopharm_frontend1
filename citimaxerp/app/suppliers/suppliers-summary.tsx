"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, CheckCircle, XCircle, Calendar, Loader2 } from "lucide-react"
import { getSupplierSummaryFromDB, SupplierSummary } from "@/lib/suppliers"
import { Skeleton } from "@/components/ui/skeleton"

interface SuppliersSummaryProps {
  refreshKey?: number
}

export function SuppliersSummary({ refreshKey }: SuppliersSummaryProps) {
  const [summary, setSummary] = useState<SupplierSummary>({
    totalSuppliers: 0,
    activeSuppliers: 0,
    inactiveSuppliers: 0,
    averagePaymentTerms: 0,
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
      const data = await getSupplierSummaryFromDB()
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch supplier summary'))
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
          <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
          <Building2 className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalSuppliers}</div>
          <p className="text-xs text-muted-foreground">All suppliers</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.activeSuppliers}</div>
          <p className="text-xs text-muted-foreground">Currently active</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Inactive Suppliers</CardTitle>
          <XCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.inactiveSuppliers}</div>
          <p className="text-xs text-muted-foreground">Currently inactive</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Payment Terms</CardTitle>
          <Calendar className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.averagePaymentTerms} days</div>
          <p className="text-xs text-muted-foreground">Average terms</p>
        </CardContent>
      </Card>
    </div>
  )
} 