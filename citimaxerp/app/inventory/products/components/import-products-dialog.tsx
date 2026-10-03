"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Upload } from "lucide-react"
import apiCall from "@/lib/api"

interface ImportRow {
  row: number
  item_no: string
  description: string
  status: string
  message?: string | null
  row_type?: "item" | "size"
  size?: string | null
  before?: Snapshot | null
  after?: Snapshot | null
}

type Snapshot = { uom?: string | null; cost?: number | null; tax?: string | null; reorder?: number | null }
type Field = keyof Snapshot

const money = (v: unknown) =>
  v === null || v === undefined ? "-" : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const show = (field: Field, v: unknown) => (field === "cost" ? money(v) : v === null || v === undefined || v === "" ? "-" : String(v))

// The value the row will leave in the system; when it differs from today's, today's is shown struck through above it.
function CompareCell({ row, field }: { row: ImportRow; field: Field }) {
  if (!row.after || !(field in row.after)) return <span className="text-gray-300">-</span>
  const next = show(field, row.after[field])
  const prev = row.before ? show(field, row.before[field]) : null
  if (prev === null) return <span className="font-medium text-emerald-700">{next}</span>
  if (prev === next) return <span className="text-gray-700">{next}</span>
  return (
    <div className="leading-tight">
      <div className="text-xs text-gray-400 line-through">{prev}</div>
      <div className="rounded bg-amber-50 px-1 font-medium text-amber-800">{next}</div>
    </div>
  )
}

interface ImportResult {
  status: string
  message: string
  dry_run: boolean
  summary: { rows: number; items_created: number; items_updated: number; sizes_created: number; sizes_updated: number; unchanged: number; errors: number }
  rows: ImportRow[]
}

const STATUS_STYLE: Record<string, string> = {
  created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "size created": "bg-emerald-50 text-emerald-700 border-emerald-200",
  updated: "bg-blue-50 text-blue-700 border-blue-200",
  "size updated": "bg-blue-50 text-blue-700 border-blue-200",
  unchanged: "bg-gray-50 text-gray-500 border-gray-200",
  error: "bg-red-50 text-red-700 border-red-200",
}

export function ImportProductsDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const run = async (dryRun: boolean) => {
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("dry_run", dryRun ? "1" : "0")
      const result = await apiCall<ImportResult>("/products/import", "POST", form)
      if (dryRun) {
        setPreview(result)
      } else {
        const s = result.summary
        toast({
          title: "Products imported",
          description: `${s.items_created} items created, ${s.items_updated} updated, ${s.sizes_created} sizes created, ${s.sizes_updated} sizes updated${s.errors ? `, ${s.errors} rows skipped` : ""}.`,
        })
        setOpen(false)
        onImported()
      }
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message || "Could not import the file", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const reset = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setFile(null)
      setPreview(null)
    }
  }

  const s = preview?.summary

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            Upload a sheet in the same layout as <b>Export as Excel</b>. Items are matched by Item No. (leave it blank for a new item);
            sizes go on their own rows under the item (e.g. 164.1, Row Type "Size"). Blank cells leave a field unchanged. Stock
            is not imported - it changes only through receipts, stock adjustments and recounts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPreview(null)
            }}
          />
          <Button variant="outline" onClick={() => run(true)} disabled={!file || busy}>
            {busy && !preview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Preview
          </Button>
        </div>

        {s && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{s.rows} rows</Badge>
              <Badge variant="outline" className={STATUS_STYLE.created}>{s.items_created} new items</Badge>
              <Badge variant="outline" className={STATUS_STYLE.updated}>{s.items_updated} items updated</Badge>
              <Badge variant="outline" className={STATUS_STYLE.created}>{s.sizes_created} new sizes</Badge>
              <Badge variant="outline" className={STATUS_STYLE.updated}>{s.sizes_updated} sizes updated</Badge>
              <Badge variant="outline" className={STATUS_STYLE.unchanged}>{s.unchanged} unchanged</Badge>
              {s.errors > 0 && <Badge variant="outline" className={STATUS_STYLE.error}>{s.errors} errors</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Each value is what the item will have after import. Where it changes, the current value is shown{" "}
              <span className="line-through">struck through</span> above the new one, <span className="rounded bg-amber-50 px-1 text-amber-800">highlighted</span>.
            </p>
            <div className="max-h-[50vh] overflow-auto rounded border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead className="w-16">Item No.</TableHead>
                    <TableHead className="min-w-[240px]">Item Description</TableHead>
                    <TableHead>Unit of Measure</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead>Tax Status</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                    <TableHead className="w-28">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview!.rows.map((r) => (
                    <TableRow key={r.row} className={r.row_type === "size" ? "bg-gray-50/50" : undefined}>
                      <TableCell className="text-gray-500">{r.row}</TableCell>
                      <TableCell className={r.row_type === "size" ? "pl-5 font-mono text-gray-600" : "font-mono font-medium"}>{r.item_no || "new"}</TableCell>
                      <TableCell className={r.row_type === "size" ? "pl-6 text-gray-700" : "font-medium"}>
                        {r.description || "-"}
                        {r.message && <p className={r.status === "error" ? "text-xs text-red-600" : "text-xs text-amber-600"}>{r.message}</p>}
                      </TableCell>
                      <TableCell><CompareCell row={r} field="uom" /></TableCell>
                      <TableCell className="text-right tabular-nums"><CompareCell row={r} field="cost" /></TableCell>
                      <TableCell><CompareCell row={r} field="tax" /></TableCell>
                      <TableCell className="text-right tabular-nums"><CompareCell row={r} field="reorder" /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLE[r.status]}>{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)}>Cancel</Button>
          <Button onClick={() => run(false)} disabled={!preview || busy || preview.summary.rows === preview.summary.errors + preview.summary.unchanged}>
            {busy && preview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy && preview ? "Importing..." : `Import${s?.errors ? " (skip errors)" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
