// html2canvas works out where text sits by measuring a hidden 1x1 image placed next to sample text
// in the live page. Tailwind's base style makes every image display:block, which throws that
// measurement off, so in downloaded PDFs words were drawn a few pixels low - out of their boxes,
// with borders running through them. Its measuring image (a 1x1 GIF given width="1") is put back
// inline in the live page, and the copy it renders gets inline images too.
const MEASURE_FIX_ID = "html2canvas-text-offset-fix"

export function fixTextOffset(clonedDoc: Document): void {
  if (!document.getElementById(MEASURE_FIX_ID)) {
    const live = document.createElement("style")
    live.id = MEASURE_FIX_ID
    live.textContent = 'img[width="1"][src^="data:image/gif"] { display: inline !important; }'
    document.head.appendChild(live)
  }
  const style = clonedDoc.createElement("style")
  style.textContent = "img { display: inline-block !important; }"
  clonedDoc.head.appendChild(style)
}

type Span = { top: number; bottom: number }

// Below this size the smallest text gets too small to read on paper (as for printed invoices).
const MIN_FIT = 0.8

/** Everything a page break must not cut: rows, lines of text, images, and a heading with its first row. */
function unbreakable(element: HTMLElement): Span[] {
  const origin = element.getBoundingClientRect().top
  const span = (el: Element, end: Element = el): Span => ({
    top: el.getBoundingClientRect().top - origin,
    bottom: end.getBoundingClientRect().bottom - origin,
  })
  const spans = Array.from(element.querySelectorAll("*"))
    .filter((el) => el.children.length === 0 || el.matches("tr, p, li, h1, h2, h3, h4, h5, h6, img, svg"))
    .map((el) => span(el))
  element.querySelectorAll("section").forEach((section) => {
    const firstRow = section.querySelector("tbody tr")
    if (firstRow) spans.push(span(section, firstRow))
  })
  return spans.filter((s) => s.bottom > s.top).sort((a, b) => a.top - b.top)
}

/** Where a block may end: the places with nothing running across them. */
function safeBreaks(spans: Span[]): number[] {
  const breaks: number[] = []
  let reach = 0
  spans.forEach((s, i) => {
    reach = Math.max(reach, s.bottom)
    const next = spans[i + 1]
    if (!next || next.top >= reach - 0.5) breaks.push(reach)
  })
  return breaks
}

/**
 * Puts a captured document on A4: on one page if it stays readable, otherwise over as many pages as
 * it needs, breaking between rows and repeating a table's headings when it carries on over a page.
 * Returns the number of pages.
 */
export function addCanvasToPdf(pdf: any, canvas: HTMLCanvasElement, element: HTMLElement, margin = 8): number {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const usableWidth = pageWidth - margin * 2
  const usableHeight = pageHeight - margin * 2
  const fullHeight = (canvas.height * usableWidth) / canvas.width
  const fit = usableHeight / fullHeight

  if (fit >= MIN_FIT) {
    const scale = Math.min(fit, 1)
    const width = usableWidth * scale
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pageWidth - width) / 2, margin, width, fullHeight * scale)
    return 1
  }

  // From here on, everything is in canvas pixels.
  const rect = element.getBoundingClientRect()
  const toCanvas = canvas.height / rect.height
  const pagePixels = (usableHeight * canvas.width) / usableWidth
  const breaks = safeBreaks(unbreakable(element)).map((y) => y * toCanvas)
  const tables = Array.from(element.querySelectorAll("table")).flatMap((table) => {
    const head = table.querySelector("thead")?.getBoundingClientRect()
    const box = table.getBoundingClientRect()
    return head
      ? [{ headTop: (head.top - rect.top) * toCanvas, headBottom: (head.bottom - rect.top) * toCanvas, bottom: (box.bottom - rect.top) * toCanvas }]
      : []
  })

  let start = 0
  let pages = 0
  while (start < canvas.height - 1) {
    const table = tables.find((t) => t.headBottom <= start && start < t.bottom - 1)
    const headHeight = table ? table.headBottom - table.headTop : 0
    const limit = start + pagePixels - headHeight
    // A piece too tall for any page is the only thing that gets cut.
    const end = limit >= canvas.height
      ? canvas.height
      : [...breaks].reverse().find((y) => y <= limit && y > start + 1) ?? limit

    const slice = document.createElement("canvas")
    slice.width = canvas.width
    slice.height = Math.ceil(headHeight + end - start)
    const context = slice.getContext("2d")!
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, slice.width, slice.height)
    if (table) context.drawImage(canvas, 0, table.headTop, canvas.width, headHeight, 0, 0, canvas.width, headHeight)
    context.drawImage(canvas, 0, start, canvas.width, end - start, 0, headHeight, canvas.width, end - start)

    if (pages > 0) pdf.addPage()
    pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, margin, usableWidth, (slice.height * usableWidth) / canvas.width)
    pages++
    start = end
  }
  return pages
}
