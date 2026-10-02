"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowLeft, CalendarIcon, CreditCard, Eye, FileText, Loader2, MessageCircle, Printer, Receipt, Split } from "lucide-react"
import { getPaymentById, Payment } from "@/lib/payments"
import { PaymentAllocationModal } from "@/components/modals/payment-allocation-modal"
import { formatCurrency, formatDate, toSentenceCase } from "@/lib/utils"

interface PaymentDetailsSheetProps {
  paymentId: string
  isOpen: boolean
  onClose: () => void
}

function getStatusBadgeClass(status: string) {
  if (!status) return "bg-slate-100 text-slate-700 border-slate-200"

  switch (status.toLowerCase()) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "failed":
      return "bg-rose-50 text-rose-700 border-rose-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function getPaymentCustomerDisplayName(payment: Payment | null) {
  const customer = payment?.customer ?? payment?.customers
  const customerType = customer?.customer_type?.toLowerCase()
  const isBusinessCustomer = customerType === "company" || customerType === "business"

  if (isBusinessCustomer) {
    return customer?.business_name || customer?.name || "N/A"
  }

  return customer?.name || "N/A"
}

function getPaymentOrder(payment: Payment | null) {
  return payment?.order ?? payment?.orders ?? null
}

function formatOptionalDate(value?: string | null) {
  return value ? formatDate(value) : "N/A"
}

function formatMetaLabel(value?: string | null) {
  return value ? toSentenceCase(value) : "N/A"
}

