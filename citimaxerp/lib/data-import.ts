import * as XLSX from "xlsx"
import apiCall from "@/lib/api"

export interface ImportColumn {
  key: string
  label: string
  type: "text" | "number" | "date" | "yesno" | "choice"
  required?: boolean
  choices?: string[]
  example?: string
  help?: string
}

export interface ImportSchema {
  key: string
  label: string
  order: number
  /** "hub" sheets are migration steps on the Data Import page; others belong to a specific form. */
  context?: "hub" | "purchase_order_form"
  description: string
  matching: string
  permission: string
  columns: ImportColumn[]
  /** First template row, taken from the company's own records (keyed by column key); null when there are none. */
  sample?: Record<string, string | number | null> | null
}

export interface ParsedPurchaseOrderLine {
  product_id: string
  variant_id: string | null
  item_name: string
  item_number: number | null
  quantity: number
  unit_price: number
  row: number
}

export interface ParsedPurchaseOrder {
  header: {
    supplier_id: string | null
    supplier_name: string | null
    order_date: string | null
    delivery_date: string | null
    comments: string | null
  }
  lines: ParsedPurchaseOrderLine[]
  problems: { row: number; message: string }[]
}

export interface ParsedReceiptLine {
  purchase_order_item_id: string
  product_id: string
  variant_id: string | null
  item_name: string
  quantity: number
  unit_price: number
  batch_number: string | null
  lot_number: string | null
  manufacture_date: string | null
  expiry_date: string | null
  notes: string | null
  row: number
}

export interface ParsedProductReceipt {
  header: { reference_number: string | null; shipping_cost: number | null; logistics_cost: number | null }
  lines: ParsedReceiptLine[]
  problems: { row: number; message: string }[]
}

export const PURCHASE_ORDER_SCHEMA_KEY = "purchase_order_items"
export const PRODUCT_RECEIPT_SCHEMA_KEY = "product_receipt_items"

export interface ImportRow {
  row: number
  key: string
  name: string
  status: "created" | "updated" | "unchanged" | "error"
  message?: string | null
  before?: number | null
  after?: number | null
  lines?: number
}

export interface ImportResult {
  status: string
  message: string
  dry_run: boolean
  entity: string
  summary: { rows: number; created: number; updated: number; unchanged: number; errors: number; items?: number }
  rows: ImportRow[]
}

export async function fetchImportSchemas(): Promise<ImportSchema[]> {
  const response = await apiCall<{ schemas: ImportSchema[] }>("/data-import/schemas", "GET")
  return [...response.schemas].sort((a, b) => a.order - b.order)
}

export async function fetchImportSchema(key: string): Promise<ImportSchema> {
  const schema = (await fetchImportSchemas()).find((s) => s.key === key)
  if (!schema) throw new Error(`No import format called "${key}".`)
  return schema
}

/** Reads a purchase order sheet into the New Purchase Order form. Saves nothing. */
export async function parsePurchaseOrderSheet(file: File): Promise<ParsedPurchaseOrder> {
  const form = new FormData()
  form.append("file", file)
  return apiCall<ParsedPurchaseOrder>("/purchase-orders/parse-sheet", "POST", form)
}

/** Reads a delivery sheet against one purchase order into the Create Product Receipt form. */
export async function parseProductReceiptSheet(file: File, purchaseOrderId: string): Promise<ParsedProductReceipt> {
  const form = new FormData()
  form.append("file", file)
  form.append("purchase_order_id", purchaseOrderId)
  return apiCall<ParsedProductReceipt>("/product-receipts/parse-sheet", "POST", form)
}

export async function runImport(entity: string, file: File, dryRun: boolean): Promise<ImportResult> {
  const form = new FormData()
  form.append("file", file)
  form.append("dry_run", dryRun ? "1" : "0")
  return apiCall<ImportResult>(`/data-import/${entity}`, "POST", form)
}

export function describeType(column: ImportColumn): string {
  switch (column.type) {
    case "number":
      return "Number"
    case "date":
      return "Date (YYYY-MM-DD)"
    case "yesno":
      return "Yes or No"
    case "choice":
      return (column.choices ?? []).join(" / ")
    default:
      return "Text"
  }
}

/**
 * Build the workbook for one import. The first sheet is the one the importer reads back; its first
 * row is filled from the system (`schema.sample`). That row is either a copy of a real record, which
 * imports as unchanged, or an example built from real names and marked "EXAMPLE ROW" in its notes,
 * which the importer skips - so leaving it in does no harm. The per-column rules live on a second sheet.
 *
 * `rows` pre-fills the sheet instead, from records the system already holds, keyed by column key, so a
 * delivery against a purchase order can be edited rather than typed out from nothing.
 */
export function downloadTemplate(
  schema: ImportSchema,
  options?: { rows?: Record<string, string | number | null | undefined>[]; fileName?: string }
) {
  const book = XLSX.utils.book_new()

  const headings = schema.columns.map((c) => (c.required ? `${c.label} *` : c.label))
  const sampleRows = options?.rows?.length ? options.rows : schema.sample ? [schema.sample] : []
  const body = sampleRows.map((row) => schema.columns.map((c) => row[c.key] ?? ""))
  const data = XLSX.utils.aoa_to_sheet([headings, ...body])
  data["!cols"] = schema.columns.map((c) => ({ wch: Math.max(16, c.label.length + 4) }))
  XLSX.utils.book_append_sheet(book, data, "Data")

  const guide = XLSX.utils.aoa_to_sheet([
    [`${schema.label} import template`],
    [schema.description],
    [schema.matching],
    [],
    options?.rows?.length
      ? ["The 'Data' sheet is already filled in for you. Edit the figures to match what arrived, and delete any row that didn't."]
      : body.length
        ? ["Row 2 of the 'Data' sheet is a sample taken from your system, to show the format. Overwrite it or add your rows under it; left as it is, it changes nothing."]
        : ["Enter your data on the 'Data' sheet, under the headings already there."],
    ["Columns marked * are required. Leave anything you don't have blank."],
    ["Don't rename, reorder or delete the heading row."],
    [],
    ["Column", "Required", "Accepted values", "Example", "Notes"],
    ...schema.columns.map((c) => [c.label, c.required ? "Yes" : "No", describeType(c), c.example ?? "", c.help ?? ""]),
  ])
  guide["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 28 }, { wch: 24 }, { wch: 62 }]
  XLSX.utils.book_append_sheet(book, guide, "Instructions")

  XLSX.writeFile(book, options?.fileName ?? `${schema.key}_import_template.xlsx`)
}
