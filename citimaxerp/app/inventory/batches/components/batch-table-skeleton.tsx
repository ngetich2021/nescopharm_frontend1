import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function BatchTableSkeleton() {
  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold">Batch Number</TableHead>
            <TableHead className="font-semibold">Product ID</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Quantity</TableHead>
            <TableHead className="font-semibold">Available</TableHead>
            <TableHead className="font-semibold">Expiry Date</TableHead>
            <TableHead className="text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
              </TableCell>
              <TableCell>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
              </TableCell>
              <TableCell>
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
              </TableCell>
              <TableCell>
                <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
              </TableCell>
              <TableCell>
                <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
              </TableCell>
              <TableCell>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
              </TableCell>
              <TableCell className="text-right">
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse ml-auto"></div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}