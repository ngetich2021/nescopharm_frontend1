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
