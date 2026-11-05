// Keeps a printed invoice from spilling a few lines onto one more page. The browser gives no way to
// ask how a document will paginate, so the page breaks are worked out here on a hidden copy laid
// out at the printed size. A two-page invoice goes on one page if it stays readable; a longer one
// only loses a light last page, and otherwise keeps its normal size.

const MM = 96 / 25.4
// A4 less the sheet's padding (.invoice-sheet in invoice-document).
const CONTENT_WIDTH = 188 * MM
const PAGE_HEIGHT = 279 * MM - 4
// Below this the smallest labels get too small to read on paper.
const MIN_ZOOM = 0.8
const ZOOM_STEP = 0.02
// On a longer invoice, a last page fuller than this is real content, not a spill.
const LIGHT_LAST_PAGE = 0.3

/** The pieces a page break falls between: each table row and each other block, in order. */
function paginate(content: HTMLElement): { pages: number; lastPageUsed: number } {
  const pieces: { top: number; bottom: number; isRow: boolean }[] = []
  let headerHeight = 0
  for (const child of Array.from(content.children)) {
    const table = child.querySelector("table")
    if (!table) {
      const { top, bottom } = child.getBoundingClientRect()
      pieces.push({ top, bottom, isRow: false })
      continue
    }
    const head = table.querySelector("thead")?.getBoundingClientRect()
    if (head) {
      headerHeight = head.height
      pieces.push({ top: head.top, bottom: head.bottom, isRow: false })
    }
    table.querySelectorAll("tbody tr").forEach((row) => {
      const { top, bottom } = row.getBoundingClientRect()
      pieces.push({ top, bottom, isRow: true })
    })
  }
  if (pieces.length === 0) return { pages: 1, lastPageUsed: 0 }

  let pages = 1
  let pageTop = pieces[0].top
  let repeated = 0 // the table header the browser repeats above rows on a new page
  for (const piece of pieces) {
    if (piece.bottom - pageTop + repeated > PAGE_HEIGHT) {
      pages++
      pageTop = piece.top
      repeated = piece.isRow ? headerHeight : 0
    }
  }
  return { pages, lastPageUsed: pieces[pieces.length - 1].bottom - pageTop + repeated }
}

/** The zoom that removes a light last page when printed: 1 when it should print as it is. */
export function invoicePrintZoom(content: HTMLElement): number {
  const host = document.createElement("div")
  host.className = "invoice-fit-measure text-sm"
  host.style.cssText = `position:absolute;left:-10000px;top:0;width:${CONTENT_WIDTH}px;visibility:hidden;`
  const copy = content.cloneNode(true) as HTMLElement

  // A copied image has no height until it decodes, so the letterhead gets its shape now. It fills
  // the page width at any zoom, so it stays the same size while the rest of the invoice shrinks.
  const images = Array.from(content.querySelectorAll("img"))
  Array.from(copy.querySelectorAll("img")).forEach((image, i) => {
    const live = images[i]
    if (live?.naturalWidth && image.classList.contains("w-full")) {
      image.style.aspectRatio = `${live.naturalWidth} / ${live.naturalHeight}`
    }
  })

  host.appendChild(copy)
  document.body.appendChild(host)
  try {
    copy.style.zoom = "1"
    const { pages, lastPageUsed } = paginate(copy)
    if (pages === 1 || (pages > 2 && lastPageUsed > PAGE_HEIGHT * LIGHT_LAST_PAGE)) return 1
    for (let zoom = 1 - ZOOM_STEP; zoom >= MIN_ZOOM - 0.001; zoom -= ZOOM_STEP) {
      copy.style.zoom = String(zoom)
      if (paginate(copy).pages < pages) return Math.round(zoom * 100) / 100
    }
    return 1
  } finally {
    host.remove()
  }
}