export function PaymentDetailsSheet({ paymentId, isOpen, onClose }: PaymentDetailsSheetProps) {
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [showAllocation, setShowAllocation] = useState(false)

  useEffect(() => {
    if (isOpen && paymentId) {
      fetchPaymentDetails()
    }
  }, [isOpen, paymentId])

  async function fetchPaymentDetails() {
    setLoading(true)
    setError(null)

    try {
      const paymentData = await getPaymentById(paymentId)
      setPayment(paymentData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch payment details"))
    } finally {
      setLoading(false)
    }
  }

  const customer = payment?.customer ?? payment?.customers
  const order = getPaymentOrder(payment)
  const customerDisplayName = getPaymentCustomerDisplayName(payment)
  const normalizedAmount = formatCurrency(payment?.amount_paid || "0")
  const normalizedOrderAmount = order?.total_amount ? formatCurrency(order.total_amount) : "N/A"
  const outstandingOrderAmount =
    order?.final_amount && payment?.amount_paid
      ? formatCurrency(Math.max(Number(order.final_amount) - Number(payment.amount_paid), 0))
      : null

  const generateReceiptText = () => {
    if (!payment) return ""

    return [
      "PAYMENT RECEIPT",
      "------------------------------",
      `Receipt #: ${payment.id}`,
      `Date: ${formatOptionalDate(payment.payment_date || payment.created_at)}`,
      `Amount: ${normalizedAmount}`,
      `Status: ${formatMetaLabel(payment.status)}`,
      `Method: ${formatMetaLabel(payment.payment_method)}`,
      `Customer: ${customerDisplayName}`,
      customer?.phone ? `Phone: ${customer.phone}` : null,
      customer?.email ? `Email: ${customer.email}` : null,
      order?.order_number ? `Order: ${order.order_number}` : null,
      payment.transaction_id ? `Transaction ID: ${payment.transaction_id}` : null,
      payment.gateway_reference ? `Reference: ${payment.gateway_reference}` : null,
      "------------------------------",
      "Thank you for your payment.",
    ]
      .filter(Boolean)
      .join("\n")
  }

  const generateReceiptHTML = () => {
    if (!payment) return ""

    return `
      <div style="max-width: 460px; margin: 0 auto; font-family: Arial, sans-serif; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="padding: 24px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff;">
          <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.8;">Citimax Receipt</div>
          <h2 style="margin: 10px 0 6px; font-size: 28px;">${normalizedAmount}</h2>
          <div style="display: inline-block; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.12); font-size: 12px;">
            ${formatMetaLabel(payment.status)}
          </div>
        </div>
        <div style="padding: 24px;">
          <div style="margin-bottom: 18px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Customer</div>
            <div style="font-size: 18px; font-weight: 700; margin-top: 6px;">${customerDisplayName}</div>
            ${customer?.phone ? `<div style="margin-top: 6px;">${customer.phone}</div>` : ""}
            ${customer?.email ? `<div style="margin-top: 4px;">${customer.email}</div>` : ""}
          </div>
          <div style="display: grid; gap: 12px; margin-bottom: 18px;">
            <div><strong>Receipt #:</strong> ${payment.id}</div>
            <div><strong>Date:</strong> ${formatOptionalDate(payment.payment_date || payment.created_at)}</div>
            <div><strong>Payment method:</strong> ${formatMetaLabel(payment.payment_method)}</div>
            <div><strong>Transaction ID:</strong> ${payment.transaction_id || "N/A"}</div>
            <div><strong>Reference:</strong> ${payment.gateway_reference || "N/A"}</div>
            <div><strong>Order:</strong> ${order?.order_number || "N/A"}</div>
          </div>
          <div style="padding-top: 18px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            Thank you for your payment.
          </div>
        </div>
      </div>
    `
  }

  const handlePrintReceipt = () => {
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Receipt</title></head><body>${generateReceiptHTML()}</body></html>`)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }
  }

  const handleSendWhatsApp = async () => {
    if (!customer?.phone) return

    setSendingWhatsApp(true)
    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: customer.phone,
          message: generateReceiptText(),
        }),
      })
    } finally {
      setSendingWhatsApp(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="mb-6 space-y-3">
          <SheetTitle className="flex items-center text-xl">
            <Button variant="ghost" size="icon" className="mr-2" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Receipt Details
          </SheetTitle>
          <SheetDescription>Review payment information, customer context, and receipt actions in one place.</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-[#E30040]" />
            <p>Loading payment details...</p>
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center text-red-500">
            <p>Error loading payment details.</p>
            <p className="text-sm">{error.message}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchPaymentDetails()}>
              Try Again
            </Button>
          </div>
        ) : payment ? (
          <div className="space-y-6 pb-8">
            <Card className="overflow-hidden border-slate-200">
              <CardContent className="p-0">
                <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#334155_100%)] px-6 py-6 text-white">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/80">
                        <Receipt className="h-3.5 w-3.5" />
                        Payment Receipt
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Received from</p>
                        <h2 className="text-2xl font-semibold">{customerDisplayName}</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                        <span className="inline-flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {formatOptionalDate(payment.payment_date || payment.created_at)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          {formatMetaLabel(payment.payment_method)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3 md:text-right">
                      <Badge className={`border ${getStatusBadgeClass(payment.status)}`}>{formatMetaLabel(payment.status)}</Badge>
                      <div>
                        <p className="text-sm text-white/70">Amount received</p>
                        <p className="text-3xl font-semibold">{normalizedAmount}</p>
                      </div>
                      <p className="text-xs text-white/60">Receipt #{payment.id}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Order</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{order?.order_number || "Not linked"}</p>
                    <p className="mt-1 text-sm text-slate-600">Order total: {normalizedOrderAmount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Transaction</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{payment.transaction_id || "Not provided"}</p>
                    <p className="mt-1 text-sm text-slate-600">Reference: {payment.gateway_reference || "N/A"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Balance context</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{outstandingOrderAmount || "N/A"}</p>
                    <p className="mt-1 text-sm text-slate-600">Outstanding after this receipt</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-slate-200">
                <CardContent className="space-y-4 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Receipt Information</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">Payment metadata</h3>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-500">Amount</p>
                      <p className="mt-1 font-semibold text-slate-900">{normalizedAmount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Currency</p>
                      <p className="mt-1 font-semibold text-slate-900">{payment.currency || "KES"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Payment date</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatOptionalDate(payment.payment_date || payment.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Gateway</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatMetaLabel(payment.payment_gateway)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Payment method</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatMetaLabel(payment.payment_method)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Status</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatMetaLabel(payment.status)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="space-y-4 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Customer & Order</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">Relevant linked details</h3>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-500">Customer</p>
                      <p className="mt-1 font-semibold text-slate-900">{customerDisplayName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Customer type</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatMetaLabel(customer?.customer_type || "individual")}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Phone</p>
                      <p className="mt-1 font-semibold text-slate-900">{customer?.phone || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Email</p>
                      <p className="mt-1 font-semibold text-slate-900">{customer?.email || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Order number</p>
                      <p className="mt-1 font-semibold text-slate-900">{order?.order_number || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Order total</p>
                      <p className="mt-1 font-semibold text-slate-900">{normalizedOrderAmount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAllocation(true)} className="gap-2">
                <Split className="h-4 w-4" />
                Allocate to Invoices
              </Button>
              <Button variant="outline" onClick={handleSendWhatsApp} disabled={!customer?.phone || sendingWhatsApp} className="gap-2">
                <MessageCircle className="h-4 w-4" />
                {sendingWhatsApp ? "Sending..." : "Send Receipt"}
              </Button>
              <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview Receipt
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Receipt Preview</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div dangerouslySetInnerHTML={{ __html: generateReceiptHTML() }} className="rounded-2xl bg-white p-2" />
                    <div className="flex gap-2">
                      <Button onClick={handlePrintReceipt} className="flex-1 gap-2" variant="outline">
                        <Printer className="h-4 w-4" />
                        Print Receipt
                      </Button>
                      <Button
                        onClick={() => navigator.clipboard.writeText(generateReceiptText())}
                        className="flex-1 gap-2"
                        variant="outline"
                      >
                        <FileText className="h-4 w-4" />
                        Copy Text
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {payment && (
              <PaymentAllocationModal
                payment={payment}
                isOpen={showAllocation}
                onClose={() => setShowAllocation(false)}
                onAllocationComplete={() => {
                  fetchPaymentDetails()
                  setShowAllocation(false)
                }}
              />
            )}
          </div>
        ) : (
          <div className="py-8 text-center">Payment not found</div>
        )}
      </SheetContent>
    </Sheet>
  )
}
