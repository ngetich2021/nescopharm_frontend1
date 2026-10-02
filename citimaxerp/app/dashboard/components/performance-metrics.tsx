"use client"

import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"

interface Metric {
  id: number
  name: string
  value: number
  target: number
  unit: string
  change: number
}

interface PerformanceMetricsProps {
  isLoading: boolean
}

export function PerformanceMetrics({ isLoading }: PerformanceMetricsProps) {
  const [metrics, setMetrics] = useState<Metric[]>([])

  useEffect(() => {
    // Mock data
    const mockMetrics: Metric[] = [
      {
        id: 1,
        name: "Conversion Rate",
        value: 3.8,
        target: 5.0,
        unit: "%",
        change: 0.5,
      },
      {
        id: 2,
        name: "Average Order Value",
        value: 128,
        target: 150,
        unit: "$",
        change: 12,
      },
      {
        id: 3,
        name: "Customer Satisfaction",
        value: 92,
        target: 95,
        unit: "%",
        change: 3,
      },
      {
        id: 4,
        name: "Return Rate",
        value: 2.4,
        target: 2.0,
        unit: "%",
        change: -0.3,
      },
    ]

    setMetrics(mockMetrics)
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-[200px]">Loading metrics...</div>
  }

  return (
    <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
      {metrics.map((metric) => {
        const progress = (metric.value / metric.target) * 100
        const isNegativeMetric = metric.name.toLowerCase().includes("return")
        const isPositiveChange = isNegativeMetric ? metric.change < 0 : metric.change > 0

        return (
          <div key={metric.id} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{metric.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  {metric.unit === "$" ? `${metric.unit}${metric.value}` : `${metric.value}${metric.unit}`}
                </span>
                <span className={`text-xs ${isPositiveChange ? "text-green-600" : "text-red-600"}`}>
                  {metric.change > 0 ? "+" : ""}
                  {metric.unit === "$" ? `${metric.unit}${metric.change}` : `${metric.change}${metric.unit}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Progress
                value={progress}
                className="h-2"
                indicatorClassName={
                  isNegativeMetric
                    ? progress > 100
                      ? "bg-red-500"
                      : "bg-green-500"
                    : progress > 100
                      ? "bg-green-500"
                      : "bg-[#E30040]"
                }
              />
              <span className="text-xs text-gray-500 min-w-[40px] text-right">
                {Math.min(100, Math.round(progress))}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
