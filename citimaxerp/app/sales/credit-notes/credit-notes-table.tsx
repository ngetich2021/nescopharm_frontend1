"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Plus,
  Search,
  FileSpreadsheet,
  FileIcon as FilePdf,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import {
  CreditNote,
  deleteCreditNote,
  fetchCreditNotes,
  getCreditNoteStatusColor,
  parseCreditNoteAmount,
} from "@/lib/credit-notes"
import { formatCurrency, formatDate } from "@/lib/utils"

interface CreditNotesTableProps {
  initialCreditNotes?: CreditNote[]
}

function getCustomerDisplayName(creditNote: CreditNote) {
  // Show a captured business name whenever it exists, not just for
  // customer_type === "company" - individuals can fill this in too now.
  if (creditNote.customer?.business_name) {
    return creditNote.customer.business_name
  }

  return creditNote.customer?.name || "Unknown Customer"
}

function formatStatus(status?: string | null) {
  const value = status || "unknown"
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")
}

export function CreditNotesTable({ initialCreditNotes = [] }: CreditNotesTableProps) {
  const router = useRouter()
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(initialCreditNotes)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const refreshCreditNotes = useCallback(async () => {
    setIsLoading(true)
    try {
      const fetched = await fetchCreditNotes({ per_page: 1000 })
      setCreditNotes(fetched.data || [])
      toast({
        title: "Credit Notes Refreshed",
        description: "Credit notes data reloaded successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to refresh credit notes",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialCreditNotes.length === 0) {
      refreshCreditNotes()
    }
  }, [initialCreditNotes.length, refreshCreditNotes])

  useEffect(() => {
    if (initialCreditNotes.length > 0) {
      setCreditNotes(initialCreditNotes)
    }
  }, [initialCreditNotes])

  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter((creditNote) => {
      const matchesSearch =
        searchQuery === "" ||
        creditNote.credit_note_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creditNote.invoice?.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getCustomerDisplayName(creditNote).toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === "all" || creditNote.status?.toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesStatus
    })
  }, [creditNotes, searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredCreditNotes.length / rowsPerPage)
  const paginatedCreditNotes = filteredCreditNotes.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [rowsPerPage, searchQuery, statusFilter])

  const handleViewDetails = (creditNoteId: string) => {
    router.push(`/sales/credit-notes/${creditNoteId}`)
  }

  const handleEditCreditNote = (creditNoteId: string) => {
    router.push(`/sales/credit-notes/new?edit_id=${creditNoteId}`)
  }

  const handleDeleteCreditNote = async (creditNote: CreditNote) => {
    if (creditNote.status !== "draft") {
      toast({
        title: "Cannot Delete",
        description: "Only draft credit notes can be deleted.",
        variant: "destructive",
      })
      return
    }

    if (!window.confirm(`Delete ${creditNote.credit_note_number}?`)) {
      return
    }

    try {
      setIsLoading(true)
      await deleteCreditNote(creditNote.id)
      toast({
        title: "Deleted",
        description: "Credit note deleted successfully.",
      })
      await refreshCreditNotes()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete credit note",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    const headers = ["Credit Note #", "Invoice", "Customer", "Date", "Status", "Amount", "Balance"]

    const csvContent = [
      headers.join(","),
      ...filteredCreditNotes.map((creditNote) =>
        [
          creditNote.credit_note_number,
          creditNote.invoice?.invoice_number || "",
          getCustomerDisplayName(creditNote),
          formatDate(creditNote.credit_note_date),
          formatStatus(creditNote.status),
          parseCreditNoteAmount(creditNote.total_amount).toFixed(2),
          parseCreditNoteAmount(creditNote.balance_amount).toFixed(2),
        ].join(",")
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `credit_notes_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export Successful",
      description: `Exported ${filteredCreditNotes.length} credit notes to CSV`,
    })
  }

  const buildPrintHtml = () => {
    return `
      <html>
        <head>
          <title>Credit Notes</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .header { margin-bottom: 20px; }
            .header h1 { color: #111827; margin-bottom: 5px; }
            .header p { color: #666; margin-top: 0; }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 12px;
            }
            .badge-draft { border: 1px solid #6b7280; color: #374151; background-color: #f3f4f6; }
            .badge-issued { border: 1px solid #2563eb; color: #1d4ed8; background-color: #dbeafe; }
            .badge-applied { border: 1px solid #059669; color: #047857; background-color: #d1fae5; }
            .badge-refunded { border: 1px solid #7c3aed; color: #6d28d9; background-color: #ede9fe; }
            .badge-void { border: 1px solid #dc2626; color: #b91c1c; background-color: #fee2e2; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Credit Notes</h1>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Credit Note #</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCreditNotes
                .map((creditNote) => {
                  const status = (creditNote.status || "draft").toLowerCase()
                  const badgeClass = `badge-${status}`
                  return `
                    <tr>
                      <td>${creditNote.credit_note_number}</td>
                      <td>${creditNote.invoice?.invoice_number || "-"}</td>
                      <td>${getCustomerDisplayName(creditNote)}</td>
                      <td>${formatDate(creditNote.credit_note_date)}</td>
                      <td><span class="badge ${badgeClass}">${formatStatus(creditNote.status)}</span></td>
                      <td>${parseCreditNoteAmount(creditNote.total_amount).toFixed(2)}</td>
                      <td>${parseCreditNoteAmount(creditNote.balance_amount).toFixed(2)}</td>
                    </tr>
                  `
                })
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `
  }

  const printCreditNotes = () => {
    const iframe = document.createElement("iframe")
    iframe.style.position = "absolute"
    iframe.style.top = "-9999px"
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) {
      return
    }

    doc.open()
    doc.write(buildPrintHtml())
    doc.close()

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)

    toast({
      title: "Print Initiated",
      description: `Printing ${filteredCreditNotes.length} credit notes`,
    })
  }

  const exportToPDF = () => {
    toast({
      title: "Preparing PDF",
      description: "Your PDF is being generated...",
    })
    printCreditNotes()
  }

  const ActionsDropdown = ({ creditNote }: { creditNote: CreditNote }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={(event) => {
            event.stopPropagation()
            handleViewDetails(creditNote.id)
          }}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>

          {creditNote.status === "draft" && (
            <>
              <DropdownMenuItem onClick={(event) => {
                event.stopPropagation()
                handleEditCreditNote(creditNote.id)
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Credit Note
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-primary" onClick={(event) => {
                event.stopPropagation()
                handleDeleteCreditNote(creditNote)
              }}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Credit Note
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <Input
              className="pl-8 max-w-sm"
              placeholder="Search credit notes..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="border-primary text-primary hover:bg-primary/10"
            onClick={() => router.push("/sales/credit-notes/new")}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Credit Note
          </Button>

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
              <DropdownMenuItem onClick={exportToPDF}>
                <FilePdf className="mr-2 h-4 w-4" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={printCreditNotes}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshCreditNotes}
            disabled={isLoading}
            className="border-gray-800 text-gray-800 hover:bg-gray-100"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""} mr-2`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Credit Note #</TableHead>
              <TableHead className="font-semibold">Invoice #</TableHead>
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Balance</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Created On</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading credit notes...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedCreditNotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No credit notes found</p>
                    <p className="text-sm">Create your first credit note to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedCreditNotes.map((creditNote) => (
                <TableRow
                  key={creditNote.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewDetails(creditNote.id)}
                >
                  <TableCell className="font-medium text-primary">
                    {creditNote.credit_note_number}
                  </TableCell>
                  <TableCell>{creditNote.invoice?.invoice_number || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{getCustomerDisplayName(creditNote)}</span>
                      <span className="text-xs text-gray-500">{creditNote.customer?.email || "No email"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(parseCreditNoteAmount(creditNote.total_amount))}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(parseCreditNoteAmount(creditNote.balance_amount))}
                  </TableCell>
                  <TableCell>
                    <Badge className={getCreditNoteStatusColor(creditNote.status)}>
                      {formatStatus(creditNote.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(creditNote.created_at || creditNote.credit_note_date)}
                      {creditNote.created_at && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(creditNote.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                    <ActionsDropdown creditNote={creditNote} />
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
            className="border-gray-200 hover:bg-primary/10 hover:text-primary hover:border-primary"
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
            className="border-gray-200 hover:bg-primary/10 hover:text-primary hover:border-primary"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
