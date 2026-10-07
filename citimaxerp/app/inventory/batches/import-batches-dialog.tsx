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
  batch_number: string
  item: string
  size: string | null
  status: string
  message?: string | null
  quantity?: number
  expiry?: string | null
  product_name?: string
}

interface ImportResult {
  status: string
  message: string
  dry_run: boolean
  summary: {
    rows: number
    batches_created: number
    batches_updated: number
    unchanged: number
    errors: number
  }
  rows: ImportRow[]
}

const STATUS_STYLE: Record<string, string> = {
  created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  updated: "bg-blue-50 text-blue-700 border-blue-200",
  unchanged: "bg-gray-50 text-gray-500 border-gray-200",
  error: "bg-red-50 text-red-700 border-red-200",
}

export function ImportBatchesDialog({ onImported }: { onImported: () => void }) {
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
      const result = await apiCall<ImportResult>("/batches/import", "POST", form)
      if (dryRun) {
        setPreview(result)
      } else {
        const s = result.summary
        toast({
          title: "Batches imported",
          description: `${s.batches_created} created, ${s.batches_updated} updated${s.errors ? `, ${s.errors} skipped` : ""}.`,
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
          Import Batches
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import Batches</DialogTitle>
          <DialogDescription>
            Upload the "Batches" sheet of the Nescopharm import workbook (or any sheet whose first row
            has <b>Batch Number</b> plus <b>Item Description</b> or <b>Item No.</b>). Products must exist already
            - import the Products sheet first. The same workbook can be uploaded here too; the "Batches"
            sheet is picked automatically.
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
              <Badge variant="outline" className={STATUS_STYLE.created}>{s.batches_created} new batches</Badge>
              <Badge variant="outline" className={STATUS_STYLE.updated}>{s.batches_updated} updated</Badge>
              <Badge variant="outline" className={STATUS_STYLE.unchanged}>{s.unchanged} unchanged</Badge>
              {s.errors > 0 && <Badge variant="outline" className={STATUS_STYLE.error}>{s.errors} errors</Badge>}
            </div>
            <div className="max-h-[55vh] overflow-auto rounded border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="min-w-[260px]">Product</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="w-28">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview!.rows.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell className="text-gray-500">{r.row}</TableCell>
                      <TableCell className="font-mono text-sm">{r.batch_number || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{r.product_name || r.item}</div>
                        {r.message && (
                          <p className={r.status === "error" ? "text-xs text-red-600" : "text-xs text-amber-600"}>{r.message}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.size || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.quantity != null ? r.quantity.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{r.expiry || "-"}</TableCell>
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
          <Button
            onClick={() => run(false)}
            disabled={!preview || busy || preview.summary.rows === preview.summary.errors + preview.summary.unchanged}
          >
            {busy && preview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy && preview ? "Importing..." : `Import${s?.errors ? " (skip errors)" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
