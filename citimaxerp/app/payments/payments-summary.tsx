"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, CheckCircle, AlertCircle, XCircle, Loader2 } from "lucide-react"
import { getPaymentSummary, PaymentSummary } from "@/lib/payments"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

export function PaymentsSummary() {
  const { companyId } = useAuth()
  const [summary, setSummary] = useState<PaymentSummary>({
    totalPayments: 0,
    totalAmount: 0,
    completedPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Fetch data when component mounts and when companyId is available
    if (companyId) {
      fetchSummary()
    }
  }, [companyId])

  async function fetchSummary() {
    setIsLoading(true)
    setError(null)
    
    try {
      const data = await getPaymentSummary(companyId || undefined)
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch payment summary'))
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
          <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          <CreditCard className="h-4 w-4 text-[#E30040]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</div>
          <p className="text-xs text-muted-foreground">{summary.totalPayments} transactions total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Payments</CardTitle>
          <CheckCircle className="h-4 w-4 text-[#E30040]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.completedPayments}</div>
          <p className="text-xs text-muted-foreground">Successfully processed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
          <AlertCircle className="h-4 w-4 text-[#E30040]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.pendingPayments}</div>
          <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
          <XCircle className="h-4 w-4 text-[#E30040]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.failedPayments}</div>
          <p className="text-xs text-muted-foreground">Requires attention</p>
        </CardContent>
      </Card>
    </div>
  )
}
