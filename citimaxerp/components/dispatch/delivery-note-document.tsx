"use client"

import { forwardRef, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { sizedName } from "@/lib/product-sizes"
import { getOrderDispatch, type OrderDispatch } from "@/lib/order-dispatches"
import { getCompany, type Company } from "@/lib/company"
import { getCustomerProfile, type CustomerProfileData } from "@/lib/customers"
import { buildBuyerBlock, mergeCustomerSources, type CustomerAddressSource } from "@/lib/customer-address"
import { getEtimsConfig } from "@/lib/etims"
import { COMPANY_KRA_PIN } from "@/lib/invoice-payment-details"
import { dispatchItemUnit, piecesPerPack } from "@/lib/price-codes"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"

export interface DeliveryNoteLoaded {
  dispatch: OrderDispatch
  customerDetails: CustomerProfileData | null
}

interface DeliveryNoteDocumentProps {
  dispatchId: string
  className?: string
  onLoaded?: (data: DeliveryNoteLoaded) => void
  onError?: (message: string) => void
}

// The printed delivery note for an order dispatch. Shown on its own page and after the
// invoice, so the two go out together.
export const DeliveryNoteDocument = forwardRef<HTMLDivElement, DeliveryNoteDocumentProps>(
  function DeliveryNoteDocument({ dispatchId, className, onLoaded, onError }, ref) {
    const [dispatch, setDispatch] = useState<OrderDispatch | null>(null)
    const [company, setCompany] = useState<Company | null>(null)
    const [customerDetails, setCustomerDetails] = useState<CustomerProfileData | null>(null)
    const [companyPin, setCompanyPin] = useState<string | null>(null)
    const [warehouseManagerName, setWarehouseManagerName] = useState<string | null>(null)
    const [approverName, setApproverName] = useState<string | null>(null)
    const [letterheadIndex, setLetterheadIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
      let cancelled = false
      const load = async () => {
        try {
          const res = await getOrderDispatch(dispatchId)
          const d = res.data
          if (cancelled) return
          setDispatch(d)

          if (d.company_id) {
            getCompany(d.company_id).then(setCompany).catch(() => setCompany(null))
          }
          let profile: CustomerProfileData | null = null
          if (d.order?.customer?.id) {
            profile = await getCustomerProfile(d.order.customer.id).catch(() => null)
            if (!cancelled) setCustomerDetails(profile)
          }
          getEtimsConfig().then((res: any) => setCompanyPin(res?.data?.kra_pin || res?.kra_pin || null)).catch(() => setCompanyPin(null))

          const fullName = (u?: { full_name?: string; first_name?: string; last_name?: string } | null) =>
            u ? (u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || null) : null

          setWarehouseManagerName(fullName(d.created_by))

          const approved = (d.approver_details || [])
            .filter((a) => a.status === 'approved' && a.user)
            .sort((a, b) => b.order - a.order)
          setApproverName(fullName(approved[0]?.user))
          if (!cancelled) onLoaded?.({ dispatch: d, customerDetails: profile })
        } catch (err: any) {
          if (!cancelled) onError?.(err.message || "Failed to load dispatch")
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      }
      load()
      return () => {
        cancelled = true
      }
    }, [dispatchId])

    if (!dispatch) {
      return isLoading ? (
        <div className="flex items-center justify-center py-16 print:hidden">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null
    }

    const buyer = buildBuyerBlock(
      mergeCustomerSources(customerDetails, dispatch.order?.customer as CustomerAddressSource | null),
    )
    // Same order as the invoice: the logistics entry, then what was chosen when the dispatch was raised.
    const destination = dispatch.logistic?.delivery_location || dispatch.destination || dispatch.delivery_location?.landmark || "N/A"
    const customerPin = customerDetails?.pin_number || (dispatch.order?.customer as any)?.pin_number || 'N/A'
    const companySlug = company?.name?.toLowerCase().trim().split(/\s+/)[0]
    // The company's current letterhead (the one invoices print) first; the bundled
    // public-folder copy is only a fallback when that can't load.
    const letterheadCandidates = [
      company?.letterhead_url,
      companySlug && `/company/${companySlug}-letterhead.jpg`,
      '/company/nescopharm-letterhead.jpg',
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
      { label: "Dispatched through", value: dispatch.logistic?.logistics_provider || dispatch.dispatched_through || dispatch.logistic?.delivery_method || "N/A" },
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
      <Card
        ref={ref}
        className={`max-w-4xl mx-auto bg-white p-6 md:p-8 shadow-lg print:shadow-none print:max-w-none print:m-0 print:p-6 print:border-0 text-sm ${className || ""}`}
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
              <p className="font-semibold">{buyer.name}</p>
              {buyer.careOf && <p>c/o {buyer.careOf}</p>}
              {buyer.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {(customerDetails?.phone || dispatch.order?.customer?.phone) && (
                <p>{customerDetails?.phone || dispatch.order?.customer?.phone}</p>
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
              {(!dispatch.items || dispatch.items.length === 0) && (
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
    )
  },
)
