"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MoreHorizontal,
  Search,
  Filter,
  Download,
  Upload,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Trash2,
  CheckSquare,
  Loader2,
  Split,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PaymentDetailsSheet } from "./payment-details-sheet"
import { CreatePaymentSheet } from "./components/create-payment-sheet"
import { PaymentAllocationModal } from "@/components/modals/payment-allocation-modal"
import { Payment, getPayments } from "@/lib/payments"
import { Skeleton } from "@/components/ui/skeleton"
import { PaymentsTableSkeleton } from "./payments-table-skeleton"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency } from "@/lib/utils"

function getPaymentCustomerDisplayName(payment: Payment) {
  const customer = payment.customer
  const customerType = customer?.customer_type?.toLowerCase()
  const isBusinessCustomer = customerType === "company" || customerType === "business"

  if (isBusinessCustomer) {
    return customer?.business_name || customer?.name || "N/A"
  }

  return customer?.name || "N/A"
}

export function PaymentsTable() {
  const { toast } = useToast()
  const { companyId } = useAuth()
  
  const [payments, setPayments] = useState<Payment[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [allocationPayment, setAllocationPayment] = useState<Payment | null>(null)
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false)

  // Cache utility functions
  function getCachedPayments(): Payment[] | null {
    try {
      const cachedString = localStorage.getItem('payments_cache')
      if (!cachedString) return null
      
      const cache = JSON.parse(cachedString)
      const now = Date.now()
      
      // Cache is valid for 5 minutes
      if (now - cache.timestamp < 5 * 60 * 1000) {
        return cache.data
      }
      return null
    } catch (e) {
      return null
    }
  }
  
  function cachePayments(data: Payment[]): void {
    try {
      localStorage.setItem('payments_cache', JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (e) {
      //
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && companyId) {
      // Try to get data from cache first
      const cachedData = getCachedPayments()
      if (cachedData) {
        setPayments(cachedData)
        setIsLoading(false)
      }
      // Fetch fresh data regardless of cache status
      fetchPayments()
    }
  }, [companyId]) // Re-fetch when companyId changes

  async function fetchPayments() {
    setIsLoading(true)
    setError(null)
    
    try {
      // Add a small delay to ensure auth is loaded (helps with race conditions)
      if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Don't fetch if we don't have a company ID
      if (!companyId) {
        console.warn('PaymentsTable: No company ID available, skipping fetch');
        setIsLoading(false);
        return;
      }
      
      // Fetch payments from API using the client with company filtering
      const data = await getPayments({
        company_id: companyId,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
      })
      
      // Filter out any null or undefined entries
      const validPayments = data.filter(item => item != null)
      
      setPayments(validPayments)
      setLastRefreshTime(new Date())
      
      // Cache the data
      cachePayments(validPayments)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch payments'))
      
      // Don't clear existing data on error if we have some
      if (payments.length === 0) {
        // Only show toast if we don't already have cached data
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : 'Failed to fetch payments',
          variant: "destructive"
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Apply client-side filtering
  const filteredPayments = payments.filter(
    (payment) =>
      (statusFilter === "all" || payment.status.toLowerCase() === statusFilter) &&
      (search === "" || 
        (payment.transaction_id && payment.transaction_id.toLowerCase().includes(search.toLowerCase())) ||
        (getPaymentCustomerDisplayName(payment).toLowerCase().includes(search.toLowerCase())) ||
        (payment.customer?.business_name && payment.customer.business_name.toLowerCase().includes(search.toLowerCase())) ||
        (payment.order?.order_number && payment.order.order_number.toLowerCase().includes(search.toLowerCase()))
      )
  )

  const totalPages = Math.ceil(filteredPayments.length / rowsPerPage)
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const handlePaymentCreated = () => {
    fetchPayments()
    toast({
      title: "Success",
      description: "Payment created successfully."
    })
  }
  
  // Apply search and filter changes
  const applyFilters = () => {
    // Reset to first page when filters change
    setCurrentPage(1)
    fetchPayments()
  }
  
  // Debounce search to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilters()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  const handleRowClick = (paymentId: string) => {
    setSelectedPaymentId(paymentId)
    setIsPaymentDetailsOpen(true)
  }

  const toggleSelectPayment = (e: React.MouseEvent, paymentId: string) => {
    e.stopPropagation()
    setSelectedPayments((prev) => {
      if (prev.includes(paymentId)) {
        return prev.filter((id) => id !== paymentId)
      } else {
        return [...prev, paymentId]
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectedPayments.length === paginatedPayments.length) {
      setSelectedPayments([])
    } else {
      setSelectedPayments(paginatedPayments.map((payment) => payment.id))
    }
  }

  const handleBulkAction = (action: string) => {
    // Implement bulk actions here
    setIsBulkActionOpen(false)
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Show loading state
  if (isLoading) {
    return <PaymentsTableSkeleton />
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-8 max-w-sm"
                placeholder="Search payments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] pl-8">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex space-x-2">
            {selectedPayments.length > 0 && (
              <TooltipProvider>
                <DropdownMenu open={isBulkActionOpen} onOpenChange={setIsBulkActionOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="default" size="sm" className="bg-[#E30040] hover:bg-[#E30040]/90">
                          <CheckSquare className="mr-2 h-4 w-4" />
                          {selectedPayments.length} Selected
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Perform actions on selected payments</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleBulkAction("export")}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export Receipts
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction("status")}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Update Status
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleBulkAction("delete")}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipProvider>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddPaymentOpen(true)}
              className="border-[#E30040] text-[#E30040] hover:bg-[#E30040]/10"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Add Payment
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <div className="relative">
              <input type="file" id="import-file" className="hidden" accept=".csv" onChange={() => {}} />
              <Button onClick={() => document.getElementById("import-file")?.click()} variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </div>
          </div>
        </div>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={selectedPayments.length === paginatedPayments.length && paginatedPayments.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all payments"
                      className="rounded-sm"
                    />
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Transaction ID</TableHead>
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Order #</TableHead>
                <TableHead className="font-semibold">Amount</TableHead>
                <TableHead className="font-semibold">Method</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Show skeleton loader when loading
                Array.from({ length: rowsPerPage }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-4 mx-auto" />
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    No payments found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPayments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className={`hover:bg-[#E30040]/5 transition-colors duration-200 cursor-pointer ${
                      selectedPayments.includes(payment.id) ? "bg-[#E30040]/10" : ""
                    }`}
                    onClick={() => handleRowClick(payment.id)}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedPayments.includes(payment.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPayments([...selectedPayments, payment.id])
                            } else {
                              setSelectedPayments(selectedPayments.filter((id) => id !== payment.id))
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${payment.transaction_id || 'payment'}`}
                          className="rounded-sm"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{payment.transaction_id || "N/A"}</TableCell>
                    <TableCell>{getPaymentCustomerDisplayName(payment)}</TableCell>
                    <TableCell>{payment.order?.order_number || "N/A"}</TableCell>
                    <TableCell>{formatCurrency(payment.amount_paid || "0")}</TableCell>
                    <TableCell>{payment.payment_method || "N/A"}</TableCell>
                    <TableCell>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : new Date(payment.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeClass(payment.status)}>{payment.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRowClick(payment.id)
                            }}
                          >
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              setAllocationPayment(payment)
                              setIsAllocationModalOpen(true)
                            }}
                          >
                            <Split className="h-4 w-4 mr-2" />
                            Allocate to Invoices
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Send Receipt</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Refund Payment</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                setRowsPerPage(Number(value))
                setCurrentPage(1)
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
              onClick={() => setCurrentPage((old) => Math.max(old - 1, 1))}
              disabled={currentPage === 1}
              className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
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
              onClick={() => setCurrentPage((old) => Math.min(old + 1, totalPages || 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Details Sheet */}
      {selectedPaymentId && (
        <PaymentDetailsSheet
          paymentId={selectedPaymentId}
          isOpen={isPaymentDetailsOpen}
          onClose={() => {
            setIsPaymentDetailsOpen(false)
            setSelectedPaymentId(null)
          }}
        />
      )}

      {/* Create Payment Sheet */}
      <CreatePaymentSheet
        isOpen={isAddPaymentOpen}
        onOpenChange={setIsAddPaymentOpen}
        onPaymentCreated={handlePaymentCreated}
      />

      {/* Payment Allocation Modal */}
      {allocationPayment && (
        <PaymentAllocationModal
          payment={allocationPayment}
          isOpen={isAllocationModalOpen}
          onClose={() => {
            setIsAllocationModalOpen(false)
            setAllocationPayment(null)
          }}
          onAllocationComplete={(result) => {
            // Refresh payments data to show updated allocation status
            fetchPayments()
            setIsAllocationModalOpen(false)
            setAllocationPayment(null)
          }}
        />
      )}
    </>
  )
}
