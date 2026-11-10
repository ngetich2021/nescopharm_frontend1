"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportMenu } from "@/components/export-menu"
import { useToast } from "@/hooks/use-toast"
import { getCompany, type Company } from "@/lib/company"
import { getEtimsConfig } from "@/lib/etims"
import { getDebitNoteDocument, type DebitNoteDocumentData } from "@/lib/supplier-payments"
import { exportTable } from "@/lib/table-export"
import { documentFileName, fileDate, printWithFileName } from "@/lib/document-names"
import { displayDate } from "@/lib/date-format"
import { addCanvasToPdf, fixTextOffset } from "@/lib/pdf-capture"
import { DebitNoteDocument } from "@/components/suppliers/debit-note-document"

/** A debit note to a supplier (SDEB/0001) as a printable document, like the sales invoice's page. */
export default function DebitNoteDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const ref = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState<DebitNoteDocumentData | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [companyPin, setCompanyPin] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    getEtimsConfig().then((res) => setCompanyPin(res?.config?.kra_pin || null)).catch(() => setCompanyPin(null))
    getDebitNoteDocument(id)
      .then(async (data) => {
        setNote(data)
        setCompany(await getCompany(data.company_id).catch(() => null))
      })
      .catch((e: any) => setError(e?.message || "Could not load the debit note"))
  }, [id])

  const fileBase = () => (note ? documentFileName([note.supplier?.name, `Debit Note ${note.number}`, fileDate(note.date)]) : "Debit Note")

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
      toast({ title: "PDF not made", description: "The debit note could not be turned into a PDF. Use Print instead.", variant: "destructive" })
    } finally {
      setDownloading(false)
    }
  }

  // Excel / CSV: the same lines as a sheet.
  const sheet = (n: DebitNoteDocumentData) => ({
    fileName: fileBase(),
    title: `Debit Note ${n.number}`,
    details: [
      ["Supplier", n.supplier?.name || "-"],
      ["Supplier KRA PIN", n.supplier?.kra_pin || "-"],
      ["Date", n.date ? displayDate(n.date) : "-"],
      ["Goods received", n.receipt_number || "-"],
      ["Supplier's credit note", n.supplier_reference || "-"],
      ["Reason", n.reason || "-"],
    ] as [string, string][],
    headers: ["S/No", "Description", "Batch", "Expiry", "Qty", "Per", "Unit Cost", "Amount"],
    moneyColumns: [6, 7],
    rows: n.lines.map((l, i) => [i + 1, l.name, l.batch_number || "", l.expiry_date ? displayDate(l.expiry_date) : "", l.quantity, l.unit, l.unit_price, l.amount]),
    footer: [
      ...(n.tax_amount ? [["", "Goods", "", "", null, "", "", n.goods], ["", "VAT", "", "", null, "", "", n.tax_amount]] : []),
      ["", "Total debited", "", "", n.lines.reduce((s, l) => s + l.quantity, 0), "", "", n.total],
    ],
  })

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Could not load the debit note</h2>
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
              onExport={(format) => (format === "pdf" ? downloadPdf() : exportTable(format, sheet(note), company))}
            />
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none">
        <DebitNoteDocument ref={ref} note={note} company={company} companyPin={companyPin} />
      </div>
    </div>
  )
}
