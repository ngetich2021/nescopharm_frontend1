"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getDeliveryInvoice, DeliveryInvoice } from "@/lib/delivery-invoices"
import { ArrowLeft, Download, Printer, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  cancelled: "bg-gray-100 text-gray-800",
}

export default function DeliveryInvoiceDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const docRef = useRef<HTMLDivElement>(null)
  const [invoice, setInvoice] = useState<DeliveryInvoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const fetched = await getDeliveryInvoice(id)
        setInvoice(fetched)
      } catch (err: any) {
        setError(err.message || "Failed to load delivery invoice")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id])

  const handleDownloadPDF = async () => {
    if (!docRef.current || !invoice) return
    setIsDownloading(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")

      const canvas = await html2canvas(docRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      })

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height)
      const imgX = (pdfWidth - canvas.width * ratio) / 2

      pdf.addImage(canvas.toDataURL("image/png"), "PNG", imgX, 10, canvas.width * ratio, canvas.height * ratio)
      pdf.save(`Delivery-Invoice-${invoice.invoice_number}.pdf`)
      toast({ title: "Success", description: "Delivery invoice PDF downloaded" })
    } catch (err) {
      console.error("Failed to generate PDF:", err)
      toast({ title: "Error", description: "Failed to generate PDF. Please try printing instead.", variant: "destructive" })
    } finally {
      setIsDownloading(false)
    }
  }

  useEffect(() => {
    if (!isLoading && invoice && typeof window !== "undefined") {
      if (window.location.search.includes("autoprint=1")) {
        const timer = setTimeout(() => window.print(), 300)
        return () => clearTimeout(timer)
      } else if (window.location.search.includes("download=1")) {
        const timer = setTimeout(() => handleDownloadPDF(), 300)
        return () => clearTimeout(timer)
      }
    }
  }, [isLoading, invoice])

  const formatAmount = (amount: string | number) =>
    Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
          <h2 className="text-lg font-semibold text-red-800">Error Loading Delivery Invoice</h2>
          <p className="mt-2 text-red-600">{error || "Delivery invoice not found"}</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const company = invoice.company
  const orderNumber = invoice.order_dispatch?.order?.order_number || invoice.order_dispatch?.order_id || "-"
  const customerName = invoice.order_dispatch?.order?.customer?.name || "-"

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      <div className="bg-white border-b print:hidden sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                {isDownloading ? "Generating..." : "Download PDF"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none">
        <Card
          ref={docRef}
          className="max-w-3xl mx-auto bg-white p-6 md:p-8 shadow-lg print:shadow-none print:max-w-none print:m-0 print:p-6 print:border-0 text-sm"
        >
          {company?.letterhead_url ? (
            <img
              src={company.letterhead_url}
              alt={`${company.name} letterhead`}
              className="w-full h-auto mb-3"
              crossOrigin="anonymous"
            />
          ) : (
            <p className="text-lg font-bold text-gray-900 mb-3">{company?.name || ""}</p>
          )}

          <div className="flex justify-between items-end mb-4">
            <h1 className="text-xl font-bold text-gray-900 tracking-wide">DELIVERY INVOICE</h1>
            <Badge className={STATUS_STYLES[invoice.status]}>{invoice.status}</Badge>
          </div>

          <table className="w-full border border-gray-300 border-collapse text-xs mb-4">
            <tbody>
              <tr>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold w-36">Invoice No.:</td>
                <td className="border border-gray-300 px-2 py-1.5 font-semibold text-gray-900">{invoice.invoice_number}</td>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold w-32">Date:</td>
                <td className="border border-gray-300 px-2 py-1.5 text-gray-900">{new Date(invoice.created_at).toLocaleDateString("en-GB")}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold">Order:</td>
                <td className="border border-gray-300 px-2 py-1.5 text-gray-900">{orderNumber}</td>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold">Customer:</td>
                <td className="border border-gray-300 px-2 py-1.5 text-gray-900">{customerName}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold">Transporter:</td>
                <td className="border border-gray-300 px-2 py-1.5 text-gray-900">{invoice.transporter_name}</td>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold">Zone:</td>
                <td className="border border-gray-300 px-2 py-1.5 text-gray-900 capitalize">{invoice.zone}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold">Transporter Invoice:</td>
                <td className="border border-gray-300 px-2 py-1.5 font-semibold text-gray-900">{invoice.transporter_invoice_number || "—"}</td>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold">Delivery Person:</td>
                <td className="border border-gray-300 px-2 py-1.5 text-gray-900">
                  {(() => {
                    const person = invoice.logistic?.delivery_person
                    const name = person?.full_name || invoice.logistic?.driver_name
                    const contact = person?.phone_number || invoice.logistic?.driver_contact
                    if (!name && !contact) return "—"
                    return (
                      <>
                        <p>{name || "—"}</p>
                        {contact && <p className="text-gray-600">{contact}</p>}
                      </>
                    )
                  })()}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border border-gray-300 border-collapse mb-4">
            <thead>
              <tr className="bg-gray-50 text-xs">
                <th className="border border-gray-300 text-left px-2 py-1.5 font-semibold text-gray-700">Description</th>
                <th className="border border-gray-300 text-right px-2 py-1.5 font-semibold text-gray-700">Cartons</th>
                <th className="border border-gray-300 text-right px-2 py-1.5 font-semibold text-gray-700">Rate/Carton (KES)</th>
                <th className="border border-gray-300 text-right px-2 py-1.5 font-semibold text-gray-700">Amount (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-2 py-1.5">Delivery service - {invoice.zone}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{invoice.number_of_cartons}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{formatAmount(invoice.rate_per_carton)}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold">{formatAmount(invoice.total_amount)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={3} className="border border-gray-300 px-2 py-1.5 text-right">Total (KES)</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{formatAmount(invoice.total_amount)}</td>
              </tr>
            </tbody>
          </table>

          {invoice.status === "paid" && (
            <table className="w-full border border-gray-300 border-collapse text-xs mb-4">
              <tbody>
                <tr>
                  <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold w-36">Payment Method:</td>
                  <td className="border border-gray-300 px-2 py-1.5 capitalize text-gray-900">{invoice.payment_method || "-"}</td>
                  <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold w-32">Payment Date:</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-gray-900">
                    {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString("en-GB") : "-"}
                  </td>
                </tr>
                {invoice.payment_reference && (
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold">Reference:</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-gray-900" colSpan={3}>{invoice.payment_reference}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <div className="mt-6 text-sm text-gray-600">
            <p>Thank you for your business.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
