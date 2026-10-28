"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, ChevronDown, ChevronRight, Clock, Download, Eye, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { PRICE_LIST_CODES } from "@/lib/price-codes"
import {
  downloadImportFile,
  fetchPriceList,
  fetchPriceListHistory,
  fetchPriceListImportChanges,
  importPriceList,
  type PriceListImportChange,
  PRICE_LIST_TEMPLATE_HEADERS,
  type PriceListImportRecord,
  type PriceListImportResult,
} from "@/lib/price-lists"
import * as XLSX from "xlsx"
import { documentFileName, todayFileDate, sessionCompanyName } from "@/lib/document-names"

const OTHER = "__other__"

// The first row is the list's own first item (code, description, price) - uploading it unchanged changes
// nothing. A new list with no items yet borrows the first NSPV item, under the new list's code.
async function downloadTemplate(listName: string) {
  const code = listName || "NSPV"
  let row: (string | number)[] = []
  try {
    const own = (await fetchPriceList(code)).rows[0]
    const borrowed = own ? null : (await fetchPriceList("NSPV")).rows[0]
    const r = own ?? borrowed
    if (r) {
      row = [own ? r.sheet_code : `${code}001`, r.description ?? "", r.price, r.unit_of_measure ?? "", r.tax_status]
    }
  } catch {
    // No sample available - the template still has its headings.
  }
  const sheet = XLSX.utils.aoa_to_sheet(row.length ? [PRICE_LIST_TEMPLATE_HEADERS, row] : [PRICE_LIST_TEMPLATE_HEADERS])
  sheet["!cols"] = [{ wch: 12 }, { wch: 55 }, { wch: 12 }, { wch: 18 }, { wch: 14 }]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, code)
  XLSX.writeFile(book, `${code} Price List Template.xlsx`)
}

const statusBadge = (status: string) => {
  if (status === "created") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">New product</Badge>
  if (status === "matched") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Matched</Badge>
  return <Badge variant="destructive">Error</Badge>
}

const money = (v: number | string) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Result of one row of an import, as shown when its history row is expanded.
const changeBadge = (status: string, priceChanged: boolean) => {
  if (status === "error") return <Badge variant="destructive">Error</Badge>
  if (status === "created") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">New product</Badge>
  if (status === "added") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Price added</Badge>
  if (priceChanged || status === "updated") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Price changed</Badge>
  return <Badge variant="outline" className="text-gray-600">Unchanged</Badge>
}

