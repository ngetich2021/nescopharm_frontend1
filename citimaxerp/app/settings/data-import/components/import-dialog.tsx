"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Upload } from "lucide-react"
import { ImportResult, ImportSchema, runImport } from "@/lib/data-import"

const STATUS_STYLE: Record<string, string> = {
  created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  updated: "bg-blue-50 text-blue-700 border-blue-200",
  unchanged: "bg-gray-50 text-gray-500 border-gray-200",
  error: "bg-red-50 text-red-700 border-red-200",
}

interface Props {
  schema: ImportSchema | null
  onClose: () => void
  onImported: () => void
}

export function ImportDialog({ schema, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const reset = () => {
    setFile(null)
    setPreview(null)
    onClose()
  }

  const run = async (dryRun: boolean) => {
    if (!file || !schema) return
    setBusy(true)
    try {
      const result = await runImport(schema.key, file, dryRun)
      if (dryRun) {
        setPreview(result)
      } else {
        const s = result.summary
        toast({
          title: `${schema.label} imported`,
          description: `${s.created} created, ${s.updated} updated${s.errors ? `, ${s.errors} rows skipped` : ""}.`,
        })
        reset()
        onImported()
      }
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message || "Could not read the file.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const s = preview?.summary
  const willWrite = s ? s.created + s.updated : 0

  return (
    <Dialog open={!!schema} onOpenChange={(next) => !next && reset()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import {schema?.label}</DialogTitle>
          <DialogDescription>{schema?.matching}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPreview(null)
            }}
          />

          {s && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{s.rows} rows read</Badge>
              <Badge variant="outline" className={STATUS_STYLE.created}>{s.created} to create</Badge>
              <Badge variant="outline" className={STATUS_STYLE.updated}>{s.updated} to update</Badge>
              <Badge variant="outline" className={STATUS_STYLE.unchanged}>{s.unchanged} unchanged</Badge>
              {s.errors > 0 && <Badge variant="outline" className={STATUS_STYLE.error}>{s.errors} with problems</Badge>}
              {s.items !== undefined && <Badge variant="outline">{s.items} line items</Badge>}
            </div>
          )}

          {preview && (
            <div className="max-h-[45vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row, index) => (
                    <TableRow key={`${row.row}-${index}`}>
                      <TableCell className="text-gray-500">{row.row}</TableCell>
                      <TableCell className="font-medium">{row.key || "-"}</TableCell>
                      <TableCell>{row.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLE[row.status]}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {row.message ??
                          (row.before !== undefined && row.before !== null
                            ? `${row.before} → ${row.after}`
                            : row.lines
                              ? `${row.lines} line${row.lines === 1 ? "" : "s"}`
                              : "")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={reset} disabled={busy}>Cancel</Button>
          <Button variant="outline" onClick={() => run(true)} disabled={!file || busy}>
            {busy && !preview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Preview
          </Button>
          <Button onClick={() => run(false)} disabled={!preview || busy || willWrite === 0}>
            {busy && preview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Upload className="mr-2 h-4 w-4" />
            Import {willWrite > 0 ? willWrite : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
