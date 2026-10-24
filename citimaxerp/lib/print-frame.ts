/**
 * Print a piece of HTML without opening another window: it is laid out in a hidden frame
 * on this page, printed from there, and the frame is removed afterwards.
 */
export function printHtml(html: string, title = "Print") {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  // A real page width, just off-screen: a zero-sized frame lays the page out squashed.
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0"
  document.body.appendChild(frame)

  const doc = frame.contentDocument
  if (!doc) {
    frame.remove()
    return
  }
  doc.open()
  doc.write(/^\s*<(!doctype|html)/i.test(html) ? html : `<!DOCTYPE html><html><head><title>${title}</title></head><body>${html}</body></html>`)
  doc.close()

  const print = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    // Printing blocks until the dialog closes; give it a moment before tidying up.
    setTimeout(() => frame.remove(), 1000)
  }
  // Wait for images (logos) to load so they appear on the page.
  if (doc.readyState === "complete") setTimeout(print, 250)
  else frame.onload = () => setTimeout(print, 250)
}
