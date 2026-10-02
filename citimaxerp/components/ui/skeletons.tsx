import { Skeleton } from "./skeleton"
import { Card, CardContent, CardHeader } from "./card"

// Dashboard Cards Skeleton
export function DashboardCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Table Skeleton
export function TableSkeleton({ 
  columns = 6, 
  rows = 5,
  showHeader = true 
}: { 
  columns?: number
  rows?: number
  showHeader?: boolean
}) {
  return (
    <div className="w-full">
      {showHeader && (
        <div className="flex items-center py-4">
          <Skeleton className="h-4 w-[250px]" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-[70px]" />
            <Skeleton className="h-8 w-[100px]" />
          </div>
        </div>
      )}
      <div className="rounded-md border">
        <div className="border-b bg-muted/50 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 border-b last:border-b-0">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, j) => (
                <Skeleton key={j} className="h-6 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// List Item Skeleton
export function ListItemSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-3 w-[150px]" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-3 w-[60px]" />
          </div>
          <Skeleton className="h-8 w-[70px]" />
        </div>
      ))}
    </div>
  )
}

// Page Header Skeleton
export function PageHeaderSkeleton() {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
      </div>
      <Skeleton className="h-10 w-[120px]" />
    </div>
  )
}

// Stats Grid Skeleton
export function StatsGridSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <div className={`grid gap-4 md:grid-cols-${columns}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
              <Skeleton className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Chart Skeleton
export function ChartSkeleton({ height = "h-[400px]" }: { height?: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-[150px]" />
          <Skeleton className="h-4 w-[100px]" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className={`w-full ${height}`} />
      </CardContent>
    </Card>
  )
}

// Form Skeleton
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-[80px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
    </div>
  )
}

// Full Page Skeleton (for dashboard-style pages)
export function FinanceDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <DashboardCardsSkeleton />
      <div className="grid gap-6 md:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton />
    </div>
  )
}

// Employee/HR List Skeleton
export function EmployeeListSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatsGridSkeleton columns={4} />
      
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
        </CardContent>
      </Card>
      
      <TableSkeleton columns={7} rows={8} showHeader={false} />
    </div>
  )
}

// Finance Table Skeleton (for journal entries, accounts, etc.)
export function FinanceTableSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      
      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-[250px]" />
              <Skeleton className="h-10 w-[150px]" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-[80px]" />
              <Skeleton className="h-10 w-[120px]" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <TableSkeleton columns={6} rows={10} showHeader={false} />
      
      {/* Pagination */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-[200px]" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-[70px]" />
          <Skeleton className="h-8 w-[70px]" />
        </div>
      </div>
    </div>
  )
}
