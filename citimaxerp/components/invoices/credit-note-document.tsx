"use client"

import { forwardRef } from "react"
import type { CreditNoteDocumentData } from "@/lib/credit-notes"
import { buildBuyerBlock } from "@/lib/customer-address"
import { NoteDocument, formatNoteAmount, noteDate } from "@/components/documents/note-document"
import { RETURN_POLICY_LINE } from "@/components/invoices/invoice-document"

type Props = {
  note: CreditNoteDocumentData
  companyPin: string | null
}

/** The printed credit note to a customer (CN-0007), laid out like the debit note (NoteDocument). */
export const CreditNoteDocument = forwardRef<HTMLDivElement, Props>(function CreditNoteDocument({ note, companyPin }, ref) {
  const buyer = buildBuyerBlock(note.customer)
  const c = note.customer
  // "0796984572 - Catherine Joel", as the paper credit note prints the contact.
  const contact = [c?.phone, c?.business_name ? c?.name : null].filter(Boolean).join(" - ") || note.other_references || ""
  const original = [note.invoice_number, note.invoice_date ? `dt. ${noteDate(note.invoice_date)}` : ""].filter(Boolean).join(" ")
  const buyersOrder = note.buyers_order_no
    ? [note.buyers_order_no, note.buyers_order_date ? `dt. ${noteDate(note.buyers_order_date)}` : ""].filter(Boolean).join(" ")
    : ""
  // Lines print quantity x rate; discount and VAT come off / on above the total.
  const adjustments = [
    ...(note.discount_amount > 0 ? [{ label: "Less Discount", value: `-${formatNoteAmount(note.discount_amount)}` }] : []),
    ...(note.tax_amount > 0 ? [{ label: "VAT", value: formatNoteAmount(note.tax_amount) }] : []),
  ]
  return (
    <NoteDocument
      ref={ref}
      title="Credit Note"
      company={note.company}
      companyPin={companyPin}
      partyLabel="Buyer (Bill to)"
      party={{ name: buyer.name, addressLines: buyer.addressLines, pin: buyer.kraPin }}
      // As the Tally credit note: the note, then the invoice's own references.
      cells={[
        { label: "Credit Note No.", value: note.number },
        { label: "Dated", value: noteDate(note.date) },
        { label: "Original Invoice No. & Date", value: original },
        { label: "Mode/Terms of Payment", value: note.mode_of_payment || "" },
        { label: "Buyer's Order No. & Date", value: buyersOrder },
        { label: "Other References", value: contact },
        { label: "Dispatch Doc No.", value: note.dispatch_doc_no || "" },
        { label: "Prepared By", value: note.prepared_by || "" },
        { label: "Dispatched through", value: note.dispatched_through || "" },
        { label: "Destination", value: note.destination || "" },
      ]}
      fullCells={[
        { label: "Terms of Delivery", value: note.terms_of_delivery && !/returns?\b/i.test(note.terms_of_delivery) ? note.terms_of_delivery : RETURN_POLICY_LINE },
        { label: "Reason for Credit", value: [note.reason, note.notes].filter(Boolean).join(" - ") },
      ]}
      lines={note.lines.map((l) => ({
        name: l.name,
        batches: l.batches,
        quantity: l.quantity,
        unit: l.unit,
        // Quantity x rate; the line's discount and VAT are listed above the total.
        unit_price: l.unit_price,
        amount: Math.round(l.quantity * l.unit_price * 100) / 100,
      }))}
      adjustments={adjustments}
      total={note.total}
      declaration="We declare that this credit note shows the goods returned or the amount credited to the buyer, and that all particulars are true and correct."
      footer="This is a Computer Generated Credit Note"
    />
  )
})
