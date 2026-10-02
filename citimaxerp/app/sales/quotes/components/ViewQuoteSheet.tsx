"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Edit, ShoppingCart, FileText, Calendar, User, MapPin, Phone, Mail, ArrowLeft, Send, ChevronDown, MessageCircle, Eye } from "lucide-react"
import { getCustomerDisplayName } from "@/lib/customers"
import { formatCurrency } from "@/lib/utils"
import { Quote, SalesRep, fetchQuoteSalesReps, assignQuoteSalesRep } from "@/lib/quotes"
import { PermissionGuard } from "@/components/PermissionGuard"
import { SendQuoteModal } from "@/components/modals/send-quote-modal"
import apiCall from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatPackagingForDisplay } from "@/lib/packaging-utils"

interface ViewQuoteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote | null
  onClose: () => void
  onRefresh: () => void
  onEdit: (quoteId: string) => void
  onConvertToOrder: (quote: Quote) => void
  isConverting: string | null
}

export function ViewQuoteSheet({
  open,
  onOpenChange,
  quote,
  onClose,
  onRefresh,
  onEdit,
  onConvertToOrder,
  isConverting
}: ViewQuoteSheetProps) {
  const [isSendQuoteModalOpen, setIsSendQuoteModalOpen] = useState(false)
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [salesRepId, setSalesRepId] = useState<string>("")
  const [isSavingRep, setIsSavingRep] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    fetchQuoteSalesReps().then(setSalesReps).catch(() => setSalesReps([]))
  }, [open])

  useEffect(() => {
    setSalesRepId(quote?.sales_rep_id || quote?.original_submitted_by_id || "")
  }, [quote?.id, quote?.sales_rep_id, quote?.original_submitted_by_id])

  if (!quote) return null

  const handleSalesRepChange = async (value: string) => {
    const previous = salesRepId
    const next = value === "none" ? "" : value
    setSalesRepId(next)
    setIsSavingRep(true)
    try {
      await assignQuoteSalesRep(quote.id, next || null)
      toast({ title: "Saved", description: next ? "Sales rep assigned" : "Sales rep cleared" })
      onRefresh()
    } catch (error: any) {
      setSalesRepId(previous)
      toast({ title: "Error", description: error.message || "Failed to assign sales rep", variant: "destructive" })
    } finally {
      setIsSavingRep(false)
    }
  }

  const repFullName = (rep?: { first_name: string; last_name: string } | null) =>
    rep ? `${rep.first_name} ${rep.last_name}`.trim() : ""
  const currentRepName =
    repFullName(salesReps.find((r) => r.id === salesRepId)) ||
    repFullName(quote.sales_rep) ||
    repFullName(quote.original_submitted_by)

  const handleSendEmail = () => {
    setIsSendQuoteModalOpen(true)
  }

  async function sendQuoteByEmail(email: string) {
    if (!quote) return
    try {
      await apiCall(`/quotes/${quote.id}/send`, "POST", { method: "email", email }, true)
      toast({
        title: "Success",
        description: "Quote sent successfully via email",
      })
      setIsSendQuoteModalOpen(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send quote",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleSendWhatsApp = () => {
    toast({
      title: "Coming Soon",
      description: "WhatsApp functionality will be implemented soon",
    })
  }

  const formatQuoteNumber = (quote: Quote) => {
    return quote.quote_number ? quote.quote_number : `QUO-${quote.id.substring(0, 8).toUpperCase()}`
  }

  const formatStatus = (status: string | null) => {
    const rawStatus = status || "Unknown"
    return rawStatus
      .replace(/[^\w\s]/gi, "")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  }

  const getStatusBadgeClass = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes("accepted")) {
      return "bg-green-100 text-green-800 border-green-500"
    } else if (statusLower.includes("pending")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-500"
    } else if (statusLower.includes("rejected")) {
      return "bg-red-100 text-red-800 border-red-500"
    } else if (statusLower.includes("expired")) {
      return "bg-gray-100 text-gray-800 border-gray-500"
    } else {
      return "bg-gray-100 text-gray-800 border-gray-500"
    }
  }

  const subtotal = quote.quote_items?.reduce((sum, item) => {
    return sum + (item.quantity * Number(item.unit_price))
  }, 0) || 0

  const discount = Number(quote.totals?.discount ?? quote.discount ?? 0)
  const finalAmount = Number(quote.totals?.total ?? quote.final_amount ?? 0)
  const vatTotal = (quote.totals?.vat_lines ?? []).reduce((sum, line) => sum + Number(line.amount), 0)
  const vatFactor = (item: { tax_rate?: number | string | null }) => 1 + Number(item.tax_rate || 0) / 100

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="!w-[65vw] !min-w-[65vw] !max-w-[65vw] flex flex-col h-full p-0">
        <SheetHeader className="flex-shrink-0 px-6 py-4 border-b bg-white">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5" />
              Quote Details - {formatQuoteNumber(quote)}
            </div>
            <Badge variant="outline" className={getStatusBadgeClass(quote.status)}>
              {formatStatus(quote.status)}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Quote Info and Customer Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quote Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Quote Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Quote Number:</span>
                  <span className="text-sm font-semibold">{formatQuoteNumber(quote)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Created:</span>
                  <span className="text-sm">{new Date(quote.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Valid Until:</span>
                  <span className="text-sm flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(quote.valid_until).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Currency:</span>
                  <span className="text-sm">{quote.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Payment Terms:</span>
                  <span className="text-sm font-semibold">{quote.payment_terms || "-"}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Sales Rep:</span>
                  <PermissionGuard
                    permissions={["can_update_quotes", "can_manage_system", "can_manage_company"]}
                    fallback={<span className="text-sm">{currentRepName || "-"}</span>}
                  >
                    <Select value={salesRepId || "none"} onValueChange={handleSalesRepChange} disabled={isSavingRep}>
                      <SelectTrigger id="quote-sales-rep" className="h-8 w-56">
                        <SelectValue placeholder="Select sales rep" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No rep</SelectItem>
                        {salesReps.map((rep) => (
                          <SelectItem key={rep.id} value={rep.id}>{repFullName(rep)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </PermissionGuard>
                </div>
                {quote.below_minimum_price && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Below Minimum:</span>
                    <Badge variant="outline" className="text-orange-600 border-orange-500">
                      Yes
                    </Badge>
                  </div>
                )}
                {quote.requires_approval && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Requires Approval:</span>
                    <Badge variant="outline" className="text-blue-600 border-blue-500">
                      Yes
                    </Badge>
                  </div>
                )}
                {quote.converted_to_order_id && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Converted to Order:</span>
                    <Badge variant="outline" className="text-green-600 border-green-500">
                      Yes
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Information */}
            {quote.customer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Name:</span>
                    <span className="text-sm font-semibold">{getCustomerDisplayName(quote.customer)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Customer #:</span>
                    <span className="text-sm font-semibold font-mono bg-gray-50 px-2 py-0.5 rounded">
                      {quote.customer.customer_number}
                    </span>
                  </div>
                  {quote.customer.email && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Email:</span>
                      <span className="text-sm flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {quote.customer.email}
                      </span>
                    </div>
                  )}
                  {quote.customer.phone && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Phone:</span>
                      <span className="text-sm flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {quote.customer.phone}
                      </span>
                    </div>
                  )}
                  {quote.customer.state && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Location:</span>
                      <span className="text-sm flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {quote.customer.state}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Customer Type:</span>
                    <span className="text-sm capitalize">{quote.customer.customer_type}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quote Items */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead className="min-w-[250px]">Item Description</TableHead>
                      <TableHead>Pack Size</TableHead>
                      <TableHead className="text-center">Order Qty</TableHead>
                      <TableHead className="text-center">Packaging</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-center">VAT</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quote.quote_items?.map((item) => {
                      // Determine quantity display
                      const displayQty = item.packagingUnit 
                        ? `${item.unit_quantity || item.quantity} ${item.packagingUnit.unit_abbreviation}`
                        : `${item.quantity} PCS`;
                      
                      // Get breakdown text - calculate if not provided by API
                      let breakdown = item.packaging_breakdown?.display_text || '';
                      if (!breakdown && item.product?.has_packaging && (item.product as any)?.packaging_units && item.quantity > 0) {
                        const packagingDisplay = formatPackagingForDisplay(item.quantity, (item.product as any).packaging_units);
                        breakdown = packagingDisplay.shortText;
                      }
                      
                      // Get total pieces (base quantity)
                      const totalPieces = item.base_quantity || item.quantity;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm whitespace-nowrap">{item.item_code || "-"}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-base">{item.product?.name || "Unknown Product"}</div>
                              {item.variant_id && (item as any).variant && (
                                <div className="text-sm font-medium text-blue-600 flex items-center gap-1">
                                  <span className="bg-blue-50 px-2 py-0.5 rounded">
                                    Variant: {(item as any).variant.name || (item as any).variant_name || "N/A"}
                                  </span>
                                </div>
                              )}
                              {item.product?.description && (
                                <div className="text-sm text-gray-600">{item.product.description}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{item.pack_size || "-"}</TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <div className="font-medium">{displayQty}</div>
                              {item.packagingUnit && (
                                <div className="text-xs text-gray-500">
                                  ({totalPieces} {item.product?.base_unit || 'pcs'} total)
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {breakdown ? (
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-gray-700">{breakdown}</div>
                                <div className="text-xs text-gray-500">Breakdown for fulfillment</div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">-</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="space-y-1">
                              <div>{formatCurrency(Number(item.unit_price) * vatFactor(item))}</div>
                              {item.packagingUnit && (
                                <div className="text-xs text-gray-500">per {item.packagingUnit.unit_abbreviation}</div>
                              )}
                              {/* Which named price tier this was - staff-only
                                  reference, never shown on a printed quote. */}
                              {item.price_label && (
                                <div className="text-xs text-gray-500 italic">{item.price_label}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(item.tax_rate || 0) > 0 ? (
                              <span className="inline-block border border-gray-500 px-1.5 py-0.5 text-xs font-semibold text-gray-700 whitespace-nowrap">
                                VAT {Number(item.tax_rate)}% inclusive
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 whitespace-nowrap">{item.tax_label || "-"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.quantity * Number(item.unit_price) * vatFactor(item))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Quote Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-base text-green-600">
                    <span>Discount:</span>
                    <span className="font-medium">-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base">
                  <span className="text-gray-600">VAT:</span>
                  <span className="font-medium">{formatCurrency(vatTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-xl border-t pt-3">
                  <span>Total:</span>
                  <span className="text-blue-600">{formatCurrency(finalAmount)}</span>
                </div>
                {quote.payment_terms && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Payment terms:</span>
                    <span className="font-semibold text-gray-900">{quote.payment_terms}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sticky Footer with Actions */}
        <div className="flex-shrink-0 border-t bg-white px-6 py-4 shadow-lg">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>

            <Button variant="outline" onClick={() => router.push(`/sales/quotes/${quote.id}/document`)}>
              <Eye className="h-4 w-4 mr-2" />
              View Document
            </Button>

            <PermissionGuard permissions={["can_view_quotes", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Send className="h-4 w-4 mr-2" />
                    Send
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSendEmail}>
                    <Mail className="mr-2 h-4 w-4" />
                    Send via Email
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSendWhatsApp}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Send via WhatsApp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGuard>

            <PermissionGuard permissions={["can_update_quotes", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button 
                variant="outline" 
                onClick={() => onEdit(quote.id)}
                disabled={quote.status === "accepted"}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Quote
              </Button>
            </PermissionGuard>
            <PermissionGuard permissions={["can_create_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button 
                onClick={() => onConvertToOrder(quote)}
                disabled={
                  quote.status === "rejected" || 
                  quote.status === "expired" || 
                  !!quote.converted_to_order_id ||
                  quote.requires_approval ||
                  isConverting === quote.id
                }
                className={
                  quote.converted_to_order_id || quote.requires_approval || quote.status === "rejected" || quote.status === "expired"
                    ? "opacity-50 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {quote.converted_to_order_id 
                  ? "Already Converted" 
                  : quote.requires_approval 
                  ? "Needs Approval" 
                  : isConverting === quote.id 
                  ? "Converting..." 
                  : "Convert to Order"}
              </Button>
            </PermissionGuard>
          </div>
        </div>
      </SheetContent>

      {/* Send Quote Modal */}
      <SendQuoteModal
        isOpen={isSendQuoteModalOpen}
        onClose={() => setIsSendQuoteModalOpen(false)}
        onSend={sendQuoteByEmail}
        defaultEmail={quote.customer?.email || ""}
      />
    </Sheet>
  )
}

export default ViewQuoteSheet