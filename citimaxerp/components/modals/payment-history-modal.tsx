"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/use-toast"
import { fetchInvoicePaymentHistory, PaymentHistoryResponse, InvoicePayment } from "@/lib/invoices"
import { RefundPaymentModal } from "@/components/modals/refund-payment-modal"
import { Loader2, CreditCard, Calendar, Hash, FileText, Undo2 } from "lucide-react"

interface PaymentHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceId: string
  invoiceNumber: string
}

export function PaymentHistoryModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber
}: PaymentHistoryModalProps) {
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [refundingPayment, setRefundingPayment] = useState<InvoicePayment | null>(null)

  useEffect(() => {
    if (isOpen && invoiceId) {
      loadPaymentHistory()
    }
  }, [isOpen, invoiceId])

  const loadPaymentHistory = async () => {
    setIsLoading(true)
    try {
      const history = await fetchInvoicePaymentHistory(invoiceId)
      // Ensure payments array exists even if API doesn't return it
      if (history && !history.payments) {
        history.payments = []
      }
      setPaymentHistory(history)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load payment history",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      cash: "Cash",
      bank_transfer: "Bank Transfer",
      credit_card: "Credit Card",
      debit_card: "Debit Card",
      check: "Check",
      mobile_money: "Mobile Money",
      other: "Other"
    }
    return methods[method] || method
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // A cheque is only truly paid once it has matured and cleared (approved); until then it
  // hasn't touched the invoice balance at all, however old the maturity date is.
  const getChequeStatusLabel = (chequeStatus?: string | null) => {
    switch (chequeStatus) {
      case 'approved':
        return 'Paid'
      case 'bounced':
        return 'Bounced'
      case 'cancelled':
        return 'Cancelled'
      default:
        return 'Pending'
    }
  }

  const getChequeStatusColor = (chequeStatus?: string | null) => {
    switch (chequeStatus) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'bounced':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Payment History</DialogTitle>
          <div className="text-sm text-muted-foreground">
            Invoice #{invoiceNumber}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading payment history...</span>
          </div>
        ) : paymentHistory ? (
          <div className="space-y-4">
            {/* Invoice Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Amount</div>
                  <div className="font-medium">{formatCurrency(paymentHistory.total_amount)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Amount Paid</div>
                  <div className="font-medium text-green-600">
                    {formatCurrency(paymentHistory.amount_paid)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Balance Due</div>
                  <div className={`font-medium ${
                    parseFloat(paymentHistory.balance_amount.toString()) > 0 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {formatCurrency(paymentHistory.balance_amount)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Payments</div>
                  <div className="font-medium">{paymentHistory.payment_count}</div>
                </div>
              </div>
            </div>

            {/* Payment List */}
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">
                  Payment Records ({paymentHistory.payments?.length || 0})
                </div>
                
                {!paymentHistory.payments || paymentHistory.payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No payments found for this invoice
                  </div>
                ) : (
                  (paymentHistory.payments || []).map((payment) => (
                    <div key={payment.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {getPaymentMethodLabel(payment.payment_method)}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                payment.is_cheque
                                  ? getChequeStatusColor(payment.cheque_status)
                                  : getPaymentStatusColor(payment.status)
                              }`}
                            >
                              {payment.is_cheque
                                ? getChequeStatusLabel(payment.cheque_status)
                                : payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {payment.is_cheque && payment.cheque_status !== 'approved' ? 'Issued' : 'Paid'}:{' '}
                                {formatDate(payment.payment_date)}
                              </span>
                            </div>
                            {payment.is_cheque && payment.maturity_date && payment.cheque_status === 'pending' && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Matures: {formatDate(payment.maturity_date)}</span>
                              </div>
                            )}
                            {payment.transaction_id && (
                              <div className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                <span>{payment.transaction_id}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {formatCurrency(payment.amount_applied)}
                          </div>
                          {parseFloat(payment.amount_paid.toString()) !== parseFloat(payment.amount_applied.toString()) && (
                            <div className="text-xs text-muted-foreground">
                              of {formatCurrency(payment.amount_paid)} paid
                            </div>
                          )}
                        </div>
                      </div>

                      {(!payment.is_cheque || payment.cheque_status === 'approved') && (
                        <div className="text-xs text-muted-foreground">
                          Applied: {formatDateTime(payment.applied_date)}
                        </div>
                      )}

                      {payment.available_to_refund > 0 && (
                        <div className="flex items-center justify-between rounded-md bg-amber-50 border border-amber-200 p-2">
                          <span className="text-xs text-amber-800">
                            {formatCurrency(payment.available_to_refund)} overpaid on this payment, unused by any invoice
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setRefundingPayment(payment)}
                          >
                            <Undo2 className="h-3 w-3 mr-1" />
                            Refund
                          </Button>
                        </div>
                      )}

                      {payment.order_id && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span>Linked to Order: {payment.order_id}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Failed to load payment history
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>

      {refundingPayment && (
        <RefundPaymentModal
          isOpen={!!refundingPayment}
          onClose={() => setRefundingPayment(null)}
          paymentId={refundingPayment.id}
          availableAmount={refundingPayment.available_to_refund}
          onRefunded={loadPaymentHistory}
        />
      )}
    </Dialog>
  )
}
