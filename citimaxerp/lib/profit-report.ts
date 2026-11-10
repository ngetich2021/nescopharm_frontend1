import apiCall from "./api"

/** One sales invoice line with what it sold for (excl. VAT, after discount) and what the goods cost. */
export interface ProfitLine {
  invoice_id: string
  invoice_number: string
  invoice_date: string
  customer: string | null
  product_id: string | null
  description: string
  price_list: string | null // NSPH, NSPO ... (null: no price code on the line)
  price_code: string | null // "NSPH 067"
  unit: string
  quantity: number
  unit_price: number
  sales: number
  cost: number | null // null: no cost anywhere for the item
  // dispatch: the batches the stock left on; batch: the item's average batch cost; cost_price: its Cost Price.
  cost_source: "dispatch" | "batch" | "cost_price" | "none"
}

export interface ProfitReport {
  date_from: string
  date_to: string
  earliest: string // the first date covered (past sales before it have no cost)
  lines: ProfitLine[]
}

export async function getProfitReport(params: { date_from: string; date_to: string }): Promise<ProfitReport> {
  const qs = new URLSearchParams(params).toString()
  const res = await apiCall<{ data: ProfitReport }>(`/reports/profit?${qs}`, "GET")
  return res.data
}
