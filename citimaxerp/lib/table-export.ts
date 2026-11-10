import { displayDateTime } from "@/lib/date-format"
import { getCompany, type Company } from "@/lib/company"
import { addScanMe, SCAN_ME_SIZE } from "@/lib/scan-me"

// Table exports (CSV, Excel, PDF) headed with the company's letterhead - or its logo, or just its
// name when it has neither. CSV is plain text, so it carries the name and title only.

export type ExportFormat = "csv" | "xlsx" | "pdf"
export type ExportCell = string | number | null | undefined

export interface TableExport {
  fileName: string
  title: string
  subtitle?: string
  details?: [string, string][] // label/value lines under the title, e.g. a document's supplier and dates
  headers: string[]
  rows: ExportCell[][]
  footer?: ExportCell[][] // e.g. totals, bold under the table
  moneyColumns?: number[] // always 2 decimals, even when every amount is whole
  rightColumns?: number[] // right-aligned though written as text, e.g. "1.50" or "30.0%"
  // Kept in the Excel file but hidden (e.g. the Ref an import reads back), left out of the PDF.
  // CSV cannot hide a column, so it keeps them.
  hiddenColumns?: number[]
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
  const name = company?.name || fallbackName
  const brand: Brand = { name }
  // The uploaded letterhead/logo first; the copies bundled with the app (the ones the delivery note
  // falls back to) when those can't be fetched, so a document is never left without its letterhead.
  const slug = name.toLowerCase().trim().split(/\s+/)[0]
  const candidates = [
    company?.letterhead_url, company?.logo_url,
    slug && `/company/${slug}-letterhead.jpg`, "/company/nescopharm-letterhead.jpg",
  ].filter((s, i, arr): s is string => !!s && arr.indexOf(s) === i)
  for (const url of candidates) {
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
  return data.headers.map((_, i) => !!data.moneyColumns?.includes(i) ||
    [...data.rows, ...(data.footer ?? [])].some((r) => typeof r[i] === "number" && !Number.isInteger(r[i] as number)))
}
const numericColumns = (data: TableExport) =>
  data.headers.map((_, i) => data.rows.some((r) => typeof r[i] === "number") &&
    data.rows.every((r) => r[i] == null || r[i] === "" || typeof r[i] === "number"))

// Heading, values and totals of a column line up: S/No and Item # centred, amounts and counts right, text left.
type Align = "left" | "center" | "right"
const SERIAL_HEADER = /^(s\/?\s?no\.?|#|no\.?|item\s?#|item no\.?)$/i
function columnAlignments(data: TableExport): Align[] {
  const numeric = numericColumns(data)
  return data.headers.map((h, i) =>
    SERIAL_HEADER.test(h.trim()) ? "center" : numeric[i] || data.rightColumns?.includes(i) ? "right" : "left")
}

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
    [brand.name], [data.title], ...(data.subtitle ? [[data.subtitle]] : []),
    ...(data.details ?? []), [],
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
  const aligns = columnAlignments(data)

  // Width of each column from its longest value.
  const widths = data.headers.map((h, i) =>
    Math.min(50, Math.max(h.length, ...[...data.rows, ...(data.footer ?? [])].map((r) =>
      r[i] == null ? 0 : (typeof r[i] === "number" && decimals[i] ? (r[i] as number).toFixed(2).length + 4 : String(r[i]).length)))) + 2)
  ws.columns = widths.map((width, i) => ({ width, hidden: !!data.hiddenColumns?.includes(i) }))

  let row = 1
  if (brand.image) {
    // Letterhead across the table, about 20px a row.
    const tableWidthPx = Math.min(900, widths.reduce((s, w, i) => s + (data.hiddenColumns?.includes(i) ? 0 : w * 7), 0))
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
  for (const [label, value] of data.details ?? []) {
    ws.getCell(row, 1).value = label
    ws.getCell(row, 1).font = { bold: true }
    ws.getCell(row, 2).value = value
    row += 1
  }
  row += 1

  const header = ws.getRow(row)
  data.headers.forEach((h, i) => {
    const c = header.getCell(i + 1)
    c.value = h
    c.font = { bold: true }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } }
    c.alignment = { horizontal: aligns[i] }
    c.border = { bottom: { style: "thin" } }
  })
  row += 1

  const put = (cells: ExportCell[], bold = false) => {
    const r = ws.getRow(row++)
    cells.forEach((v, i) => {
      const c = r.getCell(i + 1)
      c.value = v ?? null
      if (typeof v === "number") c.numFmt = decimals[i] ? "#,##0.00" : "#,##0"
      c.alignment = { horizontal: bold && aligns[i] === "left" && typeof v === "string" ? "right" : aligns[i] }
      if (bold) c.font = { bold: true }
    })
    if (bold) r.eachCell((c) => { c.border = { top: { style: "thin" } } })
  }
  data.rows.forEach((r) => put(r))
  ;(data.footer ?? []).forEach((r) => put(r, true))

