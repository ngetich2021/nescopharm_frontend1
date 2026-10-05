import * as XLSX from "xlsx"
import { Supplier, CreateSupplierPayload, createSupplier, updateSupplier } from "@/lib/suppliers"

type SupplierField = keyof CreateSupplierPayload

interface SupplierColumn {
  field: SupplierField
  label: string
  /** Other headings people commonly use for the same column. */
  aliases?: string[]
}

// The export and the import share these headings, so an exported file can be edited and imported back.
const COLUMNS: SupplierColumn[] = [
  { field: "name", label: "Name", aliases: ["supplier", "supplier name", "company", "company name"] },
  { field: "contact_person", label: "Contact Person", aliases: ["contact", "contact name"] },
  { field: "email", label: "Email", aliases: ["email address", "e-mail"] },
  { field: "phone", label: "Phone", aliases: ["phone number", "telephone", "mobile", "tel"] },
  { field: "address", label: "Address", aliases: ["location", "physical address"] },
  { field: "payment_terms_type", label: "Payment Terms Type", aliases: ["payment terms"] },
  { field: "payment_terms_days", label: "Payment Terms Days", aliases: ["payment days", "credit days", "terms days"] },
  { field: "payment_terms_description", label: "Payment Terms Description" },
  { field: "bank_name", label: "Bank Name", aliases: ["bank"] },
  { field: "bank_account_number", label: "Bank Account Number", aliases: ["account number", "account no", "bank account"] },
  { field: "bank_branch", label: "Bank Branch", aliases: ["branch"] },
  { field: "bank_swift_code", label: "SWIFT Code", aliases: ["swift", "bank swift code", "swift code"] },
  { field: "tax_information", label: "Tax Information", aliases: ["kra pin", "pin", "tax pin", "vat number", "tax"] },
  { field: "notes", label: "Notes", aliases: ["comments", "remarks"] },
  { field: "is_active", label: "Status", aliases: ["active", "is active"] },
]

const normalise = (heading: unknown) =>
  String(heading ?? "")
    .replace(/\*/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ")

function columnForHeading(heading: unknown): SupplierColumn | undefined {
  const h = normalise(heading)
  if (!h) return undefined
  return COLUMNS.find((c) => normalise(c.label) === h || normalise(c.field) === h || c.aliases?.includes(h))
}

function supplierToRow(s: Supplier): (string | number)[] {
  return COLUMNS.map((c) => {
    if (c.field === "is_active") return s.is_active ? "Active" : "Inactive"
    const value = s[c.field as keyof Supplier]
    return value === null || value === undefined ? "" : (value as string | number)
  })
}

export function exportSuppliersToExcel(suppliers: Supplier[]) {
  const sheet = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => c.label), ...suppliers.map(supplierToRow)])
  sheet["!cols"] = COLUMNS.map((c) => ({ wch: Math.max(16, c.label.length + 4) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Suppliers")
  XLSX.writeFile(book, `suppliers_export_${new Date().toISOString().split("T")[0]}.xlsx`)
}

export function downloadSupplierTemplate() {
  const data = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => (c.field === "name" ? `${c.label} *` : c.label))])
  data["!cols"] = COLUMNS.map((c) => ({ wch: Math.max(16, c.label.length + 4) }))
  const guide = XLSX.utils.aoa_to_sheet([
    ["Supplier import template"],
    ["Enter suppliers on the 'Suppliers' sheet, one per row, under the headings already there."],
    ["Only Name is required. A row whose Name matches an existing supplier updates that supplier; any other row creates a new one."],
    ["Blank cells are left unchanged when updating an existing supplier."],
    ["Status accepts Active / Inactive (or Yes / No). Payment Terms Type is Net, Due or Immediate. Payment Terms Days must be a whole number."],
    [],
    ["Example row"],
    COLUMNS.map((c) => c.label),
    [
      "Acme Medical Supplies Ltd",
      "Jane Wanjiku",
      "orders@acme.co.ke",
      "0712345678",
      "Industrial Area, Nairobi",
      "Net",
      30,
      "Net 30 days from invoice",
      "KCB",
      "1234567890",
      "Moi Avenue",
      "KCBLKENX",
      "P051234567X",
      "",
      "Active",
    ],
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, data, "Suppliers")
  XLSX.utils.book_append_sheet(book, guide, "Instructions")
  XLSX.writeFile(book, "supplier_import_template.xlsx")
}

