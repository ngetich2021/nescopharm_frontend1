"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportMenu } from "@/components/export-menu"
import { useToast } from "@/hooks/use-toast"
import type { Company } from "@/lib/company"
import { getEtimsConfig } from "@/lib/etims"
import { fetchCreditNoteDocument, type CreditNoteDocumentData } from "@/lib/credit-notes"
import { buildBuyerBlock } from "@/lib/customer-address"
import { exportTable } from "@/lib/table-export"
import { documentFileName, fileDate, printWithFileName } from "@/lib/document-names"
import { displayDate } from "@/lib/date-format"
import { addCanvasToPdf, fixTextOffset } from "@/lib/pdf-capture"
import { CreditNoteDocument } from "@/components/invoices/credit-note-document"

/** A customer credit note (CN-0007) as a printable, downloadable document, like the debit note's page. */
export default function CreditNoteDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const ref = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState<CreditNoteDocumentData | null>(null)
  const [companyPin, setCompanyPin] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    getEtimsConfig().then((res) => setCompanyPin(res?.config?.kra_pin || null)).catch(() => setCompanyPin(null))
    fetchCreditNoteDocument(id)
      .then(setNote)
      .catch((e: any) => setError(e?.message || "Could not load the credit note"))
  }, [id])

  const customerName = note ? buildBuyerBlock(note.customer).name : ""
  const fileBase = () => (note ? documentFileName([customerName, `Credit Note ${note.number}`, fileDate(note.date)]) : "Credit Note")

  const downloadPdf = async () => {
    if (!ref.current || !note) return
    setDownloading(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")
      const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false, onclone: fixTextOffset })
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      addCanvasToPdf(pdf, canvas, ref.current)
      pdf.save(`${fileBase()}.pdf`)
    } catch {
      toast({ title: "PDF not made", description: "The credit note could not be turned into a PDF. Use Print instead.", variant: "destructive" })
    } finally {
      setDownloading(false)
    }
  }

  // Excel / CSV: the same lines as a sheet.
  const sheet = (n: CreditNoteDocumentData) => ({
    fileName: fileBase(),
    title: `Credit Note ${n.number}`,
    details: [
      ["Customer", customerName || "-"],
      ["Customer KRA PIN", n.customer?.pin_number || "-"],
      ["Date", n.date ? displayDate(n.date) : "-"],
      ["Invoice", [n.invoice_number, n.invoice_date ? displayDate(n.invoice_date) : ""].filter(Boolean).join(" dt. ") || "-"],
      ["Reason", n.reason || "-"],
    ] as [string, string][],
    headers: ["S/No", "Description", "Batch", "Expiry", "Qty", "Per", "Rate", "Amount"],
    moneyColumns: [6, 7],
    rows: n.lines.map((l, i) => [
      i + 1, l.name,
      l.batches.map((b) => b.batch_number).filter(Boolean).join(", "),
      l.batches.map((b) => (b.expiry_date ? displayDate(b.expiry_date) : "")).filter(Boolean).join(", "),
      l.quantity, l.unit, l.unit_price, Math.round(l.quantity * l.unit_price * 100) / 100,
    ]),
    footer: [
      ...(n.discount_amount > 0 ? [["", "Less discount", "", "", null, "", "", -n.discount_amount]] : []),
      ...(n.tax_amount > 0 ? [["", "VAT", "", "", null, "", "", n.tax_amount]] : []),
      ["", "Total credited", "", "", n.lines.reduce((s, l) => s + l.quantity, 0), "", "", n.total],
    ],
  })

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Could not load the credit note</h2>
          <p className="mt-2 text-red-600">{error}</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Go Back</Button>
        </div>
      </div>
    )
  }
  if (!note) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      <div className="bg-white border-b print:hidden sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => printWithFileName(fileBase())}><Printer className="h-4 w-4 mr-2" />Print</Button>
            <ExportMenu
              label="Download"
              disabled={downloading}
              onExport={(format) => (format === "pdf" ? downloadPdf() : exportTable(format, sheet(note), note.company as Company | null))}
            />
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none">
        <CreditNoteDocument ref={ref} note={note} companyPin={companyPin} />
      </div>
    </div>
  )
}
