import type React from "react"
import { cn } from "@/lib/utils"

// A document's closing line with the "Scan me!" QR at its right, so the QR is on the page however
// the document leaves the system - downloaded, printed or saved as PDF from the print dialog.
export function ScanMeFooter({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[4rem_1fr_4rem] items-center gap-2 break-inside-avoid", className)}>
      <span aria-hidden />
      <div>{children}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/scan-me.jpg" alt="Scan me" width={64} height={64} className="h-16 w-16 justify-self-end" />
    </div>
  )
}
