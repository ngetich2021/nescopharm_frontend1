import apiCall from "./api"
import * as XLSX from "xlsx"
import { documentFileName, todayFileDate, sessionCompanyName } from "@/lib/document-names"
import { exportRecords, type ExportFormat } from "@/lib/table-export"

export interface Asset {
  id: string
  company_id: string
  name: string
  category: string | null // Asset Class
  serial_number: string | null
  location: string | null
  quantity: number
  purchase_cost: number | string // per piece
  notes?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Fixed Asset Register fields
  asset_code?: string | null // CMP-001
  tag_number?: string | null // TAG-001
  assigned_to?: string | null
  supplier?: string | null
  invoice_number?: string | null
  purchase_date?: string | null
  date_basis?: string | null
  depreciation_method?: string | null
  depreciation_rate?: number | string | null // % a year
  useful_life_years?: number | string | null
  residual_percent?: number | string | null
  depreciation_start_date?: string | null
  status?: string | null
  original_category?: string | null
  // Worked out by the server as at a date (today by default)
  total_cost?: number | string | null
  depreciable_amount?: number
  annual_depreciation?: number
  monthly_depreciation?: number
  months_depreciated?: number
  accumulated_depreciation?: number
  net_book_value?: number
  fully_depreciated?: boolean
  as_at?: string
}

export interface CreateAssetPayload {
  name: string
  category?: string
  serial_number?: string
  location?: string
  quantity?: number
  purchase_cost?: number
  total_cost?: number
  notes?: string
  is_active?: boolean
  asset_code?: string
  tag_number?: string
  assigned_to?: string
  supplier?: string
  invoice_number?: string
  purchase_date?: string
  date_basis?: string
  depreciation_method?: string
  depreciation_rate?: number
  useful_life_years?: number
  residual_percent?: number
  depreciation_start_date?: string
  status?: string
  original_category?: string
}

export type UpdateAssetPayload = Partial<CreateAssetPayload>

export interface AssetClassSummary {
  class: string
  lines: number
  quantity: number
  total_cost: number
  rate: number | null
  useful_life_years: number | null
  annual_depreciation: number
  accumulated_depreciation: number
  net_book_value: number
}

export interface AssetSummary {
  totalAssets: number
  totalQuantity: number
  totalValue: number
  totalCategories: number
  accumulatedDepreciation?: number
  netBookValue?: number
  annualDepreciation?: number
  unassigned?: number
  byClass?: AssetClassSummary[]
  asAt?: string
}

/** Straight-line rates by class (the register's Rates sheet); the server holds the same table. */
export const ASSET_CLASSES: Record<string, { rate: number; life: number }> = {
  "Computers & Laptops": { rate: 33.3333, life: 3 },
  "Printers": { rate: 25, life: 4 },
  "Furniture & Fittings": { rate: 12.5, life: 8 },
  "Office Equipment": { rate: 12.5, life: 8 },
  "Machinery & Equipment": { rate: 12.5, life: 8 },
  "Material Handling Equipment": { rate: 20, life: 5 },
  "Security Equipment": { rate: 20, life: 5 },
  "Leasehold Improvements": { rate: 10, life: 10 },
}
export const ASSET_STATUSES = ["In Use", "In Store", "Under Repair", "Missing", "Disposed", "Written Off"]
/** Trading began 01/10/2025: an asset bought earlier depreciates from then. */
export const DEPRECIATION_COMMENCEMENT = "2025-10-01"

export const isAssigned = (who?: string | null) => {
  const w = (who || "").trim().toLowerCase()
  return w !== "" && !["n/a", "na", "not assigned", "unassigned", "-"].includes(w)
}

export interface GetAssetsParams {
  is_active?: boolean
  category?: string
  search?: string
  as_at?: string
}

function toQuery(params?: Record<string, any>): string {
  if (!params) return ""
  const q = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&")
  return q ? `?${q}` : ""
}

export async function getAssets(params?: GetAssetsParams): Promise<Asset[]> {
  const response = await apiCall<{ status: string; data: Asset[]; message?: string }>(
    `/assets${toQuery(params)}`,
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  }
  throw new Error((response.message as string) || "Failed to fetch assets")
}

