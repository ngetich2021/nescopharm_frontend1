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
  CreditCard,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Trash2,
  CheckSquare,
  Eye,
  Upload,
  FileSpreadsheet,
  Loader2,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { getSupplierPayments, SupplierPayment, exportSupplierPayments, importSupplierPayments } from "@/lib/supplier-payments"
import { fetchImportSchema, downloadTemplate } from "@/lib/data-import"
import { ImportHistoryDialog } from "@/components/import-history-dialog"
import CreateSupplierPaymentSheet from "./create-supplier-payment-sheet"
import SupplierPaymentDetailsSheet from "./supplier-payment-details-sheet"

export function SupplierPaymentsTable() {
  const { toast } = useToast()
  const { companyId } = useAuth()
  
  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<SupplierPayment | null>(null)
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importFile, setImportFile] = useState<File | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && companyId) {
      fetchPayments()
    }
  }, [companyId])

  async function fetchPayments() {
    setIsLoading(true)
    setError(null)
    
    try {
      const data = await getSupplierPayments({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
      })
      
      setPayments(data.filter(item => item != null))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch payments'))
      if (payments.length === 0) {
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
      (statusFilter === "all" || payment.status?.toLowerCase() === statusFilter) &&
      (search === "" || 
        (payment.transaction_reference && payment.transaction_reference.toLowerCase().includes(search.toLowerCase())) ||
        (payment.supplier?.name && payment.supplier.name.toLowerCase().includes(search.toLowerCase())) ||
        (payment.purchase_order?.order_number && payment.purchase_order.order_number.toLowerCase().includes(search.toLowerCase()))
      )
  )

  const totalPages = Math.ceil(filteredPayments.length / rowsPerPage)
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const handlePaymentCreated = () => {
    fetchPayments()
    toast({
      title: "Success",
      description: "Payment recorded successfully."
    })
  }
  
  // Debounce search to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      fetchPayments()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  const handleRowClick = (payment: SupplierPayment) => {
    setSelectedPayment(payment)
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
    if (action === "export") {
      exportSupplierPayments(payments.filter((p) => selectedPayments.includes(p.id)))
    }
    setIsBulkActionOpen(false)
  }

  // Exports what the table shows (search and status filter applied), every page.
  const handleExport = () => {
    if (filteredPayments.length === 0) {
      toast({ title: "Nothing to export", description: "No payments match the current filters." })
      return
    }
    exportSupplierPayments(filteredPayments)
  }

  const handleTemplate = async () => {
    try {
      downloadTemplate(await fetchImportSchema("supplier_payments"), { fileName: "Supplier Payments Import Template.xlsx" })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to download the template", variant: "destructive" })
    }
  }

  // Preview first: nothing is saved until the user confirms.
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setIsImporting(true)
    try {
      setImportPreview(await importSupplierPayments(file, true))
      setImportFile(file)
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Could not read the file", variant: "destructive" })
    } finally {
      setIsImporting(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    try {
      const result = await importSupplierPayments(importFile, false)
      setImportPreview(null)
      setImportFile(null)
      await fetchPayments()
      window.dispatchEvent(new Event("supplier-payments-updated"))
      toast({
        title: "Payments imported",
        description: `${result.summary.created} added, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged.`,
      })
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Nothing was saved", variant: "destructive" })
    } finally {
      setIsImporting(false)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
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
  if (isLoading && payments.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-44" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"><Skeleton className="h-4 w-4" /></TableHead>
                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
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
                      Export Selected
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
              size="sm"
              onClick={() => setIsAddPaymentOpen(true)}
              className="bg-[#E30040] hover:bg-[#E30040]/90 text-white"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleTemplate}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Template
            </Button>
            <input
              type="file"
              id="import-supplier-payments-file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleImportFile}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={isImporting}
              onClick={() => document.getElementById("import-supplier-payments-file")?.click()}
            >
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import
            </Button>
            <ImportHistoryDialog kind="supplier_payments" title="Supplier Payment" />
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
                <TableHead className="font-semibold">Reference</TableHead>
                <TableHead className="font-semibold">Supplier</TableHead>
                <TableHead className="font-semibold">PO #</TableHead>
                <TableHead className="font-semibold">Amount</TableHead>
                <TableHead className="font-semibold">Method</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    No supplier payments found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPayments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className={`hover:bg-[#E30040]/5 transition-colors duration-200 cursor-pointer ${
                      selectedPayments.includes(payment.id) ? "bg-[#E30040]/10" : ""
                    }`}
                    onClick={() => handleRowClick(payment)}
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
                          aria-label={`Select ${payment.transaction_reference || 'payment'}`}
                          className="rounded-sm"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{payment.transaction_reference || "N/A"}</TableCell>
                    <TableCell>{payment.supplier?.name || "N/A"}</TableCell>
                    <TableCell>{payment.purchase_order?.order_number || "N/A"}</TableCell>
                    <TableCell>Ksh. {parseFloat(payment.amount || "0").toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{payment.payment_method?.replace("_", " ") || "N/A"}</TableCell>
                    <TableCell>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : "N/A"}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeClass(payment.status)}>{payment.status || "N/A"}</Badge>
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
                              handleRowClick(payment)
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                            <FileText className="mr-2 h-4 w-4" />
                            Download Receipt
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => e.stopPropagation()}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Payment
                          </DropdownMenuItem>
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

      {/* Create Payment Sheet */}
      <CreateSupplierPaymentSheet
        isOpen={isAddPaymentOpen}
        onOpenChange={setIsAddPaymentOpen}
        onPaymentCreated={handlePaymentCreated}
      />

      {/* Payment Details Sheet */}
      <SupplierPaymentDetailsSheet
        isOpen={isPaymentDetailsOpen}
        onOpenChange={setIsPaymentDetailsOpen}
        payment={selectedPayment}
      />

      {/* Import preview: what each row will do, before anything is saved */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[85vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-lg">
            <div className="border-b p-6">
              <h2 className="text-lg font-semibold">Import Preview - Supplier Payments</h2>
              <p className="mt-1 text-sm text-gray-600">Nothing is saved yet. Saved payments post to the books (Payables against Bank or Cash).</p>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-4 gap-3">
                {[
                  ["New payments", importPreview.summary.created, "bg-blue-50 text-blue-600"],
                  ["Updated", importPreview.summary.updated, "bg-green-50 text-green-600"],
                  ["Unchanged", importPreview.summary.unchanged, "bg-yellow-50 text-yellow-600"],
                  ["Errors", importPreview.summary.errors, "bg-red-50 text-red-600"],
                ].map(([label, value, tone]) => (
                  <div key={label as string} className={`rounded p-3 ${String(tone).split(" ")[0]}`}>
                    <div className={`text-2xl font-bold ${String(tone).split(" ")[1]}`}>{value as number}</div>
                    <div className="text-sm text-gray-600">{label as string}</div>
                  </div>
                ))}
              </div>
              {importPreview.summary.errors > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {importPreview.summary.errors} row(s) have problems and will be skipped; fix them in the sheet and import again.
                </div>
              )}
              <div className="max-h-[340px] overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                      <th>S/No.</th>
                      <th>Row</th>
                      <th>Payment No.</th>
                      <th>Supplier</th>
                      <th>Result</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(importPreview.rows ?? []).map((row: any, i: number) => (
                      <tr key={i} className="border-t align-top [&>td]:px-3 [&>td]:py-2">
                        <td className="text-gray-500">{i + 1}</td>
                        <td>{row.row}</td>
                        <td className="whitespace-nowrap">{row.key}</td>
                        <td>{row.name}</td>
                        <td>
                          <span className={`rounded px-2 py-1 text-xs ${
                            row.status === "created" ? "bg-blue-100 text-blue-800"
                              : row.status === "updated" ? "bg-green-100 text-green-800"
                              : row.status === "unchanged" ? "bg-gray-100 text-gray-800"
                              : "bg-red-100 text-red-800"
                          }`}>{row.status}</span>
                        </td>
                        <td className="text-gray-600">
                          {row.message || (row.changes ?? []).map((c: any) => `${c.field}: ${c.from ?? "-"} → ${c.to ?? "-"}`).join("; ") || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t p-6">
              <Button variant="outline" disabled={isImporting} onClick={() => { setImportPreview(null); setImportFile(null) }}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting || importPreview.summary.created + importPreview.summary.updated === 0}
                className="bg-[#E30040] text-white hover:bg-[#E30040]/90"
              >
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {importPreview.summary.created + importPreview.summary.updated} payment(s)
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
