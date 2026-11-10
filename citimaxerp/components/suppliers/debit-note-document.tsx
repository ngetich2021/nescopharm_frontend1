"use client"

import { forwardRef } from "react"
import { Card } from "@/components/ui/card"
import { displayDate } from "@/lib/date-format"
import type { Company } from "@/lib/company"
import type { DebitNoteDocumentData } from "@/lib/supplier-payments"
import { INVOICE_PAYMENT_DETAILS, COMPANY_KRA_PIN } from "@/lib/invoice-payment-details"
import { amountInWords } from "@/lib/number-to-words"

const formatAmount = (n: number) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = (d?: string | null) => (d ? displayDate(d) : "N/A")

type Props = {
  note: DebitNoteDocumentData
  company: Company | null
  companyPin: string | null
}

/**
 * The printed debit note to a supplier for goods sent back (SDEB/0001), laid out like the sales
 * invoice: letterhead, supplier box with the note's references, lines with batch, expiry and unit,
 * amount in words, our payment details, declaration and signatory.
 */
export const DebitNoteDocument = forwardRef<HTMLDivElement, Props>(function DebitNoteDocument({ note, company, companyPin }, ref) {
  const s = note.supplier
  const cells = [
    { label: "Debit Note No.", value: note.number },
    { label: "Dated", value: date(note.date) },
    { label: "Goods Received No.", value: note.receipt_number || "N/A" },
    { label: "Goods Received Date", value: date(note.receipt_date) },
    { label: "Supplier's Credit Note", value: note.supplier_reference || "N/A" },
    { label: "Contact Person", value: [s?.contact_person, s?.phone, s?.email].filter(Boolean).join(" · ") || "N/A" },
    { label: "Prepared By", value: note.recorded_by || "N/A" },
    { label: "Mode", value: "Goods returned" },
  ]
  const rows: (typeof cells)[] = []
  for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4))
  const qty = note.lines.reduce((t, l) => t + l.quantity, 0)
  const th = "border border-gray-300 px-1.5 py-1 print:py-0.5 font-semibold text-gray-700"
  const td = "border border-gray-300 px-1.5 py-1 print:py-0.5 text-gray-900 align-top"

  return (
    <>
      <style>{`@media print {
        @page { size: A4; margin: 0; }
        .invoice-sheet { padding: 9mm 11mm !important; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
      }`}</style>
      <Card ref={ref} className="invoice-sheet max-w-4xl mx-auto bg-white p-6 md:p-8 shadow-lg print:shadow-none print:max-w-none print:m-0 print:border-0 text-sm">
        {company?.letterhead_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.letterhead_url} alt={`${company.name} letterhead`} className="w-full h-auto mb-1.5" crossOrigin="anonymous" />
        )}

        <h1 className="mb-1 text-lg font-bold text-gray-900 tracking-wide leading-tight">DEBIT NOTE</h1>

        {/* Supplier / references - one bordered box, as on the invoice. */}
        <div className="grid grid-cols-[2fr_3fr] border border-gray-300 text-[11px] leading-tight">
          <div className="px-2 py-1 border-r border-gray-300">
            <p className="text-[10px] font-semibold text-gray-500 mb-0.5">SUPPLIER (DEBIT TO)</p>
            <div className="text-gray-900">
              <p className="font-semibold">{s?.name || "N/A"}</p>
              {(s?.address || "").split(/\r?\n|,\s*(?=P\.?\s?O)/i).map((l) => l.trim()).filter(Boolean).map((line) => (
                <p key={line}>{line}</p>
              ))}
              {s?.kra_pin && <p className="font-semibold">KRA PIN: {s.kra_pin}</p>}
            </div>
          </div>
          <div className="divide-y divide-gray-300">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-4 divide-x divide-gray-300">
                {row.map((cell) => (
                  <div key={cell.label} className="px-1.5 py-px">
                    <p className="text-[9px] text-gray-500">{cell.label}</p>
                    <p className="text-gray-900 [overflow-wrap:anywhere] font-semibold">{cell.value}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mb-2 border border-t-0 border-gray-300 px-1.5 py-px text-[11px] leading-tight">
          <p className="text-[9px] text-gray-500">Reason for Return</p>
          <p className="font-bold text-gray-900 break-words">{note.reason || "N/A"}</p>
        </div>

        <div className="mb-2">
          <table className="w-full border border-gray-300 border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs">
                <th className={`${th} text-left w-10`}>S/No</th>
                <th className={`${th} text-left`}>Description</th>
                <th className={`${th} text-left`}>Batch</th>
                <th className={`${th} text-left`}>Expiry</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-left`}>Per</th>
                <th className={`${th} text-right whitespace-nowrap`}>Unit Cost (Ksh)</th>
                <th className={`${th} text-right whitespace-nowrap`}>Amount (Ksh)</th>
              </tr>
            </thead>
            <tbody>
              {note.lines.map((l, i) => (
                <tr key={i} className="leading-tight break-inside-avoid">
                  <td className={td}>{i + 1}</td>
                  <td className={`${td} font-semibold`}>{l.name}</td>
                  <td className={`${td} whitespace-nowrap`}>{l.batch_number || "N/A"}</td>
                  <td className={`${td} whitespace-nowrap`}>{date(l.expiry_date)}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{l.quantity.toLocaleString()}</td>
                  <td className={td}>{l.unit}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{formatAmount(l.unit_price)}</td>
                  <td className={`${td} text-right whitespace-nowrap font-semibold`}>{formatAmount(l.amount)}</td>
                </tr>
              ))}
              {note.tax_amount > 0 && [
                { label: "Goods", value: formatAmount(note.goods) },
                { label: "VAT", value: formatAmount(note.tax_amount) },
              ].map((r) => (
                <tr key={r.label} className="leading-tight break-inside-avoid">
                  <td colSpan={7} className="border border-gray-300 text-right px-1.5 py-0.5 text-gray-700">{r.label}</td>
                  <td className="border border-gray-300 text-right px-1.5 py-0.5 text-gray-900 whitespace-nowrap">{r.value}</td>
                </tr>
              ))}
              <tr className="leading-tight break-inside-avoid bg-gray-50">
                <td colSpan={4} className="border border-gray-300 text-right px-1.5 py-0.5 font-bold text-gray-900">Total Debited</td>
                <td className="border border-gray-300 text-right px-1.5 py-0.5 font-bold text-gray-900 whitespace-nowrap">{qty.toLocaleString()}</td>
                <td colSpan={2} className="border border-gray-300" />
                <td className="border border-gray-300 text-right px-1.5 py-0.5 font-bold text-gray-900 whitespace-nowrap">KSh {formatAmount(note.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-1.5 flex justify-between items-start gap-4 break-inside-avoid">
          <div>
            <p className="text-[11px] font-semibold text-gray-600">Amount Debited (in words)</p>
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
              <p className="text-xs text-gray-700 mb-5">for {company?.name || "the Company"}</p>
              <p className="text-[11px] text-gray-500 border-t border-gray-300 pt-0.5">Authorised Signatory</p>
            </div>
          </div>
          <p className="mt-1 text-center text-[11px] text-gray-500">This is a Computer Generated Debit Note</p>
        </div>
      </Card>
    </>
  )
})
