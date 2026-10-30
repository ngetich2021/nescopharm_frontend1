"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { buildBuyerBlock, mergeCustomerSources, type CustomerAddressSource } from "@/lib/customer-address"
import { ArrowLeft, Download, Printer, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { documentFileName, fileDate, printWithFileName } from "@/lib/document-names"
import { DeliveryNoteDocument, type DeliveryNoteLoaded } from "@/components/dispatch/delivery-note-document"
import { DOCUMENT_COPIES } from "@/components/invoices/invoice-document"

export default function DeliveryNoteDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const docRef = useRef<HTMLDivElement>(null)

  const [loaded, setLoaded] = useState<DeliveryNoteLoaded | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileBase = () =>
    loaded
      ? documentFileName([
          buildBuyerBlock(mergeCustomerSources(loaded.customerDetails, loaded.dispatch.order?.customer as CustomerAddressSource | null)).name,
          `Delivery Note ${loaded.dispatch.dispatch_number}`,
          fileDate(loaded.dispatch.dispatch_date || loaded.dispatch.created_at),
        ])
      : "Delivery Note"

  const handlePrint = () => printWithFileName(fileBase())

  useEffect(() => {
    if (loaded && typeof window !== 'undefined' && window.location.search.includes('autoprint=1')) {
      const timer = setTimeout(() => printWithFileName(fileBase()), 300)
      return () => clearTimeout(timer)
    }
  }, [loaded])

  const handleDownloadPDF = async () => {
    if (!docRef.current || !loaded) return
    setIsDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      const element = docRef.current
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height)
      const imgX = (pdfWidth - canvas.width * ratio) / 2
      pdf.addImage(imgData, 'PNG', imgX, 10, canvas.width * ratio, canvas.height * ratio)
      pdf.save(`${fileBase()}.pdf`)
      toast({ title: "Success", description: "Delivery note PDF downloaded successfully" })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      toast({ title: "Error", description: "Failed to generate PDF. Please try printing instead.", variant: "destructive" })
    } finally {
      setIsDownloading(false)
    }
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Delivery Note</h2>
          <p className="mt-2 text-red-600">{error}</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
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
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={!loaded}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading || !loaded}>
                {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                {isDownloading ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Note Document - printed with no page margin (as invoices are) so the browser's
          own header and footer (web address, date) have nowhere to go; each sheet carries the space. */}
      <style>{`@media print {
        @page { size: A4; margin: 0; }
        .invoice-sheet { padding: 9mm 11mm !important; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
      }`}</style>
      <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none">
        {/* Printed four times - Original, Duplicate, Triplicate, Quadruplicate; only the original shows on screen. */}
        {DOCUMENT_COPIES.map((copyLabel, i) => (
          <div key={copyLabel} className={`invoice-sheet ${i === 0 ? "" : "hidden print:block print:break-before-page"}`}>
            <DeliveryNoteDocument
              ref={i === 0 ? docRef : undefined}
              dispatchId={id}
              copyLabel={copyLabel}
              onLoaded={i === 0 ? setLoaded : undefined}
              onError={i === 0 ? setError : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
