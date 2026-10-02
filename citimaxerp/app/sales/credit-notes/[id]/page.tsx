"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  ApplyCreditNoteErrorResponse,
  ApplyCreditNoteUiHint,
  CustomerCreditContext,
  CreditNote,
  CreditNoteLineItem,
  applyCreditNote,
  deleteCreditNote,
  fetchCreditNoteById,
  fetchCustomerUnappliedCredits,
  getCreditNoteStatusColor,
  issueCreditNote,
  parseCreditNoteAmount,
  refundCreditNote,
  voidCreditNote,
} from "@/lib/credit-notes"
import { fetchInvoices } from "@/lib/invoices"
import { formatCurrency, formatDate } from "@/lib/utils"
import { InvoiceEtimsBadge } from "@/components/etims/invoice-etims-badge"
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  FileText,
  HandCoins,
  Loader2,
  ReceiptText,
  Wallet,
} from "lucide-react"

function getCustomerName(creditNote: CreditNote): string {
  // Business name is optional for individuals too now, so show it whenever
  // it's been captured rather than gating on customer_type === "company" -
  // otherwise a filled-in field silently never appears anywhere.
  if (creditNote.customer?.business_name) {
    return creditNote.customer.business_name
  }

  return creditNote.customer?.name || "Unknown customer"
}

function getLineItemTotal(lineItem: CreditNoteLineItem) {
  const quantity = parseCreditNoteAmount(lineItem.quantity)
  const unitPrice = parseCreditNoteAmount(lineItem.unit_price)
  const subtotal = quantity * unitPrice
  const discountAmount = parseCreditNoteAmount(lineItem.discount_amount)
  const taxRate = parseCreditNoteAmount(lineItem.tax_rate)

  const taxAmount =
    lineItem.tax_amount !== undefined
      ? parseCreditNoteAmount(lineItem.tax_amount)
      : Math.max(0, subtotal - discountAmount) * (taxRate / 100)

  if (lineItem.line_total !== undefined) {
    return parseCreditNoteAmount(lineItem.line_total)
  }

  return subtotal - discountAmount + taxAmount
}

function formatStatusLabel(status?: string | null) {
  const value = status || "unknown"
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")
}

