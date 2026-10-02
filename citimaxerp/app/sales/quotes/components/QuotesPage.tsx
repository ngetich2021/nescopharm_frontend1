"use client";

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { QuotesSummary } from "./QuotesSummary"
import { QuotesTable } from "./QuotesTable"
import { CreateQuoteSheet } from "./CreateQuoteSheet"
import { EditQuoteSheet } from "./EditQuoteSheet"
import { ViewQuoteSheet } from "./ViewQuoteSheet"
import { ConvertQuoteDialog } from "./ConvertQuoteDialog"
import { ConvertQuoteWithSelectionDialog } from "./ConvertQuoteWithSelectionDialog"
import { fetchQuotes, getQuoteById, deleteQuote, convertQuoteToOrder, Quote } from "@/lib/quotes"
import { PermissionGuard } from "@/components/PermissionGuard"

export function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editQuote, setEditQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [isConverting, setIsConverting] = useState<string | null>(null)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [convertWithSelectionDialogOpen, setConvertWithSelectionDialogOpen] = useState(false)
  const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null)
  const { toast } = useToast()

  const fetchQuotesData = async () => {
    setLoading(true)
    try {
      const quotesData = await fetchQuotes()
      setQuotes(quotesData)
    } catch (error: any) {
      console.error('Error fetching quotes:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to fetch quotes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotesData()
  }, [])

  // Filter quotes client-side
  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = search === "" ||
      (quote.quote_number && quote.quote_number.toLowerCase().includes(search.toLowerCase())) ||
      (quote.customer?.name && quote.customer.name.toLowerCase().includes(search.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || quote.status.toLowerCase() === statusFilter.toLowerCase()
    
    return matchesSearch && matchesStatus
  })

  // Pagination
  const totalItems = filteredQuotes.length
  const totalPages = Math.ceil(totalItems / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedQuotes = filteredQuotes.slice(startIndex, endIndex)

  // Reset to first page when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

  const handleViewQuote = async (quoteId: string) => {
    try {
      const quoteDetail = await getQuoteById(quoteId)
      if (quoteDetail) {
        setSelectedQuote(quoteDetail)
        setViewModalOpen(true)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch quote details",
        variant: "destructive",
      })
    }
  }

  const handleEditQuote = async (quoteId: string) => {
    try {
      const quoteDetail = await getQuoteById(quoteId)
      if (quoteDetail) {
        setEditQuote(quoteDetail)
        setEditSheetOpen(true)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch quote details",
        variant: "destructive",
      })
    }
  }

  const handleDeleteQuote = async (quote: Quote) => {
    if (!confirm(`Are you sure you want to delete quote ${quote.quote_number}?`)) {
      return
    }

    try {
      await deleteQuote(quote.id)
      await fetchQuotesData()
      toast({
        title: "Success",
        description: `Quote ${quote.quote_number} has been deleted successfully.`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete quote",
        variant: "destructive",
      })
    }
  }

  const handleConvertToOrder = (quote: Quote) => {
    setQuoteToConvert(quote)
    setConvertDialogOpen(true)
  }

  const handleOpenConvertWithSelectionDialog = () => {
    setConvertWithSelectionDialogOpen(true)
  }

  const handleConfirmConvertFromSelection = async (quoteId: string) => {
    try {
      setIsConverting(quoteId)
      const order = await convertQuoteToOrder(quoteId)
      toast({
        title: "Success",
        description: `Quote has been converted to order successfully.`,
      })
      setConvertWithSelectionDialogOpen(false)
      await fetchQuotesData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to convert quote to order",
        variant: "destructive",
      })
    } finally {
      setIsConverting(null)
    }
  }

  const handleConfirmConvert = async () => {
    if (!quoteToConvert) return

    try {
      setIsConverting(quoteToConvert.id)
      const order = await convertQuoteToOrder(quoteToConvert.id)
      toast({
        title: "Success",
        description: `Quote ${quoteToConvert.quote_number} has been converted to order successfully.`,
      })
      setConvertDialogOpen(false)
      setQuoteToConvert(null)
      await fetchQuotesData()
      // You could navigate to the order here if needed
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to convert quote to order",
        variant: "destructive",
      })
    } finally {
      setIsConverting(null)
    }
  }

  const handleCreateSuccess = () => {
    setCreateSheetOpen(false)
    fetchQuotesData()
    toast({
      title: "Success",
      description: "Quote created successfully.",
    })
  }

  const handleEditSuccess = () => {
    setEditSheetOpen(false)
    setEditQuote(null)
    fetchQuotesData()
    toast({
      title: "Success",
      description: "Quote updated successfully.",
    })
  }

  const handleRefresh = () => {
    fetchQuotesData()
  }

  return (
    <PermissionGuard permissions={["can_view_quotes_menu", "can_view_quotes", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">Create and manage quotes for your customers</p>
        </div>

        <QuotesSummary quotes={quotes} loading={loading} />
        
        <QuotesTable
          quotes={paginatedQuotes}
          loading={loading}
          onViewQuote={handleViewQuote}
          onEditQuote={handleEditQuote}
          onDeleteQuote={handleDeleteQuote}
          onConvertToOrder={handleConvertToOrder}
          onOpenConvertDialog={handleOpenConvertWithSelectionDialog}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          totalItems={filteredQuotes.length}
          onRefresh={handleRefresh}
          onCreateNew={() => setCreateSheetOpen(true)}
          isConverting={isConverting}
        />

        {/* View Quote Sheet */}
        <ViewQuoteSheet 
          open={viewModalOpen} 
          onOpenChange={setViewModalOpen} 
          quote={selectedQuote} 
          onClose={() => {
            setViewModalOpen(false)
            setSelectedQuote(null)
          }}
          onRefresh={handleRefresh}
          onEdit={(quoteId: string) => {
            setViewModalOpen(false)
            handleEditQuote(quoteId)
          }}
          onConvertToOrder={handleConvertToOrder}
          isConverting={isConverting}
        />

        {/* Create Quote Sheet */}
        <CreateQuoteSheet
          open={createSheetOpen}
          onClose={() => setCreateSheetOpen(false)}
          onSuccess={handleCreateSuccess}
        />

        {/* Edit Quote Sheet */}
        <EditQuoteSheet
          open={editSheetOpen}
          onClose={() => {
            setEditSheetOpen(false)
            setEditQuote(null)
          }}
          quote={editQuote}
          onSuccess={handleEditSuccess}
        />

        {/* Convert Quote Dialog (from actions column) */}
        <ConvertQuoteDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          quote={quoteToConvert}
          onConfirm={handleConfirmConvert}
          isConverting={isConverting !== null}
        />

        {/* Convert Quote with Selection Dialog (from action bar button) */}
        <ConvertQuoteWithSelectionDialog
          open={convertWithSelectionDialogOpen}
          onOpenChange={setConvertWithSelectionDialogOpen}
          quotes={quotes}
          onConfirm={handleConfirmConvertFromSelection}
          isConverting={isConverting !== null}
        />
      </div>
    </PermissionGuard>
  )
}