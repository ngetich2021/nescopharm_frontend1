"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, Target, Award, Zap, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label?: string
    isPositive?: boolean
  }
  progress?: {
    value: number
    max: number
    label?: string
  }
  variant?: "default" | "gradient" | "minimal"
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  progress,
  variant = "default",
  className,
}: StatCardProps) {
  const gradients = [
    "from-blue-500 to-cyan-500",
    "from-purple-500 to-pink-500",
    "from-orange-500 to-red-500",
    "from-green-500 to-emerald-500",
    "from-indigo-500 to-purple-500",
  ]

  const randomGradient = gradients[Math.floor(Math.random() * gradients.length)]

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-300",
        variant === "gradient" && "border-0",
        variant === "default" && "hover:shadow-lg hover:scale-[1.02]",
        className
      )}
    >
      {variant === "gradient" && (
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", randomGradient)} />
      )}

      <CardContent className={cn("relative p-6", variant === "gradient" && "text-white")}>
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1 flex-1">
            <p
              className={cn(
                "text-sm font-medium",
                variant === "gradient" ? "text-white/80" : "text-muted-foreground"
              )}
            >
              {title}
            </p>
            {subtitle && (
              <p
                className={cn(
                  "text-xs",
                  variant === "gradient" ? "text-white/60" : "text-muted-foreground/70"
                )}
              >
                {subtitle}
              </p>
            )}
          </div>

          {Icon && (
            <div
              className={cn(
                "p-2 rounded-lg",
                variant === "gradient"
                  ? "bg-white/20 backdrop-blur-sm"
                  : "bg-primary/10"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  variant === "gradient" ? "text-white" : "text-primary"
                )}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-3xl font-bold tracking-tight">{value}</div>

          {trend && (
            <div className="flex items-center gap-2">
              <Badge
                variant={variant === "gradient" ? "secondary" : "outline"}
                className={cn(
                  "flex items-center gap-1 font-semibold",
                  trend.isPositive !== false &&
                    (variant === "gradient"
                      ? "bg-white/20 text-white border-white/40"
                      : "border-green-500/40 text-green-600 bg-green-500/10"),
                  trend.isPositive === false &&
                    (variant === "gradient"
                      ? "bg-white/20 text-white border-white/40"
                      : "border-red-500/40 text-red-600 bg-red-500/10")
                )}
              >
                {trend.isPositive !== false ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(trend.value)}%</span>
              </Badge>
              {trend.label && (
                <span
                  className={cn(
                    "text-xs",
                    variant === "gradient" ? "text-white/80" : "text-muted-foreground"
                  )}
                >
                  {trend.label}
                </span>
              )}
            </div>
          )}

          {progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    variant === "gradient" ? "text-white/80" : "text-muted-foreground"
                  )}
                >
                  {progress.label || "Progress"}
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    variant === "gradient" ? "text-white" : "text-foreground"
                  )}
                >
                  {progress.value} / {progress.max}
                </span>
              </div>
              <Progress
                value={(progress.value / progress.max) * 100}
                className={cn(
                  "h-2",
                  variant === "gradient" && "bg-white/20 [&>div]:bg-white"
                )}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Goal Card for tracking targets
interface GoalCardProps {
  title: string
  current: number
  target: number
  unit?: string
  period?: string
  icon?: LucideIcon
}

export function GoalCard({ title, current, target, unit, period, icon: Icon }: GoalCardProps) {
  const percentage = Math.min((current / target) * 100, 100)
  const isAchieved = current >= target

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{title}</h3>
              {isAchieved && (
                <Badge className="bg-green-500 hover:bg-green-600">
                  <Award className="h-3 w-3 mr-1" />
                  Achieved
                </Badge>
              )}
            </div>
            {period && <p className="text-xs text-muted-foreground">{period}</p>}
          </div>
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {current.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              / {target.toLocaleString()} {unit}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{percentage.toFixed(0)}%</span>
            </div>
            <Progress value={percentage} className="h-3" />
          </div>

          {!isAchieved && (
            <p className="text-xs text-muted-foreground">
              {(target - current).toLocaleString()} {unit} remaining
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Performance Score Card
interface PerformanceCardProps {
  title: string
  score: number
  maxScore?: number
  metrics?: Array<{ label: string; value: number; max: number }>
}

export function PerformanceCard({
  title,
  score,
  maxScore = 100,
  metrics,
}: PerformanceCardProps) {
  const percentage = (score / maxScore) * 100
  const getScoreColor = () => {
    if (percentage >= 80) return "text-green-600"
    if (percentage >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBg = () => {
    if (percentage >= 80) return "bg-green-500/10"
    if (percentage >= 60) return "bg-yellow-500/10"
    return "bg-red-500/10"
  }

  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold">{title}</h3>
          <Zap className="h-5 w-5 text-yellow-500" />
        </div>

        <div className="flex items-center justify-center mb-6">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/20"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={`${percentage * 2.51} ${251 - percentage * 2.51}`}
                className={cn("transition-all duration-1000", getScoreColor())}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-bold", getScoreColor())}>{score}</span>
              <span className="text-xs text-muted-foreground">/ {maxScore}</span>
            </div>
          </div>
        </div>

        {metrics && metrics.length > 0 && (
          <div className="space-y-3">
            {metrics.map((metric, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{metric.label}</span>
                  <span className="font-semibold">
                    {metric.value} / {metric.max}
                  </span>
                </div>
                <Progress value={(metric.value / metric.max) * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
