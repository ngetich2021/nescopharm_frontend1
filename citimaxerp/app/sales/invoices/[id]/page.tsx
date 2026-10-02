"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  ArrowLeft, 
  Send, 
  Edit, 
  Trash2, 
  Download, 
  DollarSign,
  Calendar,
  User,
  Mail,
  MessageCircle,
  Eye,
  Phone,
  ChevronDown,
  CreditCard,
  History,
  Plus,
  FileText,
  Printer,
  Maximize2
} from "lucide-react"
import { fetchInvoiceById, deleteInvoice, Invoice, sendInvoice, fetchSalesReps, assignSalesRep, SalesRep, fetchInvoicePaymentHistory } from "@/lib/invoices"
import { getInvoiceStatusColor, getInvoiceStatusLabel } from "@/lib/invoice-status"
import { SendInvoiceModal } from "@/components/modals/send-invoice-modal"
import apiCall from "@/lib/api"
import { RecordPaymentModal } from "@/components/modals/record-payment-modal"
import { PaymentHistoryModal } from "@/components/modals/payment-history-modal"
import { MapPaymentModal } from "@/components/modals/map-payment-modal"
import { getCompany, Company } from "@/lib/company"
import { getCustomerProfile, CustomerProfileData } from "@/lib/customers"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CreditNotesByInvoiceResponse,
  fetchCreditNotesByInvoice,
  getCreditNoteStatusColor,
  parseCreditNoteAmount,
} from "@/lib/credit-notes"
import { InvoiceEtimsBadge } from "@/components/etims/invoice-etims-badge"

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [customerDetails, setCustomerDetails] = useState<CustomerProfileData | null>(null)
  const [creditNotesData, setCreditNotesData] = useState<CreditNotesByInvoiceResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingCreditNotes, setIsLoadingCreditNotes] = useState(false)
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false)
  const [isPaymentHistoryModalOpen, setIsPaymentHistoryModalOpen] = useState(false)
  const [isMapPaymentModalOpen, setIsMapPaymentModalOpen] = useState(false)
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [isAssigningRep, setIsAssigningRep] = useState(false)

  // Send Invoice Modal state
  const [isSendInvoiceModalOpen, setIsSendInvoiceModalOpen] = useState(false)
  // Unapplied excess sitting on this invoice's payment(s) - e.g. the customer
  // paid more than the invoice total in one lump sum. Refundable from Payment
  // History. Fetched separately since the invoice's own balance doesn't
  // reflect it (a Payment's excess isn't allocated to this invoice at all).
  const [refundableAmount, setRefundableAmount] = useState(0)

  useEffect(() => {
    if (params.id) {
      loadInvoice(params.id as string)
      fetchInvoicePaymentHistory(params.id as string)
        .then((history) => {
          const total = (history.payments || []).reduce((sum, p) => sum + (p.available_to_refund || 0), 0)
          setRefundableAmount(total)
        })
        .catch(() => setRefundableAmount(0))
    }
  }, [params.id])

  useEffect(() => {
    fetchSalesReps().then(setSalesReps).catch(() => setSalesReps([]))
  }, [])

  const handleAssignRep = async (repId: string) => {
    if (!invoice) return
    setIsAssigningRep(true)
    try {
      const updated = await assignSalesRep(invoice.id, repId === "none" ? null : repId)
      setInvoice(updated)
      toast({
        title: "Success",
        description: repId === "none" ? "Sales rep cleared" : "Sales rep assigned",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign sales rep",
        variant: "destructive",
      })
    } finally {
      setIsAssigningRep(false)
    }
  }

  const loadInvoice = async (invoiceId: string) => {
    try {
      setIsLoading(true)
      const invoiceData = await fetchInvoiceById(invoiceId)
      setInvoice(invoiceData)

      try {
        setIsLoadingCreditNotes(true)
        const creditsResponse = await fetchCreditNotesByInvoice(invoiceId)
        setCreditNotesData(creditsResponse)
      } catch {
        setCreditNotesData(null)
      } finally {
        setIsLoadingCreditNotes(false)
      }
      
      // Fetch company data attached to the invoice (not the logged-in user's company)
      if (invoiceData.company_id) {
        try {
          // First check if invoice has company data included
          if (invoiceData.company) {
            setCompany(invoiceData.company as Company)
          } else {
            // Fallback: fetch company by invoice's company_id
            const companyData = await getCompany(invoiceData.company_id)
            setCompany(companyData)
          }
        } catch (error) {
          console.error('Failed to fetch invoice company data:', error)
          // Use basic company info from user profile as fallback
          if (user?.company?.id) {
            setCompany({
              id: user.company.id,
              name: user.company.name,
              is_active: user.company.is_active || true,
              is_first_time: user.company.is_first_time || false,
              created_at: '',
              updated_at: ''
            } as Company)
          }
        }
      }
      
      // Fetch full customer details to get customer_type and business_name
      if (invoiceData.customer_id) {
        try {
          const fullCustomerData = await getCustomerProfile(invoiceData.customer_id)
          if (fullCustomerData) {
            setCustomerDetails(fullCustomerData)
          }
        } catch (error) {
          console.error('Failed to fetch customer details:', error)
          // Will fall back to invoice.customer data
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load invoice",
        variant: "destructive",
      })
      setCreditNotesData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendInvoice = async () => {
    if (!invoice) return

    try {
      const updatedInvoice = await sendInvoice(invoice.id)
      setInvoice(updatedInvoice)
      toast({
        title: "Success",
        description: "Invoice sent successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invoice",
        variant: "destructive",
      })
    }
  }

  const handleDeleteInvoice = async () => {
    if (!invoice) return
    
    if (!confirm('Are you sure you want to delete this invoice?')) return

    try {
      await deleteInvoice(invoice.id)
      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      })
      router.push('/sales')
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice",
        variant: "destructive",
      })
    }
  }


  const handleSendEmail = () => {
    setIsSendInvoiceModalOpen(true)
  }

  async function sendInvoiceByEmail(email: string) {
    if (!invoice) return
    try {
      await apiCall(`/invoices/${invoice.id}/send`, "POST", { method: "email", email }, true)
      toast({
        title: "Success",
        description: "Invoice sent successfully",
      })
      setIsSendInvoiceModalOpen(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invoice",
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

  const handlePaymentRecorded = async () => {
    setIsRecordPaymentModalOpen(false);
    
    // Reload invoice data to show updated payment status
    if (params.id) {
      await loadInvoice(params.id as string);
    }
    
    toast({
      title: "Success",
      description: "Payment recorded successfully",
    });
  }

  const handlePaymentMapped = async () => {
    setIsMapPaymentModalOpen(false);
    
    // Reload invoice data to show updated payment status
    if (params.id) {
      await loadInvoice(params.id as string);
    }
    
    toast({
      title: "Success",
      description: "Payment mapped to invoice successfully",
    });
  }

  const getStatusColor = getInvoiceStatusColor

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-8 pt-6">
        {/* Header Skeleton */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/sales/invoices">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </Button>
            </Link>
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        {/* Two Column Layout Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Left Column - Information Cards */}
          <div className="space-y-6 order-2 xl:order-1">
            {/* Customer Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>

            {/* Status & Dates Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Status & Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Skeleton className="h-4 w-20 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes Card */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Invoice Preview */}
          <div className="space-y-6 order-1 xl:order-2">
            <Card className="h-fit sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Invoice Preview
                </CardTitle>
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="bg-white border rounded-lg p-6 lg:p-8 shadow-sm">
                  {/* Header Skeleton */}
                  <div className="flex justify-between items-start mb-6 lg:mb-8">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-12 h-12 rounded" />
                      <div>
                        <Skeleton className="h-5 w-32 mb-1" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>

                  {/* Company Info Skeleton */}
                  <div className="mb-6 lg:mb-8 pb-4 border-b border-gray-200">
                    <Skeleton className="h-4 w-48 mb-1" />
                    <Skeleton className="h-4 w-40 mb-1" />
                    <Skeleton className="h-4 w-56" />
                  </div>

                  {/* Bill To and Invoice Details Skeleton */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-6 lg:mb-8">
                    <div>
                      <Skeleton className="h-5 w-20 mb-3" />
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <div className="text-left lg:text-right">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-4 w-30" />
                    </div>
                  </div>

                  {/* Table Skeleton */}
                  <div className="mb-6 lg:mb-8">
                    <div className="border-b-2 border-gray-300 pb-3 mb-4">
                      <div className="grid grid-cols-4 gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  </div>

                  {/* Totals Skeleton */}
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="flex items-center gap-4">
          <Link href="/sales/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
          </Link>
        </div>
        <div className="text-center py-8">Invoice not found</div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/sales/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">{invoice.invoice_number}</h1>
            <p className="text-muted-foreground">
              Invoice Details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={getStatusColor(invoice.status)}>
            {getInvoiceStatusLabel(invoice.status)}
          </Badge>

          {/* Send Options in Header */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
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

          <Link href={`/sales/credit-notes/new?invoice_id=${invoice.id}`}>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Credit Note
            </Button>
          </Link>
          
          {invoice.status === 'draft' && (
            <Link href={`/sales/invoices/${invoice.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          )}
          
          <Link href={`/sales/invoices/${invoice.id}/document?autoprint=1`}>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </Link>

          <Link href={`/sales/invoices/${invoice.id}/document`}>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </Link>

          {(invoice.status === 'draft' || invoice.status === 'sent') && (
            <Button variant="outline" size="sm" onClick={handleDeleteInvoice} className="text-primary hover:text-primary/80">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Left Column - Invoice Information */}
        <div className="space-y-6 order-2 xl:order-1">
          <InvoiceEtimsBadge invoiceId={invoice.id} />

          {/* Customer Information */}
          {(invoice.customer || customerDetails) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="font-medium text-lg">
                    {/* Show a captured business name whenever it exists, not
                        just for customer_type === 'company' - individuals can
                        fill this in too now. */}
                    {(customerDetails?.business_name || invoice.customer?.business_name)
                      || (customerDetails?.name || invoice.customer?.name)}
                  </p>
                  {(customerDetails?.business_name || invoice.customer?.business_name) && (
                    <p className="text-sm text-muted-foreground">
                      Contact: {customerDetails?.name || invoice.customer?.name}
                    </p>
                  )}
                  {(customerDetails?.email || invoice.customer?.email) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {customerDetails?.email || invoice.customer?.email}
                    </p>
                  )}
                  {(customerDetails?.phone || invoice.customer?.phone) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {customerDetails?.phone || invoice.customer?.phone}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status & Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Status & Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge className={getStatusColor(invoice.status)}>
                  {getInvoiceStatusLabel(invoice.status)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Due Date</p>
                  <p className="text-sm text-muted-foreground">{formatDate(invoice.due_date)}</p>
                </div>
                {invoice.sent_at && (
                  <div>
                    <p className="text-sm font-medium">Sent Date</p>
                    <p className="text-sm text-muted-foreground">{formatDate(invoice.sent_at)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Payment Type</p>
                  <Badge className={invoice.payment_type === 'credit' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'}>
                    {invoice.payment_type === 'credit'
                      ? `Credit${invoice.credit_terms_days ? ` (Net ${invoice.credit_terms_days})` : ''}`
                      : 'Cash'}
                  </Badge>
                </div>
                {invoice.days_remaining !== null && invoice.days_remaining !== undefined && (
                  <div>
                    <p className="text-sm font-medium">Days Left</p>
                    <Badge className={
                      invoice.days_remaining < 0 ? 'bg-red-100 text-red-800'
                        : invoice.days_remaining <= 7 ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }>
                      {invoice.days_remaining < 0 ? `${Math.abs(invoice.days_remaining)}d overdue` : `${invoice.days_remaining}d left`}
                    </Badge>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-1">Sales Rep</p>
                <Select
                  value={invoice.sales_rep_id || "none"}
                  onValueChange={handleAssignRep}
                  disabled={isAssigningRep}
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {salesReps.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {rep.full_name || `${rep.first_name} ${rep.last_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Payment Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Summary */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
                </div>
                {parseFloat(invoice.amount_paid.toString()) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-medium text-green-600">{formatCurrency(invoice.amount_paid)}</span>
                  </div>
                )}
                {parseFloat(invoice.balance_amount.toString()) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance Due:</span>
                    <span className="font-bold text-primary">{formatCurrency(invoice.balance_amount)}</span>
                  </div>
                )}
              </div>

              {/* Payment Actions */}
              <div className="space-y-4">
                {/* Payment History - Always available */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => setIsPaymentHistoryModalOpen(true)}
                  >
                    <History className="h-4 w-4 mr-1" />
                    History
                  </Button>
                </div>

                {/* Payment Actions - Only if balance > 0 */}
                {parseFloat(invoice.balance_amount.toString()) > 0 && (
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      className="flex-1" 
                      onClick={() => setIsRecordPaymentModalOpen(true)}
                    >
                      <CreditCard className="h-4 w-4 mr-1" />
                      Record
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1" 
                      onClick={() => setIsMapPaymentModalOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Map
                    </Button>
                  </div>
                )}

                {/* Payment Status Message */}
                {parseFloat(invoice.balance_amount.toString()) === 0 && (
                  <div className="text-center py-3 text-sm text-green-600 bg-green-50 rounded-md border border-green-200">
                    ✓ Invoice fully paid
                  </div>
                )}

                {refundableAmount > 0 && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-2">
                    <p>
                      This invoice's payment has <strong>{formatCurrency(refundableAmount)}</strong> unapplied -
                      it was paid for more than the invoice total.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setIsPaymentHistoryModalOpen(true)}
                    >
                      Refund the excess
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Credit Notes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Credit Notes
              </CardTitle>
              <Link href={`/sales/credit-notes/new?invoice_id=${invoice.id}`}>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credits Issued:</span>
                  <span className="font-medium">
                    {formatCurrency(parseCreditNoteAmount(creditNotesData?.total_credits_issued || 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credits Applied:</span>
                  <span className="font-medium">
                    {formatCurrency(parseCreditNoteAmount(creditNotesData?.total_credits_applied || 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credits Refunded:</span>
                  <span className="font-medium">
                    {formatCurrency(parseCreditNoteAmount(creditNotesData?.total_credits_refunded || 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credits Available:</span>
                  <span className="font-medium">
                    {formatCurrency(parseCreditNoteAmount(creditNotesData?.total_credits_available || 0))}
                  </span>
                </div>
              </div>

              {isLoadingCreditNotes ? (
                <div className="text-sm text-muted-foreground">Loading credit notes...</div>
              ) : (creditNotesData?.credit_notes?.length || 0) > 0 ? (
                <div className="space-y-2">
                  {creditNotesData?.credit_notes.map((creditNote) => (
                    <Link key={creditNote.id} href={`/sales/credit-notes/${creditNote.id}`}>
                      <div className="border rounded-md p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{creditNote.credit_note_number}</p>
                          <Badge className={getCreditNoteStatusColor(creditNote.status)}>
                            {creditNote.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{formatDate(creditNote.credit_note_date)}</span>
                          <span className="font-medium">
                            {formatCurrency(parseCreditNoteAmount(creditNote.total_amount))}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No credit notes linked to this invoice.</div>
              )}
            </CardContent>
          </Card>

          {/* Notes and Terms - Only if they exist */}
          {(invoice.notes || invoice.terms_and_conditions) && (
            <div className="space-y-6">
              {invoice.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                  </CardContent>
                </Card>
              )}

              {invoice.terms_and_conditions && (
                <Card>
                  <CardHeader>
                    <CardTitle>Terms & Conditions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{invoice.terms_and_conditions}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Invoice Preview Template */}
        <div className="space-y-6 order-1 xl:order-2">
          <Card className="h-fit sticky top-6">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Invoice Preview
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    This is how your invoice will appear to customers
                  </p>
                </div>
                <Link href={`/sales/invoices/${invoice.id}/document`}>
                  <Button variant="outline" size="sm">
                    <Maximize2 className="h-4 w-4 mr-2" />
                    View Full Details
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {/* Invoice Template Preview */}
              <div className="bg-white border rounded-lg p-6 lg:p-8 shadow-sm max-h-[800px] overflow-y-auto">
                {/* Letterhead Banner */}
                {company?.letterhead_url && (
                  <img
                    src={company.letterhead_url}
                    alt={`${company.name} letterhead`}
                    className="w-full h-auto mb-6 lg:mb-8"
                  />
                )}

                {/* Invoice Title - company identity already shown once, in the letterhead above */}
                <div className="flex justify-end items-start mb-6 lg:mb-8">
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">INVOICE</h1>
                </div>

                {/* Bill To and Invoice Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-6 lg:mb-8">
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">BILLED TO:</h3>
                    <div className="text-sm">
                      {(invoice.customer || customerDetails) ? (
                        <>
                          <p className="font-medium">
                            {/* Show a captured business name whenever it exists,
                                not just for customer_type === 'company'. */}
                            {(customerDetails?.business_name || invoice.customer?.business_name)
                              || (customerDetails?.name || invoice.customer?.name)}
                          </p>
                          {(customerDetails?.business_name || invoice.customer?.business_name) && (
                            <p className="text-gray-600">c/o {customerDetails?.name || invoice.customer?.name}</p>
                          )}
                          {(customerDetails?.phone || invoice.customer?.phone) && <p>{customerDetails?.phone || invoice.customer?.phone}</p>}
                          {(customerDetails?.address || invoice.customer?.address) && <p className="break-words">{customerDetails?.address || invoice.customer?.address}</p>}
                        </>
                      ) : (
                        <p className="text-gray-500">Customer information not available</p>
                      )}
                    </div>
                  </div>
                  <div className="text-left lg:text-right">
                    <div className="text-sm space-y-1">
                      <p><span className="font-medium">Invoice No.</span> {invoice.invoice_number}</p>
                      <p><span className="font-medium">Date:</span> {formatDate(invoice.invoice_date)}</p>
                      <p><span className="font-medium">Due Date:</span> {formatDate(invoice.due_date)}</p>
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="mb-6 lg:mb-8 overflow-x-auto">
                  {invoice.line_items && invoice.line_items.length > 0 ? (
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="text-left py-3 text-xs lg:text-sm font-semibold">Item Code</th>
                          <th className="text-left py-3 text-xs lg:text-sm font-semibold">Item Description</th>
                          <th className="text-center py-3 text-xs lg:text-sm font-semibold">Quantity</th>
                          <th className="text-right py-3 text-xs lg:text-sm font-semibold">Unit Price</th>
                          <th className="text-right py-3 text-xs lg:text-sm font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.line_items.map((item) => {
                          const vatRate = parseFloat((item.tax_rate ?? 0).toString())
                          const unitPriceInclVat = parseFloat(item.unit_price.toString()) * (1 + vatRate / 100)
                          return (
                            <tr key={item.id} className="border-b border-gray-200">
                              <td className="py-3 text-xs lg:text-sm pr-4 font-mono whitespace-nowrap">
                                {item.variant?.sku || item.product?.product_code || item.product?.sku || "—"}
                              </td>
                              <td className="py-3 text-xs lg:text-sm pr-4">
                                <div>{item.description}</div>
                                {vatRate > 0 && (
                                  <span className="inline-block mt-0.5 border border-gray-500 px-1 text-[10px] font-semibold text-gray-700">
                                    VAT {vatRate}% inclusive
                                  </span>
                                )}
                              </td>
                              <td className="text-center py-3 text-xs lg:text-sm">{item.quantity}</td>
                              <td className="text-right py-3 text-xs lg:text-sm">{formatCurrency(unitPriceInclVat)}</td>
                              <td className="text-right py-3 text-xs lg:text-sm font-medium">
                                {formatCurrency(parseFloat(item.quantity.toString()) * unitPriceInclVat)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No line items available
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-6 lg:mb-8">
                  <div className="w-full lg:w-64">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(invoice.subtotal)}</span>
                      </div>
                      {parseFloat(invoice.discount_amount.toString()) > 0 && (
                        <div className="flex justify-between">
                          <span>Discount</span>
                          <span>-{formatCurrency(invoice.discount_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>VAT</span>
                        <span>{formatCurrency(invoice.tax_amount)}</span>
                      </div>
                      <div className="border-t pt-2">
                        <div className="flex justify-between font-bold text-base lg:text-lg">
                          <span>Total</span>
                          <span>{formatCurrency(invoice.total_amount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Terms and Notes */}
                <div className="text-xs lg:text-sm text-gray-600 space-y-2">
                  {invoice.payment_terms && (
                    <p>
                      <span className="font-medium">Payment Terms:</span> {invoice.payment_terms}
                    </p>
                  )}
                  {invoice.notes && (
                    <p>
                      <span className="font-medium">Notes:</span> {invoice.notes}
                    </p>
                  )}
                  
                  {/* Default footer text only if no custom terms/notes */}
                  {!invoice.payment_terms && !invoice.notes && (
                    <p className="mt-4">
                      Payment is required within 14 business days of invoice date.<br />
                      Please send remittance to hello@reallygreatsite.com.
                    </p>
                  )}
                  
                  <p className="font-medium mt-6">Thank you for your business.</p>
                  
                  <div className="text-right mt-8">
                    <div className="inline-block">
                      <div className="w-32 h-8 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                        Authorized Signed
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Management & Send Invoice Modals */}
      {invoice && (
        <>
          <RecordPaymentModal
            isOpen={isRecordPaymentModalOpen}
            onClose={() => setIsRecordPaymentModalOpen(false)}
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            totalAmount={parseFloat(invoice.total_amount.toString())}
            balanceAmount={parseFloat(invoice.balance_amount.toString())}
            onPaymentRecorded={handlePaymentRecorded}
          />

          <PaymentHistoryModal
            isOpen={isPaymentHistoryModalOpen}
            onClose={() => {
              setIsPaymentHistoryModalOpen(false)
              fetchInvoicePaymentHistory(invoice.id)
                .then((history) => {
                  const total = (history.payments || []).reduce((sum, p) => sum + (p.available_to_refund || 0), 0)
                  setRefundableAmount(total)
                })
                .catch(() => {})
            }}
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
          />

          <MapPaymentModal
            isOpen={isMapPaymentModalOpen}
            onClose={() => setIsMapPaymentModalOpen(false)}
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            balanceAmount={parseFloat(invoice.balance_amount.toString())}
            customerId={invoice.customer_id}
            onPaymentMapped={handlePaymentMapped}
          />

          <SendInvoiceModal
            isOpen={isSendInvoiceModalOpen}
            onClose={() => setIsSendInvoiceModalOpen(false)}
            onSend={sendInvoiceByEmail}
            defaultEmail={invoice.customer?.email || ""}
          />
        </>
      )}
    </div>
  )
}
