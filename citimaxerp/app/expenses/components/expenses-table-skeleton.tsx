import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export function ExpensesTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search and Filters Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-auto">
            <Skeleton className="h-10 w-full md:w-64" /> {/* Search */}
          </div>
          <div className="relative w-full md:w-auto">
            <Skeleton className="h-10 w-full md:w-[180px]" /> {/* Status filter */}
          </div>
        </div>
        <div className="flex space-x-2 flex-wrap items-center">
          <Skeleton className="h-10 w-24" /> {/* First button */}
          <Skeleton className="h-10 w-24" /> {/* Second button */}
          <Skeleton className="h-10 w-24" /> {/* Third button */}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableHead>
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
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell className="text-right">
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