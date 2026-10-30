"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { Invoice } from "@/lib/invoices"
import type { Company } from "@/lib/company"
import type { CustomerProfileData } from "@/lib/customers"
import { buildBuyerBlock, mergeCustomerSources } from "@/lib/customer-address"
import type { CustomerAccountWithDetails } from "@/lib/customer-accounts"
import { getEtimsConfig } from "@/lib/etims"
import { ArrowLeft, Download, FileText, Mail, Printer } from "lucide-react"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { documentFileName, fileDate, printWithFileName } from "@/lib/document-names"
import { DOCUMENT_COPIES, InvoiceDocument, loadInvoiceDocumentData, RETURN_POLICY_IMAGE, RETURN_POLICY_PDF } from "@/components/invoices/invoice-document"
import { FileLink } from "@/components/file-preview"
import { listOrderDispatches } from "@/lib/order-dispatches"
import { DeliveryNoteDocument } from "@/components/dispatch/delivery-note-document"
import { fixTextOffset } from "@/lib/pdf-capture"

export default function InvoiceDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const invoiceRef = useRef<HTMLDivElement>(null)
  // The invoice goes out with its order's delivery note (the current, not rejected, dispatch).
  const deliveryNoteRef = useRef<HTMLDivElement>(null)
  // undefined while still looking; null when the order has no live dispatch.
  const [dispatchId, setDispatchId] = useState<string | null | undefined>(undefined)
  const [deliveryNoteReady, setDeliveryNoteReady] = useState(false)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [customerDetails, setCustomerDetails] = useState<CustomerProfileData | null>(null)
  const [customerAccount, setCustomerAccount] = useState<CustomerAccountWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companyPin, setCompanyPin] = useState<string | null>(null)

  useEffect(() => {
    getEtimsConfig().then((res) => setCompanyPin(res?.config?.kra_pin || null)).catch(() => setCompanyPin(null))
  }, [])

  useEffect(() => {
    loadInvoiceDocumentData(id)
      .then((data) => {
        setInvoice(data.invoice)
        setCompany(data.company)
        setCustomerDetails(data.customerDetails)
        setCustomerAccount(data.customerAccount)
      })
      .catch((err: any) => setError(err.message || "Failed to load invoice"))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => {
    if (!invoice) return
    if (!invoice.order_id) {
      setDispatchId(null)
      return
    }
    listOrderDispatches({ order_id: invoice.order_id, per_page: 20 })
      .then((res) => {
        const live = (res.data || [])
          .filter((d) => !["cancelled", "rejected"].includes(d.status) && d.approval_status !== "rejected")
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        setDispatchId(live[0]?.id ?? null)
      })
      .catch(() => setDispatchId(null))
  }, [invoice])

  // Both documents are on the page (or there is no delivery note to wait for).
  const documentsReady = !!invoice && dispatchId !== undefined && (dispatchId === null || deliveryNoteReady)

  const fileBase = () =>
    invoice
      ? documentFileName([
          buildBuyerBlock(mergeCustomerSources(customerDetails, invoice.customer)).name,
          `Invoice ${invoice.invoice_number}`,
          fileDate(invoice.invoice_date),
        ])
      : "Invoice"

  const handlePrint = () => {
    printWithFileName(fileBase())
  }

  // Allow linking straight to a print or download dialog
  useEffect(() => {
    if (!isLoading && documentsReady && typeof window !== 'undefined') {
      if (window.location.search.includes('autoprint=1')) {
        const timer = setTimeout(() => printWithFileName(fileBase()), 300)
        return () => clearTimeout(timer)
      } else if (window.location.search.includes('download=1')) {
        const timer = setTimeout(() => handleDownloadPDF(), 300)
        return () => clearTimeout(timer)
      }
    }
  }, [isLoading, documentsReady])

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
        logging: false, onclone: fixTextOffset,
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

      // Then the order's delivery note, on its own page.
      if (deliveryNoteRef.current && deliveryNoteReady) {
        const noteCanvas = await html2canvas(deliveryNoteRef.current, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false, onclone: fixTextOffset,
        })
        const noteRatio = Math.min(pdfWidth / noteCanvas.width, pdfHeight / noteCanvas.height)
        pdf.addPage()
        pdf.addImage(
          noteCanvas.toDataURL('image/png'),
          'PNG',
          (pdfWidth - noteCanvas.width * noteRatio) / 2,
          10,
          noteCanvas.width * noteRatio,
          noteCanvas.height * noteRatio,
        )
      }

      // The return policy always goes out with the invoice, as its last page.
      const policy = await fetch(RETURN_POLICY_IMAGE).then((r) => r.blob()).then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      }))
      pdf.addPage()
      pdf.addImage(policy, 'JPEG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`${fileBase()}.pdf`)
      
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
              <Button variant="outline" size="sm" asChild>
                <FileLink href={RETURN_POLICY_PDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Return Policy
                </FileLink>
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
        {/* Printed four times - Original, Duplicate, Triplicate, Quadruplicate - each invoice
            followed by its delivery note; the return policy goes with the original. Only the
            original shows on screen (and in the PDF). */}
        {DOCUMENT_COPIES.map((copyLabel, i) => (
          <div key={copyLabel} className={i === 0 ? undefined : "hidden print:block print:break-before-page"}>
            <InvoiceDocument
              ref={i === 0 ? invoiceRef : undefined}
              invoice={invoice}
              company={company}
              customerDetails={customerDetails}
              customerAccount={customerAccount}
              companyPin={companyPin}
              copyLabel={copyLabel}
              withPolicy={i === 0}
              enclosures={dispatchId && (
                <div className="invoice-sheet mt-6 print:mt-0 print:break-before-page">
                  <DeliveryNoteDocument
                    ref={i === 0 ? deliveryNoteRef : undefined}
                    dispatchId={dispatchId}
                    copyLabel={copyLabel}
                    onLoaded={i === 0 ? () => setDeliveryNoteReady(true) : undefined}
                    onError={i === 0 ? () => setDispatchId(null) : undefined}
                  />
                </div>
              )}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
