"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
  FileSpreadsheet,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ShoppingCart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { Quote } from "@/lib/quotes"
import { PermissionGuard } from "@/components/PermissionGuard"

interface QuotesTableProps {
  quotes: Quote[]
  loading: boolean
  onViewQuote: (quoteId: string) => void
  onEditQuote: (quoteId: string) => void
  onDeleteQuote: (quote: Quote) => void
  onConvertToOrder: (quote: Quote) => void
  onOpenConvertDialog: () => void
  search: string
  onSearchChange: (search: string) => void
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  currentPage: number
  totalPages: number
  rowsPerPage: number
  onPageChange: (page: number) => void
  onRowsPerPageChange: (rowsPerPage: number) => void
  totalItems: number
  onRefresh: () => void
  onCreateNew: () => void
  isConverting: string | null
}

export function QuotesTable({
  quotes,
  loading,
  onViewQuote,
  onEditQuote,
  onDeleteQuote,
  onConvertToOrder,
  onOpenConvertDialog,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  currentPage,
  totalPages,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  totalItems,
  onRefresh,
  onCreateNew,
  isConverting
}: QuotesTableProps) {

  const formatQuoteNumber = (quote: Quote) => {
    return quote.quote_number ? quote.quote_number : `QUO-${quote.id.substring(0, 8).toUpperCase()}`
  }

  const formatStatus = (status: string | null) => {
    const rawStatus = status || "Unknown"
    return rawStatus
      .replace(/[^\w\s]/gi, "")
      .split(/[\s_]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  }

  const exportToCSV = () => {
    const headers = ["Quote Number", "Customer", "Date", "Status", "Valid Until", "Total Amount"]
    const csvContent = [
      headers.join(","),
      ...quotes.map((quote) =>
        [
          formatQuoteNumber(quote),
          (quote.customer as any)?.business_name || quote.customer?.name || "Unknown",
          new Date(quote.created_at).toLocaleDateString(),
          formatStatus(quote.status),
          new Date(quote.valid_until).toLocaleDateString(),
          Number.parseFloat(quote.final_amount || quote.total_amount || "0").toFixed(2),
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `quotes_export_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export Successful",
      description: `Exported ${quotes.length} quotes to CSV`,
    })
  }

  // Actions dropdown component
  const ActionsDropdown = ({ quote }: { quote: Quote }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewQuote(quote.id); }}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
          {quote.status !== "accepted" && (
            <PermissionGuard permissions={["can_update_quotes", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditQuote(quote.id); }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Quote
              </DropdownMenuItem>
            </PermissionGuard>
          )}
          <PermissionGuard permissions={["can_create_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onConvertToOrder(quote); }}
              disabled={
                quote.status === "rejected" || 
                quote.status === "expired" || 
                !!quote.converted_to_order_id ||
                quote.requires_approval ||
                isConverting === quote.id
              }
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isConverting === quote.id ? "Converting..." : "Convert to Order"}
            </DropdownMenuItem>
          </PermissionGuard>
          <PermissionGuard permissions={["can_delete_quotes", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-primary"
              onClick={(e) => { e.stopPropagation(); onDeleteQuote(quote); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Quote
            </DropdownMenuItem>
          </PermissionGuard>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <Input
              className="pl-8 max-w-sm"
              placeholder="Search quotes..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex space-x-2">
          <PermissionGuard permissions={["can_create_quotes", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <Button 
              variant="outline"
              size="sm"
              className="border-primary text-primary hover:bg-primary/10"
              onClick={onCreateNew}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Quote
            </Button>
          </PermissionGuard>
          <PermissionGuard permissions={["can_create_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
            <Button 
              variant="outline"
              size="sm"
              className="border-green-600 text-green-700 hover:bg-green-50"
              onClick={onOpenConvertDialog}
              disabled={isConverting !== null}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Convert to Order
            </Button>
          </PermissionGuard>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="border-gray-800 text-gray-800 hover:bg-gray-100"
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="border-gray-800 text-gray-800 hover:bg-gray-100"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''} mr-2`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Quote #</TableHead>
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">Total Amount</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Valid Until</TableHead>
              <TableHead className="font-semibold">Created On</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading quotes...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No quotes found</p>
                    <p className="text-sm">Create your first quote to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((quote) => (
                <TableRow 
                  key={quote.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onViewQuote(quote.id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-primary">
                        {formatQuoteNumber(quote)}
                      </span>
                      {quote.submitted_by_id && (
                        <Badge variant="outline" className="w-fit bg-blue-50 text-blue-800 border-blue-400 text-[11px] font-normal">
                          From: {quote.submittedBy?.full_name || [quote.submittedBy?.first_name, quote.submittedBy?.last_name].filter(Boolean).join(" ") || "Rep"} · {new Date(quote.submitted_at || quote.created_at).toLocaleDateString()}{" "}
                          {new Date(quote.submitted_at || quote.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Needs Review
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {(quote.customer as any)?.business_name || quote.customer?.name || "Unknown Customer"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {quote.customer?.email || "No email"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {quote.currency} {" "}
                    {Number.parseFloat(quote.final_amount || quote.total_amount || "0").toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const rawStatus = quote.status || "Unknown"
                      const formattedStatus = formatStatus(rawStatus)

                      const statusLower = rawStatus.toLowerCase()
                      let badgeClass = ""

                      if (statusLower.includes("accepted")) {
                        badgeClass = "bg-green-100 text-green-800 border-green-500"
                      } else if (statusLower === "awaiting_rep_confirm") {
                        badgeClass = "bg-purple-100 text-purple-800 border-purple-500"
                      } else if (statusLower.includes("pending")) {
                        badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-500"
                      } else if (statusLower.includes("rejected")) {
                        badgeClass = "bg-red-100 text-red-800 border-red-500"
                      } else if (statusLower.includes("expired")) {
                        badgeClass = "bg-gray-100 text-gray-800 border-gray-500"
                      } else {
                        badgeClass = "bg-gray-100 text-gray-800 border-gray-500"
                      }

                      return (
                        <Badge variant="outline" className={cn(badgeClass)}>
                          {formattedStatus}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(quote.valid_until).toLocaleDateString()}
                      <div className="text-xs text-muted-foreground">
                        {new Date(quote.valid_until).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(quote.created_at).toLocaleDateString()}
                      <div className="text-xs text-muted-foreground">
                        {new Date(quote.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <ActionsDropdown quote={quote} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={rowsPerPage.toString()}
            onValueChange={(value) => {
              onRowsPerPageChange(Number(value));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={rowsPerPage} />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={pageSize.toString()}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
            className="border-gray-200 hover:bg-[primary]/10 hover:text-[primary] hover:border-[primary]"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="flex items-center justify-center text-sm font-medium">
            Page {currentPage} of {totalPages || 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages || 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="border-gray-200 hover:bg-[primary]/10 hover:text-[primary] hover:border-[primary]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default QuotesTable