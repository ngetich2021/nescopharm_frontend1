"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { fetchInvoiceById, Invoice } from "@/lib/invoices"
import { getCompany, Company } from "@/lib/company"
import { getCustomerProfile, CustomerProfileData } from "@/lib/customers"
import { buildBuyerBlock, mergeCustomerSources } from "@/lib/customer-address"
import { getCustomerAccount, type CustomerAccountWithDetails } from "@/lib/customer-accounts"
import { INVOICE_PAYMENT_DETAILS, COMPANY_KRA_PIN } from "@/lib/invoice-payment-details"
import { getEtimsConfig } from "@/lib/etims"
import { amountInWords } from "@/lib/number-to-words"
import { ArrowLeft, Download, Mail, Printer } from "lucide-react"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DocumentViewToggle, useDocumentView } from "@/components/document-view-toggle"
import { documentCode } from "@/lib/price-codes"

export default function InvoiceDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const invoiceRef = useRef<HTMLDivElement>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [customerDetails, setCustomerDetails] = useState<CustomerProfileData | null>(null)
  const [customerAccount, setCustomerAccount] = useState<CustomerAccountWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companyPin, setCompanyPin] = useState<string | null>(null)
  const [view, setView] = useDocumentView()
  const isPricing = view === "pricing"

  useEffect(() => {
    getEtimsConfig().then((res) => setCompanyPin(res?.config?.kra_pin || null)).catch(() => setCompanyPin(null))
  }, [])

  useEffect(() => {
    const getInvoice = async () => {
      try {
        const fetchedInvoice = await fetchInvoiceById(id)
        setInvoice(fetchedInvoice)
        
        // Fetch company data attached to the invoice
        if (fetchedInvoice.company_id) {
          try {
            if (fetchedInvoice.company) {
              setCompany(fetchedInvoice.company as Company)
            } else {
              const companyData = await getCompany(fetchedInvoice.company_id)
              setCompany(companyData)
            }
          } catch (err) {
            console.error('Failed to fetch company:', err)
          }
        }
        
        // Fetch full customer details to get customer_type and business_name
        if (fetchedInvoice.customer_id) {
          try {
            const fullCustomerData = await getCustomerProfile(fetchedInvoice.customer_id)
            if (fullCustomerData) {
              setCustomerDetails(fullCustomerData)

              // Non-company customers without their own KRA PIN fall back to a
              // director's PIN on their credit account. Companies must use their
              // own pin_number (a director's PIN isn't the company's tax PIN).
              if (fullCustomerData.customer_type !== "company" && !fullCustomerData.pin_number && fullCustomerData.account_id) {
                try {
                  const account = await getCustomerAccount(fullCustomerData.account_id)
                  setCustomerAccount(account)
                } catch (err) {
                  console.error('Failed to fetch customer account:', err)
                }
              }
            }
          } catch (err) {
            console.error('Failed to fetch customer details:', err)
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load invoice")
      } finally {
        setIsLoading(false)
      }
    }

    getInvoice()
  }, [id])

  const handlePrint = () => {
    window.print()
  }

  // Allow linking straight to a print or download dialog
  useEffect(() => {
    if (!isLoading && invoice && typeof window !== 'undefined') {
      if (window.location.search.includes('autoprint=1')) {
        const timer = setTimeout(() => window.print(), 300)
        return () => clearTimeout(timer)
      } else if (window.location.search.includes('download=1')) {
        const timer = setTimeout(() => handleDownloadPDF(), 300)
        return () => clearTimeout(timer)
      }
    }
  }, [isLoading, invoice])

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current || !invoice) return
    
    setIsDownloading(true)
    
    try {
      // Dynamically import the libraries
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      
      const element = invoiceRef.current
      
      // Create canvas from the invoice element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      
      const imgData = canvas.toDataURL('image/png')
      
      // Calculate dimensions for A4 page
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = 10
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      pdf.save(`Invoice-${invoice.invoice_number}${isPricing ? "-Pricing" : ""}.pdf`)
      
      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully",
      })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try printing instead.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const formatAmount = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatBatchDate = (date: string): string =>
    new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replace(/ /g, "-")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Invoice</h2>
          <p className="mt-2 text-red-600">{error || "Invoice not found"}</p>
          <Button 
            variant="outline" 
            onClick={() => router.back()} 
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      {/* Action Bar - Hide on print */}
      <div className="bg-white border-b print:hidden sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              <DocumentViewToggle value={view} onChange={setView} />
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadPDF}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isDownloading ? 'Generating...' : 'Download PDF'}
              </Button>
              <Button variant="outline" size="sm">
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none">
        <Card 
          ref={invoiceRef}
          className="max-w-4xl mx-auto bg-white p-6 md:p-8 shadow-lg print:shadow-none print:max-w-none print:m-0 print:p-6 print:border-0 text-sm"
        >
          {/* Letterhead Banner - the sole source of company identity/contact info on this document.
              Full width at its natural aspect ratio - cropping or forcing a fixed height distorts/cuts
              the logo, so height is left to scale with width instead. */}
          {(company?.letterhead_url || invoice.company?.letterhead_url) && (
            <img
              src={company?.letterhead_url || invoice.company?.letterhead_url || undefined}
              alt={`${company?.name || invoice.company?.name} letterhead`}
              className="w-full h-auto mb-2"
              crossOrigin="anonymous"
            />
          )}

          {/* Header */}
          <div className="flex justify-between items-end mb-3">
            <h1 className="text-xl font-bold text-gray-900 tracking-wide">INVOICE{isPricing && " (PRICING)"}</h1>
            {invoice.due_date && invoice.due_date !== invoice.invoice_date && (
              <p className="text-xs text-gray-600">
                Due Date: <span className="font-semibold text-gray-900">{new Date(invoice.due_date).toLocaleDateString()}</span>
              </p>
            )}
          </div>

          {/* Bill To / Reference & Dispatch Details - one continuous bordered
              box (matching the reference invoice's own layout) instead of
              two loosely-spaced, differently-styled sections. */}
          <div className="grid grid-cols-2 border border-gray-300 text-xs leading-tight">
            <div className="px-2 py-1 border-r border-gray-300">
              <p className="text-[10px] font-semibold text-gray-500 mb-0.5">BUYER (BILL TO)</p>
              {(() => {
                const buyer = buildBuyerBlock(
                  mergeCustomerSources(customerDetails, invoice.customer),
                )
                // An individual with no PIN of their own falls back to a
                // director's, which only the account carries.
                const pin = buyer.kraPin || customerAccount?.directors?.find((d) => d.pin?.trim())?.pin
                const email = customerDetails?.email || invoice.customer?.email
                const phone = customerDetails?.phone || invoice.customer?.phone
                return (
                  <div className="text-gray-900">
                    <p className="font-semibold">{buyer.name}</p>
                    {buyer.careOf && <p>c/o {buyer.careOf}</p>}
                    {buyer.addressLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {email && <p>{email}</p>}
                    {phone && <p>{phone}</p>}
                    {pin && <p className="font-semibold">KRA PIN: {pin}</p>}
                  </div>
                )
              })()}
            </div>

            {/* Reference & Dispatch Details - a tight grid of label/value
                cells, same box, no extra padding or gaps between rows. Packed
                4 cells per row (rather than 2) to fit this many fields
                without an overly tall document. */}
            <div className="divide-y divide-gray-300">
              {(() => {
                const cells = [
                  { label: "Invoice No.", value: invoice.invoice_number },
                  { label: "Dated", value: new Date(invoice.invoice_date).toLocaleDateString() },
                  { label: "Delivery Note", value: invoice.delivery_note_number || "N/A" },
                  { label: "Mode/Terms of Payment", value: invoice.mode_of_payment || "N/A" },
                  {
                    label: "Delivery Note Date",
                    value: invoice.delivery_note_date ? new Date(invoice.delivery_note_date).toLocaleDateString() : "N/A",
                  },
                  {
                    label: "Reference No. & Date",
                    value: invoice.reference_number
                      ? `${invoice.reference_number}${invoice.reference_date ? ` dt. ${new Date(invoice.reference_date).toLocaleDateString()}` : ""}`
                      : "N/A",
                  },
                  { label: "Other References", value: invoice.other_references || "N/A" },
                  {
                    label: "Buyer's Order No.",
                    value: invoice.buyers_order_no
                      ? `${invoice.buyers_order_no}${invoice.buyers_order_date ? ` dt. ${new Date(invoice.buyers_order_date).toLocaleDateString()}` : ""}`
                      : "N/A",
                  },
                  { label: "Dispatch Doc No.", value: invoice.dispatch_doc_no || "N/A" },
                  { label: "Dispatched Through", value: invoice.dispatched_through || "N/A" },
                  { label: "Destination", value: invoice.destination || "N/A" },
                ]

                const rows: (typeof cells)[] = []
                for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4))

                return rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-4 divide-x divide-gray-300">
                    {row.map((cell) => (
                      <div key={cell.label} className="px-1.5 py-0.5">
                        <p className="text-[10px] text-gray-500">{cell.label}</p>
                        <p className="text-gray-900 break-words font-semibold">{cell.value}</p>
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Terms of Delivery - a standing company policy line, kept below
              the Buyer/Reference box (as its own full-width row) rather than
              squeezed into a quarter-width grid cell where it wrapped across
              several lines and inflated the whole table's height. */}
          <div className="mb-4 border border-t-0 border-gray-300 px-1.5 py-0.5 text-xs leading-tight">
            <p className="text-[10px] text-gray-500">Terms of Delivery</p>
            <p className="font-bold text-gray-900 break-words">
              {invoice.terms_of_delivery || "Returns shall only be accepted within 7 days from delivery."}
            </p>
          </div>

          {/* Line Items Table */}
          <div className="mb-4">
            <table className="w-full border border-gray-300 border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs">
                  <th className="border border-gray-300 text-left px-2 py-1.5 font-semibold text-gray-700 w-10">S/No</th>
                  <th className="border border-gray-300 text-left px-2 py-1.5 font-semibold text-gray-700 whitespace-nowrap">Code No.</th>
                  <th className="border border-gray-300 text-left px-2 py-1.5 font-semibold text-gray-700">Item Name</th>
                  <th className="border border-gray-300 text-left px-2 py-1.5 font-semibold text-gray-700">Pack Size</th>
                  <th className="border border-gray-300 text-right px-2 py-1.5 font-semibold text-gray-700">Price per Pack (Ksh)</th>
                  <th className="border border-gray-300 text-right px-2 py-1.5 font-semibold text-gray-700">Order Qty</th>
                  <th className="border border-gray-300 text-right px-2 py-1.5 font-semibold text-gray-700">Total Value (Ksh)</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items && invoice.line_items.map((item, index) => {
                  // Invoices created from an order carry each FEFO batch with its own qty;
                  // older/manual lines only have a single batch_number/expiry_date.
                  const batches = item.metadata?.batches?.length
                    ? item.metadata.batches
                    : (item.batch_number || item.expiry_date)
                      ? [{ batch_number: item.batch_number ?? null, expiry_date: item.expiry_date ?? null, quantity: null }]
                      : []
                  const packSize = item.unit || "pcs"
                  const qty = parseFloat(item.quantity.toString())
                  const vatRate = parseFloat((item.tax_rate ?? 0).toString())
                  const unitPriceInclVat = parseFloat(item.unit_price.toString()) * (1 + vatRate / 100)
                  return (
                    <tr key={item.id || index} className="leading-5">
                      <td className="border border-gray-300 px-2 py-1.5 text-gray-900 align-top">{index + 1}</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-gray-900 align-top whitespace-nowrap font-mono text-xs">
                        {documentCode(item.metadata?.price_label, (item.product as any)?.item_number)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-gray-900 align-top">
                        <p className="font-semibold">{item.description}</p>
                        {vatRate > 0 && (
                          <span className="inline-block mt-0.5 border border-gray-500 px-1 text-[10px] font-semibold text-gray-700">
                            VAT {vatRate}% inclusive
                          </span>
                        )}
                        {batches.map((b, i) => (
                          <div key={i} className="pl-6 text-xs italic text-gray-600">
                            <p>Batch&nbsp;&nbsp;: {b.batch_number || "N/A"}</p>
                            <p>Expiry : {b.expiry_date ? formatBatchDate(b.expiry_date) : "N/A"}</p>
                          </div>
                        ))}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-gray-900 align-top">{packSize}</td>
                      <td className="border border-gray-300 text-right px-2 py-1.5 text-gray-900 align-top whitespace-nowrap">
                        {formatAmount(unitPriceInclVat)}
                        {isPricing && item.metadata?.price_label && <span className="font-semibold"> @ {item.metadata.price_label}</span>}
                      </td>
                      {/* Per-batch qtys only when the line was split across batches; one batch would just repeat the total. */}
                      <td className="border border-gray-300 text-right px-2 py-1.5 text-gray-900 align-top whitespace-nowrap">
                        <p className="font-semibold">{qty.toLocaleString()}</p>
                        {batches.length > 1 && batches.map((b, i) => (
                          <div key={i} className="text-xs">
                            <p>{b.quantity != null ? b.quantity.toLocaleString() : " "}</p>
                            <p>&nbsp;</p>
                          </div>
                        ))}
                      </td>
                      <td className="border border-gray-300 text-right px-2 py-1.5 text-gray-900 align-top font-semibold">
                        {formatAmount(qty * unitPriceInclVat)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-4">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-900">KES {formatAmount(invoice.subtotal)}</span>
              </div>
              {parseFloat(invoice.discount_amount.toString()) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="text-green-600">-KES {formatAmount(invoice.discount_amount)}</span>
                </div>
              )}
              {parseFloat(invoice.tax_amount.toString()) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT:</span>
                  <span className="text-gray-900">KES {formatAmount(invoice.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t-2 border-gray-300 pt-2">
                <span>Total:</span>
                <span>KES {formatAmount(invoice.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="text-green-600">KES {formatAmount(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Balance Due:</span>
                <span className={parseFloat(invoice.balance_amount.toString()) > 0 ? "text-red-600" : "text-green-600"}>
                  KES {formatAmount(invoice.balance_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Amount Chargeable (in words) */}
          <div className="mb-8 pt-3 border-t border-gray-200 flex justify-between items-start gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Amount Chargeable (in words)</p>
              <p className="text-sm font-medium text-gray-900">{amountInWords(invoice.total_amount)}</p>
            </div>
            <p className="text-xs text-gray-500 italic whitespace-nowrap">E. &amp; O.E</p>
          </div>

          {/* Notes & Payment Terms */}
          {(invoice.notes || invoice.payment_terms) && (
            <div className="border-t border-gray-200 pt-6 space-y-4">
              {invoice.payment_terms && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Payment Terms</p>
                  <p className="text-sm text-gray-600">{invoice.payment_terms}</p>
                </div>
              )}
              {invoice.notes && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Notes</p>
                  <p className="text-sm text-gray-600">{invoice.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Company KRA PIN & Payment Details - always shown, side by side */}
          {(() => {
            const c = company || (invoice.company as Company | undefined)
            return (
              <div className="mt-6 border border-gray-300 text-xs leading-snug">
                <p className="bg-gray-50 border-b border-gray-300 px-2 py-1 font-bold text-gray-800">
                  {(c?.name || 'COMPANY').toUpperCase()} PAYMENT DETAILS
                </p>
                <div className="grid grid-cols-3 divide-x divide-gray-300">
                  <div className="px-2 py-1.5">
                    <p className="font-semibold text-gray-800 mb-0.5">COMPANY&apos;S KRA PIN</p>
                    <p className="font-bold text-gray-900">{companyPin || COMPANY_KRA_PIN}</p>
                  </div>
                  <div className="px-2 py-1.5 text-gray-700">
                    <p className="font-semibold text-gray-800 mb-0.5">M-PESA</p>
                    <p>Paybill: <span className="font-semibold text-gray-900">{c?.mpesa_paybill || INVOICE_PAYMENT_DETAILS.mpesaPaybill}</span></p>
                    <p>Account No: <span className="font-semibold text-gray-900">{c?.mpesa_account_number || INVOICE_PAYMENT_DETAILS.mpesaAccount}</span></p>
                  </div>
                  <div className="px-2 py-1.5 text-gray-700">
                    <p className="font-semibold text-gray-800 mb-0.5">BANK DETAILS</p>
                    <p>Bank: <span className="font-semibold text-gray-900">{c?.bank_name || INVOICE_PAYMENT_DETAILS.bankName}</span></p>
                    <p>A/C Name: <span className="font-semibold text-gray-900">{c?.bank_account_name || INVOICE_PAYMENT_DETAILS.bankAccountName}</span></p>
                    <p>A/C No: <span className="font-semibold text-gray-900">{c?.bank_account_number || INVOICE_PAYMENT_DETAILS.bankAccountNumber}</span></p>
                    <p>Branch: <span className="font-semibold text-gray-900">{c?.bank_branch || INVOICE_PAYMENT_DETAILS.bankBranch}</span></p>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Declaration & Signature */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-end gap-8">
            <div className="max-w-sm">
              <p className="text-xs font-semibold text-gray-700 mb-1">Declaration</p>
              <p className="text-xs text-gray-500">
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-700 mb-8">for {company?.name || invoice.company?.name || 'the Company'}</p>
              <p className="text-xs text-gray-500 border-t border-gray-300 pt-1">Authorised Signatory</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-500 space-y-1">
            <p>Thank you for your business!</p>
            <p>This is a Computer Generated Invoice</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
