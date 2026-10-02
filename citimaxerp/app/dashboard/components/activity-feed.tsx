"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"

interface ActivityItem {
  id: string
  type: "sale" | "inventory" | "customer" | "payment" | "alert" | "success"
  title: string
  description: string
  timestamp: Date
  user?: string
  amount?: number
  status?: "pending" | "completed" | "failed"
}

interface ActivityFeedProps {
  activities?: ActivityItem[]
  maxHeight?: string
  showViewAll?: boolean
  loading?: boolean
}

const activityConfig: Record<
  ActivityItem["type"],
  { icon: LucideIcon; color: string; bgColor: string }
> = {
  sale: {
    icon: ShoppingCart,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
  },
  inventory: {
    icon: Package,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
  },
  customer: {
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
  },
  payment: {
    icon: DollarSign,
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
  },
  alert: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-500/10",
  },
  success: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
  },
}

function ActivityItemComponent({ activity }: { activity: ActivityItem }) {
  const config = activityConfig[activity.type]
  const Icon = config.icon

  return (
    <div className="group relative flex gap-4 py-4 transition-colors hover:bg-muted/50 rounded-lg px-3 -mx-3">
      {/* Timeline Dot */}
      <div className="relative flex-shrink-0">
        <div className={cn("p-2 rounded-full", config.bgColor)}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        {/* Connecting Line */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-px h-full bg-border" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold leading-tight">{activity.title}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {activity.description}
            </p>
          </div>
          {activity.amount !== undefined && (
            <Badge variant="secondary" className="flex-shrink-0 font-mono">
              KES {activity.amount.toLocaleString()}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</span>
          {activity.user && (
            <>
              <span>•</span>
              <span>{activity.user}</span>
            </>
          )}
          {activity.status && (
            <>
              <span>•</span>
              <Badge
                variant={
                  activity.status === "completed"
                    ? "default"
                    : activity.status === "failed"
                    ? "destructive"
                    : "secondary"
                }
                className="text-xs px-1.5 py-0"
              >
                {activity.status}
              </Badge>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ActivityFeed({
  activities,
  maxHeight = "400px",
  showViewAll = true,
  loading = false,
}: ActivityFeedProps) {
  const displayActivities = activities || []

  if (displayActivities.length === 0 && !loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground text-center">No recent activity</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Badge variant="secondary" className="font-mono">
            {displayActivities.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Spinner className="h-8 w-8" />
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          </div>
        ) : (
          <ScrollArea style={{ height: maxHeight }} className="px-6">
            <div className="py-2">
              {displayActivities.map((activity, index) => (
              <div key={activity.id}>
                <ActivityItemComponent activity={activity} />
                {/* Remove line after last item */}
                {index === displayActivities.length - 1 && (
                  <div className="h-4" />
                )}
              </div>
            ))}
            </div>
          </ScrollArea>
        )}
        {!loading && showViewAll && (
          <div className="p-4 border-t bg-muted/30">
            <Button variant="outline" className="w-full group" size="sm">
              <span>View All Activity</span>
              <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact Activity Feed for smaller spaces
export function CompactActivityFeed({ activities }: { activities?: ActivityItem[] }) {
  const displayActivities = (activities || []).slice(0, 5)

  if (displayActivities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">No recent activity</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayActivities.map((activity) => {
          const config = activityConfig[activity.type]
          const Icon = config.icon

          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={cn("p-1.5 rounded-md", config.bgColor)}>
                <Icon className={cn("h-3.5 w-3.5", config.color)} />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium leading-tight">{activity.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </p>
              </div>
              {activity.amount !== undefined && (
                <div className="text-xs font-semibold text-right flex-shrink-0">
                  KES {activity.amount.toLocaleString()}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