export default function PriceListsPage() {
  const { toast } = useToast()
  const [listChoice, setListChoice] = useState<string>("NSPH")
  const [customList, setCustomList] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<"preview" | "import" | "export" | null>(null)
  const [result, setResult] = useState<PriceListImportResult | null>(null)
  const [history, setHistory] = useState<PriceListImportRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [changes, setChanges] = useState<Record<string, { complete: boolean; data: PriceListImportChange[] }>>({})

  // Open/close a history row, loading its rows the first time.
  const toggleImport = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (changes[id]) return
    try {
      const res = await fetchPriceListImportChanges(id)
      setChanges((prev) => ({ ...prev, [id]: res }))
    } catch (err: any) {
      setChanges((prev) => ({ ...prev, [id]: { complete: false, data: [] } }))
      toast({ title: "Could not load the changes", description: err.message, variant: "destructive" })
    }
  }

  const listName = (listChoice === OTHER ? customList : listChoice).trim().toUpperCase()

  const loadHistory = useCallback(async (name: string) => {
    if (!name) { setHistory([]); return }
    setHistoryLoading(true)
    try {
      setHistory(await fetchPriceListHistory(name))
    } catch { setHistory([]) }
    finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => { loadHistory(listName) }, [listName, loadHistory])

  // Downloads the list as it stands now, in the importer's own columns, so prices can be
  // edited in Excel and the same sheet uploaded back.
  const exportList = async () => {
    if (!listName) return
    setBusy("export")
    try {
      const res = await fetchPriceList(listName)
      if (res.rows.length === 0) {
        toast({ title: "Nothing to export", description: res.message })
        return
      }
      const sheet = XLSX.utils.aoa_to_sheet([
        PRICE_LIST_TEMPLATE_HEADERS,
        ...res.rows.map((r) => [r.sheet_code, r.description ?? "", r.price, r.unit_of_measure ?? "", r.tax_status]),
      ])
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, res.list_name)
      XLSX.writeFile(book, documentFileName([sessionCompanyName(), `${res.list_name} Price List`, todayFileDate()], "xlsx"))
      toast({ title: "Downloaded", description: `${res.rows.length} ${res.list_name} prices exported.` })
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message || "Could not export the price list.", variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const run = async (dryRun: boolean) => {
    if (!file || !listName) return
    setBusy(dryRun ? "preview" : "import")
    try {
      const res = await importPriceList(file, listName, dryRun)
      setResult(res)
      toast({ title: dryRun ? "Preview ready" : "Import complete", description: res.message })
      if (!dryRun) loadHistory(listName)
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message || "Could not import the price list.", variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <PermissionGuard permissions={["can_create_products", "can_update_products", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Price Lists</h1>
            <p className="text-sm text-gray-600">
              To change prices: download the current list, edit the prices in Excel, then upload it back. Rows are matched to products by item description; new descriptions create new products.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/inventory/products"><ArrowLeft className="h-4 w-4 mr-2" />Products</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Price list</Label>
                <Select value={listChoice} onValueChange={(v) => { setListChoice(v); setResult(null) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRICE_LIST_CODES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value={OTHER}>Other...</SelectItem>
                  </SelectContent>
                </Select>
                {listChoice === OTHER && (
                  <Input value={customList} onChange={(e) => setCustomList(e.target.value)} placeholder="List name, e.g. NSPX" />
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="price-list-file">File (.xlsx, .xls or .csv)</Label>
                <Input
                  id="price-list-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Columns: <span className="font-medium">{PRICE_LIST_TEMPLATE_HEADERS.join(", ")}</span>. Item Description and Price are required.
              Tax Status accepts e.g. VAT 16%, VAT 8%, Zero rated, Exempt, Non-VAT; leave it blank to keep the product&apos;s current tax.
              {listName === "NSPV" && " Importing NSPV also sets each product's default price."}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => downloadTemplate(listName)}>
                <Download className="h-4 w-4 mr-2" />Blank template
              </Button>
              <Button type="button" variant="outline" disabled={!listName || busy !== null} onClick={exportList}>
                {busy === "export" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Download current {listName || "list"}
              </Button>
              <Button type="button" variant="outline" disabled={!file || !listName || busy !== null} onClick={() => run(true)}>
                {busy === "preview" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Preview
              </Button>
              <Button type="button" disabled={!file || !listName || busy !== null} onClick={() => run(false)}>
                {busy === "import" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import {listName}
              </Button>
            </div>
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {listName} Import History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                      <TableHead className="text-right">Matched</TableHead>
                      <TableHead className="text-right">New</TableHead>
                      <TableHead className="text-right">Added</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="text-right">Errors</TableHead>
                      <TableHead>Uploaded by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => {
                      const d = new Date(h.created_at)
                      const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                      const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                      const isOpen = expanded === h.id
                      const detail = changes[h.id]
                      return (
                        <Fragment key={h.id}>
                        <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggleImport(h.id)}>
                          <TableCell>
                            {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                          </TableCell>
                          <TableCell className="font-semibold">{h.list_name}{h.version}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {dateStr} at {timeStr}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {/* Always offered: if the uploaded file is gone the server rebuilds the sheet. */}
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadImportFile(h.id, h.file_name || `${h.list_name}${h.version}.xlsx`).catch((err) =>
                                  toast({ title: "Download failed", description: err.message, variant: "destructive" }))
                              }}
                            >
                              <Download className="h-3 w-3" />{h.file_name || `${h.list_name}${h.version}.xlsx`}
                            </button>
                          </TableCell>
                          <TableCell className="text-right">{h.rows_count}</TableCell>
                          <TableCell className="text-right">{h.products_matched}</TableCell>
                          <TableCell className="text-right">{h.products_created}</TableCell>
                          <TableCell className="text-right">{h.prices_added}</TableCell>
                          <TableCell className="text-right">{h.prices_updated}</TableCell>
                          <TableCell className="text-right">
                            {h.errors_count > 0
                              ? <span className="text-red-600 font-medium">{h.errors_count}</span>
                              : <span className="text-muted-foreground">0</span>}
                          </TableCell>
                          <TableCell className="text-sm">{h.uploader?.name || "-"}</TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                            <TableCell colSpan={11} className="p-3">
                              {!detail ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Loading changes...
                                </div>
                              ) : detail.data.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No price changes were recorded for this import.</p>
                              ) : (
                                <>
                                  {!detail.complete && (
                                    <p className="mb-2 text-xs text-muted-foreground">
                                      This import is from before full results were kept, so only the prices it added or changed are shown.
                                    </p>
                                  )}
                                  <div className="max-h-[420px] overflow-auto rounded border bg-white">
                                    <table className="w-full text-sm">
                                      <thead className="sticky top-0 bg-gray-50 text-xs text-gray-600">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium">S/No</th>
                                          <th className="px-3 py-2 text-left font-medium">Item Code</th>
                                          <th className="px-3 py-2 text-left font-medium">Item Description</th>
                                          <th className="px-3 py-2 text-left font-medium">Result</th>
                                          <th className="px-3 py-2 text-right font-medium">Old Price</th>
                                          <th className="px-3 py-2 text-right font-medium">New Price</th>
                                          <th className="px-3 py-2 text-left font-medium">Unit</th>
                                          <th className="px-3 py-2 text-left font-medium">Note</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.data.map((r, ri) => {
                                          const changed = r.old_price != null && r.price != null && Number(r.old_price) !== Number(r.price)
                                          return (
                                            <tr key={ri} className="border-t align-top">
                                              <td className="px-3 py-1.5 text-gray-500">{ri + 1}</td>
                                              <td className="px-3 py-1.5 font-mono text-xs">{r.code || "-"}</td>
                                              <td className="px-3 py-1.5">{r.description || "-"}</td>
                                              <td className="px-3 py-1.5">{changeBadge(r.status, changed)}</td>
                                              <td className="px-3 py-1.5 text-right text-gray-500">
                                                {r.old_price != null ? <span className={changed ? "line-through" : ""}>{money(r.old_price)}</span> : "-"}
                                              </td>
                                              <td className={`px-3 py-1.5 text-right ${changed ? "font-semibold" : ""}`}>{r.price != null ? money(r.price) : "-"}</td>
                                              <td className="px-3 py-1.5">{r.unit_of_measure || "-"}</td>
                                              <td className="px-3 py-1.5 text-xs text-gray-600">{r.message || ""}</td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {historyLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
          </div>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {result.dry_run ? "Preview" : "Imported"} - {result.list_name}
                {result.dry_run && <Badge variant="outline">Nothing saved yet</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                <div><p className="text-muted-foreground">Rows</p><p className="text-lg font-semibold">{result.summary.rows}</p></div>
                <div><p className="text-muted-foreground">Matched products</p><p className="text-lg font-semibold">{result.summary.products_matched}</p></div>
                <div><p className="text-muted-foreground">New products</p><p className="text-lg font-semibold">{result.summary.products_created}</p></div>
                <div><p className="text-muted-foreground">Prices added / updated</p><p className="text-lg font-semibold">{result.summary.prices_added} / {result.summary.prices_updated}</p></div>
                <div><p className="text-muted-foreground">Errors</p><p className={`text-lg font-semibold ${result.summary.errors ? "text-red-600" : ""}`}>{result.summary.errors}</p></div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Item Description</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Item No.</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell>{r.description || "-"}</TableCell>
                        <TableCell className="text-right">{r.price != null ? r.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}</TableCell>
                        <TableCell>{r.unit_of_measure || "-"}</TableCell>
                        <TableCell>{r.item_number ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {statusBadge(r.status)}
                            {r.message && <span className="text-xs text-muted-foreground">{r.message}</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {result.dry_run && (
                <div className="flex justify-end">
                  <Button disabled={busy !== null} onClick={() => run(false)}>
                    {busy === "import" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Looks right - import {result.list_name}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PermissionGuard>
  )
}
