"use client"

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { downloadTemplate, fetchImportSchema, runImport, type ImportResult } from "@/lib/data-import"

/**
 * Template + Import (preview first) for bringing past paper sheets in, e.g. cleaning or temperature
 * records. `entity` is the import's key on the backend (ImportSchemas).
 */
export function SheetImport({ entity, label, onImported }: { entity: string; label: string; onImported: () => void }) {
  const { toast } = useToast()
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const close = () => { setPreview(null); setFile(null) }

  const template = async () => {
    try {
      downloadTemplate(await fetchImportSchema(entity), { fileName: `${label} Import Template.xlsx` })
    } catch (err) {
      toast({ title: "Could not download the template", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
    }
  }

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ""
    if (!picked) return
    setBusy(true)
    try {
      setPreview(await runImport(entity, picked, true))
      setFile(picked)
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Could not read the file", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!file) return
    setBusy(true)
    try {
      const result = await runImport(entity, file, false)
      close()
      onImported()
      toast({ title: `${label} imported`, description: `${result.summary.created} added, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged.` })
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Nothing was saved", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const saving = preview ? preview.summary.created + preview.summary.updated : 0

  return (
    <>
      <Button variant="outline" size="sm" onClick={template}>
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Template
      </Button>
      <input type="file" id={inputId} className="hidden" accept=".csv,.xlsx,.xls" onChange={pick} />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => document.getElementById(inputId)?.click()}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        Import
      </Button>

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open && !busy) close() }}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Import Preview - {label}</DialogTitle>
            <DialogDescription>Nothing is saved yet. Check the rows, then import.</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  ["New", preview.summary.created, "bg-blue-50", "text-blue-600"],
                  ["Updated", preview.summary.updated, "bg-green-50", "text-green-600"],
                  ["Unchanged", preview.summary.unchanged, "bg-yellow-50", "text-yellow-600"],
                  ["Errors", preview.summary.errors, "bg-red-50", "text-red-600"],
                ] as const).map(([name, value, bg, fg]) => (
                  <div key={name} className={`rounded p-3 ${bg}`}>
                    <div className={`text-2xl font-bold ${fg}`}>{value}</div>
                    <div className="text-sm text-gray-600">{name}</div>
                  </div>
                ))}
              </div>
              {preview.summary.errors > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {preview.summary.errors} row(s) have problems and will be skipped; fix them in the sheet and import again.
                </div>
              )}
              <div className="max-h-[380px] overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                      <th>S/No.</th>
                      <th>Row</th>
                      <th>Date</th>
                      <th>Record</th>
                      <th>Result</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row: any, i: number) => (
                      <tr key={i} className="border-t align-top [&>td]:px-3 [&>td]:py-2">
                        <td className="text-gray-500">{i + 1}</td>
                        <td>{row.row}</td>
                        <td className="whitespace-nowrap">{row.key}</td>
                        <td>{row.name}</td>
                        <td>
                          <span className={`rounded px-2 py-1 text-xs ${
                            row.status === "created" ? "bg-blue-100 text-blue-800"
                              : row.status === "updated" ? "bg-green-100 text-green-800"
                              : row.status === "unchanged" ? "bg-gray-100 text-gray-800"
                              : "bg-red-100 text-red-800"
                          }`}>{row.status}</span>
                        </td>
                        <td className="text-gray-600">
                          {row.message || (row.changes ?? []).map((c: any) => `${c.field}: ${c.from ?? "-"} → ${c.to ?? "-"}`).join("; ") || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={close}>Cancel</Button>
                <Button onClick={confirm} disabled={busy || saving === 0}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import {saving} record(s)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
