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
import { InvoiceDocument, loadInvoiceDocumentData, RETURN_POLICY_IMAGE, RETURN_POLICY_PDF } from "@/components/invoices/invoice-document"

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
    if (!isLoading && invoice && typeof window !== 'undefined') {
      if (window.location.search.includes('autoprint=1')) {
        const timer = setTimeout(() => printWithFileName(fileBase()), 300)
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
                <a href={RETURN_POLICY_PDF} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" />
                  Return Policy
                </a>
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
        <InvoiceDocument
          ref={invoiceRef}
          invoice={invoice}
          company={company}
          customerDetails={customerDetails}
          customerAccount={customerAccount}
          companyPin={companyPin}
        />
      </div>
    </div>
  )
}
