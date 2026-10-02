import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function SerialNumberTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Serial Number</TableHead>
            <TableHead>Product ID</TableHead>
            <TableHead>Batch ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
              </TableCell>
              <TableCell>
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              </TableCell>
              <TableCell>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              </TableCell>
              <TableCell className="text-right">
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}