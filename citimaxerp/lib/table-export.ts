import { getCompany, type Company } from "@/lib/company"

// Table exports (CSV, Excel, PDF) headed with the company's letterhead - or its logo, or just its
// name when it has neither. CSV is plain text, so it carries the name and title only.

export type ExportFormat = "csv" | "xlsx" | "pdf"
export type ExportCell = string | number | null | undefined

export interface TableExport {
  fileName: string
  title: string
  subtitle?: string
  headers: string[]
  rows: ExportCell[][]
  footer?: ExportCell[][] // e.g. totals, bold under the table
}

interface Brand {
  name: string
  image?: { dataUrl: string; width: number; height: number; type: "PNG" | "JPEG" }
}

// One company lookup per page load.
let brandCache: Promise<Brand> | null = null

async function loadImage(url: string): Promise<Brand["image"]> {
  const blob = await (await fetch(url)).blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  const img = new Image()
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = dataUrl })
  return { dataUrl, width: img.naturalWidth, height: img.naturalHeight, type: blob.type.includes("png") ? "PNG" : "JPEG" }
}

async function loadBrand(companyId?: string, fallbackName = ""): Promise<Brand> {
  let company: Company | null = null
  try { company = companyId ? await getCompany(companyId) : null } catch { /* name only */ }
  const brand: Brand = { name: company?.name || fallbackName }
  for (const url of [company?.letterhead_url, company?.logo_url]) {
    if (!url) continue
    try { brand.image = await loadImage(url); break } catch { /* try the next one */ }
  }
  return brand
}

function getBrand(companyId?: string, fallbackName?: string) {
  if (!brandCache) brandCache = loadBrand(companyId, fallbackName).catch(() => ({ name: fallbackName || "" }))
  return brandCache
}

// Amount columns (any value with cents) show 2 decimals; counts and S/No stay whole.
function decimalColumns(data: TableExport): boolean[] {
  return data.headers.map((_, i) =>
    [...data.rows, ...(data.footer ?? [])].some((r) => typeof r[i] === "number" && !Number.isInteger(r[i] as number)))
}
const numericColumns = (data: TableExport) =>
  data.headers.map((_, i) => data.rows.length > 0 && data.rows.every((r) => r[i] == null || r[i] === "" || typeof r[i] === "number"))

function download(blob: Blob, name: string) {
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

function exportCsv(data: TableExport, brand: Brand) {
  const cell = (v: ExportCell) => {
    const s = v == null ? "" : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    [brand.name], [data.title], ...(data.subtitle ? [[data.subtitle]] : []), [],
    data.headers, ...data.rows, ...(data.footer ?? []),
  ].map((r) => r.map(cell).join(","))
  // BOM so Excel opens it as UTF-8.
  download(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }), `${data.fileName}.csv`)
}

