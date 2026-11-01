"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ExportFormat } from "@/lib/table-export"

// One "Download" action that asks which format (PDF, Excel or CSV) instead of a link for each.
interface DownloadFormatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onDownload: (format: ExportFormat) => Promise<void>
}

const FORMATS: { format: ExportFormat; label: string; hint: string; icon: typeof FileText }[] = [
  { format: "pdf", label: "PDF", hint: "To print or send", icon: FileText },
  { format: "xlsx", label: "Excel", hint: ".xlsx spreadsheet", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", hint: "Plain data", icon: FileDown },
]

export function DownloadFormatDialog({ open, onOpenChange, title, onDownload }: DownloadFormatDialogProps) {
  const { toast } = useToast()
  const [busy, setBusy] = useState<ExportFormat | null>(null)

  const choose = async (format: ExportFormat) => {
    setBusy(format)
    try {
      await onDownload(format)
      onOpenChange(false)
    } catch (err) {
      toast({ title: "Download failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Download {title}</DialogTitle>
          <DialogDescription>Choose a format. PDF and Excel carry the company logo.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {FORMATS.map(({ format, label, hint, icon: Icon }) => (
            <Button
              key={format}
              variant="outline"
              className="h-auto flex-col gap-1 py-4"
              disabled={!!busy}
              onClick={() => choose(format)}
            >
              {busy === format ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
              <span className="font-medium">{label}</span>
              <span className="text-xs font-normal text-muted-foreground">{hint}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
