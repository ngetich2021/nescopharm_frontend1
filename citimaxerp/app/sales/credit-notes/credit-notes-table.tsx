"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { matchesDocNumber } from "@/lib/utils"
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
import { ExportMenu, useTableExport } from "@/components/export-menu"

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
  // Fully used against the invoice: the customer was credited, nothing was paid.
  if (value === "applied") return "Credited"
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")
}

/** A draft waiting on its 2 approvers (or rejected by one) says so; otherwise its status. */
function creditNoteStatusLabel(creditNote: CreditNote) {
  if (creditNote.status === "draft" && creditNote.approval_status === "pending") {
    const done = (creditNote.approvals || []).filter((a) => a.status === "approved").length
    return `Awaiting approval (${done} of ${(creditNote.approvals || []).length})`
  }
  if (creditNote.status === "draft" && creditNote.approval_status === "rejected") return "Rejected"
  return formatStatus(creditNote.status)
}

function creditNoteStatusClass(creditNote: CreditNote) {
  if (creditNote.status === "draft" && creditNote.approval_status === "pending") return "bg-amber-100 text-amber-800"
  if (creditNote.status === "draft" && creditNote.approval_status === "rejected") return "bg-red-100 text-red-800"
  return getCreditNoteStatusColor(creditNote.status)
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
        matchesDocNumber(creditNote.invoice?.invoice_number, searchQuery) ||
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
    const confirmText = creditNote.status === "draft"
      ? `Delete ${creditNote.credit_note_number}?`
      : `Delete ${creditNote.credit_note_number}? Its credit comes off the invoice and any stock it returned goes back out.`
    if (!window.confirm(confirmText)) {
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

  const exportCreditNotes = useTableExport(() => ({
    fileName: `credit-notes-${new Date().toISOString().split("T")[0]}`,
    title: "Credit Notes",
    headers: ["S/No", "Credit Note #", "Invoice", "Customer", "Date", "Status", "Amount", "Balance"],
    moneyColumns: [6, 7],
    rows: filteredCreditNotes.map((creditNote, i) => [
      i + 1,
      creditNote.credit_note_number,
      creditNote.invoice?.invoice_number || "",
      getCustomerDisplayName(creditNote),
      formatDate(creditNote.credit_note_date),
      creditNoteStatusLabel(creditNote),
      parseCreditNoteAmount(creditNote.total_amount),
      parseCreditNoteAmount(creditNote.balance_amount),
    ]),
    footer: [["", "", "", "", "", "Total",
      filteredCreditNotes.reduce((s, c) => s + parseCreditNoteAmount(c.total_amount), 0),
      filteredCreditNotes.reduce((s, c) => s + parseCreditNoteAmount(c.balance_amount), 0)]],
  }))

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
          <DropdownMenuItem onClick={(event) => {
            event.stopPropagation()
            router.push(`/sales/credit-notes/${creditNote.id}/document`)
          }}>
            <Download className="h-4 w-4 mr-2" />
            Credit Note (Print / Download)
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
            </>
          )}

          {/* Any credit note not on live eTIMS can be deleted (the server unwinds an issued one). */}
          {!creditNote.on_live_etims && (
            <>
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
              <SelectItem value="applied">Credited</SelectItem>
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

          <ExportMenu onExport={exportCreditNotes} disabled={filteredCreditNotes.length === 0} />

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
                    <Badge className={creditNoteStatusClass(creditNote)}>
                      {creditNoteStatusLabel(creditNote)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {/* The date chosen on the credit note, never the day it was keyed in. */}
                    <div className="text-sm">{formatDate(creditNote.credit_note_date)}</div>
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
