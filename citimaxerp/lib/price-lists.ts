import apiCall from "@/lib/api"

export interface PriceListImportRow {
  row: number
  code: string
  description: string
  status: "created" | "matched" | "error"
  item_number?: number
  price?: number
  unit_of_measure?: string | null
  message?: string | null
}

export interface PriceListImportResult {
  status: string
  message: string
  dry_run: boolean
  list_name: string
  summary: {
    rows: number
    products_created: number
    products_matched: number
    prices_added: number
    prices_updated: number
    errors: number
  }
  rows: PriceListImportRow[]
}

export async function importPriceList(file: File, listName: string, dryRun: boolean): Promise<PriceListImportResult> {
  const form = new FormData()
  form.append("file", file)
  form.append("list_name", listName)
  form.append("dry_run", dryRun ? "1" : "0")
  return apiCall<PriceListImportResult>("/price-lists/import", "POST", form)
}

export const PRICE_LIST_TEMPLATE_HEADERS = ["Item Code", "Item Description", "Price", "Unit of Measure", "Tax Status"]

export interface PriceListExportRow {
  // The full code for the sheet's "Item Code" column, e.g. "NSPH001".
  sheet_code: string
  item_code: string | null
  code: string
  description: string | null
  price: number
  unit_of_measure: string | null
  tax_status: string
  item_number: number | null
}

export interface PriceListExportResult {
  status: string
  message: string
  list_name: string
  rows: PriceListExportRow[]
}

export async function fetchPriceList(listName: string): Promise<PriceListExportResult> {
  return apiCall<PriceListExportResult>(`/price-lists/export?list_name=${encodeURIComponent(listName)}`, "GET")
}

export interface PriceListImportRecord {
  id: string
  company_id: string
  list_name: string
  version: number
  file_name: string | null
  file_path: string | null
  rows_count: number
  products_created: number
  products_matched: number
  prices_added: number
  prices_updated: number
  errors_count: number
  uploaded_by: string | null
  created_at: string
  updated_at: string
  uploader?: { id: string; name: string } | null
}

export async function fetchPriceListHistory(listName?: string): Promise<PriceListImportRecord[]> {
  const params = listName ? `?list_name=${encodeURIComponent(listName)}` : ""
  const res = await apiCall<{ data: PriceListImportRecord[] }>(`/price-lists/history${params}`, "GET")
  return res.data
}

export interface ProductPriceHistoryRecord {
  id: string
  product_id: string
  price_type: string
  old_value: string | null
  new_value: string
  change_amount: string | null
  change_percentage: string | null
  changed_by: string | null
  source: string
  source_reference: string | null
  created_at: string
  changed_by_user?: { id: string; name: string } | null
}

export async function fetchProductPriceHistory(productId: string): Promise<ProductPriceHistoryRecord[]> {
  const res = await apiCall<{ data: ProductPriceHistoryRecord[] }>(`/products/${productId}/price-history`, "GET")
  return res.data
}

export async function downloadImportFile(importId: string, fileName: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/price-lists/history/${importId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error("Download failed")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName || "price-list-import"
  a.click()
  URL.revokeObjectURL(url)
}
