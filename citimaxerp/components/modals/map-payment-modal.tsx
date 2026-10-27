"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { mapPaymentToInvoice, MapPaymentRequest, PaymentMappingResponse } from "@/lib/invoices"
import { fetchCustomerAccountBalance, type AccountUnappliedPayment } from "@/lib/customer-balance"
import { Loader2, CreditCard, Calendar, Search, X } from "lucide-react"

interface MapPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceId: string
  invoiceNumber: string
  balanceAmount: number
  customerId: string
  onPaymentMapped?: (result: PaymentMappingResponse) => void
}

export function MapPaymentModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  balanceAmount,
  customerId,
  onPaymentMapped
}: MapPaymentModalProps) {
  const [allPayments, setAllPayments] = useState<AccountUnappliedPayment[]>([])
  const [selectedPaymentId, setSelectedPaymentId] = useState("")
  const [applyAmount, setApplyAmount] = useState<number>(0)
  const [maxApplyAmount, setMaxApplyAmount] = useState<number>(0)
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (isOpen && customerId) {
      loadAvailablePayments()
    }
  }, [isOpen, customerId])

  // Only this customer's receipts that still have money not yet on an invoice.
  const loadAvailablePayments = async () => {
    setIsLoadingPayments(true)
    try {
      const account = await fetchCustomerAccountBalance(customerId)
      setAllPayments(account.unapplied_payments || [])
    } catch (error: any) {
      console.error('Failed to load payments:', error)
      toast({
        title: "Error",
        description: "Failed to load available payments",
        variant: "destructive",
      })
      setAllPayments([])
    } finally {
      setIsLoadingPayments(false)
    }
  }

  const displayedPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allPayments
    return allPayments.filter((p) =>
      (p.reference || "").toLowerCase().includes(q) ||
      (p.payment_method || "").toLowerCase().includes(q) ||
      (p.order_number || "").toLowerCase().includes(q) ||
      String(p.available).includes(q) ||
      String(p.amount_paid).includes(q)
    )
  }, [allPayments, searchQuery])

  useEffect(() => {
    const selectedPayment = allPayments.find(p => p.id === selectedPaymentId)
    if (selectedPayment) {
      const maxAmount = Math.min(selectedPayment.available, balanceAmount)
      setMaxApplyAmount(maxAmount)
      setApplyAmount(maxAmount)
    } else {
      setMaxApplyAmount(0)
      setApplyAmount(0)
    }
  }, [selectedPaymentId, allPayments, balanceAmount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedPaymentId) {
      toast({
        title: "Error",
        description: "Please select a payment to map",
        variant: "destructive",
      })
      return
    }

    if (applyAmount <= 0) {
      toast({
        title: "Error",
        description: "Apply amount must be greater than zero",
        variant: "destructive",
      })
      return
    }

    if (applyAmount > maxApplyAmount) {
      toast({
        title: "Error",
        description: `Apply amount cannot exceed ${maxApplyAmount.toFixed(2)}`,
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const mappingRequest: MapPaymentRequest = {
        payment_id: selectedPaymentId,
        apply_amount: applyAmount
      }

      const result = await mapPaymentToInvoice(invoiceId, mappingRequest)

      toast({
        title: "Success",
        description: "Payment mapped to invoice successfully",
      })

      onPaymentMapped?.(result)
      onClose()

      // Reset form
      setSelectedPaymentId("")
      setApplyAmount(0)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to map payment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      // Reset search when closing
      setSearchQuery("")
      setSelectedPaymentId("")
      setApplyAmount(0)
      onClose()
    }
  }

  const clearSearch = () => {
    setSearchQuery("")
  }

  const formatCurrency = (amount: string | number) => {
    return `KES ${parseFloat(amount.toString()).toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getPaymentMethodLabel = (method: string | null) => {
    const methods: Record<string, string> = {
      cash: "Cash",
      mpesa: "M-Pesa Paybill",
      bank_transfer: "Bank Transfer",
      cheque: "Cheque",
      credit_card: "Credit Card",
      debit_card: "Debit Card",
      check: "Cheque",
      mobile_money: "Mobile Money",
      other: "Other"
    }
    return method ? methods[method] || method : "-"
  }

  const selectedPayment = allPayments.find(p => p.id === selectedPaymentId)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Map Existing Payment</DialogTitle>
          <div className="text-sm text-muted-foreground">
            Invoice #{invoiceNumber} • Balance: {formatCurrency(balanceAmount)}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="search_payments">Search Payments</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search_payments"
                type="text"
                placeholder="Search by reference, amount, method or order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-8 p-0"
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_select">Select Payment *</Label>
            {isLoadingPayments ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Loading payments...</span>
              </div>
            ) : (
              <Select
                value={selectedPaymentId}
                onValueChange={setSelectedPaymentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an available payment" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {displayedPayments.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      <div className="font-medium mb-1">
                        {searchQuery ? "No payments found" : "No unused money from this customer"}
                      </div>
                      <div className="text-xs">
                        {searchQuery
                          ? "Try adjusting your search criteria"
                          : "Only this customer's payments with money not yet on an invoice can be mapped"
                        }
                      </div>
                    </div>
                  ) : (
                    displayedPayments.map((payment) => (
                      <SelectItem key={payment.id} value={payment.id}>
                        <div className="flex items-start gap-2 w-full">
                          <CreditCard className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">
                                {formatCurrency(payment.available)} available
                              </span>
                              <span className="text-muted-foreground text-sm">
                                {getPaymentMethodLabel(payment.payment_method)}
                              </span>
                            </div>

                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <div className="flex items-center gap-3">
                                {payment.reference && (
                                  <span>
                                    <span className="font-medium">Ref:</span> {payment.reference}
                                  </span>
                                )}
                                {payment.payment_date && (
                                  <span>
                                    <Calendar className="h-3 w-3 inline mr-1" />
                                    {formatDate(payment.payment_date)}
                                  </span>
                                )}
                              </div>
                              {payment.available < payment.amount_paid && (
                                <div>
                                  Received {formatCurrency(payment.amount_paid)}, {formatCurrency(payment.allocated)} already used
                                </div>
                              )}
                              {payment.order_number && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">Order:</span>
                                  <span>#{payment.order_number}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedPayment && (
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <div className="text-sm font-medium">Selected Payment Details</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Received:</span>
                  <span className="ml-1 font-medium">
                    {formatCurrency(selectedPayment.amount_paid)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Available:</span>
                  <span className="ml-1 font-medium">
                    {formatCurrency(selectedPayment.available)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Method:</span>
                  <span className="ml-1">{getPaymentMethodLabel(selectedPayment.payment_method)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <span className="ml-1">
                    {selectedPayment.payment_date ? formatDate(selectedPayment.payment_date) : 'N/A'}
                  </span>
                </div>
                {selectedPayment.reference && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Reference:</span>
                    <span className="ml-1">{selectedPayment.reference}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedPaymentId && (
            <div className="space-y-2">
              <Label htmlFor="apply_amount">Amount to Apply *</Label>
              <Input
                id="apply_amount"
                type="number"
                step="0.01"
                min="0.01"
                max={maxApplyAmount}
                value={applyAmount}
                onChange={(e) => setApplyAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
              />
              <div className="text-xs text-muted-foreground">
                Maximum: {formatCurrency(maxApplyAmount)}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedPaymentId || displayedPayments.length === 0}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Map Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
