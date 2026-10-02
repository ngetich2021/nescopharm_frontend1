"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DebtSummary } from "@/types/debts"
import { DollarSign, AlertTriangle, Clock, CheckCircle } from "lucide-react"

interface DebtsSummaryProps {
  summary: DebtSummary
}

export function DebtsSummary({ summary }: DebtsSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalOutstanding)}</div>
          <p className="text-xs text-muted-foreground">Across all debts</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOverdue)}</div>
          <p className="text-xs text-muted-foreground">
            {summary.overdueCount} debt{summary.overdueCount !== 1 ? "s" : ""} overdue
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Debts</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{summary.pendingCount}</div>
          <p className="text-xs text-muted-foreground">Active pending debts</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Paid This Month</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.paidThisMonth)}</div>
          <p className="text-xs text-muted-foreground">Payments received</p>
        </CardContent>
      </Card>
    </div>
  )
}