export interface SupplierImportResult {
  created: number
  updated: number
  skipped: number
  errors: { row: number; name: string; message: string }[]
}

function parseActive(value: unknown): boolean | undefined {
  const v = normalise(value)
  if (!v) return undefined
  if (["active", "yes", "y", "true", "1"].includes(v)) return true
  if (["inactive", "no", "n", "false", "0"].includes(v)) return false
  return undefined
}

function rowToPayload(row: unknown[], columns: (SupplierColumn | undefined)[]): { payload: CreateSupplierPayload; problem?: string } {
  const payload: Partial<Record<SupplierField, unknown>> = {}
  columns.forEach((column, i) => {
    if (!column) return
    const raw = row[i]
    if (raw === null || raw === undefined || String(raw).trim() === "") return

    if (column.field === "is_active") {
      const active = parseActive(raw)
      if (active !== undefined) payload.is_active = active
    } else if (column.field === "payment_terms_days") {
      const days = Number(String(raw).replace(/[^\d.-]/g, ""))
      if (Number.isFinite(days) && days >= 0) payload.payment_terms_days = Math.round(days)
    } else {
      // Phone and account numbers often come through as numbers; keep them as text.
      payload[column.field] = String(raw).trim()
    }
  })
  if (!payload.name) return { payload: payload as CreateSupplierPayload, problem: "Name is required." }
  return { payload: payload as CreateSupplierPayload }
}

/**
 * Reads the first sheet of an .xlsx/.xls/.csv file and creates or updates suppliers. Rows are
 * matched to `existing` by name (case-insensitive); unmatched rows become new suppliers.
 */
export async function importSuppliersFromFile(
  file: File,
  existing: Supplier[],
  onProgress?: (done: number, total: number) => void
): Promise<SupplierImportResult> {
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" })
  const sheet = book.Sheets[book.SheetNames[0]]
  if (!sheet) throw new Error("The file has no sheets.")

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" })
  // Find the heading row: the first row that has a Name column.
  const headerIndex = rows.findIndex((r) => r.some((cell) => columnForHeading(cell)?.field === "name"))
  if (headerIndex === -1) {
    throw new Error("Couldn't find a 'Name' column. Use the supplier template or an exported supplier file.")
  }
  const columns = rows[headerIndex].map(columnForHeading)
  const dataRows = rows
    .slice(headerIndex + 1)
    .map((cells, i) => ({ cells, rowNumber: headerIndex + i + 2 }))
    .filter(({ cells }) => cells.some((cell) => String(cell ?? "").trim() !== ""))

  if (dataRows.length === 0) throw new Error("The file has no supplier rows under the headings.")

  const byName = new Map(existing.map((s) => [s.name.trim().toLowerCase(), s]))
  const result: SupplierImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  for (let i = 0; i < dataRows.length; i++) {
    const { cells, rowNumber } = dataRows[i]
    const { payload, problem } = rowToPayload(cells, columns)
    const name = payload.name ?? ""
    if (problem) {
      result.errors.push({ row: rowNumber, name, message: problem })
      result.skipped++
    } else {
      try {
        const match = byName.get(name.toLowerCase())
        if (match) {
          // Keep the stored name; the file may only differ in case or spacing.
          const { name: _name, ...changes } = payload
          await updateSupplier(match.id, changes)
          result.updated++
        } else {
          const created = await createSupplier(payload)
          // A name repeated further down the file updates this one rather than duplicating it.
          byName.set(name.toLowerCase(), created)
          result.created++
        }
      } catch (err) {
        result.errors.push({ row: rowNumber, name, message: err instanceof Error ? err.message : String(err) })
        result.skipped++
      }
    }
    onProgress?.(i + 1, dataRows.length)
  }

  return result
}
