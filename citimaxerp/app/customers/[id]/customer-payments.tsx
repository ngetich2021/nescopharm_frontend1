"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
// Removed apiCall import as data is now passed via props

// Define the Payment type based on your API response
interface Payment {
  id: string
  amount_paid: string // Changed to string as per API response
  payment_method: string | null
  status: "completed" | "pending" | "failed"
  created_at: string
  // Add other fields as needed from your actual API response
}

interface CustomerPaymentsProps {
  customerId: string
  initialPayments: Payment[] // Payments are now passed as a prop
}

export function CustomerPayments({ customerId, initialPayments }: CustomerPaymentsProps) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments) // Initialize with prop
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>(initialPayments) // Initialize with prop
  const [isLoading, setIsLoading] = useState(false) // No longer loading internally
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  // Update payments when initialPayments prop changes (e.g., when customer profile re-fetches)
  useEffect(() => {
    setPayments(initialPayments)
    setFilteredPayments(initialPayments)
    setCurrentPage(1) // Reset pagination when data changes
  }, [initialPayments])

  useEffect(() => {
    // Apply filters and search whenever payments, searchQuery, statusFilter, or methodFilter changes
    let result = [...payments]

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((payment) => payment.status === statusFilter)
    }

    // Apply method filter
    if (methodFilter !== "all") {
      result = result.filter((payment) => payment.payment_method === methodFilter)
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (payment) => payment.id.toLowerCase().includes(query) || payment.payment_method?.toLowerCase().includes(query),
      )
    }

    setFilteredPayments(result)
    setCurrentPage(1) // Reset to first page when filters change
  }, [payments, searchQuery, statusFilter, methodFilter])

  // Get unique payment methods for filter dropdown
  const paymentMethods = Array.from(new Set(payments.map((payment) => payment.payment_method))).filter(
    (method): method is string => typeof method === "string" && method.length > 0,
  )

  // Calculate pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredPayments.slice(indexOfFirstItem, indexOfLastItem)

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value))
    setCurrentPage(1) // Reset to first page when items per page changes
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="relative w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search payments..."
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="py-4 text-center text-red-500">{error}</div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-4 text-center text-gray-500">No payment history found for this customer.</div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{payment.id.slice(0, 8)}</TableCell>
                      <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{payment.payment_method}</TableCell>
                      <TableCell>KES {Number.parseFloat(payment.amount_paid).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            payment.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : payment.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination controls */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">
                  Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredPayments.length)} of{" "}
                  {filteredPayments.length} payments
                </p>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-500">per page</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    // Show first page, last page, current page, and pages around current
                    let pageToShow: number | null = null

                    if (totalPages <= 5) {
                      // If 5 or fewer pages, show all
                      pageToShow = i + 1
                    } else if (currentPage <= 3) {
                      // Near start
                      if (i < 4) {
                        pageToShow = i + 1
                      } else {
                        pageToShow = totalPages
                      }
                    } else {
                      // Middle
                      if (i === 0) {
                        pageToShow = 1
                      } else if (i === 4) {
                        pageToShow = totalPages
                      } else {
                        pageToShow = currentPage - 1 + i
                      }
                    }

                    // Show ellipsis instead of page number
                    if ((i === 1 && pageToShow !== 2) || (i === 3 && pageToShow !== totalPages - 1)) {
                      return (
                        <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-sm">
                          ...
                        </span>
                      )
                    }

                    return (
                      <Button
                        key={pageToShow}
                        variant={currentPage === pageToShow ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePageChange(pageToShow!)}
                      >
                        {pageToShow}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
