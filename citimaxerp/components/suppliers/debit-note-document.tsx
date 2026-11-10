"use client"

import { forwardRef } from "react"
import { Card } from "@/components/ui/card"
import { displayDate } from "@/lib/date-format"
import type { Company } from "@/lib/company"
import type { DebitNoteDocumentData } from "@/lib/supplier-payments"
import { INVOICE_PAYMENT_DETAILS, COMPANY_KRA_PIN } from "@/lib/invoice-payment-details"
import { amountInWords } from "@/lib/number-to-words"

const BUNDLED_LETTERHEAD = "/company/nescopharm-letterhead.jpg"
const formatAmount =(n: number) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = (d?: string | null) => (d ? displayDate(d) : "")
const unitLabel = (u?: string | null) => (u || "pcs").toUpperCase()

type Props = {
  note: DebitNoteDocumentData
  company: Company | null
  companyPin: string | null
}

/**
 * The printed debit note to a supplier for goods sent back (SDEB/0001), laid out like the company's
 * Tally debit note: our details and the supplier (Bill to) on the left, Debit Note No. / Dated /
 * Original Invoice No. & Date / Other References on the right; goods with batch and expiry under each
 * name, Quantity, Rate, per, Amount; amount in words; Company's PIN and bank details; signatory.
 */
