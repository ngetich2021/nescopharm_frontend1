"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  changePercent?: number
  previousValue?: string | number
  currency?: string
}

function MetricCard({ title, value, changePercent, previousValue, currency }: MetricCardProps) {
  const isPositive = typeof changePercent === "number" && changePercent >= 0
  return (
    <Card className="w-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium truncate">{title}</CardTitle>
        {typeof changePercent === "number" && (
          <span className={`flex items-center text-xs font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
            {changePercent}%
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {currency ? `${currency} ` : ""}{value}
        </div>
        {typeof previousValue !== "undefined" && (
          <CardDescription className="text-xs mt-1 text-muted-foreground">
            Prev: {currency ? `${currency} ` : ""}{previousValue}
          </CardDescription>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardSummaryCards({ data }: { data: any }) {
  if (!data) return null
  const { sales_metrics, financial_metrics, customer_metrics } = data
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Total Orders"
        value={sales_metrics?.total_orders?.current ?? "-"}
        changePercent={sales_metrics?.total_orders?.change_percent}
        previousValue={sales_metrics?.total_orders?.previous}
      />
      <MetricCard
        title="Total Revenue"
        value={sales_metrics?.total_revenue?.current ?? "-"}
        changePercent={sales_metrics?.total_revenue?.change_percent}
        previousValue={sales_metrics?.total_revenue?.previous}
        currency="KES"
      />
      <MetricCard
        title="Net Profit"
        value={financial_metrics?.net_profit?.current ?? "-"}
        changePercent={financial_metrics?.net_profit?.change_percent}
        previousValue={financial_metrics?.net_profit?.previous}
        currency="KES"
      />
      <MetricCard
        title="Total Customers"
        value={customer_metrics?.total_customers ?? "-"}
        changePercent={customer_metrics?.new_customers?.change_percent}
        previousValue={customer_metrics?.new_customers?.previous}
      />
    </div>
  )
}
