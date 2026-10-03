"use client"

import { sizedName } from "@/lib/product-sizes"
import { useState } from "react"
import { Quote } from "@/lib/quotes"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, FileText, User, Calendar, DollarSign, Package, CheckCircle2, XCircle, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCustomerDisplayName } from "@/lib/customers"

interface ConvertQuoteWithSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quotes: Quote[]
  onConfirm: (quoteId: string) => void
  isConverting: boolean
}

export function ConvertQuoteWithSelectionDialog({ 
  open, 
  onOpenChange, 
  quotes,
  onConfirm, 
  isConverting 
}: ConvertQuoteWithSelectionDialogProps) {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState<string>("")

  const formatQuoteNumber = (quote: Quote) => {
    return quote.quote_number ? quote.quote_number : `QUO-${quote.id.substring(0, 8).toUpperCase()}`
  }

  // Filter quotes that can be converted
  const eligibleQuotes = quotes.filter(quote => 
    !quote.converted_to_order_id && 
    !quote.requires_approval && 
    quote.status !== "rejected" && 
    quote.status !== "expired"
  )

  // Further filter by search term
  const filteredQuotes = eligibleQuotes.filter(quote => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    const quoteNumber = formatQuoteNumber(quote).toLowerCase()
    const customerName = (quote.customer?.name || "").toLowerCase()
    const customerEmail = (quote.customer?.email || "").toLowerCase()
    
    return quoteNumber.includes(searchLower) || 
           customerName.includes(searchLower) ||
           customerEmail.includes(searchLower)
  })

  // Get the selected quote
  const selectedQuote = eligibleQuotes.find(q => q.id === selectedQuoteId)

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === "accepted") {
      return <Badge className="bg-green-100 text-green-800 border-green-500">Accepted</Badge>
    } else if (statusLower === "pending") {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-500">Pending</Badge>
    } else if (statusLower === "rejected") {
      return <Badge className="bg-red-100 text-red-800 border-red-500">Rejected</Badge>
    } else if (statusLower === "expired") {
      return <Badge className="bg-gray-100 text-gray-800 border-gray-500">Expired</Badge>
    }
    return <Badge>{status}</Badge>
  }

  const handleConfirm = () => {
    if (selectedQuoteId) {
      onConfirm(selectedQuoteId)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedQuoteId("") // Reset selection when closing
      setSearchTerm("") // Reset search when closing
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Convert Quote to Order
          </DialogTitle>
          <DialogDescription>
            Select a quote to convert into an order, review the details, and confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search and Select Quote */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search and Select Quote</label>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 z-10" />
              <Input
                placeholder="Search by quote number, customer name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {searchTerm 
                  ? `${filteredQuotes.length} of ${eligibleQuotes.length} quote${filteredQuotes.length !== 1 ? 's' : ''} found`
                  : `${eligibleQuotes.length} eligible quote${eligibleQuotes.length !== 1 ? 's' : ''}`
                }
              </span>
              {selectedQuote && (
                <span className="text-green-600 font-medium">
                  ✓ Quote selected
                </span>
              )}
            </div>

            {/* Quote List */}
            <div className="border rounded-lg">
              <ScrollArea className="h-[200px]">
                {filteredQuotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <XCircle className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-gray-600 font-medium">
                      {searchTerm ? "No quotes match your search" : "No eligible quotes available"}
                    </p>
                    {searchTerm && (
                      <p className="text-sm text-gray-500 mt-1">
                        Try a different search term
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredQuotes.map((quote) => (
                      <div
                        key={quote.id}
                        onClick={() => setSelectedQuoteId(quote.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border-2",
                          selectedQuoteId === quote.id
                            ? "bg-green-50 border-green-500 shadow-sm"
                            : "bg-white border-gray-200 hover:border-green-300 hover:bg-green-50/50"
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">
                              {formatQuoteNumber(quote)}
                            </span>
                            {selectedQuoteId === quote.id && (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {quote.customer ? getCustomerDisplayName(quote.customer) : "Unknown Customer"}
                          </div>
                          {quote.customer?.email && (
                            <div className="text-xs text-gray-500">
                              {quote.customer.email}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-sm font-bold text-primary">
                            {quote.currency} {Number(quote.final_amount || quote.total_amount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(quote.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Show quote details when selected */}
          {selectedQuote ? (
            <>
              <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3 flex gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 font-medium">
                  This quote is ready to be converted to an order
                </p>
              </div>

              {/* Quote Details */}
              <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide mb-3">Quote Summary</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <span className="block text-xs text-gray-500">Quote Number</span>
                      <span className="font-medium text-gray-900">{formatQuoteNumber(selectedQuote)}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <span className="block text-xs text-gray-500">Customer</span>
                      <span className="font-medium text-gray-900">{selectedQuote.customer ? getCustomerDisplayName(selectedQuote.customer) : "Unknown"}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <span className="block text-xs text-gray-500">Valid Until</span>
                      <span className="font-medium text-gray-900">
                        {new Date(selectedQuote.valid_until).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <div className="h-4 w-4 mt-0.5" />
                    <div>
                      <span className="block text-xs text-gray-500">Status</span>
                      {getStatusBadge(selectedQuote.status)}
                    </div>
                  </div>
                </div>

                {/* Items Count */}
                {selectedQuote.quote_items && selectedQuote.quote_items.length > 0 && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-gray-500" />
                      <span className="text-xs text-gray-500">Items</span>
                      <span className="font-medium text-gray-900">
                        {selectedQuote.quote_items.length} item{selectedQuote.quote_items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {selectedQuote.quote_items.map((item, index) => (
                        <div key={index} className="text-xs text-gray-600 pl-6">
                          • {item.product ? sizedName(item.product?.name, (item as any).variant?.name || (item as any).variant_name) : 'Product'} - Qty: {item.quantity} @ {selectedQuote.currency} {Number(item.unit_price).toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total Amount */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-700">Total Amount</span>
                    </div>
                    <span className="text-xl font-bold text-primary">
                      {selectedQuote.currency} {Number(selectedQuote.final_amount || selectedQuote.total_amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {selectedQuote.discount && Number(selectedQuote.discount) > 0 && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-500">Discount Applied</span>
                      <span className="text-gray-700">-{selectedQuote.currency} {Number(selectedQuote.discount).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selectedQuote.notes && (
                  <div className="pt-3 border-t">
                    <span className="block text-xs text-gray-500 mb-1">Notes</span>
                    <p className="text-sm text-gray-700 italic">{selectedQuote.notes}</p>
                  </div>
                )}
              </div>

              {/* Info message */}
              <div className="flex gap-3 rounded-lg bg-blue-50 p-3 text-sm">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-blue-900">What happens next?</p>
                  <ul className="list-disc list-inside text-blue-700 space-y-1">
                    <li>A new order will be created with these quote details</li>
                    <li>The quote will remain in the system</li>
                    <li>You can manage the order in the Orders section</li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-gray-300 rounded-lg">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">No Quote Selected</p>
              <p className="text-sm text-gray-500 mt-1">
                Please select a quote from the dropdown above
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isConverting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isConverting || !selectedQuoteId}
            className={!selectedQuoteId ? "opacity-50 cursor-not-allowed" : ""}
          >
            {isConverting ? "Converting..." : "Convert to Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