async function exportXlsx(data: TableExport, brand: Brand) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(data.title.slice(0, 31) || "Sheet1")
  const decimals = decimalColumns(data)
  const numeric = numericColumns(data)

  // Width of each column from its longest value.
  const widths = data.headers.map((h, i) =>
    Math.min(50, Math.max(h.length, ...[...data.rows, ...(data.footer ?? [])].map((r) =>
      r[i] == null ? 0 : (typeof r[i] === "number" && decimals[i] ? (r[i] as number).toFixed(2).length + 4 : String(r[i]).length)))) + 2)
  ws.columns = widths.map((width) => ({ width }))

  let row = 1
  if (brand.image) {
    // Letterhead across the table, about 20px a row.
    const tableWidthPx = Math.min(900, widths.reduce((s, w) => s + w * 7, 0))
    const heightPx = tableWidthPx * brand.image.height / brand.image.width
    const id = wb.addImage({ base64: brand.image.dataUrl, extension: brand.image.type === "PNG" ? "png" : "jpeg" })
    ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: tableWidthPx, height: heightPx } })
    row = Math.ceil(heightPx / 20) + 2
  } else if (brand.name) {
    ws.getCell(row, 1).value = brand.name
    ws.getCell(row, 1).font = { bold: true, size: 14 }
    row += 1
  }
  ws.getCell(row, 1).value = data.title
  ws.getCell(row, 1).font = { bold: true, size: 13 }
  row += 1
  if (data.subtitle) {
    ws.getCell(row, 1).value = data.subtitle
    row += 1
  }
  row += 1

  const header = ws.getRow(row)
  data.headers.forEach((h, i) => {
    const c = header.getCell(i + 1)
    c.value = h
    c.font = { bold: true }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } }
    c.alignment = { horizontal: numeric[i] ? "right" : "left" }
    c.border = { bottom: { style: "thin" } }
  })
  row += 1

  const put = (cells: ExportCell[], bold = false) => {
    const r = ws.getRow(row++)
    cells.forEach((v, i) => {
      const c = r.getCell(i + 1)
      c.value = v ?? null
      if (typeof v === "number") {
        c.numFmt = decimals[i] ? "#,##0.00" : "#,##0"
        c.alignment = { horizontal: "right" }
      }
      if (bold) {
        c.font = { bold: true }
        if (typeof v === "string") c.alignment = { horizontal: "right" }
      }
    })
    if (bold) r.eachCell((c) => { c.border = { top: { style: "thin" } } })
  }
  data.rows.forEach((r) => put(r))
  ;(data.footer ?? []).forEach((r) => put(r, true))

  const buffer = await wb.xlsx.writeBuffer()
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${data.fileName}.xlsx`)
}

async function exportPdf(data: TableExport, brand: Brand) {
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default
  const pdf = new jsPDF({ orientation: data.headers.length > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 12
  const decimals = decimalColumns(data)
  const numeric = numericColumns(data)
  const fmt = (v: ExportCell, i: number) =>
    typeof v === "number"
      ? v.toLocaleString(undefined, decimals[i] ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined)
      : v ?? ""

  let y = margin
  if (brand.image) {
    // A wide letterhead spans the page; a logo stays small at the left.
    const wide = brand.image.width / brand.image.height > 2.5
    const w = wide ? pageWidth - margin * 2 : 30
    const h = w * brand.image.height / brand.image.width
    pdf.addImage(brand.image.dataUrl, brand.image.type, margin, y, w, h)
    if (!wide && brand.name) {
      pdf.setFont("helvetica", "bold").setFontSize(14).text(brand.name, margin + w + 5, y + h / 2)
    }
    y += h + 6
  } else if (brand.name) {
    pdf.setFont("helvetica", "bold").setFontSize(14).text(brand.name, margin, y + 5)
    y += 10
  }
  pdf.setFont("helvetica", "bold").setFontSize(13).text(data.title, margin, y + 4)
  y += 6
  if (data.subtitle) {
    pdf.setFont("helvetica", "normal").setFontSize(10).text(data.subtitle, margin, y + 4)
    y += 6
  }

  const columnStyles: Record<number, { halign: "right" }> = {}
  numeric.forEach((n, i) => { if (n) columnStyles[i] = { halign: "right" } })
  autoTable(pdf, {
    startY: y + 3,
    margin: { left: margin, right: margin },
    head: [data.headers],
    body: data.rows.map((r) => r.map(fmt)),
    foot: data.footer?.map((r) => r.map(fmt)),
    showFoot: "lastPage",
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [31, 41, 55], textColor: 255 },
    footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: "bold", halign: "right" },
    columnStyles,
    didDrawPage: () => {
      const pageHeight = pdf.internal.pageSize.getHeight()
      pdf.setFont("helvetica", "normal").setFontSize(8)
      pdf.text(`Printed ${new Date().toLocaleString("en-GB")}`, margin, pageHeight - 6)
      pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 6, { align: "right" })
    },
  })
  pdf.save(`${data.fileName}.pdf`)
}

export async function exportTable(format: ExportFormat, data: TableExport, company?: { id?: string; name?: string } | null) {
  const brand = await getBrand(company?.id, company?.name)
  if (format === "csv") return exportCsv(data, brand)
  if (format === "xlsx") return exportXlsx(data, brand)
  return exportPdf(data, brand)
}
