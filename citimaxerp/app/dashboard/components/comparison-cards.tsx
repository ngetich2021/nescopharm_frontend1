"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TrendingUp, TrendingDown, ArrowRight, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ComparisonData {
  label: string
  currentValue: number
  previousValue: number
  unit?: string
  icon?: LucideIcon
}

interface ComparisonCardProps {
  title: string
  description?: string
  data: ComparisonData[]
  timeframe?: {
    current: string
    previous: string
  }
  className?: string
}

export function ComparisonCard({
  title,
  description,
  data,
  timeframe = { current: "This Month", previous: "Last Month" },
  className,
}: ComparisonCardProps) {
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  return (
    <Card className={cn("hover:shadow-lg transition-all duration-300", className)}>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
          <span className="font-medium">{timeframe.current}</span>
          <ArrowRight className="h-4 w-4" />
          <span>{timeframe.previous}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((item, index) => {
          const change = calculateChange(item.currentValue, item.previousValue)
          const isPositive = change >= 0
          const Icon = item.icon

          return (
            <div key={index}>
              {index > 0 && <Separator className="my-4" />}
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {Icon && (
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <Badge
                    variant={isPositive ? "default" : "destructive"}
                    className="flex items-center gap-1"
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(change).toFixed(1)}%
                  </Badge>
                </div>

                {/* Values Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {timeframe.current}
                    </p>
                    <p className="text-2xl font-bold">
                      {item.unit}
                      {item.currentValue.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {timeframe.previous}
                    </p>
                    <p className="text-2xl font-bold text-muted-foreground">
                      {item.unit}
                      {item.previousValue.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Visual Bar Comparison */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-primary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            (item.currentValue /
                              Math.max(item.currentValue, item.previousValue)) *
                              100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium w-12 text-right">
                      {timeframe.current.split(" ")[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-muted-foreground/50 transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            (item.previousValue /
                              Math.max(item.currentValue, item.previousValue)) *
                              100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {timeframe.previous.split(" ")[0]}
                    </span>
                  </div>
                </div>

                {/* Difference */}
                <div className="text-sm">
                  <span className="text-muted-foreground">Difference: </span>
                  <span
                    className={cn(
                      "font-semibold",
                      isPositive ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {item.unit}
                    {(item.currentValue - item.previousValue).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// Simplified side-by-side comparison
interface SideBySideCardProps {
  title: string
  leftLabel: string
  leftValue: number | string
  rightLabel: string
  rightValue: number | string
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  unit?: string
  showDifference?: boolean
}

export function SideBySideCard({
  title,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  unit,
  showDifference = true,
}: SideBySideCardProps) {
  const numLeft = typeof leftValue === "number" ? leftValue : 0
  const numRight = typeof rightValue === "number" ? rightValue : 0
  const difference = numLeft - numRight
  const percentChange = numRight !== 0 ? (difference / numRight) * 100 : 0

  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Left Side */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {LeftIcon && (
                <div className="p-2 rounded-lg bg-primary/10">
                  <LeftIcon className="h-4 w-4 text-primary" />
                </div>
              )}
              <p className="text-sm font-medium text-muted-foreground">
                {leftLabel}
              </p>
            </div>
            <p className="text-2xl font-bold">
              {unit}
              {typeof leftValue === "number"
                ? leftValue.toLocaleString()
                : leftValue}
            </p>
          </div>

          {/* Right Side */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {RightIcon && (
                <div className="p-2 rounded-lg bg-muted">
                  <RightIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <p className="text-sm font-medium text-muted-foreground">
                {rightLabel}
              </p>
            </div>
            <p className="text-2xl font-bold text-muted-foreground">
              {unit}
              {typeof rightValue === "number"
                ? rightValue.toLocaleString()
                : rightValue}
            </p>
          </div>
        </div>

        {showDifference && typeof leftValue === "number" && typeof rightValue === "number" && (
          <>
            <Separator className="my-4" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Difference</span>
              <div className="flex items-center gap-2">
                <Badge
                  variant={difference >= 0 ? "default" : "secondary"}
                  className="flex items-center gap-1"
                >
                  {difference >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(percentChange).toFixed(1)}%
                </Badge>
                <span className="font-semibold">
                  {difference >= 0 ? "+" : ""}
                  {unit}
                  {difference.toLocaleString()}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