export const DebitNoteDocument = forwardRef<HTMLDivElement, Props>(function DebitNoteDocument({ note, company, companyPin }, ref) {
  const s = note.supplier
  const qty = note.lines.reduce((t, l) => t + l.quantity, 0)
  const units = Array.from(new Set(note.lines.map((l) => unitLabel(l.unit))))
  const totalQty = `${qty.toLocaleString()}${units.length === 1 ? ` ${units[0]}` : ""}`
  const original = [note.receipt_reference || note.receipt_number, note.receipt_date ? `dt. ${date(note.receipt_date)}` : ""].filter(Boolean).join(" ")
  const ourAddress = [
    company?.postal_code ? `P.O BOX ${company.postal_code}` : null,
    company?.address,
    [company?.city, company?.country].filter(Boolean).join(" ") || null,
  ].filter(Boolean) as string[]
  const cell = "border-gray-500 px-1.5 py-0.5"
  const label = "text-[10px] text-gray-600"

  return (
    <>
      <style>{`@media print {
        @page { size: A4; margin: 0; }
        .invoice-sheet { padding: 9mm 11mm !important; }
      }`}</style>
      <Card ref={ref} className="invoice-sheet max-w-4xl mx-auto bg-white p-6 md:p-8 shadow-lg print:shadow-none print:max-w-none print:m-0 print:border-0 text-[12px] text-gray-900">
        {/* The uploaded letterhead, else the copy bundled with the app, so it always prints. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={company?.letterhead_url || BUNDLED_LETTERHEAD}
          alt={`${company?.name || "Company"} letterhead`}
          className="w-full h-auto mb-2"
          crossOrigin="anonymous"
          onError={(e) => {
            const img = e.currentTarget
            if (!img.src.endsWith(BUNDLED_LETTERHEAD)) img.src = BUNDLED_LETTERHEAD
          }}
        />

        <h1 className="text-center text-base font-bold mb-1">Debit Note</h1>

        <div className="border border-gray-500">
          {/* Us and the supplier | the note's references */}
          <div className="grid grid-cols-2">
            <div className={`${cell} border-r py-1 leading-snug`}>
              <p className="font-bold">{company?.name || "Nescopharm Africa Limited"}</p>
              {ourAddress.map((l) => <p key={l}>{l}</p>)}
              {company?.phone && <p>Contact : {company.phone}</p>}
              {company?.email && <p>E-Mail : {company.email}</p>}

              <p className={`${label} mt-2`}>Supplier (Debit to)</p>
              <p className="font-bold">{s?.name || ""}</p>
              {(s?.address || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => <p key={l}>{l}</p>)}
              <p className="grid grid-cols-[4rem_1fr]"><span>PIN</span><span className="font-semibold">{s?.kra_pin || ""}</span></p>
            </div>
            <div className="grid grid-rows-[auto_auto_auto_1fr] text-[12px]">
              <div className="grid grid-cols-2 border-b border-gray-500">
                <div className={`${cell} border-r`}><p className={label}>Debit Note No.</p><p className="font-bold">{note.number}</p></div>
                <div className={cell}><p className={label}>Dated</p><p className="font-bold">{date(note.date)}</p></div>
              </div>
              <div className="grid grid-cols-2 border-b border-gray-500">
                <div className={`${cell} border-r`}><p className={label}>Original Invoice No. &amp; Date</p><p className="font-bold">{original}</p></div>
                <div className={cell}><p className={label}>Other References</p><p className="font-bold">{note.supplier_reference || ""}</p></div>
              </div>
              <div className="grid grid-cols-2 border-b border-gray-500">
                <div className={`${cell} border-r`}><p className={label}>Goods Received No.</p><p className="font-bold">{note.receipt_number || ""}</p></div>
                <div className={cell}><p className={label}>Prepared By</p><p className="font-bold">{note.recorded_by || ""}</p></div>
              </div>
              <div className={cell}>
                <p className={label}>Reason for Return</p>
                <p className="font-semibold break-words">{note.reason || ""}</p>
              </div>
            </div>
          </div>

          {/* Goods */}
          <table className="w-full border-collapse border-t border-gray-500">
            <thead>
              <tr className="text-[11px]">
                <th className={`${cell} border-r border-b w-10 text-left font-semibold`}>Sl No.</th>
                <th className={`${cell} border-r border-b text-center font-semibold`}>Description of Goods</th>
                <th className={`${cell} border-r border-b text-center font-semibold w-28`}>Quantity</th>
                <th className={`${cell} border-r border-b text-center font-semibold w-24`}>Rate</th>
                <th className={`${cell} border-r border-b text-center font-semibold w-14`}>per</th>
                <th className={`${cell} border-b text-center font-semibold w-32`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {note.lines.map((l, i) => (
                <tr key={i} className="align-top break-inside-avoid">
                  <td className={`${cell} border-r`}>{i + 1}</td>
                  <td className={`${cell} border-r`}>
                    <p className="font-bold">{l.name}</p>
                    <div className="pl-4 text-[11px] italic text-gray-700">
                      <p className="grid grid-cols-[3.5rem_1fr]"><span>Batch</span><span>: {l.batch_number || ""}</span></p>
                      <p className="grid grid-cols-[3.5rem_1fr]"><span>Expiry</span><span>: {date(l.expiry_date)}</span></p>
                    </div>
                  </td>
                  <td className={`${cell} border-r text-right font-bold whitespace-nowrap`}>{l.quantity.toLocaleString()} {unitLabel(l.unit)}</td>
                  <td className={`${cell} border-r text-right whitespace-nowrap`}>{formatAmount(l.unit_price)}</td>
                  <td className={`${cell} border-r`}>{unitLabel(l.unit)}</td>
                  <td className={`${cell} text-right font-bold whitespace-nowrap`}>{formatAmount(l.amount)}</td>
                </tr>
              ))}
              {/* Room under the goods, as on the paper note, so the columns run down the page. */}
              <tr>
                <td className={`${cell} border-r h-40`} />
                <td className={`${cell} border-r text-right align-bottom`}>
                  {note.tax_amount > 0 && <p className="font-semibold">VAT</p>}
                </td>
                <td className={`${cell} border-r`} />
                <td className={`${cell} border-r`} />
                <td className={`${cell} border-r`} />
                <td className={`${cell} text-right align-bottom whitespace-nowrap`}>
                  {note.tax_amount > 0 && <p className="font-semibold">{formatAmount(note.tax_amount)}</p>}
                </td>
              </tr>
              <tr className="border-t border-gray-500">
                <td className={`${cell} border-r`} />
                <td className={`${cell} border-r text-right`}>Total</td>
                <td className={`${cell} border-r text-right font-bold whitespace-nowrap`}>{totalQty}</td>
                <td className={`${cell} border-r`} />
                <td className={`${cell} border-r`} />
                <td className={`${cell} text-right font-bold whitespace-nowrap`}>KSh {formatAmount(note.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amount in words, then the same payment details, QR, declaration and signatory as the invoice. */}
        <div className="mt-1.5 mb-1.5 flex justify-between items-start gap-4 break-inside-avoid">
          <div>
            <p className="text-[11px] font-semibold text-gray-600">Amount Chargeable (in words)</p>
            <p className="text-xs font-medium text-gray-900">{amountInWords(note.total)}</p>
          </div>
          <p className="text-xs text-gray-500 italic whitespace-nowrap">E. &amp; O.E</p>
        </div>

        <div className="flex items-stretch gap-2 break-inside-avoid">
          <div className="flex-1 min-w-0 border border-gray-300 text-[11px] leading-tight">
            <p className="bg-gray-50 border-b border-gray-300 px-2 py-0.5 font-bold text-gray-800">
              {(company?.name || "COMPANY").toUpperCase()} PAYMENT DETAILS
            </p>
            <div className="grid grid-cols-[1fr_1.2fr_2fr] divide-x divide-gray-300">
              <div className="px-2 py-1">
                <p className="font-semibold text-gray-800">COMPANY&apos;S KRA PIN</p>
                <p className="font-bold text-gray-900">{companyPin || COMPANY_KRA_PIN}</p>
              </div>
              <div className="px-2 py-1 text-gray-700">
                <p className="font-semibold text-gray-800">M-PESA</p>
                <p>Paybill: <span className="font-semibold text-gray-900">{company?.mpesa_paybill || INVOICE_PAYMENT_DETAILS.mpesaPaybill}</span></p>
                <p>Account No: <span className="font-semibold text-gray-900">{company?.mpesa_account_number || INVOICE_PAYMENT_DETAILS.mpesaAccount}</span></p>
              </div>
              <div className="px-2 py-1 text-gray-700">
                <p className="font-semibold text-gray-800">BANK DETAILS</p>
                <p>
                  Bank: <span className="font-semibold text-gray-900">{company?.bank_name || INVOICE_PAYMENT_DETAILS.bankName}</span>
                  {" · "}Branch: <span className="font-semibold text-gray-900">{company?.bank_branch || INVOICE_PAYMENT_DETAILS.bankBranch}</span>
                </p>
                <p>A/C Name: <span className="font-semibold text-gray-900">{company?.bank_account_name || INVOICE_PAYMENT_DETAILS.bankAccountName}</span></p>
                <p>A/C No: <span className="font-semibold text-gray-900">{company?.bank_account_number || INVOICE_PAYMENT_DETAILS.bankAccountNumber}</span></p>
              </div>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/scan-me.jpg" alt="Scan me" width={64} height={64} className="h-16 w-16 print:h-14 print:w-14 shrink-0 self-center" />
        </div>

        <div className="break-inside-avoid">
          <div className="mt-1.5 flex justify-between items-end gap-8">
            <div className="max-w-sm">
              <p className="text-[11px] font-semibold text-gray-700">Declaration</p>
              <p className="text-[11px] leading-tight text-gray-500">
                We declare that this debit note shows the goods returned to the supplier and their actual cost, and that all particulars are true and correct.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-700 mb-5">for {company?.name || "Nescopharm Africa Limited"}</p>
              <p className="text-[11px] text-gray-500 border-t border-gray-300 pt-0.5">Authorised Signatory</p>
            </div>
          </div>
          <p className="mt-1 text-center text-[11px] text-gray-500">This is a Computer Generated Debit Note</p>
        </div>
      </Card>
    </>
  )
})
