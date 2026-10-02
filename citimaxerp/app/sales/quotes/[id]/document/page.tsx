"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getQuoteById, Quote } from "@/lib/quotes"
import { ArrowLeft, Download, Printer, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DocumentViewToggle, useDocumentView } from "@/components/document-view-toggle"

export default function QuoteDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const quoteRef = useRef<HTMLDivElement>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useDocumentView()
  const isPricing = view === "pricing"

  useEffect(() => {
    const load = async () => {
      try {
        const fetched = await getQuoteById(id)
        if (!fetched) throw new Error("Quote not found")
        setQuote(fetched)
      } catch (err: any) {
        setError(err.message || "Failed to load quote")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id])

  const handleDownloadPDF = async () => {
    if (!quoteRef.current || !quote) return
    setIsDownloading(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")

      const canvas = await html2canvas(quoteRef.current, {
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
      pdf.save(`Quotation-${quote.quote_number}${isPricing ? "-Pricing" : ""}.pdf`)
      toast({ title: "Success", description: "Quotation PDF downloaded" })
    } catch (err) {
      console.error("Failed to generate PDF:", err)
      toast({ title: "Error", description: "Failed to generate PDF. Please try printing instead.", variant: "destructive" })
    } finally {
      setIsDownloading(false)
    }
  }

  const formatAmount = (amount: string | number) =>
    Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Quote</h2>
          <p className="mt-2 text-red-600">{error || "Quote not found"}</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const company = quote.company
  const rep = quote.sales_rep || quote.original_submitted_by
  const repName = rep ? `${rep.first_name} ${rep.last_name}`.trim() : "-"
  const clientName = quote.customer?.business_name || quote.customer?.name || "-"
  const currency = quote.currency || "KES"
  const totals = quote.totals
  const subtotal = Number(totals?.subtotal ?? quote.total_amount ?? 0)
  const discount = Number(totals?.discount ?? quote.discount ?? 0)
  const total = Number(totals?.total ?? quote.final_amount ?? 0)
  const vatTotal = (totals?.vat_lines ?? []).reduce((sum, line) => sum + Number(line.amount), 0)

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
              <DocumentViewToggle value={view} onChange={setView} />
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
          ref={quoteRef}
          className="max-w-4xl mx-auto bg-white p-6 md:p-8 shadow-lg print:shadow-none print:max-w-none print:m-0 print:p-6 print:border-0 text-sm"
        >
          {company?.letterhead_url ? (
            <img
              src={company.letterhead_url}
              alt={`${company.name} letterhead`}
              className="w-full h-auto mb-3"
              crossOrigin="anonymous"
            />
          ) : (
            <p className="text-lg font-bold text-gray-900 mb-3">{company?.name}</p>
          )}

          <div className="flex justify-between items-end mb-3">
            <h1 className="text-xl font-bold text-gray-900 tracking-wide">QUOTATION{isPricing && " (PRICING)"}</h1>
            <p className="text-xs text-gray-600">
              Date: <span className="font-semibold text-gray-900">{new Date(quote.created_at).toLocaleDateString("en-GB")}</span>
            </p>
          </div>

          <table className="w-full border border-gray-300 border-collapse text-xs mb-4">
            <tbody>
              <tr>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold w-36">Client Name:</td>
                <td className="border border-gray-300 px-2 py-1.5 text-gray-900">
                  <p className="font-semibold">{clientName}</p>
                  {quote.customer?.phone && <p>{quote.customer.phone}</p>}
                </td>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold w-32">Quote No.:</td>
                <td className="border border-gray-300 px-2 py-1.5 font-semibold text-gray-900">{quote.quote_number}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold">Sales Team Name:</td>
                <td className="border border-gray-300 px-2 py-1.5 text-gray-900">{repName}</td>
                <td className="border border-gray-300 bg-gray-50 px-2 py-1.5 font-semibold">Payment terms:</td>
                <td className="border border-gray-300 px-2 py-1.5 font-bold text-gray-900">{quote.payment_terms || "-"}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border border-gray-300 border-collapse mb-2">
            <thead>
              <tr className="bg-gray-50 text-xs">
                <th className="border border-gray-300 text-left px-2 py-1.5 font-semibold text-gray-700">Item Code</th>
                <th className="border border-gray-300 text-left px-2 py-1.5 font-semibold text-gray-700">Item Description</th>
                <th className="border border-gray-300 text-left px-2 py-1.5 font-semibold text-gray-700">Pack Size</th>
                <th className="border border-gray-300 text-right px-2 py-1.5 font-semibold text-gray-700">Unit Price ({currency})</th>
                <th className="border border-gray-300 text-right px-2 py-1.5 font-semibold text-gray-700">Order Qty</th>
                <th className="border border-gray-300 text-right px-2 py-1.5 font-semibold text-gray-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quote.quote_items?.map((item) => {
                const variantName = (item as any).variant?.name || item.variant_name
                const qty = item.unit_id && item.unit_quantity ? Number(item.unit_quantity) : item.quantity
                const vatFactor = 1 + Number(item.tax_rate || 0) / 100
                const itemCode = item.item_code || (item as any).variant?.sku || item.product?.product_code || item.product?.sku || "-"
                return (
                  <tr key={item.id}>
                    <td className="border border-gray-300 px-2 py-1.5 font-mono text-xs align-top">{itemCode}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-gray-900 align-top">
                      {item.product?.name}{variantName ? ` - ${variantName}` : ""}
                      {Number(item.tax_rate || 0) > 0 && (
                        <span className="block w-fit mt-0.5 border border-gray-500 px-1 text-[10px] font-semibold text-gray-700">
                          VAT {Number(item.tax_rate)}% inclusive
                        </span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 align-top whitespace-nowrap">{item.pack_size || "-"}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right align-top whitespace-nowrap">
                      {isPricing ? `${currency} ` : ""}{formatAmount(Number(item.unit_price) * vatFactor)}
                      {isPricing && item.price_label && <span className="font-semibold"> @ {item.price_label}</span>}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right align-top">{qty.toLocaleString()}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right align-top font-semibold">
                      {formatAmount(item.quantity * Number(item.unit_price) * vatFactor)}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right">Subtotal</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{formatAmount(subtotal)}</td>
              </tr>
              {discount > 0 && (
                <tr>
                  <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right">Discount</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right text-green-700">-{formatAmount(discount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right">VAT</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{formatAmount(vatTotal)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right">Total ({currency})</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right">{formatAmount(total)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-right text-xs text-gray-500">Unit prices and amounts are inclusive of VAT.</p>


          {quote.valid_until && (
            <div className="mt-6 rounded bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              This quote is valid until {new Date(quote.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}

          <div className="mt-6 text-sm text-gray-600">
            {quote.notes ? (
              <>
                <p className="font-semibold text-gray-700 mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{quote.notes}</p>
              </>
            ) : (
              <p>Thank you for considering our quotation.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
