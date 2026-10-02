"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock, FileText, DollarSign } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Quote } from "@/lib/quotes"

interface QuotesSummaryProps {
  quotes: Quote[]
  loading: boolean
}

export function QuotesSummary({ quotes, loading }: QuotesSummaryProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Calculate summary data for quotes dynamically
  const summaryData = {
    totalQuotes: quotes.length || 0,
    acceptedQuotes: quotes.filter((q: Quote) => q.status?.toLowerCase() === "accepted").length || 0,
    pendingQuotes: quotes.filter((q: Quote) => q.status?.toLowerCase() === "pending").length || 0,
    totalValue: quotes.reduce((sum, q) => sum + Number.parseFloat(q.final_amount || q.total_amount || "0"), 0) || 0,
  }

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Total Quotes</CardTitle>
          <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-2xl font-bold">{summaryData.totalQuotes}</div>
          <p className="text-xs text-muted-foreground hidden sm:block">All time quotes</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Accepted Quotes</CardTitle>
          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-2xl font-bold">{summaryData.acceptedQuotes}</div>
          <p className="text-xs text-muted-foreground hidden sm:block">Successfully accepted</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Pending Quotes</CardTitle>
          <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-2xl font-bold">{summaryData.pendingQuotes}</div>
          <p className="text-xs text-muted-foreground hidden sm:block">Awaiting response</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Total Value</CardTitle>
          <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-2xl font-bold">{formatCurrency(summaryData.totalValue)}</div>
          <p className="text-xs text-muted-foreground hidden sm:block">Total value of all quotes</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default QuotesSummary