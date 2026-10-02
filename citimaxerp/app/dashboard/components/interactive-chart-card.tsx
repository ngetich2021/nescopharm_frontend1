"use client"

import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

interface DataPoint {
  label: string
  value: number
  color?: string
}

interface InteractiveChartCardProps {
  title: string
  description?: string
  data: DataPoint[]
  total?: number
  trend?: { value: number; label: string }
  chartType?: "bar" | "area" | "donut"
  className?: string
  loading?: boolean
  height?: number
}

const COLORS = [
  "hsl(221, 83%, 53%)",  // blue
  "hsl(262, 83%, 58%)",  // violet
  "hsl(330, 81%, 60%)",  // pink
  "hsl(25, 95%, 53%)",   // orange
  "hsl(142, 71%, 45%)",  // green
  "hsl(47, 96%, 53%)",   // yellow
  "hsl(199, 89%, 48%)",  // sky
  "hsl(0, 84%, 60%)",    // red
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold">
        {payload[0].value?.toLocaleString()}
      </p>
    </div>
  )
}

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{payload[0].name}</p>
      <p className="text-sm font-semibold">
        {payload[0].value?.toLocaleString()}
      </p>
    </div>
  )
}

export function InteractiveChartCard({
  title,
  description,
  data,
  total,
  trend,
  chartType = "bar",
  className,
  loading = false,
  height = 280,
}: InteractiveChartCardProps) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value }))

  return (
    <div
      className={cn("overflow-hidden rounded-2xl", className)}
      style={{
        background: "rgba(255, 255, 255, 0.55)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
      }}
    >
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {trend && (
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.value >= 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
              )}
            >
              {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend.value)}%
            </Badge>
          )}
        </div>
        {total !== undefined && (
          <p className="text-2xl font-bold tracking-tight mt-1">
            {total.toLocaleString()}
          </p>
        )}
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height }}>
            <Spinner className="h-8 w-8" />
          </div>
        ) : chartType === "bar" ? (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : chartType === "area" ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={2}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