export async function createAsset(payload: CreateAssetPayload): Promise<Asset> {
  const response = await apiCall<{ status: string; data: Asset; message?: string }>(
    "/assets",
    "POST",
    payload,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  }
  throw new Error((response.message as string) || "Failed to create asset")
}

export async function updateAsset(id: string, payload: UpdateAssetPayload): Promise<Asset> {
  const response = await apiCall<{ status: string; data: Asset; message?: string }>(
    `/assets/${id}`,
    "PUT",
    payload,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  }
  throw new Error((response.message as string) || "Failed to update asset")
}

export async function deleteAsset(id: string): Promise<void> {
  const response = await apiCall<{ status: string; message?: string }>(
    `/assets/${id}`,
    "DELETE",
    undefined,
    true
  )
  if (response.status !== "success") {
    throw new Error((response.message as string) || "Failed to delete asset")
  }
}

export async function getAssetSummary(asAt?: string): Promise<AssetSummary> {
  try {
    const response = await apiCall<{ status: string; data: AssetSummary; message?: string }>(
      `/assets/summary${toQuery({ as_at: asAt })}`,
      "GET",
      undefined,
      true
    )
    if (response.status === "success" && response.data) {
      return response.data
    }
  } catch (e) {
    // fall through to default
  }
  return { totalAssets: 0, totalQuantity: 0, totalValue: 0, totalCategories: 0 }
}

// The register's columns, in its order. Excel export uses these headings so the sheet imports back
// (a row with an Asset ID already in the system updates that asset).
const REGISTER_COLUMNS: { header: string; field: keyof Asset | "sno"; aliases?: string[] }[] = [
  { header: "S/No", field: "sno" },
  { header: "Asset ID", field: "asset_code", aliases: ["assetid", "assetcode", "assetno"] },
  { header: "Asset Tag No.", field: "tag_number", aliases: ["assettagno", "tagno", "tagnumber", "tag"] },
  { header: "Asset Description", field: "name", aliases: ["assetdescription", "assetnamedescription", "description", "assetname", "name"] },
  { header: "Asset Class", field: "category", aliases: ["assetclass", "class", "category"] },
  { header: "Serial / Model No.", field: "serial_number", aliases: ["serialmodelno", "serialmodelnumber", "serialno", "serialnumber", "serial", "modelno"] },
  { header: "Location / Department", field: "location", aliases: ["locationdepartment", "location", "department"] },
  { header: "Assigned To / User", field: "assigned_to", aliases: ["assignedtouser", "assignedto", "user", "custodian"] },
  { header: "Supplier / Vendor", field: "supplier", aliases: ["suppliervendor", "supplier", "vendor"] },
  { header: "Invoice No.", field: "invoice_number", aliases: ["invoiceno", "invoicenumber", "invoice"] },
  { header: "Qty", field: "quantity", aliases: ["qty", "qtypcs", "quantity"] },
  { header: "Purchase Date", field: "purchase_date", aliases: ["purchasedate", "dateofpurchase"] },
  { header: "Date Basis", field: "date_basis", aliases: ["datebasis"] },
  { header: "Total Cost (Ksh)", field: "total_cost", aliases: ["totalcostksh", "totalcost", "cost"] },
  { header: "Unit Cost (Ksh)", field: "purchase_cost", aliases: ["unitcostksh", "unitcost", "purchasecostksh", "purchasecost"] },
  { header: "Depreciation Method", field: "depreciation_method", aliases: ["depreciationmethod", "method"] },
  { header: "Rate % p.a.", field: "depreciation_rate", aliases: ["ratepa", "rate", "depreciationrate"] },
  { header: "Useful Life (Yrs)", field: "useful_life_years", aliases: ["usefullifeyrs", "usefullife", "life"] },
  { header: "Residual Value %", field: "residual_percent", aliases: ["residualvalue", "residual"] },
  { header: "Depreciation Start Date", field: "depreciation_start_date", aliases: ["depreciationstartdate", "depstartdate"] },
  { header: "Annual Depreciation", field: "annual_depreciation" },
  { header: "Monthly Depreciation", field: "monthly_depreciation" },
  { header: "Months Depreciated", field: "months_depreciated" },
  { header: "Accumulated Depreciation", field: "accumulated_depreciation" },
  { header: "Net Book Value", field: "net_book_value" },
  { header: "Status", field: "status", aliases: ["status"] },
  { header: "Original Category", field: "original_category", aliases: ["originalcategory"] },
]
// Worked out by the system, never read back from a sheet.
const COMPUTED: (keyof Asset)[] = ["annual_depreciation", "monthly_depreciation", "months_depreciated", "accumulated_depreciation", "net_book_value"]
const MONEY_FIELDS: (keyof Asset)[] = ["total_cost", "purchase_cost", "annual_depreciation", "monthly_depreciation", "accumulated_depreciation", "net_book_value"]
const DATE_FIELDS: (keyof Asset)[] = ["purchase_date", "depreciation_start_date"]

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "")
const ddmmyyyy = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "")

