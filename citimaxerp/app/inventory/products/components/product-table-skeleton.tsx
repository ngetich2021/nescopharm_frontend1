"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export function ProductTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Table Controls Skeleton */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Skeleton className="h-10 w-full sm:w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold w-12"><Skeleton className="h-4 w-full" /></TableHead>
              <TableHead className="font-semibold"><Skeleton className="h-4 w-full" /></TableHead>
              <TableHead className="font-semibold"><Skeleton className="h-4 w-full" /></TableHead>
              <TableHead className="font-semibold"><Skeleton className="h-4 w-full" /></TableHead>
              <TableHead className="font-semibold"><Skeleton className="h-4 w-full" /></TableHead>
              <TableHead className="font-semibold"><Skeleton className="h-4 w-full" /></TableHead>
              <TableHead className="font-semibold"><Skeleton className="h-4 w-full" /></TableHead>
              <TableHead className="font-semibold"><Skeleton className="h-4 w-full" /></TableHead>
              <TableHead className="font-semibold"><Skeleton className="h-4 w-full" /></TableHead>
              <TableHead className="text-right font-semibold w-20"><Skeleton className="h-4 w-full" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-20 text-center" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  )
}