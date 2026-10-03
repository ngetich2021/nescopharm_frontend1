"use client"

import { sizedName } from "@/lib/product-sizes"
import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getOrderDispatch, type OrderDispatch } from "@/lib/order-dispatches"
import { getCompany, Company } from "@/lib/company"
import { getCustomerProfile, CustomerProfileData } from "@/lib/customers"
import { getCustomerDisplayName } from "@/lib/customers"
import { getEtimsConfig } from "@/lib/etims"
import { COMPANY_KRA_PIN } from "@/lib/invoice-payment-details"
import { dispatchItemUnit, piecesPerPack } from "@/lib/price-codes"
import { format } from "date-fns"
import { ArrowLeft, Download, Printer, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function DeliveryNoteDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const docRef = useRef<HTMLDivElement>(null)

  const [dispatch, setDispatch] = useState<OrderDispatch | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [customerDetails, setCustomerDetails] = useState<CustomerProfileData | null>(null)
  const [companyPin, setCompanyPin] = useState<string | null>(null)
  const [warehouseManagerName, setWarehouseManagerName] = useState<string | null>(null)
  const [approverName, setApproverName] = useState<string | null>(null)
  const [letterheadIndex, setLetterheadIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getOrderDispatch(id)
        const d = res.data
        setDispatch(d)

        if (d.company_id) {
          getCompany(d.company_id).then(setCompany).catch(() => setCompany(null))
        }
        if (d.order?.customer?.id) {
          getCustomerProfile(d.order.customer.id).then(setCustomerDetails).catch(() => setCustomerDetails(null))
        }
        getEtimsConfig().then((res: any) => setCompanyPin(res?.data?.kra_pin || res?.kra_pin || null)).catch(() => setCompanyPin(null))

        const fullName = (u?: { full_name?: string; first_name?: string; last_name?: string } | null) =>
          u ? (u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || null) : null

        setWarehouseManagerName(fullName(d.created_by))

        const approved = (d.approver_details || [])
          .filter((a) => a.status === 'approved' && a.user)
          .sort((a, b) => b.order - a.order)
        setApproverName(fullName(approved[0]?.user))
      } catch (err: any) {
        setError(err.message || "Failed to load dispatch")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id])

  const handlePrint = () => window.print()

  useEffect(() => {
    if (!isLoading && dispatch && typeof window !== 'undefined' && window.location.search.includes('autoprint=1')) {
      const timer = setTimeout(() => window.print(), 300)
      return () => clearTimeout(timer)
    }
  }, [isLoading, dispatch])

  const handleDownloadPDF = async () => {
    if (!docRef.current || !dispatch) return
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
      pdf.save(`Delivery-Note-${dispatch.dispatch_number}.pdf`)
      toast({ title: "Success", description: "Delivery note PDF downloaded successfully" })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      toast({ title: "Error", description: "Failed to generate PDF. Please try printing instead.", variant: "destructive" })
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

  if (error || !dispatch) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Delivery Note</h2>
          <p className="mt-2 text-red-600">{error || "Dispatch not found"}</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const customerDisplayName = dispatch.order?.customer ? getCustomerDisplayName(dispatch.order.customer) : "Customer"
  const businessName = customerDetails?.business_name || dispatch.order?.customer?.business_name
  const destination = dispatch.delivery_location?.landmark || dispatch.logistic?.delivery_location || "N/A"
  const customerPin = customerDetails?.pin_number || (dispatch.order?.customer as any)?.pin_number || 'N/A'
  const companySlug = company?.name?.toLowerCase().trim().split(/\s+/)[0]
  // Public-folder copy first (same origin, always available), then the API-served one.
  const letterheadCandidates = [
    companySlug && `/company/${companySlug}-letterhead.jpg`,
    '/company/nescopharm-letterhead.jpg',
    company?.letterhead_url,
  ].filter((s, i, arr): s is string => !!s && arr.indexOf(s) === i)
  const letterheadSrc = letterheadCandidates[letterheadIndex]
  const dispatchDate = dispatch.dispatch_date || dispatch.created_at
  const dateStr = dispatchDate ? format(new Date(dispatchDate), 'dd-MMM-yy') : 'N/A'

  const referenceCells = [
    { label: "Delivery Note No.", value: dispatch.dispatch_number },
    { label: "Dated", value: dateStr },
    { label: "Reference No. & Date", value: dispatch.order?.order_number ? `${dispatch.order.order_number} dt. ${dateStr}` : "N/A" },
    { label: "Mode/Terms of Payment", value: dispatch.order?.payment_status ? dispatch.order.payment_status.replace(/^\w/, c => c.toUpperCase()) : "N/A" },
    { label: "Buyer's Order No.", value: dispatch.order?.order_number || "N/A" },
    { label: "Other References", value: dispatch.logistic?.tracking_number || "N/A" },
    { label: "Dispatch Doc No.", value: dispatch.dispatch_number },
    { label: "Dated", value: dateStr },
    { label: "Dispatched through", value: dispatch.logistic?.logistics_provider || dispatch.logistic?.delivery_method || "N/A" },
    { label: "Destination", value: destination },
  ]
  // Lines are sold in packs (e.g. "Per pack of 100's"); the note counts pieces handed over.
  const lines = (dispatch.items || []).map((item) => {
    const packs = Number(item.quantity || 0)
    const perPack = piecesPerPack(dispatchItemUnit(item))
    return { item, packs, perPack, pieces: perPack ? packs * perPack : packs }
  })
  const totalPieces = lines.reduce((sum, l) => sum + l.pieces, 0)
  const referenceRows: (typeof referenceCells)[] = []
  for (let i = 0; i < referenceCells.length; i += 2) referenceRows.push(referenceCells.slice(i, i + 2))

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
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                {isDownloading ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Note Document */}
      <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none">
        <Card
          ref={docRef}
          className="max-w-4xl mx-auto bg-white p-6 md:p-8 shadow-lg print:shadow-none print:max-w-none print:m-0 print:p-6 print:border-0 text-sm"
        >
          {letterheadSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={letterheadSrc}
              src={letterheadSrc}
              alt={`${company?.name || 'Company'} letterhead`}
              className="w-full h-auto mb-2"
              onError={() => setLetterheadIndex((i) => i + 1)}
            />
          ) : (
            <div className="mb-3">
              <p className="font-bold text-gray-900 text-base">{company?.name || 'Company Name'}</p>
              {company?.address && <p className="text-xs text-gray-600">{company.address}</p>}
              <p className="text-xs text-gray-600">
                {[company?.phone && `Contact: ${company.phone}`, company?.email && `E-Mail: ${company.email}`].filter(Boolean).join('  ')}
              </p>
            </div>
          )}

          {/* Header */}
          <div className="flex justify-between items-end mb-3">
            <h1 className="text-xl font-bold text-gray-900 tracking-wide">DELIVERY NOTE</h1>
          </div>

          {/* Buyer / Reference - one continuous bordered box, matching the invoice's own layout */}
          <div className="grid grid-cols-2 border border-gray-300 text-xs leading-tight">
            <div className="px-2 py-1 border-r border-gray-300">
              <p className="text-[10px] font-semibold text-gray-500 mb-0.5">BUYER (BILL TO)</p>
              <div className="text-gray-900">
                <p className="font-semibold">{businessName || customerDisplayName}</p>
                {businessName && <p>c/o {customerDisplayName}</p>}
                {(customerDetails?.phone || dispatch.order?.customer?.phone) && (
                  <p>{customerDetails?.phone || dispatch.order?.customer?.phone}</p>
                )}
                {(customerDetails?.address || dispatch.order?.customer?.address) && (
                  <p>{customerDetails?.address || dispatch.order?.customer?.address}</p>
                )}
                <p>PIN : {customerPin}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-300">
              {referenceRows.map((row, i) => (
                <div key={i} className="grid grid-cols-2 divide-x divide-gray-300">
                  {row.map((cell) => (
                    <div key={cell.label} className="px-1.5 py-0.5">
                      <p className="text-[10px] text-gray-500">{cell.label}</p>
                      <p className="text-gray-900 break-words font-semibold">{cell.value}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Terms of Delivery */}
          <div className="border border-t-0 border-gray-300 px-1.5 py-0.5 text-xs leading-tight">
            <p className="text-[10px] text-gray-500">Terms of Delivery</p>
            <p className="font-bold text-gray-900 break-words">
              Returns Shall Only Be Accepted Within 7 Days From Delivery Date
            </p>
          </div>

          {/* Items through footer - one continuous bordered block, as in the sample: only the
              column divider runs down through the items, then Total, E. & O.E, and the
              PIN / signatory footer all share the same outer border. */}
          <div className="border border-t-0 border-gray-300 text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="border-r border-gray-300 text-center px-2 py-1 font-normal text-gray-700">Description of Goods</th>
                  <th className="text-center px-2 py-1 font-normal text-gray-700 w-36">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(({ item, packs, perPack, pieces }, idx) => (
                  <tr key={idx}>
                    <td className={`border-r border-gray-300 px-2 ${idx === 0 ? 'pt-4' : 'pt-0.5'} font-bold text-gray-900`}>
                      {item.product ? sizedName(item.product.name, item.variant?.name) : 'Product'}
                    </td>
                    <td className={`text-right px-2 ${idx === 0 ? 'pt-4' : 'pt-0.5'} text-gray-900 whitespace-nowrap`}>
                      {perPack && (
                        <span className="text-gray-600">({perPack.toLocaleString()} x {packs.toLocaleString()}) = </span>
                      )}
                      <span className="font-bold">{pieces.toLocaleString()} PCS</span>
                    </td>
                  </tr>
                ))}
                {isLoading && (
                  <tr>
                    <td colSpan={2} className="border-r border-gray-300 px-2 pt-4 text-center">
                      <Loader2 className="h-5 w-5 animate-spin inline text-gray-400" />
                    </td>
                  </tr>
                )}
                {!isLoading && (!dispatch.items || dispatch.items.length === 0) && (
                  <tr>
                    <td className="border-r border-gray-300 px-2 pt-4 text-gray-500">No items</td>
                    <td />
                  </tr>
                )}
                {/* Filler so the column divider runs down the page like the printed form */}
                <tr>
                  <td className="border-r border-gray-300 h-64" />
                  <td />
                </tr>
                <tr className="border-t border-gray-300">
                  <td className="border-r border-gray-300 px-2 py-0.5 text-right text-gray-700">Total</td>
                  <td className="px-2 py-0.5 text-right font-bold text-gray-900">
                    {totalPieces.toLocaleString()} PCS
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="border-t border-gray-300 px-2 py-0.5 text-right italic text-gray-700">E. &amp; O.E</div>

            <div className="grid grid-cols-2 border-t border-gray-300">
              <div className="flex flex-col justify-end">
                <div className="px-2 py-1 flex">
                  <span className="w-28 text-gray-700">Company&apos;s PIN</span>
                  <span className="font-bold text-gray-900">: {companyPin || COMPANY_KRA_PIN}</span>
                </div>
                <div className="border-t border-r border-gray-300 px-2 py-1 text-gray-700">Recd. in Good Condition</div>
              </div>
              <div className="border-l border-gray-300 flex flex-col justify-between min-h-[90px]">
                <p className="px-2 pt-1 text-right font-bold text-gray-900">for {company?.name || 'the Company'}</p>
                <div className="grid grid-cols-3 gap-3 px-2 pb-1 items-end">
                  <div>
                    <p className="text-sm font-bold text-black break-words">{warehouseManagerName || ''}</p>
                    <p className="border-t border-gray-500 pt-0.5 text-gray-700">Prepared by</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black break-words">{approverName || ''}</p>
                    <p className="border-t border-gray-500 pt-0.5 text-gray-700">Verified by</p>
                  </div>
                  <p className="border-t border-gray-500 pt-0.5 text-right text-gray-700">Authorised Signatory</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-1 text-center text-xs text-gray-700">
            <p>This is a Computer Generated Document</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
