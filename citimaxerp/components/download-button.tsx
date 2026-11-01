"use client"

import { useState } from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useOptionalAuth } from "@/lib/auth-context"
import { exportTable, type TableExport } from "@/lib/table-export"
import { DownloadFormatDialog } from "@/components/download-format-dialog"

// A single "Download" button: asks PDF / Excel / CSV, then exports what `build` returns
// headed with the company letterhead.
interface DownloadButtonProps {
  build: () => TableExport | Promise<TableExport>
  title: string // shown in the dialog, e.g. "General Ledger"
  label?: string
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
  disabled?: boolean
}

export function DownloadButton({ build, title, label = "Download", size = "sm", variant = "outline", className, disabled }: DownloadButtonProps) {
  const [open, setOpen] = useState(false)
  const company = useOptionalAuth()?.userProfile?.company
  return (
    <>
      <Button size={size} variant={variant} className={className} disabled={disabled} onClick={() => setOpen(true)}>
        <Download className={label ? "mr-2 h-4 w-4" : "h-4 w-4"} />
        {label}
      </Button>
      <DownloadFormatDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        onDownload={async (format) => exportTable(format, await build(), company)}
      />
    </>
  )
}
