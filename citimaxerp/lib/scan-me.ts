import type { jsPDF } from "jspdf"

// The "Scan me!" QR every downloaded PDF carries in the bottom-right corner of each page.

const SCAN_ME_IMAGE = "/scan-me.jpg"
export const SCAN_ME_SIZE = 16 // mm, square
const EDGE = 4 // mm from the right and bottom edges

let scanMe: Promise<string | null> | null = null

function loadScanMe() {
  scanMe ??= fetch(SCAN_ME_IMAGE)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    }))
    .catch(() => { scanMe = null; return null })
  return scanMe
}

/** Puts the QR on every page of the PDF; call it just before saving. A PDF without it still saves. */
export async function addScanMe(pdf: jsPDF) {
  const image = await loadScanMe()
  if (!image) return
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page)
    pdf.addImage(image, "JPEG", pageWidth - EDGE - SCAN_ME_SIZE, pageHeight - EDGE - SCAN_ME_SIZE, SCAN_ME_SIZE, SCAN_ME_SIZE, "scan-me")
  }
}
