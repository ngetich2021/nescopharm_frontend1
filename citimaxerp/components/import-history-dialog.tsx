"use client"

import { Fragment, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { ChevronDown, ChevronRight, Download, History, Loader2 } from "lucide-react"
import apiCall from "@/lib/api"

type Change = { field: string; from: unknown; to: unknown }
type ChangedRow = { ref: string; item: string; size: string | null; action: "created" | "updated" | "deactivated" | "merged"; changes: Change[] }
type ImportLog = {
  id: string
  created_at: string
  user: string | null
  file_name: string | null
  has_file: boolean
  summary: Record<string, number>
  changes: ChangedRow[]
}

const FIELD_LABELS: Record<string, string> = {
  name: "Description",
  unit_of_measurement: "Unit of Measure",
  unit_cost: "Cost Price",
  cost: "Cost Price",
  low_stock_threshold: "Reorder Level",
  is_taxable: "Taxable",
  tax_rate: "Tax Rate",
  track_inventory: "Track Inventory",
  is_active: "Active",
  hs_code: "HS Code",
  quantity_received: "Qty Received",
  quantity_available: "Qty Available",
  selling_price: "Selling Price",
  manufacture_date: "Manufacture Date",
  expiry_date: "Expiry Date",
  received_date: "Received Date",
  supplier_id: "Supplier",
  lot_number: "Lot Number",
}

const label = (field: string) => FIELD_LABELS[field] ?? field.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "-" : String(v))

const SUMMARY_LABELS: Record<string, string> = {
  items_created: "items created",
  items_updated: "items updated",
  sizes_created: "sizes created",
  sizes_updated: "sizes updated",
  batches_created: "batches created",
  batches_updated: "batches updated",
  unchanged: "unchanged",
  deactivated: "deactivated",
  merged: "duplicates merged",
  errors: "skipped",
}

async function downloadFile(id: string, fileName: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/imports/history/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error("Download failed")
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = fileName || "import.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportHistoryDialog({ kind }: { kind: "products" | "batches" }) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<ImportLog[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const { toast } = useToast()

  const load = async () => {
    setLogs(null)
    try {
      const res = await apiCall<{ data: ImportLog[] }>(`/imports/history?kind=${kind}`, "GET")
      setLogs(res.data)
    } catch (error: any) {
      setLogs([])
      toast({ title: "Could not load import history", description: error.message, variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) load() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-2 h-4 w-4" />
          Import History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{kind === "products" ? "Product" : "Batch"} Import History</DialogTitle>
          <DialogDescription>Who imported which file, when, and every value it changed. Click a row to see the changes.</DialogDescription>
        </DialogHeader>

        {logs === null ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
          </div>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <div className="max-h-[65vh] overflow-auto rounded border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white">
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-12">S/No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Imported By</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log, i) => {
                  const isOpen = expanded === log.id
                  return (
                    <Fragment key={log.id}>
                      <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(isOpen ? null : log.id)}>
                        <TableCell>
                          {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                        </TableCell>
                        <TableCell className="text-gray-500">{i + 1}</TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell>{log.user ?? "-"}</TableCell>
                        <TableCell>
                          {log.has_file ? (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadFile(log.id, log.file_name ?? "").catch(() =>
                                  toast({ title: "Download failed", variant: "destructive" }))
                              }}
                            >
                              <Download className="mr-1 h-3 w-3" /> {log.file_name}
                            </Button>
                          ) : (log.file_name ?? "-")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(log.summary)
                              .filter(([k, v]) => k !== "rows" && v > 0)
                              .map(([k, v]) => (
                                <Badge key={k} variant="outline" className="text-xs">{v} {SUMMARY_LABELS[k] ?? k}</Badge>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                          <TableCell colSpan={6} className="p-3">
                            {log.changes.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nothing was changed by this import.</p>
                            ) : (
                              <table className="w-full text-sm bg-white border rounded">
                                <thead className="bg-gray-50 text-xs text-gray-600">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">S/No</th>
                                    <th className="px-3 py-2 text-left font-medium">{kind === "products" ? "Item No." : "Batch"}</th>
                                    <th className="px-3 py-2 text-left font-medium">Item</th>
                                    <th className="px-3 py-2 text-left font-medium">Action</th>
                                    <th className="px-3 py-2 text-left font-medium">Changes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {log.changes.map((row, ri) => (
                                    <tr key={ri} className="border-t align-top">
                                      <td className="px-3 py-2 text-gray-500">{ri + 1}</td>
                                      <td className="px-3 py-2 font-mono">{row.ref}</td>
                                      <td className="px-3 py-2">{row.item}{row.size ? <span className="text-gray-500"> ({row.size})</span> : null}</td>
                                      <td className="px-3 py-2">
                                        <Badge variant="outline" className={
                                          row.action === "created" ? "bg-emerald-50 text-emerald-700"
                                            : row.action === "deactivated" ? "bg-orange-50 text-orange-700"
                                            : row.action === "merged" ? "bg-purple-50 text-purple-700"
                                            : "bg-blue-50 text-blue-700"
                                        }>
                                          {row.action}
                                        </Badge>
                                      </td>
                                      <td className="px-3 py-2 space-y-0.5">
                                        {row.changes.map((c, ci) => (
                                          <div key={ci}>
                                            <span className="text-gray-600">{label(c.field)}:</span>{" "}
                                            {row.action !== "created" && c.from !== null && <><span className="text-gray-400 line-through">{show(c.from)}</span>{" → "}</>}
                                            <span className="font-medium">{show(c.to)}</span>
                                          </div>
                                        ))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
        )}
      </DialogContent>
    </Dialog>
  )
}
