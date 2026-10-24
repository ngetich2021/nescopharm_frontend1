import apiCall from "@/lib/api"

export type FilingInvoice = {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  status: string
  total_amount: number
  amount_paid: number
  balance_amount: number
  file_number: string | null
  filed_at: string | null
  customer_id: string | null
  customer: string
  order_id: string | null
  order_number: string | null
  order_amount: number | null
  differs_from_order: boolean
}

export type OrderWithoutInvoice = {
  id: string
  order_number: string
  order_date: string
  amount: number
  is_historical: boolean
  customer_id: string | null
  customer: string
}

export type FilingData = {
  invoices: FilingInvoice[]
  orders_without_invoice: OrderWithoutInvoice[]
  summary: { invoices: number; filed: number; customers: number; differs_from_order: number; orders_without_invoice: number }
}

export type FilingImportResult = {
  applied: boolean
  message: string
  counts: { update: number; clear: number; unchanged: number; not_found: number; skipped: number }
  rows: { row: number; invoice_number: string; file_number: string; previous?: string | null; result: string; message?: string }[]
}

export const getFiling = () => apiCall<FilingData>("/filing", "GET")

export const saveFileNumber = (invoiceId: string, fileNumber: string) =>
  apiCall<{ message: string; file_number: string | null }>(`/filing/${invoiceId}`, "PATCH", { file_number: fileNumber || null })

export const importFileNumbers = (rows: { invoice_number: string; file_number: string }[], apply: boolean) =>
  apiCall<FilingImportResult>("/filing/import", "POST", { rows, apply })

export const createMissingInvoices = (orderIds: string[]) =>
  apiCall<{ message: string; created: number; results: { order_number: string; ok: boolean; message: string; invoice_number?: string }[] }>(
    "/filing/create-invoices",
    "POST",
    { order_ids: orderIds },
  )

export const matchInvoicesToOrders = (invoiceIds: string[]) =>
  apiCall<{ message: string; results: { invoice_number: string; before?: number; after?: number; skipped?: boolean; message?: string }[] }>(
    "/filing/match-orders",
    "POST",
    { invoice_ids: invoiceIds },
  )

/** The print page reads the chosen invoices from here (too many ids for a URL). */
export const PRINT_KEY = "filing-print-ids"
