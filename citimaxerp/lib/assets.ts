import apiCall from "./api"
import * as XLSX from "xlsx"

export interface Asset {
  id: string
  company_id: string
  name: string
  category: string | null
  serial_number: string | null
  location: string | null
  quantity: number
  purchase_cost: number | string
  notes?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateAssetPayload {
  name: string
  category?: string
  serial_number?: string
  location?: string
  quantity?: number
  purchase_cost?: number
  notes?: string
  is_active?: boolean
}

export type UpdateAssetPayload = Partial<CreateAssetPayload>

export interface AssetSummary {
  totalAssets: number
  totalQuantity: number
  totalValue: number
  totalCategories: number
}

export interface GetAssetsParams {
  is_active?: boolean
  category?: string
  search?: string
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

export async function getAssetSummary(): Promise<AssetSummary> {
  try {
    const response = await apiCall<{ status: string; data: AssetSummary; message?: string }>(
      "/assets/summary",
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

const EXPORT_HEADERS = {
  "S/No": "sno",
  "Asset Name/Description": "name",
  "Category": "category",
  "Serial/Model Number": "serial_number",
  "Location/Department": "location",
  "Qty (Pcs)": "quantity",
  "Purchase Cost (Ksh)": "purchase_cost",
} as const

// Map a spreadsheet header (any of several spellings) to an asset field.
function headerToField(header: string): keyof CreateAssetPayload | "sno" | null {
  const h = header.toLowerCase().trim()
  if (h.includes("name") || h.includes("description")) return "name"
  if (h.includes("category")) return "category"
  if (h.includes("serial") || h.includes("model")) return "serial_number"
  if (h.includes("location") || h.includes("department")) return "location"
  if (h.includes("qty") || h.includes("quantity")) return "quantity"
  if (h.includes("cost") || h.includes("value") || h.includes("price")) return "purchase_cost"
  if (h === "s/no" || h === "sno" || h === "sno." || h.includes("s/no")) return "sno"
  return null
}

export async function exportAssets(): Promise<void> {
  const assets = await getAssets()
  const rows = assets.map((a, idx) => ({
    "S/No": idx + 1,
    "Asset Name/Description": a.name,
    "Category": a.category || "",
    "Serial/Model Number": a.serial_number || "",
    "Location/Department": a.location || "",
    "Qty (Pcs)": a.quantity,
    "Purchase Cost (Ksh)": Number(a.purchase_cost) || 0,
  }))

  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(Object.keys(EXPORT_HEADERS).map((k) => [k, ""]))])
  sheet["!cols"] = Object.keys(EXPORT_HEADERS).map((k) => ({ wch: Math.max(k.length + 2, 18) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Assets")
  XLSX.writeFile(book, `assets_register_${new Date().toISOString().split("T")[0]}.xlsx`)
}

export function downloadAssetTemplate(): void {
  const headers = Object.keys(EXPORT_HEADERS).filter((h) => h !== "S/No")
  const example = {
    "Asset Name/Description": "HP Pro 290 Desktop",
    "Category": "Computers",
    "Serial/Model Number": "4CE502BSF3",
    "Location/Department": "Accounts",
    "Qty (Pcs)": 1,
    "Purchase Cost (Ksh)": 125000,
  }
  const sheet = XLSX.utils.json_to_sheet([example])
  sheet["!cols"] = headers.map((k) => ({ wch: Math.max(k.length + 2, 18) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Assets")
  XLSX.writeFile(book, "assets_import_template.xlsx")
}

// Parse an uploaded spreadsheet into asset rows on the client.
export async function parseAssetFile(file: File): Promise<CreateAssetPayload[]> {
  const buffer = await file.arrayBuffer()
  const book = XLSX.read(buffer, { type: "array" })
  const sheet = book.Sheets[book.SheetNames[0]]
  const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" })

  return raw.map((r) => {
    const asset: CreateAssetPayload = { name: "" }
    for (const [header, value] of Object.entries(r)) {
      const field = headerToField(header)
      if (!field || field === "sno") continue
      if (field === "quantity") {
        const n = parseInt(String(value).replace(/[^0-9.-]/g, ""), 10)
        asset.quantity = Number.isFinite(n) && n > 0 ? n : 1
      } else if (field === "purchase_cost") {
        const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""))
        asset.purchase_cost = Number.isFinite(n) ? n : 0
      } else {
        ;(asset as any)[field] = String(value).trim()
      }
    }
    return asset
  })
}

export type AssetOptionType = "category" | "department"

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