function registerRow(a: Asset, idx: number): Record<string, string | number> {
  const row: Record<string, string | number> = {}
  for (const c of REGISTER_COLUMNS) {
    if (c.field === "sno") row[c.header] = idx + 1
    else if (c.field === "depreciation_method") row[c.header] = a.depreciation_method === "straight_line" ? "Straight Line" : a.depreciation_method || ""
    else if (DATE_FIELDS.includes(c.field)) row[c.header] = ddmmyyyy(a[c.field] as string)
    else if (MONEY_FIELDS.includes(c.field)) row[c.header] = Math.round((Number(a[c.field]) || 0) * 100) / 100
    else if (["depreciation_rate", "useful_life_years", "residual_percent", "quantity", "months_depreciated"].includes(c.field)) row[c.header] = Number(a[c.field]) || 0
    else row[c.header] = (a[c.field] as string) ?? ""
  }
  return row
}

export async function exportAssets(format: ExportFormat = "xlsx", rowsToExport?: Asset[], asAt?: string): Promise<void> {
  const assets = rowsToExport ?? (await getAssets({ as_at: asAt }))
  const rows = assets.map(registerRow)
  const title = `Fixed Asset Register${asAt ? ` as at ${ddmmyyyy(asAt)}` : ""}`
  const fileName = documentFileName([sessionCompanyName(), "Fixed Asset Register", asAt ? ddmmyyyy(asAt).replace(/\//g, "-") : todayFileDate()])
  if (format !== "xlsx") {
    // PDF keeps to what fits a page: who has what, where, and what it is worth now.
    const PDF_HEADERS = ["S/No", "Asset ID", "Asset Tag No.", "Asset Description", "Asset Class", "Location / Department", "Assigned To / User", "Qty", "Purchase Date", "Total Cost (Ksh)", "Accumulated Depreciation", "Net Book Value", "Status"]
    const keep = format === "pdf" ? PDF_HEADERS : REGISTER_COLUMNS.map((c) => c.header)
    const records = rows.map((r) => Object.fromEntries(keep.map((h) => [h, r[h]])))
    const moneyHeaders = REGISTER_COLUMNS.filter((c) => MONEY_FIELDS.includes(c.field as keyof Asset)).map((c) => c.header)
    const moneyColumns = keep.map((h, i) => (moneyHeaders.includes(h) ? i : -1)).filter((i) => i >= 0)
    return exportRecords(format, records, { fileName, title, moneyColumns })
  }
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(REGISTER_COLUMNS.map((c) => [c.header, ""]))])
  sheet["!cols"] = REGISTER_COLUMNS.map((c) => ({ wch: Math.max(c.header.length + 2, 14) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Register")
  XLSX.writeFile(book, documentFileName([sessionCompanyName(), "Fixed Asset Register", todayFileDate()], "xlsx"))
}

// The register's columns with one real asset as the example (importing it again leaves it as it is).
export async function downloadAssetTemplate(): Promise<void> {
  const sample = (await getAssets().catch(() => [] as Asset[]))[0]
  const headers = REGISTER_COLUMNS.filter((c) => c.field !== "sno" && !COMPUTED.includes(c.field as keyof Asset))
  const example = sample
    ? Object.fromEntries(Object.entries(registerRow(sample, 0)).filter(([h]) => headers.some((c) => c.header === h)))
    : Object.fromEntries(headers.map((c) => [c.header, ""]))
  const sheet = XLSX.utils.json_to_sheet([example], { header: headers.map((c) => c.header) })
  sheet["!cols"] = headers.map((c) => ({ wch: Math.max(c.header.length + 2, 14) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Register")
  XLSX.writeFile(book, "fixed_asset_register_template.xlsx")
}

const fieldFor = (header: string) => {
  const h = norm(header)
  return REGISTER_COLUMNS.find((c) => c.field !== "sno" && (norm(c.header) === h || c.aliases?.includes(h)))?.field ?? null
}

// Reads the Fixed Asset Register workbook (its "Register" sheet, headings on any of the first rows)
// or the older plain template.
export async function parseAssetFile(file: File): Promise<CreateAssetPayload[]> {
  const buffer = await file.arrayBuffer()
  const book = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheetName = book.SheetNames.find((n) => n.trim().toLowerCase() === "register") ?? book.SheetNames[0]
  const grid: any[][] = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: "", raw: true })
  const headerIdx = grid.findIndex((r) => r.filter((c) => fieldFor(String(c)) !== null).length >= 2 && r.some((c) => fieldFor(String(c)) === "name"))
  if (headerIdx < 0) return []
  const fields = grid[headerIdx].map((c) => fieldFor(String(c)))

  const out: CreateAssetPayload[] = []
  for (const r of grid.slice(headerIdx + 1)) {
    const asset: Record<string, any> = {}
    fields.forEach((f, i) => {
      if (!f || f === "sno" || COMPUTED.includes(f as keyof Asset)) return
      const v = r[i]
      if (v === "" || v === null || v === undefined) return
      if (DATE_FIELDS.includes(f as keyof Asset)) {
        if (v instanceof Date) asset[f] = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
        else {
          const m = String(v).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/) // dd/mm/yyyy
          asset[f] = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : String(v).trim()
        }
      } else if (f === "quantity") {
        const n = parseInt(String(v).replace(/[^0-9.-]/g, ""), 10)
        asset.quantity = Number.isFinite(n) && n > 0 ? n : 1
      } else if (["total_cost", "purchase_cost", "depreciation_rate", "useful_life_years", "residual_percent"].includes(f)) {
        const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""))
        if (Number.isFinite(n)) asset[f] = n
      } else {
        asset[f] = String(v).trim()
      }
    })
    const name = String(asset.name ?? "").trim()
    // Stop at the register's TOTAL line; skip blank rows.
    if (!name && !asset.asset_code) continue
    if (/^total/i.test(String(asset.asset_code ?? name))) break
    out.push(asset as CreateAssetPayload)
  }
  return out
}

export type AssetOptionType = "category" | "department" | "assignee"

export async function getAssetOptions(type: AssetOptionType): Promise<string[]> {
  const response = await apiCall<{ status: string; data: string[]; message?: string }>(
    `/asset-options?type=${encodeURIComponent(type)}`,
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && Array.isArray(response.data)) {
    return response.data
  }
  return []
}

export async function createAssetOption(type: AssetOptionType, name: string): Promise<void> {
  const response = await apiCall<{ status: string; message?: string }>(
    "/asset-options",
    "POST",
    { type, name },
    true
  )
  if (response.status !== "success") {
    throw new Error((response.message as string) || "Failed to add option")
  }
}

export async function importAssets(rows: CreateAssetPayload[], dryRun: boolean = true): Promise<any> {
  const response = await apiCall<any>(
    "/assets/import",
    "POST",
    { rows, dry_run: dryRun ? 1 : 0 },
    true
  )
  if (response.status === "success") {
    return response
  }
  throw new Error((response.message as string) || "Failed to import assets")
}
