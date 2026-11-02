"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, RefreshCw, Search, ShieldCheck, Upload, ExternalLink } from "lucide-react"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { ImportHistoryDialog } from "@/components/import-history-dialog"
import { PermissionGuard } from "@/components/PermissionGuard"
import {
  listEtimsInvoices,
  listEtimsProducts,
  importEtimsCodes,
  retryEtimsInvoice,
  type EtimsInvoiceRow,
  type EtimsProductRow,
  type EtimsCodesImportResult,
} from "@/lib/etims"

const INVOICE_STATUS: Record<string, { label: string; className: string }> = {
  registering_items: { label: "Registering items", className: "bg-blue-100 text-blue-800" },
  locked_pending: { label: "Sending", className: "bg-blue-100 text-blue-800" },
  submitted: { label: "Submitted", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Signed by KRA", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
  response_invalid: { label: "Invalid response", className: "bg-red-100 text-red-800" },
  voided_with_cn: { label: "Voided (credit note)", className: "bg-gray-100 text-gray-800" },
}

const KRA_STATUS: Record<EtimsProductRow["kra_status"], { label: string; className: string }> = {
  not_registered: { label: "Not registered", className: "bg-gray-100 text-gray-800" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  synced: { label: "Registered", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
}

const fmtMoney = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "-")
const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"

export default function EtimsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> eTIMS
        </h1>
        <p className="text-muted-foreground mt-1">Invoices sent to KRA, and the KRA codes each product is registered under.</p>
      </div>
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="codes">Product Codes</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab />
        </TabsContent>
        <TabsContent value="codes" className="mt-4">
          <ProductCodesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InvoicesTab() {
  const [rows, setRows] = useState<EtimsInvoiceRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)
  const perPage = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listEtimsInvoices({ status: status === "all" ? undefined : status, search: query || undefined, page, per_page: perPage })
      setRows(res.data)
      setCounts(res.counts)
      setLastPage(res.last_page)
      setTotal(res.total)
    } catch (e) {
      toast.error("Could not load eTIMS invoices", { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [status, query, page])

  useEffect(() => { void load() }, [load])

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQuery(search.trim()) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const retry = async (id: string) => {
    setRetrying(id)
    try {
      await retryEtimsInvoice(id)
      toast.success("Sent to KRA again")
      await load()
    } catch (e) {
      toast.error("Could not resend", { description: (e as Error).message })
    } finally {
      setRetrying(null)
    }
  }

  const onExport = useTableExport(async () => {
    const all = await listEtimsInvoices({ status: status === "all" ? undefined : status, search: query || undefined, page: 1, per_page: 5000 })
    return {
      fileName: "etims-invoices",
      title: "eTIMS Invoices",
      subtitle: status === "all" ? "All invoices sent to KRA" : INVOICE_STATUS[status]?.label ?? status,
      headers: ["S/No", "Invoice No.", "Date", "Customer", "Amount", "eTIMS Status", "KRA Invoice No.", "KRA Receipt No.", "Sent", "Error"],
      rows: all.data.map((r, i) => [
        i + 1, r.invoice_number, fmtDate(r.invoice_date), r.customer, r.total_amount,
        INVOICE_STATUS[r.etims_status]?.label ?? r.etims_status, r.etims_invoice_number, r.etims_receipt_number,
        fmtDateTime(r.etims_submitted_at), r.etims_last_error,
      ]),
      moneyColumns: [4],
    }
  })

  const allCount = Object.values(counts).reduce((a, b) => a + Number(b), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Invoices sent to KRA</CardTitle>
            <CardDescription>{total} invoice{total === 1 ? "" : "s"}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input className="pl-8 w-64" placeholder="Invoice, NSK, KRA number, customer" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({allCount})</SelectItem>
                {Object.entries(INVOICE_STATUS).map(([key, s]) => (
                  <SelectItem key={key} value={key}>{s.label} ({counts[key] ?? 0})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportMenu onExport={onExport} disabled={loading} />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S/No</TableHead>
                <TableHead>Invoice No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>eTIMS Status</TableHead>
                <TableHead>KRA Invoice No.</TableHead>
                <TableHead>KRA Receipt No.</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No invoices have been sent to KRA{status !== "all" || query ? " that match" : " yet"}.</TableCell></TableRow>
              ) : rows.map((r, i) => {
                const s = INVOICE_STATUS[r.etims_status] ?? { label: r.etims_status, className: "" }
                const canRetry = r.etims_status === "failed" || r.etims_status === "response_invalid"
                return (
                  <TableRow key={r.id}>
                    <TableCell>{(page - 1) * perPage + i + 1}</TableCell>
                    <TableCell>
                      <Link href={`/sales/invoices/${r.id}`} className="text-primary hover:underline">{r.invoice_number}</Link>
                    </TableCell>
                    <TableCell>{fmtDate(r.invoice_date)}</TableCell>
                    <TableCell>{r.customer ?? "-"}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.total_amount)}</TableCell>
                    <TableCell>
                      <Badge className={s.className} variant="outline">{s.label}</Badge>
                      {r.etims_last_error && canRetry && (
                        <p className="text-xs text-red-600 mt-1 max-w-xs">{r.etims_last_error}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.etims_invoice_number ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.etims_receipt_number ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(r.etims_submitted_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.etims_qr_url && (
                        <a href={r.etims_qr_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-primary hover:underline mr-2">
                          KRA <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      )}
                      {canRetry && (
                        <Button size="sm" variant="outline" onClick={() => retry(r.id)} disabled={retrying === r.id}>
                          {retrying === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resend"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {lastPage > 1 && (
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-sm text-muted-foreground">Page {page} of {lastPage}</span>
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= lastPage || loading} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProductCodesTab() {
  const [rows, setRows] = useState<EtimsProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<EtimsCodesImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows((await listEtimsProducts()).data)
    } catch (e) {
      toast.error("Could not load products", { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.item_class_code.includes(q)) : rows
  }, [rows, search])

  const genericCount = rows.filter((r) => r.generic_class_code).length

  // The headings are the ones the import reads back; Ref ties each row to its product.
  const onExport = useTableExport(() => ({
    fileName: "etims-product-codes",
    title: "eTIMS Product Codes",
    subtitle: "Fill in the KRA codes and import this sheet on eTIMS > Product Codes",
    headers: ["S/No", "Item Description", "Unit of Measure", "Type", "Tax", "Item Class Code", "Packaging Unit", "Quantity Unit", "Country of Origin", "KRA Status", "Ref"],
    rows: rows.map((r, i) => [
      i + 1, r.name, r.unit, r.type, r.tax_label, r.item_class_code, r.packaging_unit_code,
      r.quantity_unit_code, r.country_of_origin_code, KRA_STATUS[r.kra_status].label, r.id,
    ]),
  }))

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    setImporting(true)
    try {
      const res = await importEtimsCodes(f, true)
      setFile(f)
      setPreview(res)
    } catch (err) {
      toast.error("Could not read the file", { description: (err as Error).message })
    } finally {
      setImporting(false)
    }
  }

  const confirmImport = async () => {
    if (!file) return
    setImporting(true)
    try {
      const res = await importEtimsCodes(file, false)
      toast.success(res.message, {
        description: `${res.summary.updated} updated, ${res.summary.reregistered} registered again with KRA, ${res.summary.unchanged} unchanged, ${res.summary.errors} skipped`,
      })
      setPreview(null)
      setFile(null)
      await load()
    } catch (err) {
      toast.error("Import failed", { description: (err as Error).message })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Product KRA Codes</CardTitle>
            <CardDescription>
              Export, fill in the codes, and import the sheet back.
              {genericCount > 0 && <> {genericCount} product{genericCount === 1 ? " uses" : "s use"} a general class code.</>}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input className="pl-8 w-56" placeholder="Description or class code" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <ExportMenu onExport={onExport} disabled={loading || rows.length === 0} />
            <PermissionGuard permissions={["can_update_products", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Import
              </Button>
            </PermissionGuard>
            <ImportHistoryDialog kind="etims_codes" title="KRA Codes" />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S/No</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Item Class Code</TableHead>
                <TableHead>Packaging</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>KRA Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
              ) : shown.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No products.</TableCell></TableRow>
              ) : shown.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.unit ?? "-"}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{r.tax_label}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.item_class_code}
                    {r.generic_class_code && <span className="ml-1 text-yellow-700">(general)</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.packaging_unit_code}</TableCell>
                  <TableCell className="font-mono text-xs">{r.quantity_unit_code}</TableCell>
                  <TableCell className="font-mono text-xs">{r.country_of_origin_code}</TableCell>
                  <TableCell>
                    <Badge className={KRA_STATUS[r.kra_status].className} variant="outline">{KRA_STATUS[r.kra_status].label}</Badge>
                    {r.kra_status === "failed" && r.last_error && <p className="text-xs text-red-600 mt-1 max-w-xs">{r.last_error}</p>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o && !importing) { setPreview(null); setFile(null) } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import KRA codes - preview</DialogTitle>
            <DialogDescription>
              {file?.name}: nothing is saved until you confirm.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{preview.summary.rows} rows</Badge>
                <Badge variant="outline" className="bg-green-100 text-green-800">{preview.summary.updated} to update</Badge>
                <Badge variant="outline" className="bg-blue-100 text-blue-800">{preview.summary.reregistered} to register again with KRA</Badge>
                <Badge variant="outline">{preview.summary.unchanged} unchanged</Badge>
                <Badge variant="outline" className="bg-red-100 text-red-800">{preview.summary.errors} skipped</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S/No</TableHead>
                    <TableHead>Sheet Row</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.filter((r) => r.status !== "unchanged").map((r, i) => (
                    <TableRow key={`${r.row}-${i}`}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{r.row}</TableCell>
                      <TableCell>{r.name}{r.unit ? ` (${r.unit})` : ""}</TableCell>
                      <TableCell>
                        {r.status === "error"
                          ? <Badge variant="outline" className="bg-red-100 text-red-800">Skipped</Badge>
                          : <Badge variant="outline" className="bg-green-100 text-green-800">Update</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.status === "error" ? <span className="text-red-600">{r.message}</span> : (
                          <>
                            {r.changes.map((c) => <div key={c.field}>{c.field}: {c.from ?? "-"} → <b>{c.to}</b></div>)}
                            {r.reregister && <div className="text-blue-700">Registered again with KRA under the new codes</div>}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {preview.rows.every((r) => r.status === "unchanged") && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Every row matches the codes already saved.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPreview(null); setFile(null) }} disabled={importing}>Cancel</Button>
            <Button onClick={confirmImport} disabled={importing || !preview || preview.summary.updated === 0}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Import {preview?.summary.updated ?? 0} change{preview?.summary.updated === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
