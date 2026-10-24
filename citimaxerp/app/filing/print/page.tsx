"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react"
import { getEtimsConfig } from "@/lib/etims"
import { PRINT_KEY } from "@/lib/filing"
import { printWithFileName } from "@/lib/document-names"
import { InvoiceDocument, loadInvoiceDocumentData, RETURN_POLICY_IMAGE, type InvoiceDocumentData } from "@/components/invoices/invoice-document"

/**
 * Several invoices, each on its own page, in the same layout as a single printed invoice -
 * so a customer's whole folder can be printed or saved as one PDF.
 */
export default function FilingPrintPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [docs, setDocs] = useState<InvoiceDocumentData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(0)
  const [companyPin, setCompanyPin] = useState<string | null>(null)
  const [withPolicy, setWithPolicy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const refs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    getEtimsConfig().then((res) => setCompanyPin(res?.config?.kra_pin || null)).catch(() => setCompanyPin(null))

    let ids: string[] = []
    try {
      ids = JSON.parse(sessionStorage.getItem(PRINT_KEY) || "[]")
    } catch {
      ids = []
    }
    setTotal(ids.length)
    if (ids.length === 0) {
      setLoading(false)
      return
    }

    // A few at a time, keeping the chosen order (customer, then date).
    let cancelled = false
    const results: (InvoiceDocumentData | null)[] = new Array(ids.length).fill(null)
    let next = 0
    let done = 0
    const worker = async () => {
      while (next < ids.length && !cancelled) {
        const index = next++
        try {
          results[index] = await loadInvoiceDocumentData(ids[index])
        } catch {
          setFailed((f) => f + 1)
        }
        done++
        if (!cancelled) setDocs(results.slice(0, done).filter(Boolean) as InvoiceDocumentData[])
      }
    }
    Promise.all([worker(), worker(), worker(), worker()]).then(() => {
      if (cancelled) return
      setDocs(results.filter(Boolean) as InvoiceDocumentData[])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const fileName = () => {
    const names = new Set(docs.map((d) => d.invoice.customer?.business_name || d.invoice.customer?.name).filter(Boolean))
    return names.size === 1 ? `Invoices - ${[...names][0]}` : `Invoices (${docs.length})`
  }

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      let policy: string | null = null
      if (withPolicy) {
        policy = await fetch(RETURN_POLICY_IMAGE).then((r) => r.blob()).then((blob) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        }))
      }
      for (let i = 0; i < docs.length; i++) {
        const el = refs.current[i]
        if (!el) continue
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false })
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
        if (i > 0) pdf.addPage()
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (pageW - canvas.width * ratio) / 2, 10, canvas.width * ratio, canvas.height * ratio)
        if (policy) {
          pdf.addPage()
          pdf.addImage(policy, "JPEG", 0, 0, pageW, pageH)
        }
      }
      pdf.save(`${fileName()}.pdf`)
    } catch (err: any) {
      toast({ title: "Could not create the PDF", description: "Use Print and choose \"Save as PDF\" instead.", variant: "destructive" })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      <div className="sticky top-0 z-10 border-b bg-white print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Button variant="ghost" size="sm" onClick={() => router.push("/filing")}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Filing</Button>
            {loading ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading invoices {docs.length} of {total}...</span>
            ) : total === 0 ? (
              <span className="text-muted-foreground">No invoices chosen. Select invoices on the Filing tab and press Print.</span>
            ) : (
              <span><b>{docs.length}</b> invoice{docs.length === 1 ? "" : "s"} ready{failed ? `, ${failed} could not be loaded` : ""}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withPolicy} onCheckedChange={(v) => setWithPolicy(!!v)} /> Include return policy page
            </label>
            <Button variant="outline" size="sm" onClick={downloadPdf} disabled={loading || downloading || docs.length === 0}>
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download PDF
            </Button>
            <Button size="sm" onClick={() => printWithFileName(fileName())} disabled={loading || docs.length === 0}>
              <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 print:p-0">
        {docs.map((d, i) => (
          <div key={d.invoice.id} className={i > 0 ? "mt-8 print:mt-0 print:break-before-page" : ""}>
            <InvoiceDocument
              ref={(el) => { refs.current[i] = el }}
              {...d}
              companyPin={companyPin}
              withPolicy={withPolicy}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
