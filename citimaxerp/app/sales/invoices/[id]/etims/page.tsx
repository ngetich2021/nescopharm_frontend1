"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { ArrowLeft, Loader2, Printer, Send, ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportMenu } from "@/components/export-menu"
import { ScanMeFooter } from "@/components/scan-me-footer"
import { useToast } from "@/hooks/use-toast"
import { documentFileName, printWithFileName } from "@/lib/document-names"
import { fixTextOffset } from "@/lib/pdf-capture"
import { getEtimsInvoiceDocument, submitEtimsInvoice, type EtimsInvoiceDocument } from "@/lib/etims"

const money = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 2 })

const PENDING = ["registering_items", "locked_pending", "submitted"]

/**
 * The invoice as KRA's eTIMS prints it: seller and buyer PINs, the CU invoice number, each line
 * under its KRA item code and tax rate, the SCU information with the KRA QR code, and the tax
 * summary. Shown once DigiTax has signed the invoice; before that it says what is missing.
 */
export default function EtimsInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const docRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<EtimsInvoiceDocument | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getEtimsInvoiceDocument(id)
      setDoc(d)
      setError(null)
      setQr(d.qr_url ? await QRCode.toDataURL(d.qr_url, { margin: 0, width: 240 }) : null)
    } catch (e: any) {
      setError(e?.message || "Could not load the eTIMS invoice")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  // While DigiTax is still signing, check again every few seconds.
  useEffect(() => {
    if (!doc || !PENDING.includes(doc.etims_status ?? "")) return
    const t = setTimeout(() => { void load() }, 5000)
    return () => clearTimeout(t)
  }, [doc, load])

  const signed = doc?.etims_status === "completed"
  const fileBase = () => documentFileName([doc?.buyer.name ?? "", `eTIMS Invoice ${doc?.cu_invoice_number ?? doc?.invoice_number ?? ""}`])

  const send = async () => {
    setSending(true)
    try {
      await submitEtimsInvoice(id)
      toast({ title: "Sent to eTIMS", description: "Waiting for KRA to sign it." })
      await load()
    } catch (e: any) {
      toast({ title: "Could not send to eTIMS", description: e?.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const downloadPdf = async () => {
    if (!docRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")
      const canvas = await html2canvas(docRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, onclone: fixTextOffset })
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const w = pdf.internal.pageSize.getWidth()
      const h = pdf.internal.pageSize.getHeight()
      const ratio = Math.min(w / canvas.width, h / canvas.height)
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", (w - canvas.width * ratio) / 2, 8, canvas.width * ratio, canvas.height * ratio)
      pdf.save(`${fileBase()}.pdf`)
    } catch {
      toast({ title: "Could not make the PDF", description: "Try Print instead.", variant: "destructive" })
    } finally {
      setDownloading(false)
    }
  }

  // ?download=pdf (the eTIMS list's "Download eTIMS receipt"): save the PDF once it is shown.
  const autoDownloaded = useRef(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("download") !== "pdf" || !signed || (!qr && !!doc?.qr_url) || autoDownloaded.current) return
    autoDownloaded.current = true
    // Let the document (and its QR image) paint before it is captured.
    const t = setTimeout(() => { void downloadPdf() }, 600)
    return () => clearTimeout(t)
  })

  if (loading && !doc) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      <div className="bg-white border-b print:hidden sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="flex flex-wrap gap-2">
            {doc?.qr_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={doc.qr_url} target="_blank" rel="noreferrer">View on KRA <ExternalLink className="h-3 w-3 ml-1" /></a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => printWithFileName(fileBase())} disabled={!signed}>
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <ExportMenu label="Download" formats={["pdf"]} onExport={downloadPdf} disabled={!signed || downloading} />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 print:p-0">
        {error && <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {doc && !signed && (
          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
            {PENDING.includes(doc.etims_status ?? "") ? (
              <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {doc.invoice_number} has been sent to eTIMS and is waiting for KRA to sign it. This page updates by itself.</p>
            ) : (
              <>
                <p className="font-medium">
                  {doc.etims_status === "failed" || doc.etims_status === "response_invalid"
                    ? `eTIMS did not sign ${doc.invoice_number}.`
                    : `${doc.invoice_number} has not been sent to eTIMS yet.`}
                </p>
                {doc.etims_last_error && <p className="mt-1">{doc.etims_last_error}</p>}
                <p className="mt-1">Below is what will be sent. The KRA invoice number, SCU details and QR code appear once KRA signs it.</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={send} disabled={sending}>
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Send to eTIMS
                  </Button>
                  <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
                </div>
              </>
            )}
          </div>
        )}

        {doc && (
          <div ref={docRef} className="mx-auto max-w-[210mm] bg-white p-8 text-[12px] text-black shadow print:shadow-none print:p-6" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
            {/* Header */}
            {/* KRA's logo (from kra.go.ke; the largest copy KRA publishes, shown at its own size). */}
            <div className="flex items-center justify-between gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kra-logo.png" alt="Kenya Revenue Authority" width={152} height={37} className="h-[37px] w-[152px]" />
              <div className="text-right" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
                <p className="text-lg font-bold tracking-wide text-gray-800">eTIMS INVOICE</p>
                {doc.environment === "test" && <span className="mt-1 inline-block rounded border border-gray-400 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">Test - not a tax invoice</span>}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="border border-gray-700 p-2">
                <p>INVOICE FROM</p>
                <p>PIN: {doc.seller.pin ?? "-"}</p>
                <p>NAME: {doc.seller.name ?? "-"}</p>
              </div>
              <div className="border border-gray-700 p-2">
                <p>INVOICE TO</p>
                <p>PIN: {doc.buyer.pin ?? "-"}</p>
                <p>NAME: {doc.buyer.name ?? "-"}</p>
              </div>
              <div className="border border-gray-700 p-2">
                <p>INVOICE NO: {doc.cu_invoice_number ?? "-"}</p>
                <p>Date : {doc.date ?? "-"}</p>
              </div>
            </div>

            {/* Lines */}
            <table className="mt-4 w-full border-collapse border border-gray-700">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="border-r border-gray-700 p-2 font-bold">Item Code</th>
                  <th className="border-r border-gray-700 p-2 font-bold">Item Description</th>
                  <th className="border-r border-gray-700 p-2 font-bold">Qty x Unit Price</th>
                  <th className="border-r border-gray-700 p-2 font-bold">Rate</th>
                  <th className="border-r border-gray-700 p-2 font-bold">Amt excl. Tax</th>
                  <th className="border-r border-gray-700 p-2 font-bold">Tax Amt</th>
                  <th className="p-2 font-bold">Amt incl. Tax</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {doc.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="border-r border-gray-700 p-2">{l.item_code ?? "-"}</td>
                    <td className="border-r border-gray-700 p-2">{l.description}</td>
                    <td className="border-r border-gray-700 p-2 whitespace-nowrap">{qty(l.quantity)} x {money(l.unit_price)}</td>
                    <td className="border-r border-gray-700 p-2">{l.rate}</td>
                    <td className="border-r border-gray-700 p-2">{money(l.amount_excl_tax)}</td>
                    <td className="border-r border-gray-700 p-2">{money(l.tax_amount)}</td>
                    <td className="p-2">{money(l.amount_incl_tax)}</td>
                  </tr>
                ))}
                {/* Keeps the ruled body of KRA's layout when there are few lines. */}
                <tr style={{ height: `${Math.max(40, 220 - doc.lines.length * 30)}px` }}>
                  {Array.from({ length: 7 }).map((_, i) => <td key={i} className={i < 6 ? "border-r border-gray-700" : ""} />)}
                </tr>
              </tbody>
            </table>

            {/* SCU information + tax summary */}
            <div className="mt-4 grid grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="space-y-1">
                  <p className="font-bold">SCU INFORMATION</p>
                  <p className="border-t border-dashed border-gray-700 pt-1">Date : {doc.date ?? "-"}</p>
                  <p>SCU ID : {doc.scu_id ?? "-"}</p>
                  <p className="pt-2">CU INVOICE NO. :</p>
                  <p>{doc.cu_invoice_number ?? "-"}</p>
                  <p className="pt-2 break-all">Internal Data : {doc.internal_data ?? "-"}</p>
                  <p className="break-all">Receipt Signature : {doc.receipt_signature ?? "-"}</p>
                  <p className="border-t border-dashed border-gray-700 pt-1">Powered by eTIMS</p>
                </div>
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="KRA eTIMS QR code" className="h-28 w-28 shrink-0 self-center" />
                ) : (
                  <div className="h-28 w-28 shrink-0 self-center border border-dashed border-gray-400 text-[10px] text-gray-500 flex items-center justify-center text-center p-1">KRA QR appears once signed</div>
                )}
              </div>
              <div>
                <p className="font-bold">TAX SUMMARY</p>
                <table className="mt-1 w-full border-collapse border border-gray-700">
                  <thead>
                    <tr className="text-left">
                      <th className="border border-gray-700 p-1.5 font-bold">Tax Rate</th>
                      <th className="border border-gray-700 p-1.5 font-bold">Taxable Amt</th>
                      <th className="border border-gray-700 p-1.5 font-bold">Tax Amt</th>
                      <th className="border border-gray-700 p-1.5 font-bold">Total Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.tax_summary.map((s) => (
                      <tr key={s.rate}>
                        <td className="border border-gray-700 p-1.5">{s.rate}</td>
                        <td className="border border-gray-700 p-1.5">KSh {money(s.taxable)}</td>
                        <td className="border border-gray-700 p-1.5">KSh {money(s.tax)}</td>
                        <td className="border border-gray-700 p-1.5">KSh {money(s.total)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="border border-gray-700 p-1.5">Totals</td>
                      <td className="border border-gray-700 p-1.5">KSh {money(doc.totals.taxable)}</td>
                      <td className="border border-gray-700 p-1.5">KSh {money(doc.totals.tax)}</td>
                      <td className="border border-gray-700 p-1.5">KSh {money(doc.totals.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <ScanMeFooter className="mt-6 text-center text-[10px] text-gray-500">
              <p>Our invoice {doc.invoice_number}</p>
            </ScanMeFooter>
          </div>
        )}
      </div>
    </div>
  )
}
