"use client"

import { useState } from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useOptionalAuth } from "@/lib/auth-context"
import { exportTable, type ExportFormat, type TableExport } from "@/lib/table-export"

// The one way to download in the app: an "Export" button opening Excel / PDF / CSV.
// PDF and Excel are headed with the company letterhead (see lib/table-export).

const FORMATS: { format: ExportFormat; label: string; icon: typeof FileText }[] = [
  { format: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "csv", label: "CSV", icon: FileDown },
]

type OnExport = (format: ExportFormat) => void | Promise<void>

function useExport(onExport: OnExport) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (format: ExportFormat) => {
    setBusy(true)
    try {
      await onExport(format)
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

/** Exports what `build` returns, in the chosen format, headed with the company letterhead. */
export function useTableExport(build: () => TableExport | Promise<TableExport>): OnExport {
  const company = useOptionalAuth()?.userProfile?.company
  return async (format) => exportTable(format, await build(), company)
}

interface ExportMenuProps {
  onExport: OnExport
  label?: string
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
  disabled?: boolean
  // Formats this export offers, e.g. ["pdf"] for a document only made as a PDF. Default: all three.
  formats?: ExportFormat[]
}

export function ExportMenu({ onExport, label = "Export", size = "sm", variant = "outline", className, disabled, formats }: ExportMenuProps) {
  const { busy, run } = useExport(onExport)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className={className} disabled={disabled || busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FORMATS.filter((f) => !formats || formats.includes(f.format)).map(({ format, label, icon: Icon }) => (
          <DropdownMenuItem key={format} onClick={() => run(format)}>
            <Icon className="mr-2 h-4 w-4" /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The same choice inside a row's actions menu: "Download ▸ Excel / PDF / CSV". */
export function ExportSubMenu({ onExport, label = "Download", formats }: Pick<ExportMenuProps, "onExport" | "label" | "formats">) {
  const { busy, run } = useExport(onExport)
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          {FORMATS.filter((f) => !formats || formats.includes(f.format)).map(({ format, label, icon: Icon }) => (
            <DropdownMenuItem key={format} onClick={(e) => { e.stopPropagation(); run(format) }}>
              <Icon className="mr-2 h-4 w-4" /> {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  )
}
