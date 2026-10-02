"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "sonner"
import { Receipt, Upload, RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react"
import {
  listEtimsSupplierReceipts, uploadEtimsSupplierReceipt, reverifyEtimsSupplierReceipt,
  getEtimsReceiptReconciliation,
  type EtimsSupplierReceipt,
} from "@/lib/etims"

export default function EtimsSupplierReceiptsPage() {
  const [receipts, setReceipts] = useState<EtimsSupplierReceipt[]>([])
  const [recon, setRecon] = useState<{ verified_count: number; pending_count: number; invalid_count: number; vat_reclaimable_total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [onlyUnsigned, setOnlyUnsigned] = useState(false)
  const [openUpload, setOpenUpload] = useState(false)

  // upload form
  const [qrPayload, setQrPayload] = useState("")
  const [kraPin, setKraPin] = useState("")
  const [traderInvoiceNumber, setTraderInvoiceNumber] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, r] = await Promise.all([
        listEtimsSupplierReceipts({ only_unsigned: onlyUnsigned }),
        getEtimsReceiptReconciliation(),
      ])
      setReceipts(list.data.data)
      setRecon(r)
    } catch (e) {
      toast.error("Failed to load supplier receipts", { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [onlyUnsigned])

  useEffect(() => { void load() }, [load])

  const onSubmit = async () => {
    if (!qrPayload.trim()) {
      toast.error("Paste or scan the QR payload first")
      return
    }
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append("qr_payload", qrPayload.trim())
      if (kraPin.trim()) form.append("supplier_kra_pin", kraPin.trim().toUpperCase())
      if (traderInvoiceNumber.trim()) form.append("trader_invoice_number", traderInvoiceNumber.trim())
      if (file) form.append("upload", file)

      const res = await uploadEtimsSupplierReceipt(form)
      toast.success(
        res.receipt.verification_status === "verified"
          ? "Receipt verified - VAT-reclaimable"
          : res.receipt.verification_status === "invalid"
          ? "Could not verify with DigiTax"
          : "Uploaded, verification pending",
      )
      setQrPayload(""); setKraPin(""); setTraderInvoiceNumber(""); setFile(null)
      setOpenUpload(false)
      await load()
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  const onReverify = async (id: string) => {
    try {
      await reverifyEtimsSupplierReceipt(id)
      toast.success("Re-verification complete")
      await load()
    } catch (e) {
      toast.error("Re-verify failed", { description: (e as Error).message })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Supplier eTIMS Receipts (AP)
          </h1>
          <p className="text-muted-foreground mt-1">Upload supplier invoices, verify with DigiTax, track VAT-reclaim eligibility.</p>
        </div>
        <Button onClick={() => setOpenUpload(true)}>
          <Upload className="h-4 w-4 mr-2" /> Upload receipt
        </Button>
      </div>

      {/* Reconciliation summary */}
      {recon && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Verified</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-600">{recon.verified_count}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{recon.pending_count}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Invalid / unsigned</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-destructive">{recon.invalid_count}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">VAT reclaimable</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">KES {recon.vat_reclaimable_total.toLocaleString()}</p></CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Receipts</CardTitle>
            <CardDescription>Click verify to re-check with DigiTax.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyUnsigned}
                onChange={(e) => setOnlyUnsigned(e.target.checked)}
              />
              Only unsigned suppliers
            </label>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>KRA PIN</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead>Reclaim?</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{loading ? "Loading…" : "No receipts yet."}</TableCell></TableRow>
              ) : receipts.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><StatusBadge status={r.verification_status} /></TableCell>
                  <TableCell className="font-mono text-xs">{r.supplier_kra_pin ?? "-"}</TableCell>
                  <TableCell>{r.trader_invoice_number ?? "-"}</TableCell>
                  <TableCell>{r.invoice_date ?? "-"}</TableCell>
                  <TableCell className="text-right">{r.total_amount != null ? `${r.currency} ${Number(r.total_amount).toLocaleString()}` : "-"}</TableCell>
                  <TableCell className="text-right">{r.tax_amount != null ? Number(r.tax_amount).toLocaleString() : "-"}</TableCell>
                  <TableCell>
                    {r.vat_reclaimable ? <Badge className="bg-green-600">Yes</Badge> : <Badge variant="outline">No</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => onReverify(r.id)}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Verify
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={openUpload} onOpenChange={setOpenUpload}>
        <SheetContent side="right" className="!w-full !max-w-full sm:!w-[560px] sm:!max-w-[560px]">
          <SheetHeader>
            <SheetTitle>Upload supplier receipt</SheetTitle>
            <SheetDescription>
              Paste the QR contents from the supplier's invoice. The file upload is optional but recommended for audit.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>QR payload</Label>
              <Input value={qrPayload} onChange={(e) => setQrPayload(e.target.value)} placeholder="https://etims.kra.go.ke/... or scanned text" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Supplier KRA PIN</Label>
                <Input value={kraPin} onChange={(e) => setKraPin(e.target.value.toUpperCase())} placeholder="P051234567Z" />
              </div>
              <div>
                <Label>Trader invoice number</Label>
                <Input value={traderInvoiceNumber} onChange={(e) => setTraderInvoiceNumber(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>File (PDF / image)</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpenUpload(false)}>Cancel</Button>
              <Button onClick={onSubmit} disabled={submitting || !qrPayload.trim()}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload & verify
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function StatusBadge({ status }: { status: EtimsSupplierReceipt["verification_status"] }) {
  if (status === "verified") return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>
  if (status === "invalid") return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Invalid</Badge>
  if (status === "error") return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>
  return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>
}