  const buffer = await wb.xlsx.writeBuffer()
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${data.fileName}.xlsx`)
}

async function exportPdf(data: TableExport, brand: Brand) {
  if (data.hiddenColumns?.length) {
    const keep = (_: unknown, i: number) => !data.hiddenColumns!.includes(i)
    const drop = (r: ExportCell[]) => r.filter(keep)
    const kept = data.headers.map((_, i) => i).filter((i) => !data.hiddenColumns!.includes(i))
    const remap = (cols?: number[]) => cols?.filter((c) => kept.includes(c)).map((c) => kept.indexOf(c))
    data = {
      ...data, headers: data.headers.filter(keep), rows: data.rows.map(drop), footer: data.footer?.map(drop),
      moneyColumns: remap(data.moneyColumns), rightColumns: remap(data.rightColumns), hiddenColumns: undefined,
    }
  }
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default
  const pdf = new jsPDF({ orientation: data.headers.length > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 12
  const decimals = decimalColumns(data)
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
  if (data.details?.length) {
    // Two columns of label: value pairs.
    const colWidth = (pageWidth - margin * 2) / 2
    // Values start just past the longest label on their side, so a long label never touches its value.
    pdf.setFont("helvetica", "bold").setFontSize(9)
    const labelWidth = [0, 1].map((side) => Math.max(24, ...data.details!
      .filter((_, i) => i % 2 === side).map(([label]) => pdf.getTextWidth(`${label}:`))) + 4)
    // Each row is as tall as its longest value, so a long note wraps instead of running under the table.
    let rowY = y + 4
    for (let i = 0; i < data.details.length; i += 2) {
      let rowLines = 1
      data.details.slice(i, i + 2).forEach(([label, value], side) => {
        const x = margin + side * colWidth
        pdf.setFont("helvetica", "bold").setFontSize(9).text(`${label}:`, x, rowY)
        const lines: string[] = pdf.setFont("helvetica", "normal").splitTextToSize(String(value ?? ""), colWidth - labelWidth[side] - 4)
        pdf.text(lines, x + labelWidth[side], rowY)
        rowLines = Math.max(rowLines, lines.length)
      })
      rowY += rowLines === 1 ? 5 : rowLines * 4 + 1
    }
    y = rowY - 4 + 2
  }

  const aligns = columnAlignments(data)
  autoTable(pdf, {
    startY: y + 3,
    // The bottom leaves room for the Scan me QR in the corner.
    margin: { left: margin, right: margin, bottom: SCAN_ME_SIZE + 8 },
    head: [data.headers],
    body: data.rows.map((r) => r.map(fmt)),
    foot: data.footer?.map((r) => r.map(fmt)),
    showFoot: "lastPage",
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [31, 41, 55], textColor: 255 },
    footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: "bold" },
    // Headings and totals take their column's alignment (autoTable's columnStyles reach the body only);
    // a totals label in a text column sits right, against the figures.
    didParseCell: ({ cell, column, section }) => {
      const align = aligns[column.index]
      cell.styles.halign = section === "foot" && align === "left" && cell.raw !== "" ? "right" : align
    },
    didDrawPage: () => {
      const pageHeight = pdf.internal.pageSize.getHeight()
      pdf.setFont("helvetica", "normal").setFontSize(8)
      pdf.text(`Printed ${displayDateTime(new Date())}`, margin, pageHeight - 6)
      pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin - SCAN_ME_SIZE, pageHeight - 6, { align: "right" })
    },
  })
  await addScanMe(pdf)
  pdf.save(`${data.fileName}.pdf`)
}

/** Rows of a CSV file (quoted fields, "" escapes), for re-exporting a server-made CSV in any format. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++
      row.push(field); rows.push(row); row = []; field = ""
    } else field += c
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((v) => v.trim() !== ""))
}

/** A CSV cell as a number when it is one ("12,500.00" -> 12500), else the text. Codes with leading zeros stay text. */
export function csvCell(v: string): ExportCell {
  const s = v.trim()
  return /^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s) && !/^0\d/.test(s) ? Number(s.replace(/,/g, "")) : s
}

// The logged-in user's company as kept in the session, for exports made outside a component.
function storedCompany(): { id?: string; name?: string } | null {
  if (typeof window === "undefined") return null
  try {
    for (const key of ["company", "user"]) {
      const parsed = JSON.parse(localStorage.getItem(key) || "null")
      const c = key === "company" ? parsed : parsed?.company
      if (c?.id) return { id: c.id, name: c.name }
    }
  } catch { /* storage unavailable */ }
  return null
}

/** Rows kept as {heading: value} records (as written for Excel), exported in any format. */
export function exportRecords(format: ExportFormat, records: Record<string, ExportCell>[], meta: Omit<TableExport, "headers" | "rows">) {
  const headers = Object.keys(records[0] ?? {})
  return exportTable(format, { ...meta, headers, rows: records.map((r) => headers.map((h) => r[h])) })
}

export async function exportTable(format: ExportFormat, data: TableExport, company?: { id?: string; name?: string } | null) {
  company = company?.id ? company : storedCompany() ?? company
  const brand = await getBrand(company?.id, company?.name)
  if (format === "csv") return exportCsv(data, brand)
  if (format === "xlsx") return exportXlsx(data, brand)
  return exportPdf(data, brand)
}
