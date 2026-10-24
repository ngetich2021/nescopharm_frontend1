"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, ChevronsUpDown, Download, FileSpreadsheet, FolderOpen,
  Loader2, Printer, RefreshCw, Search, Upload,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  createMissingInvoices, getFiling, importFileNumbers, matchInvoicesToOrders, saveFileNumber, PRINT_KEY,
  type FilingData, type FilingImportResult, type FilingInvoice,
} from "@/lib/filing"
import { printHtml } from "@/lib/print-frame"

const kes = (v: unknown) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "-")
const STATUS: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  partially_paid: "bg-amber-100 text-amber-800",
  sent: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-700",
  cancelled: "bg-slate-100 text-slate-500",
}
const EXPORT_HEADINGS = ["S/No", "Customer", "Invoice No", "Invoice Date", "Order No", "Amount (KES)", "Paid (KES)", "Balance (KES)", "Status", "File No"]

/** File number cell: saves when you leave the box or press Enter. */
function FileNumberInput({ invoice, onSaved }: { invoice: FilingInvoice; onSaved: (value: string | null) => void }) {
  const { toast } = useToast()
  const [value, setValue] = useState(invoice.file_number ?? "")
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle")
  useEffect(() => setValue(invoice.file_number ?? ""), [invoice.file_number])

  const save = async () => {
    const next = value.trim()
    if (next === (invoice.file_number ?? "")) return
    setState("saving")
    try {
      const res = await saveFileNumber(invoice.id, next)
      onSaved(res.file_number)
      setState("saved")
      setTimeout(() => setState("idle"), 1500)
    } catch (err: any) {
      setState("idle")
      setValue(invoice.file_number ?? "")
      toast({ title: "Could not save the file number", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="-"
        className="h-8 w-20 text-center font-semibold"
      />
      {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {state === "saved" && <Check className="h-3.5 w-3.5 text-green-600" />}
    </div>
  )
}

/**
 * Filing: every invoice, arranged by customer, with the number its printed copy is filed under.
 * File numbers can be typed in, or filled in an exported Excel sheet and imported back.
 */
export default function FilingPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [data, setData] = useState<FilingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [customerId, setCustomerId] = useState<string>("all")
  const [customerOpen, setCustomerOpen] = useState(false)
  const [filed, setFiled] = useState<"all" | "filed" | "unfiled">("all")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const fileInput = useRef<HTMLInputElement>(null)
  const [importRows, setImportRows] = useState<{ invoice_number: string; file_number: string }[] | null>(null)
  const [preview, setPreview] = useState<FilingImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [missingOpen, setMissingOpen] = useState(false)
  const [missingPick, setMissingPick] = useState<Set<string>>(new Set())
  const [differsOpen, setDiffersOpen] = useState(false)
  const [differsPick, setDiffersPick] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getFiling())
    } catch (err: any) {
      toast({ title: "Could not load invoices", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const customers = useMemo(() => {
    const map = new Map<string, string>()
    data?.invoices.forEach((i) => map.set(i.customer_id ?? "none", i.customer))
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.invoices ?? []).filter((i) =>
      (customerId === "all" || (i.customer_id ?? "none") === customerId) &&
      (filed === "all" || (filed === "filed" ? !!i.file_number : !i.file_number)) &&
      (!q || [i.invoice_number, i.customer, i.order_number, i.file_number].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [data, search, customerId, filed])

  // Already sorted by customer, then date, by the API.
  const groups = useMemo(() => {
    const out: { key: string; name: string; invoices: FilingInvoice[] }[] = []
    for (const inv of visible) {
      const key = inv.customer_id ?? "none"
      const last = out[out.length - 1]
      if (last && last.key === key) last.invoices.push(inv)
      else out.push({ key, name: inv.customer, invoices: [inv] })
    }
    return out
  }, [visible])

  const setFileNumberLocally = (id: string, value: string | null) =>
    setData((d) => d && { ...d, invoices: d.invoices.map((i) => (i.id === id ? { ...i, file_number: value } : i)),
      summary: { ...d.summary, filed: d.invoices.filter((i) => (i.id === id ? value : i.file_number)).length } })

  const toggle = (set: Set<string>, ids: string[], on: boolean) => {
    const next = new Set(set)
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
    return next
  }

  const printInvoices = (ids: string[]) => {
    if (ids.length === 0) return
    try {
      sessionStorage.setItem(PRINT_KEY, JSON.stringify(ids))
    } catch {
      toast({ title: "Could not open the print view", variant: "destructive" })
      return
    }
    router.push("/filing/print")
  }

  // A short list to file by: order, amount and file number for each invoice, one section per customer.
  const printList = (list: { name: string; invoices: FilingInvoice[] }[]) => {
    const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)
    // The heading row repeats only if a long list runs onto another page; the total prints once.
    const sections = list.map((g) => `
      <h2>${esc(g.name)}</h2>
      <table>
        <colgroup><col class="n"><col class="o"><col class="r"><col class="f"></colgroup>
        <thead><tr><th>S/No</th><th>Order</th><th class="r">Amount (KES)</th><th class="f">File No</th></tr></thead>
        <tbody>
          ${g.invoices.map((i, idx) => `<tr><td>${idx + 1}</td><td>${esc(i.order_number || i.invoice_number)}</td><td class="r">${kes(i.total_amount)}</td><td class="f">${esc(i.file_number || "")}</td></tr>`).join("")}
          <tr class="total"><td></td><td>${g.invoices.length} order${g.invoices.length === 1 ? "" : "s"}</td><td class="r">${kes(g.invoices.reduce((t, i) => t + i.total_amount, 0))}</td><td></td></tr>
        </tbody>
      </table>`).join("")
    printHtml(`<!DOCTYPE html><html><head><title>Filing list</title><style>
      @page { size: A4; margin: 0; }
      body { font-family: Arial, sans-serif; font-size: 11pt; margin: 0; padding: 12mm 14mm; color: #111; }
      h1 { font-size: 13pt; margin: 0 0 4mm; display: flex; justify-content: space-between; }
      h1 small { font-size: 9pt; font-weight: normal; color: #555; }
      h2 { font-size: 11.5pt; margin: 5mm 0 1.5mm; break-after: avoid; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      col.n { width: 12%; } col.o { width: 34%; } col.r { width: 30%; } col.f { width: 24%; }
      th, td { border: 1px solid #888; padding: 2.4mm 3mm; text-align: left; white-space: nowrap; overflow: hidden; }
      th { background: #eee; font-size: 10pt; }
      tr { break-inside: avoid; }
      .r { text-align: right; } .f { text-align: center; font-weight: bold; }
      tr.total td { font-weight: bold; background: #f7f7f7; }
    </style></head><body><h1><span>Filing list</span><small>${new Date().toLocaleDateString("en-GB")}</small></h1>${sections}</body></html>`)
  }

  const exportExcel = () => {
    const rows: (string | number)[][] = []
    groups.forEach((g) => g.invoices.forEach((i, idx) => rows.push([
      idx + 1, g.name, i.invoice_number, fmtDate(i.invoice_date), i.order_number ?? "",
      i.total_amount, i.amount_paid, i.balance_amount, i.status.replace("_", " "), i.file_number ?? "",
    ])))
    const book = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADINGS, ...rows])
    sheet["!cols"] = [{ wch: 6 }, { wch: 34 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(book, sheet, "Filing")
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ["How to use this sheet"],
      ["1. Write each invoice's file number in the File No column (1, 2, 3 ...)."],
      ["2. Keep the Invoice No column as it is - it is how each row finds its invoice."],
      ["3. Save the file and use Import Excel on the Filing tab. You will see the changes before anything is saved."],
      ["An empty File No clears that invoice's file number. Other columns are ignored on import."],
    ]), "Instructions")
    XLSX.writeFile(book, `filing_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const readImport = async (file: File) => {
    try {
      const book = XLSX.read(await file.arrayBuffer())
      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: false, defval: "" })
      const headerIndex = rows.findIndex((r) => r.some((c) => /invoice\s*(no|number|#)/i.test(String(c))) && r.some((c) => /file\s*(no|number|#)/i.test(String(c))))
      if (headerIndex < 0) {
        toast({ title: "Columns not found", description: "The first sheet needs an \"Invoice No\" and a \"File No\" column.", variant: "destructive" })
        return
      }
      const header = rows[headerIndex].map((c) => String(c))
      const invCol = header.findIndex((c) => /invoice\s*(no|number|#)/i.test(c))
      const fileCol = header.findIndex((c) => /file\s*(no|number|#)/i.test(c))
      const parsed = rows.slice(headerIndex + 1)
        .map((r) => ({ invoice_number: String(r[invCol] ?? "").trim(), file_number: String(r[fileCol] ?? "").trim() }))
        .filter((r) => r.invoice_number)
      if (parsed.length === 0) {
        toast({ title: "No invoices in the file", variant: "destructive" })
        return
      }
      setBusy(true)
      setImportRows(parsed)
      setPreview(await importFileNumbers(parsed, false))
    } catch (err: any) {
      setImportRows(null)
      toast({ title: "Could not read the file", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const applyImport = async () => {
    if (!importRows) return
    setBusy(true)
    try {
      const res = await importFileNumbers(importRows, true)
      toast({ title: "File numbers imported", description: res.message })
      setPreview(null)
      setImportRows(null)
      load()
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const missing = data?.orders_without_invoice ?? []
  const differs = (data?.invoices ?? []).filter((i) => i.differs_from_order)

  const createInvoices = async () => {
    setBusy(true)
    try {
      const res = await createMissingInvoices([...missingPick])
      const failed = res.results.filter((r) => !r.ok)
      toast({
        title: res.message,
        description: failed.length ? failed.slice(0, 3).map((f) => `${f.order_number}: ${f.message}`).join("; ") : undefined,
        variant: failed.length ? "destructive" : undefined,
      })
      setMissingOpen(false)
      load()
    } catch (err: any) {
      toast({ title: "Could not create invoices", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const matchOrders = async () => {
    setBusy(true)
    try {
      const res = await matchInvoicesToOrders([...differsPick])
      toast({ title: res.message })
      setDiffersOpen(false)
      load()
    } catch (err: any) {
      toast({ title: "Could not update invoices", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const stat = (title: string, value: string | number, note?: string) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  )

  const s = data?.summary

  return (
    <PermissionGuard permissions={["can_view_invoices", "can_view_sales_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><FolderOpen className="h-6 w-6" /> Filing</h1>
            <p className="text-sm text-muted-foreground">All invoices arranged by customer, with the file number each printed copy is filed under.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh</Button>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!visible.length}><Download className="mr-2 h-4 w-4" /> Export Excel</Button>
            <PermissionGuard permissions={["can_update_invoices", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
                {busy && importRows ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Import Excel
              </Button>
            </PermissionGuard>
            <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && readImport(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => printList(groups)} disabled={!groups.length} title="Order, amount and file number, by customer">
              <Printer className="mr-2 h-4 w-4" /> Print list
            </Button>
            <Button size="sm" onClick={() => printInvoices([...selected])} disabled={selected.size === 0} title="The full invoices you ticked">
              <Printer className="mr-2 h-4 w-4" /> Print invoices{selected.size ? ` (${selected.size})` : ""}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stat("Invoices", s?.invoices ?? "-")}
          {stat("Filed", s ? `${s.filed} of ${s.invoices}` : "-", s && s.invoices ? `${Math.round((s.filed / s.invoices) * 100)}% have a file number` : undefined)}
          {stat("Not filed", s ? s.invoices - s.filed : "-")}
          {stat("Customers", s?.customers ?? "-")}
        </div>

        {(missing.length > 0 || differs.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            {missing.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span><b>{missing.length}</b> completed order{missing.length === 1 ? "" : "s"} (KES {kes(missing.reduce((t, o) => t + o.amount, 0))}) {missing.length === 1 ? "has" : "have"} no invoice.</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setMissingPick(new Set(missing.map((o) => o.id))); setMissingOpen(true) }}>Review</Button>
              </div>
            )}
            {differs.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span><b>{differs.length}</b> invoice{differs.length === 1 ? "" : "s"} no longer match{differs.length === 1 ? "es" : ""} {differs.length === 1 ? "its" : "their"} order (e.g. VAT added to the order later).</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setDiffersPick(new Set(differs.filter((i) => i.status !== "paid").map((i) => i.id))); setDiffersOpen(true) }}>Review</Button>
              </div>
            )}
          </div>
        )}

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, order, customer or file no..." className="pl-8" />
              </div>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-[260px] justify-between font-normal">
                    <span className="truncate">{customerId === "all" ? "All customers" : customers.find((c) => c.id === customerId)?.name}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search customer..." />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="all customers" onSelect={() => { setCustomerId("all"); setCustomerOpen(false) }}>
                          <Check className={cn("mr-2 h-4 w-4", customerId === "all" ? "opacity-100" : "opacity-0")} /> All customers
                        </CommandItem>
                        {customers.map((c) => (
                          <CommandItem key={c.id} value={`${c.name} ${c.id}`} onSelect={() => { setCustomerId(c.id); setCustomerOpen(false) }}>
                            <Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} /> {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Select value={filed} onValueChange={(v) => setFiled(v as typeof filed)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All invoices</SelectItem>
                  <SelectItem value="unfiled">Not filed</SelectItem>
                  <SelectItem value="filed">Filed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(groups.map((g) => g.key)))}>
                {collapsed.size ? "Expand all" : "Collapse all"}
              </Button>
            </div>

            {loading && !data ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : groups.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No invoices match.</p>
            ) : (
              <div className="overflow-x-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead className="w-12">S/No</TableHead>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Order No</TableHead>
                      <TableHead className="text-right">Amount (KES)</TableHead>
                      <TableHead className="text-right">Balance (KES)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>File No</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((g) => {
                      const ids = g.invoices.map((i) => i.id)
                      const allOn = ids.every((id) => selected.has(id))
                      const isCollapsed = collapsed.has(g.key)
                      const filedCount = g.invoices.filter((i) => i.file_number).length
                      return [
                        <TableRow key={`g-${g.key}`} className="bg-slate-50 hover:bg-slate-100">
                          <TableCell>
                            <Checkbox checked={allOn} onCheckedChange={(v) => setSelected(toggle(selected, ids, !!v))} aria-label={`Select all for ${g.name}`} />
                          </TableCell>
                          <TableCell colSpan={7}>
                            <button className="flex items-center gap-2 text-left font-semibold" onClick={() => setCollapsed(toggle(collapsed, [g.key], !isCollapsed))}>
                              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              {g.name}
                              <span className="text-xs font-normal text-muted-foreground">
                                {g.invoices.length} invoice{g.invoices.length === 1 ? "" : "s"} · {filedCount} filed · KES {kes(g.invoices.reduce((t, i) => t + i.total_amount, 0))}
                              </span>
                            </button>
                          </TableCell>
                          <TableCell colSpan={2} className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => printList([g])} title="Order, amount and file number for each invoice"><Printer className="mr-1.5 h-3.5 w-3.5" /> Print all</Button>
                          </TableCell>
                        </TableRow>,
                        ...(isCollapsed ? [] : g.invoices.map((i, idx) => (
                          <TableRow key={i.id}>
                            <TableCell><Checkbox checked={selected.has(i.id)} onCheckedChange={(v) => setSelected(toggle(selected, [i.id], !!v))} /></TableCell>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">
                              <Link href={`/sales/invoices/${i.id}/document`} className="hover:underline">{i.invoice_number}</Link>
                              {i.differs_from_order && <span title={`Order total KES ${kes(i.order_amount)}`}><AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" /></span>}
                            </TableCell>
                            <TableCell>{fmtDate(i.invoice_date)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{i.order_number ?? "-"}</TableCell>
                            <TableCell className="text-right font-mono">{kes(i.total_amount)}</TableCell>
                            <TableCell className={cn("text-right font-mono", i.balance_amount > 0.01 && "text-red-600")}>{kes(i.balance_amount)}</TableCell>
                            <TableCell><Badge variant="outline" className={cn("capitalize", STATUS[i.status])}>{i.status.replace("_", " ")}</Badge></TableCell>
                            <TableCell><FileNumberInput invoice={i} onSaved={(v) => setFileNumberLocally(i.id, v)} /></TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Print / PDF" onClick={() => printInvoices([i.id])}><Printer className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))),
                      ]
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import preview */}
        <Dialog open={preview !== null} onOpenChange={(o) => { if (!o) { setPreview(null); setImportRows(null) } }}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Import file numbers</DialogTitle>
              <DialogDescription>Check the changes below. Nothing is saved until you confirm.</DialogDescription>
            </DialogHeader>
            {preview && (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-100 text-green-800" variant="outline">{preview.counts.update} to set</Badge>
                  {preview.counts.clear > 0 && <Badge className="bg-amber-100 text-amber-800" variant="outline">{preview.counts.clear} to clear</Badge>}
                  <Badge variant="outline">{preview.counts.unchanged} unchanged</Badge>
                  {preview.counts.not_found > 0 && <Badge className="bg-red-100 text-red-700" variant="outline">{preview.counts.not_found} not found</Badge>}
                  {preview.counts.skipped > 0 && <Badge variant="outline">{preview.counts.skipped} skipped</Badge>}
                </div>
                {preview.rows.length > 0 && (
                  <div className="max-h-[45vh] overflow-y-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Row</TableHead><TableHead>Invoice</TableHead><TableHead>Was</TableHead><TableHead>Becomes</TableHead><TableHead>Note</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.slice(0, 300).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground">{r.row}</TableCell>
                            <TableCell>{r.invoice_number}</TableCell>
                            <TableCell>{r.previous ?? "-"}</TableCell>
                            <TableCell className="font-semibold">{r.result === "clear" ? "(cleared)" : r.file_number || "-"}</TableCell>
                            <TableCell className={cn("text-xs", r.result === "not_found" ? "text-red-600" : "text-muted-foreground")}>{r.message ?? ""}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setPreview(null); setImportRows(null) }} disabled={busy}>Cancel</Button>
              <Button onClick={applyImport} disabled={busy || !preview || preview.counts.update + preview.counts.clear === 0}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save {preview ? preview.counts.update + preview.counts.clear : 0} change(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Completed orders without an invoice */}
        <Dialog open={missingOpen} onOpenChange={setMissingOpen}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Completed orders without an invoice</DialogTitle>
              <DialogDescription>
                Each selected order gets its invoice, dated on the order date, with any payment already received applied to it. Nothing is sent to eTIMS.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={missing.length > 0 && missing.every((o) => missingPick.has(o.id))}
                        onCheckedChange={(v) => setMissingPick(v ? new Set(missing.map((o) => o.id)) : new Set())} />
                    </TableHead>
                    <TableHead className="w-12">S/No</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount (KES)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missing.map((o, i) => (
                    <TableRow key={o.id}>
                      <TableCell><Checkbox checked={missingPick.has(o.id)} onCheckedChange={(v) => setMissingPick(toggle(missingPick, [o.id], !!v))} /></TableCell>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>{o.customer}</TableCell>
                      <TableCell>{o.order_number}{o.is_historical && <span className="ml-1 text-xs text-muted-foreground">(past sale)</span>}</TableCell>
                      <TableCell>{fmtDate(o.order_date)}</TableCell>
                      <TableCell className="text-right font-mono">{kes(o.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMissingOpen(false)} disabled={busy}>Cancel</Button>
              <PermissionGuard permissions={["can_create_invoices", "can_manage_system", "can_manage_company"]} hideOnDenied>
                <Button onClick={createInvoices} disabled={busy || missingPick.size === 0}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create {missingPick.size} invoice(s)
                </Button>
              </PermissionGuard>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invoices that no longer match their order */}
        <Dialog open={differsOpen} onOpenChange={setDiffersOpen}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invoices that differ from their order</DialogTitle>
              <DialogDescription>
                The order was changed after it was invoiced (for example VAT added). Updating copies the order&apos;s lines, discount and VAT onto the invoice and keeps what was already paid.
                Paid invoices are not selected by default: updating one leaves the customer owing the difference.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={differs.length > 0 && differs.every((i) => differsPick.has(i.id))}
                        onCheckedChange={(v) => setDiffersPick(v ? new Set(differs.map((i) => i.id)) : new Set())} />
                    </TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Invoice (KES)</TableHead>
                    <TableHead className="text-right">Order (KES)</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {differs.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell><Checkbox checked={differsPick.has(i.id)} onCheckedChange={(v) => setDiffersPick(toggle(differsPick, [i.id], !!v))} /></TableCell>
                      <TableCell className="max-w-[200px] truncate">{i.customer}</TableCell>
                      <TableCell>{i.invoice_number}<div className="text-xs text-muted-foreground">{i.order_number}</div></TableCell>
                      <TableCell><Badge variant="outline" className={cn("capitalize", STATUS[i.status])}>{i.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{kes(i.total_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{kes(i.order_amount)}</TableCell>
                      <TableCell className="text-right font-mono">{kes((i.order_amount ?? 0) - i.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDiffersOpen(false)} disabled={busy}>Cancel</Button>
              <PermissionGuard permissions={["can_update_invoices", "can_manage_system", "can_manage_company"]} hideOnDenied>
                <Button onClick={matchOrders} disabled={busy || differsPick.size === 0}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update {differsPick.size} invoice(s)
                </Button>
              </PermissionGuard>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}
