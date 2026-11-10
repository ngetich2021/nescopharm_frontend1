"use client"

import { forwardRef } from "react"
import type { Company } from "@/lib/company"
import type { DebitNoteDocumentData } from "@/lib/supplier-payments"
import { NoteDocument, formatNoteAmount, noteDate } from "@/components/documents/note-document"

type Props = {
  note: DebitNoteDocumentData
  company: Company | null
  companyPin: string | null
}

/** The printed debit note to a supplier for goods sent back (SDEB/0001). Layout: NoteDocument. */
export const DebitNoteDocument = forwardRef<HTMLDivElement, Props>(function DebitNoteDocument({ note, company, companyPin }, ref) {
  const s = note.supplier
  const original = [note.receipt_reference || note.receipt_number, note.receipt_date ? `dt. ${noteDate(note.receipt_date)}` : ""].filter(Boolean).join(" ")
  return (
    <NoteDocument
      ref={ref}
      title="Debit Note"
      company={company}
      companyPin={companyPin}
      partyLabel="Supplier (Debit to)"
      party={{
        name: s?.name || "",
        addressLines: (s?.address || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
        pin: s?.kra_pin || null,
      }}
      cells={[
        { label: "Debit Note No.", value: note.number },
        { label: "Dated", value: noteDate(note.date) },
        { label: "Original Invoice No. & Date", value: original },
        { label: "Other References", value: note.supplier_reference || "" },
        { label: "Goods Received No.", value: note.receipt_number || "" },
        { label: "Prepared By", value: note.recorded_by || "" },
      ]}
      reason={{ label: "Reason for Return", value: note.reason || "" }}
      lines={note.lines.map((l) => ({
        name: l.name,
        batches: [{ batch_number: l.batch_number, expiry_date: l.expiry_date }],
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price,
        amount: l.amount,
      }))}
      adjustments={note.tax_amount > 0 ? [{ label: "VAT", value: formatNoteAmount(note.tax_amount) }] : []}
      total={note.total}
      declaration="We declare that this debit note shows the goods returned to the supplier and their actual cost, and that all particulars are true and correct."
      footer="This is a Computer Generated Debit Note"
    />
  )
})
