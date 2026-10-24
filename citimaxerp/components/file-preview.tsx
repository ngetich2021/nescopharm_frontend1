"use client"

import { forwardRef, useState, type AnchorHTMLAttributes, type MouseEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

const isImage = (url: string) => /^data:image\/|\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(url)

/** Shows a document or image inside the page, with a download button - no new window. */
export function FilePreviewDialog({ url, title, open, onOpenChange }: { url: string | null; title?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-3">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pr-8">
          <DialogTitle className="truncate">{title || "Document"}</DialogTitle>
          {url && (
            <Button asChild variant="outline" size="sm">
              <a href={url} download><Download className="mr-2 h-4 w-4" /> Download</a>
            </Button>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded border bg-gray-50">
          {url && (isImage(url)
            ? <img src={url} alt={title || "Document"} className="mx-auto h-auto max-w-full" />
            : <iframe src={url} title={title || "Document"} className="h-full w-full" />)}
        </div>
      </DialogContent>
    </Dialog>
  )
}

type FileLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target"> & { href?: string | null; title?: string }

/**
 * A link to an uploaded file (receipt, delivery note, signed document...). Clicking shows it
 * in the page instead of opening another browser window. One element, so it also works
 * inside <Button asChild>.
 */
export const FileLink = forwardRef<HTMLAnchorElement, FileLinkProps>(function FileLink({ href, title, children, onClick, ...rest }, ref) {
  const [open, setOpen] = useState(false)
  const show = (e: MouseEvent<HTMLAnchorElement>) => {
    // Clicks inside the (portalled) viewer bubble here through React; only the link itself opens it.
    if (!e.currentTarget.contains(e.target as Node)) return
    e.preventDefault()
    e.stopPropagation()
    onClick?.(e)
    if (href) setOpen(true)
  }
  return (
    <a ref={ref} href={href || undefined} onClick={show} {...rest}>
      {children}
      <FilePreviewDialog url={open && href ? href : null} title={title} open={open} onOpenChange={setOpen} />
    </a>
  )
})
