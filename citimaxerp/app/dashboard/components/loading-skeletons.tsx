"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

export function EnhancedMetricCardSkeleton() {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted/30 animate-pulse" />
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <div className="mb-3">
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-6 w-20 rounded-md" />
      </CardContent>
    </Card>
  )
}

export function MiniMetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-8 w-8" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-3/4" />
          <Skeleton className="h-2 w-5/6" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ActivityFeedSkeleton() {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-8" />
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function DetailedMetricCardSkeleton() {
  return (
    <Card className="p-6 animate-pulse">
      <Skeleton className="h-5 w-32 mb-3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </Card>
  )
}

export function QuickActionCardSkeleton() {
  return (
    <Card className="relative overflow-hidden animate-pulse">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-5 w-8 rounded" />
        </div>
        <Skeleton className="h-5 w-24 mb-2" />
        <Skeleton className="h-4 w-full mb-4" />
        <Skeleton className="h-4 w-20" />
      </CardContent>
    </Card>
  )
}

// Centralized loading component
export function DashboardLoadingState() {
  return (
    <div className="container mx-auto py-4 px-4 sm:py-6 sm:px-6 space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <EnhancedMetricCardSkeleton />
        <EnhancedMetricCardSkeleton />
        <EnhancedMetricCardSkeleton />
        <EnhancedMetricCardSkeleton />
      </div>

      {/* Mini Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MiniMetricCardSkeleton />
        <MiniMetricCardSkeleton />
        <MiniMetricCardSkeleton />
        <MiniMetricCardSkeleton />
        <MiniMetricCardSkeleton />
        <MiniMetricCardSkeleton />
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <DetailedMetricCardSkeleton />
        <DetailedMetricCardSkeleton />
        <DetailedMetricCardSkeleton />
        <DetailedMetricCardSkeleton />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCardSkeleton />
        </div>
        <div className="lg:col-span-1">
          <ActivityFeedSkeleton />
        </div>
      </div>

      {/* Loading Spinner Center */}
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-3">
          <Spinner className="h-12 w-12 mx-auto" />
          <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    </div>
  )
}
