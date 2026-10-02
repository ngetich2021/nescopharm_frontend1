"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"

interface EnhancedMetricCardProps {
  title: string
  value: string | number
  changePercent?: number
  changeText?: string
  icon?: LucideIcon
  trend?: "up" | "down" | "neutral"
  currency?: string
  description?: string
  gradient?: string
  loading?: boolean
}

export function EnhancedMetricCard({
  title,
  value,
  changePercent,
  changeText,
  icon: Icon,
  trend,
  currency,
  description,
  gradient = "from-blue-500/10 to-purple-500/10",
  loading = false,
}: EnhancedMetricCardProps) {
  const isPositive = trend === "up" || (typeof changePercent === "number" && changePercent >= 0)
  const isNegative = trend === "down" || (typeof changePercent === "number" && changePercent < 0)

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
        "border-border/50 backdrop-blur-sm",
        loading && "animate-pulse"
      )}
    >
      {/* Background Gradient */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-70", gradient)} />

      <CardContent className="relative p-6">
        {/* Header with Icon */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            {description && (
              <p className="text-xs text-muted-foreground/70">{description}</p>
            )}
          </div>
          {Icon && (
            <div className="p-2 rounded-lg bg-background/80 backdrop-blur-sm shadow-sm">
              <Icon className="h-5 w-5 text-foreground/70" />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-3">
          <div className="text-3xl font-bold tracking-tight">
            {loading ? (
              <div className="flex items-center gap-2">
                <Spinner className="h-6 w-6" />
                <Skeleton className="h-9 w-32" />
              </div>
            ) : (
              <>
                {currency && <span className="text-muted-foreground">{currency} </span>}
                {typeof value === "number" ? value.toLocaleString() : value}
              </>
            )}
          </div>
        </div>

        {/* Change Indicator */}
        {(changePercent !== undefined || changeText) && !loading && (
          <div className="flex items-center gap-2">
            {changePercent !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold",
                  isPositive && "bg-green-500/10 text-green-600 dark:text-green-400",
                  isNegative && "bg-red-500/10 text-red-600 dark:text-red-400",
                  !isPositive && !isNegative && "bg-muted text-muted-foreground"
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : isNegative ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span>{Math.abs(changePercent)}%</span>
              </div>
            )}
            {changeText && (
              <p className="text-xs text-muted-foreground">{changeText}</p>
            )}
          </div>
        )}
      </CardContent>

      {/* Hover Effect Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
    </Card>
  )
}

// Mini variant for compact layouts
export function MiniMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  currency,
}: Omit<EnhancedMetricCardProps, "changePercent" | "description" | "gradient" | "changeText">) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-xl font-bold">
              {currency && <span className="text-muted-foreground text-sm">{currency} </span>}
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          </div>
          {Icon && (
            <div className={cn(
              "p-2 rounded-full transition-colors",
              trend === "up" && "bg-green-500/10 text-green-600",
              trend === "down" && "bg-red-500/10 text-red-600",
              !trend && "bg-muted text-muted-foreground"
            )}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