function formatActionLabel(action?: string | null) {
  if (!action) {
    return "-"
  }

  const normalized = action.trim().toLowerCase()

  const labels: Record<string, string> = {
    refund_credit_note: "Refund Credit Note",
    apply_to_open_invoice: "Apply to Open Invoice",
    choose_another_invoice_or_refund: "Choose Another Invoice or Refund",
    apply_to_another_invoice: "Apply to Another Invoice",
  }

  if (labels[normalized]) {
    return labels[normalized]
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

interface ApplyInvoiceOption {
  id: string
  invoice_number: string
  balance_amount: number | string
}

const defaultRefundMethod = "bank_transfer"

export default function CreditNoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [creditNote, setCreditNote] = useState<CreditNote | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isIssuing, setIsIssuing] = useState(false)
  const [isVoiding, setIsVoiding] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false)
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false)

  const [customerInvoices, setCustomerInvoices] = useState<ApplyInvoiceOption[]>([])
  const [customerCreditContext, setCustomerCreditContext] = useState<CustomerCreditContext | null>(null)
  const [isLoadingCreditContext, setIsLoadingCreditContext] = useState(false)

  const [applyInvoiceId, setApplyInvoiceId] = useState("")
  const [applyAmount, setApplyAmount] = useState("")
  const [applyErrorMessage, setApplyErrorMessage] = useState("")
  const [applyErrorCode, setApplyErrorCode] = useState("")
  const [applyUiHint, setApplyUiHint] = useState<ApplyCreditNoteUiHint | null>(null)
  const [applyCreditContext, setApplyCreditContext] = useState<CustomerCreditContext | null>(null)

  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [refundMethod, setRefundMethod] = useState(defaultRefundMethod)
  const [refundReference, setRefundReference] = useState("")
  const [refundNotes, setRefundNotes] = useState("")
  const [refundDate, setRefundDate] = useState(new Date().toISOString().split("T")[0])

  const consumedAmount =
    parseCreditNoteAmount(creditNote?.amount_applied) + parseCreditNoteAmount(creditNote?.amount_refunded)

  const canIssue = creditNote?.status === "draft" && parseCreditNoteAmount(creditNote.total_amount) > 0
  const canApply = creditNote?.status === "issued" && parseCreditNoteAmount(creditNote.balance_amount) > 0
  const canRefund = creditNote?.status === "issued" && parseCreditNoteAmount(creditNote.balance_amount) > 0
  const canVoid = (creditNote?.status === "draft" || creditNote?.status === "issued") && consumedAmount <= 0
  const canDelete = creditNote?.status === "draft"
  const canEdit = creditNote?.status === "draft"

  const resetApplyRecoveryState = () => {
    setApplyErrorMessage("")
    setApplyErrorCode("")
    setApplyUiHint(null)
    setApplyCreditContext(customerCreditContext)
  }

  const resetRefundForm = () => {
    setRefundAmount("")
    setRefundReason("")
    setRefundMethod(defaultRefundMethod)
    setRefundReference("")
    setRefundNotes("")
    setRefundDate(new Date().toISOString().split("T")[0])
  }

  const loadCustomerInvoices = async (customerId: string, linkedInvoice?: ApplyInvoiceOption) => {
    try {
      const response = await fetchInvoices({ customer_id: customerId, per_page: 200 })
      const options = (response.data || []).map((invoice) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        balance_amount: invoice.balance_amount,
      }))

      if (linkedInvoice && !options.some((invoice) => invoice.id === linkedInvoice.id)) {
        options.unshift(linkedInvoice)
      }

      setCustomerInvoices(options)
    } catch {
      setCustomerInvoices(linkedInvoice ? [linkedInvoice] : [])
    }
  }

  const loadCustomerCreditContext = async (customerId: string) => {
    try {
      setIsLoadingCreditContext(true)
      const response = await fetchCustomerUnappliedCredits(customerId)
      setCustomerCreditContext(response.context)
      setApplyCreditContext(response.context)
    } catch {
      setCustomerCreditContext(null)
      setApplyCreditContext(null)
    } finally {
      setIsLoadingCreditContext(false)
    }
  }

  const loadCreditNote = async (creditNoteId: string) => {
    try {
      setIsLoading(true)
      const data = await fetchCreditNoteById(creditNoteId)
      setCreditNote(data)
      setApplyInvoiceId(data.invoice_id)

      if (data.customer_id) {
        const linkedInvoice: ApplyInvoiceOption = {
          id: data.invoice_id,
          invoice_number: data.invoice?.invoice_number || "Linked Invoice",
          balance_amount: data.invoice?.balance_amount || 0,
        }

        await Promise.all([
          loadCustomerInvoices(data.customer_id, linkedInvoice),
          loadCustomerCreditContext(data.customer_id),
        ])
      } else {
        setCustomerInvoices([])
        setCustomerCreditContext(null)
        setApplyCreditContext(null)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load credit note",
        variant: "destructive",
      })
      router.replace("/sales/credit-notes")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (params.id) {
      loadCreditNote(params.id as string)
    }
  }, [params.id])

  const eligibleInvoices = useMemo(() => {
    if (!creditNote) {
      return []
    }

    return customerInvoices.filter((invoice) => {
      if (invoice.id === creditNote.invoice_id) {
        return true
      }

      return parseCreditNoteAmount(invoice.balance_amount) > 0
    })
  }, [creditNote, customerInvoices])

  const handleIssue = async () => {
    if (!creditNote || !canIssue) {
      return
    }

    try {
      setIsIssuing(true)
      await issueCreditNote(creditNote.id)
      toast({ title: "Success", description: "Credit note issued successfully." })
      await loadCreditNote(creditNote.id)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to issue credit note",
        variant: "destructive",
      })
    } finally {
      setIsIssuing(false)
    }
  }

  const handleVoid = async () => {
    if (!creditNote || !canVoid) {
      return
    }

    if (!window.confirm("Void this credit note? This action cannot be undone.")) {
      return
    }

    try {
      setIsVoiding(true)
      await voidCreditNote(creditNote.id)
      toast({ title: "Success", description: "Credit note voided successfully." })
      await loadCreditNote(creditNote.id)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to void credit note",
        variant: "destructive",
      })
    } finally {
      setIsVoiding(false)
    }
  }

  const handleDelete = async () => {
    if (!creditNote || !canDelete) {
      return
    }

    if (!window.confirm("Delete this draft credit note?")) {
      return
    }

    try {
      setIsDeleting(true)
      await deleteCreditNote(creditNote.id)
      toast({ title: "Success", description: "Credit note deleted successfully." })
      router.push("/sales/credit-notes")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete credit note",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleApply = async () => {
    if (!creditNote || !canApply) {
      return
    }

    if (!applyInvoiceId) {
      toast({
        title: "Invoice Required",
        description: "Select an invoice to apply this credit note.",
        variant: "destructive",
      })
      return
    }

    const amountValue = applyAmount.trim()
    const amount = amountValue ? Number(amountValue) : undefined

    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      toast({
        title: "Invalid Amount",
        description: "Apply amount must be greater than 0.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsApplying(true)
      resetApplyRecoveryState()

      const response = await applyCreditNote(creditNote.id, {
        invoice_id: applyInvoiceId,
        amount,
      })

      toast({
        title: "Success",
        description: `Applied ${formatCurrency(parseCreditNoteAmount(response.applied))} to invoice.`,
      })

      setApplyCreditContext(response.customer_credit_context || customerCreditContext)
      setIsApplyDialogOpen(false)
      setApplyAmount("")
      await loadCreditNote(creditNote.id)
    } catch (error: any) {
      const apiResponse = error?.apiResponse as ApplyCreditNoteErrorResponse | undefined

      if (apiResponse?.error_code === "INVOICE_NO_OUTSTANDING_BALANCE") {
        setApplyErrorMessage(apiResponse.message || "The invoice has no outstanding balance")
        setApplyErrorCode(apiResponse.error_code)
        setApplyUiHint(apiResponse.ui_hint || null)
        setApplyCreditContext(apiResponse.customer_credit_context || customerCreditContext)

        const firstOpenInvoice = apiResponse.customer_credit_context?.open_invoices?.[0]
        if (firstOpenInvoice?.id) {
          setApplyInvoiceId(firstOpenInvoice.id)
        }

        toast({
          title: "Invoice Has No Balance",
          description: "Choose another open invoice or refund this credit note.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Error",
        description: error?.message || "Failed to apply credit note",
        variant: "destructive",
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleRefund = async (fromApplyRecovery = false) => {
    if (!creditNote || !canRefund) {
      return
    }

    if (!refundReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Provide a refund reason before submitting.",
        variant: "destructive",
      })
      return
    }

    const amountValue = refundAmount.trim()
    const amount = amountValue ? Number(amountValue) : undefined

    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      toast({
        title: "Invalid Amount",
        description: "Refund amount must be greater than 0.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsRefunding(true)

      const response = await refundCreditNote(creditNote.id, {
        amount,
        refund_reason: refundReason.trim(),
        refund_method: refundMethod || undefined,
        reference: refundReference.trim() || undefined,
        notes: refundNotes.trim() || undefined,
        refund_date: refundDate || undefined,
      })

      toast({
        title: "Success",
        description: `Refunded ${formatCurrency(parseCreditNoteAmount(response.refunded))} successfully.`,
      })

      if (response.customer_credit_context) {
        setCustomerCreditContext(response.customer_credit_context)
        setApplyCreditContext(response.customer_credit_context)
      }

      if (fromApplyRecovery) {
        setIsApplyDialogOpen(false)
        resetApplyRecoveryState()
      } else {
        setIsRefundDialogOpen(false)
      }

      resetRefundForm()
      await loadCreditNote(creditNote.id)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to refund credit note",
        variant: "destructive",
      })
    } finally {
      setIsRefunding(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading credit note...
        </div>
      </div>
    )
  }

  if (!creditNote) {
    return (
      <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        <div className="text-center py-10">Credit note not found.</div>
      </div>
    )
  }

  const totalAmount = parseCreditNoteAmount(creditNote.total_amount)
  const availableBalance = parseCreditNoteAmount(creditNote.balance_amount)
  const appliedAmount = parseCreditNoteAmount(creditNote.amount_applied)
  const refundedAmount = parseCreditNoteAmount(creditNote.amount_refunded)
  const lineItems = creditNote.line_items || []
  const refunds = creditNote.refunds || []

  return (
    <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/sales/credit-notes">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Credit Notes
          </Button>
        </Link>
        <Badge className={getCreditNoteStatusColor(creditNote.status)}>
          {formatStatusLabel(creditNote.status)}
        </Badge>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background px-5 py-6 sm:px-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
                  <FileText className="h-3.5 w-3.5" />
                  Credit Note
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">{creditNote.credit_note_number}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Issued for {getCustomerName(creditNote)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="inline-flex items-center gap-2">
                    <ReceiptText className="h-4 w-4" />
                    Invoice {creditNote.invoice?.invoice_number || "-"}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Credit date {formatDate(creditNote.credit_note_date)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                {canIssue && (
                  <Button onClick={handleIssue} disabled={isIssuing}>
                    {isIssuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Issue
                  </Button>
                )}

                {canApply && (
                  <Button
                    variant={canIssue ? "outline" : "default"}
                    onClick={() => {
                      setApplyInvoiceId(creditNote.invoice_id)
                      setApplyAmount("")
                      resetApplyRecoveryState()
                      setIsApplyDialogOpen(true)
                    }}
                  >
                    Apply to Invoice
                  </Button>
                )}

                {canRefund && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetRefundForm()
                      setIsRefundDialogOpen(true)
                    }}
                  >
                    Refund
                  </Button>
                )}

                {canEdit && (
                  <Link href={`/sales/credit-notes/new?edit_id=${creditNote.id}`}>
                    <Button variant="outline">Edit</Button>
                  </Link>
                )}

                {canVoid && (
                  <Button variant="outline" onClick={handleVoid} disabled={isVoiding}>
                    {isVoiding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Void
                  </Button>
                )}

                {canDelete && (
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-background p-4">
              <p className="text-xs text-muted-foreground">Total Credit</p>
              <p className="text-lg font-semibold">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="bg-background p-4">
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <p className="text-lg font-semibold">{formatCurrency(availableBalance)}</p>
            </div>
            <div className="bg-background p-4">
              <p className="text-xs text-muted-foreground">Amount Applied</p>
              <p className="text-lg font-semibold">{formatCurrency(appliedAmount)}</p>
            </div>
            <div className="bg-background p-4">
              <p className="text-xs text-muted-foreground">Amount Refunded</p>
              <p className="text-lg font-semibold">{formatCurrency(refundedAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <InvoiceEtimsBadge invoiceId={creditNote.id} isCreditNote />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full sm:w-[520px] grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="line-items">Line Items</TabsTrigger>
          <TabsTrigger value="refunds-context">Refunds & Context</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Linked Records</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium">{getCustomerName(creditNote)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Invoice</span>
                    {creditNote.invoice_id ? (
                      <Link
                        href={`/sales/invoices/${creditNote.invoice_id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        {creditNote.invoice?.invoice_number || "View linked invoice"}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="font-medium">-</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="font-medium">{creditNote.currency}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dates and Narrative</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Credit Note Date</span>
                    <span>{formatDate(creditNote.credit_note_date)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Expiry Date</span>
                    <span>{creditNote.expiry_date ? formatDate(creditNote.expiry_date) : "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Reason</span>
                    <span className="font-medium text-right">{creditNote.reason || "-"}</span>
                  </div>
                  <div className="pt-2">
                    <p className="text-muted-foreground mb-1">Notes</p>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="whitespace-pre-wrap">{creditNote.notes || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Amount Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(parseCreditNoteAmount(creditNote.subtotal))}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-green-600">
                      -{formatCurrency(parseCreditNoteAmount(creditNote.discount_amount))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(parseCreditNoteAmount(creditNote.tax_amount))}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-4 font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Applied</span>
                    <span>{formatCurrency(appliedAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Refunded</span>
                    <span>{formatCurrency(refundedAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Balance</span>
                    <span>{formatCurrency(availableBalance)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Credit Context Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {isLoadingCreditContext ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading customer credit context...
                    </div>
                  ) : customerCreditContext ? (
                    <>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Unapplied Credit Total</span>
                        <span>{formatCurrency(parseCreditNoteAmount(customerCreditContext.unapplied_credit_total))}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Open Invoice Balance</span>
                        <span>{formatCurrency(parseCreditNoteAmount(customerCreditContext.open_invoice_balance_total))}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Open Invoices</span>
                        <span>{customerCreditContext.open_invoices_count}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Unapplied Credit Notes</span>
                        <span>{customerCreditContext.unapplied_credit_notes_count}</span>
                      </div>
                      <div className="pt-1 text-xs text-muted-foreground">
                        Suggested next action: {formatActionLabel(customerCreditContext.suggested_next_action)}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">No customer credit context available.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Next Best Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-2">
                    <p className="font-medium">Credit lifecycle</p>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CircleDollarSign className="h-4 w-4" />
                      {formatStatusLabel(creditNote.status)}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                      Remaining balance {formatCurrency(availableBalance)}
                    </div>
                  </div>

                  {canApply && (
                    <Button
                      className="w-full justify-start"
                      onClick={() => {
                        setApplyInvoiceId(creditNote.invoice_id)
                        setApplyAmount("")
                        resetApplyRecoveryState()
                        setIsApplyDialogOpen(true)
                      }}
                    >
                      <HandCoins className="h-4 w-4 mr-2" />
                      Apply Credit to an Invoice
                    </Button>
                  )}

                  {canRefund && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        resetRefundForm()
                        setIsRefundDialogOpen(true)
                      }}
                    >
                      <ReceiptText className="h-4 w-4 mr-2" />
                      Refund Remaining Credit
                    </Button>
                  )}

                  {!canApply && !canRefund && (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      This credit note is fully consumed or not yet ready for application/refund.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="line-items" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Line Items</CardTitle>
              <p className="text-sm text-muted-foreground">{lineItems.length} item(s)</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Tax %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.length > 0 ? (
                    lineItems.map((lineItem, index) => (
                      <TableRow key={lineItem.id || index}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{lineItem.description}</p>
                            <p className="text-xs text-muted-foreground">{lineItem.unit || "pcs"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{parseCreditNoteAmount(lineItem.quantity)}</TableCell>
                        <TableCell>{formatCurrency(parseCreditNoteAmount(lineItem.unit_price))}</TableCell>
                        <TableCell>{formatCurrency(parseCreditNoteAmount(lineItem.discount_amount))}</TableCell>
                        <TableCell>{parseCreditNoteAmount(lineItem.tax_rate)}%</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(getLineItemTotal(lineItem))}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        No line items
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refunds-context" className="mt-0">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Refund History</CardTitle>
                <p className="text-sm text-muted-foreground">{refunds.length} refund(s)</p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.length > 0 ? (
                      refunds.map((refund) => (
                        <TableRow key={refund.id}>
                          <TableCell>{refund.refund_date ? formatDate(refund.refund_date) : "-"}</TableCell>
                          <TableCell>{formatCurrency(parseCreditNoteAmount(refund.amount))}</TableCell>
                          <TableCell>{refund.refund_method || "-"}</TableCell>
                          <TableCell>{refund.reference || "-"}</TableCell>
                          <TableCell>{refund.refund_reason || "-"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No refunds recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Unapplied Credit Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {isLoadingCreditContext ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading customer credit context...
                  </div>
                ) : customerCreditContext ? (
                  <>
                    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Unapplied Credit Total</span>
                        <span>{formatCurrency(parseCreditNoteAmount(customerCreditContext.unapplied_credit_total))}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Open Invoice Balance</span>
                        <span>{formatCurrency(parseCreditNoteAmount(customerCreditContext.open_invoice_balance_total))}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Open Invoices</span>
                        <span>{customerCreditContext.open_invoices_count}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Unapplied Credit Notes</span>
                        <span>{customerCreditContext.unapplied_credit_notes_count}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Open Invoices</p>
                      {customerCreditContext.open_invoices.length > 0 ? (
                        <div className="space-y-2">
                          {customerCreditContext.open_invoices.slice(0, 4).map((invoice) => (
                            <button
                              key={invoice.id}
                              type="button"
                              className="w-full rounded-md border bg-background p-3 text-left hover:bg-muted/30"
                              onClick={() => setApplyInvoiceId(invoice.id)}
                            >
                              <div className="font-medium">{invoice.invoice_number}</div>
                              <div className="text-xs text-muted-foreground">
                                Balance {formatCurrency(parseCreditNoteAmount(invoice.balance_amount))}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No open invoices for this customer.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">No customer credit context available.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isApplyDialogOpen}
        onOpenChange={(open) => {
          setIsApplyDialogOpen(open)
          if (!open) {
            resetApplyRecoveryState()
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply Credit Note</DialogTitle>
            <DialogDescription>
              Choose an invoice and optional amount to apply this credit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invoice</Label>
              <Select value={applyInvoiceId} onValueChange={setApplyInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} • Balance {formatCurrency(parseCreditNoteAmount(invoice.balance_amount))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apply_amount">Amount (optional)</Label>
              <Input
                id="apply_amount"
                type="number"
                min="0"
                step="0.01"
                value={applyAmount}
                onChange={(event) => setApplyAmount(event.target.value)}
                placeholder="Leave blank to apply full available credit"
              />
              <p className="text-xs text-muted-foreground">
                Available balance: {formatCurrency(parseCreditNoteAmount(creditNote.balance_amount))}
              </p>
            </div>

            {applyErrorMessage && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">{applyErrorMessage}</p>
                {applyErrorCode && <p className="text-xs mt-1">Error code: {applyErrorCode}</p>}
                {applyUiHint?.primary_action && (
                  <p className="text-xs mt-1">Suggested action: {formatActionLabel(applyUiHint.primary_action)}</p>
                )}
              </div>
            )}

            {applyErrorCode === "INVOICE_NO_OUTSTANDING_BALANCE" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border p-3 space-y-3">
                  <h4 className="text-sm font-semibold">Apply To Another Invoice</h4>
                  {(applyCreditContext?.open_invoices?.length || 0) > 0 ? (
                    <div className="space-y-2">
                      {applyCreditContext?.open_invoices.map((invoice) => (
                        <button
                          key={invoice.id}
                          type="button"
                          onClick={() => setApplyInvoiceId(invoice.id)}
                          className={`w-full text-left rounded-md border p-2 text-sm transition-colors ${
                            applyInvoiceId === invoice.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                          }`}
                        >
                          <div className="font-medium">{invoice.invoice_number}</div>
                          <div className="text-xs text-muted-foreground">
                            Balance {formatCurrency(parseCreditNoteAmount(invoice.balance_amount))}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No open invoices available for this customer.</p>
                  )}
                </div>

                <div className="rounded-md border p-3 space-y-3">
                  <h4 className="text-sm font-semibold">Refund Credit Instead</h4>
                  <div className="space-y-2">
                    <Label htmlFor="recovery_refund_amount">Refund Amount (optional)</Label>
                    <Input
                      id="recovery_refund_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                      placeholder="Leave blank to refund full balance"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery_refund_reason">Refund Reason *</Label>
                    <Input
                      id="recovery_refund_reason"
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                      placeholder="Customer requested refund"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery_refund_method">Refund Method</Label>
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger id="recovery_refund_method">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="card_reversal">Card Reversal</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleRefund(true)}
                    disabled={isRefunding}
                  >
                    {isRefunding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Refund From This Modal
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={isApplying}>
              {isApplying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund Credit Note</DialogTitle>
            <DialogDescription>
              Refund all or part of the remaining credit balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refund_amount">Amount (optional)</Label>
              <Input
                id="refund_amount"
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                placeholder="Leave blank to refund full balance"
              />
              <p className="text-xs text-muted-foreground">
                Available balance: {formatCurrency(parseCreditNoteAmount(creditNote.balance_amount))}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund_reason">Refund Reason *</Label>
              <Input
                id="refund_reason"
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder="Customer requested cash refund"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund_method">Refund Method</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger id="refund_method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="card_reversal">Card Reversal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund_reference">Reference</Label>
              <Input
                id="refund_reference"
                value={refundReference}
                onChange={(event) => setRefundReference(event.target.value)}
                placeholder="BTX-99211"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund_date">Refund Date</Label>
              <Input
                id="refund_date"
                type="date"
                value={refundDate}
                onChange={(event) => setRefundDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund_notes">Notes</Label>
              <Textarea
                id="refund_notes"
                value={refundNotes}
                onChange={(event) => setRefundNotes(event.target.value)}
                placeholder="Processed by finance"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleRefund(false)} disabled={isRefunding}>
              {isRefunding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
