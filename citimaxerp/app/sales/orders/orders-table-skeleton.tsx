import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function OrdersTableSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <Skeleton className="h-4 w-32" />
              </CardTitle>
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="text-xs text-muted-foreground">
                <Skeleton className="h-3 w-40 mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-auto">
            <Skeleton className="h-10 w-full md:w-64" /> {/* Search */}
          </div>
          <div className="relative w-full md:w-auto">
            <Skeleton className="h-10 w-full md:w-[130px]" /> {/* Status filter */}
          </div>
          <Skeleton className="h-10 w-24" /> {/* Export button */}
        </div>
        <div className="flex space-x-2 flex-wrap items-center">
          <Skeleton className="h-10 w-32" /> {/* New Order button */}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-32" />
              </TableHead>
              <TableHead className="text-right">
                <Skeleton className="h-4 w-24 ml-auto" />
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-4 w-4" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-20 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-32" /> {/* Rows per page */}
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-24" /> {/* Previous button */}
          <Skeleton className="h-8 w-16" /> {/* Page indicator */}
          <Skeleton className="h-8 w-24" /> {/* Next button */}
        </div>
      </div>
    </div>
  )
}
