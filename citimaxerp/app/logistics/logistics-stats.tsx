import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LogisticsStats } from "../types"
import { cn } from "@/lib/utils"

interface LogisticsStatsProps {
  stats: LogisticsStats
}

export function LogisticsStats({ stats }: LogisticsStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalDeliveries.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            <span className={cn("font-medium", stats.totalDeliveriesChange > 0 ? "text-green-600" : "text-red-600")}>
              {stats.totalDeliveriesChange > 0 ? "+" : ""}
              {stats.totalDeliveriesChange}
            </span>{" "}
            vs last week
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completedDeliveries.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            <span
              className={cn("font-medium", stats.completedDeliveriesChange > 0 ? "text-green-600" : "text-red-600")}
            >
              {stats.completedDeliveriesChange > 0 ? "+" : ""}
              {stats.completedDeliveriesChange}
            </span>{" "}
            vs last week
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingDeliveries.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Requires attention</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Delivery Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.averageDeliveryTime.toFixed(1)} hours</div>
          <p className="text-xs text-muted-foreground">Across all completed deliveries</p>
        </CardContent>
      </Card>
    </div>
  )
}
