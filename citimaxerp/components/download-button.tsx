"use client"

import type { ButtonProps } from "@/components/ui/button"
import type { TableExport } from "@/lib/table-export"
import { ExportMenu, useTableExport } from "@/components/export-menu"

// An "Export" button opening Excel / PDF / CSV of what `build` returns, headed with the
// company letterhead.
interface DownloadButtonProps {
  build: () => TableExport | Promise<TableExport>
  title?: string
  label?: string
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
  disabled?: boolean
}

export function DownloadButton({ build, label, size, variant, className, disabled }: DownloadButtonProps) {
  const onExport = useTableExport(build)
  return <ExportMenu onExport={onExport} label={label} size={size} variant={variant} className={className} disabled={disabled} />
}
