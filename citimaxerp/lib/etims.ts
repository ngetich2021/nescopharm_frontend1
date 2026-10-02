import apiCall from "./api"

// ─────────── Types ───────────

export interface EtimsConfig {
  id: string
  name: string
  country_code: "KE"
  kra_pin: string | null
  branch_id: string
  environment: "test" | "live"
  environment_locked: boolean
  go_live_date: string | null
  enabled: boolean
  has_api_key: boolean
  last_test_connection_at: string | null
  last_test_connection_result: "success" | "failure" | null
  last_sync_at: string | null
  last_error: string | null
}

export interface EtimsWizardProgress {
  step: 1 | 2 | 3 | 4
  identity: boolean
  credentials: boolean
  activation: boolean
}

export interface EtimsConfigResponse {
  config: EtimsConfig | null
  wizard: EtimsWizardProgress
  webhook_url: string | null
}

export interface EtimsItemRegistration {
  id: string
  company_id: string
  product_id: string
  item_code: string | null
  item_class_code: string | null
  item_type_code: "1" | "2" | "3" | null
  packaging_unit_code: string | null
  quantity_unit_code: string | null
  country_of_origin_code: string | null
  tax_type_code: "A" | "B" | "C" | "D" | "E" | null
  sync_status: "pending" | "synced" | "failed"
  last_error: string | null
  attempts: number
  synced_at: string | null
}

export interface EtimsReference {
  item_classes: Array<{ code: string; name: string; parent_code: string | null; level: number; is_leaf: boolean }>
  packaging_units: Array<{ code: string; name: string }>
  quantity_units: Array<{ code: string; name: string }>
  tax_types: Array<{ code: string; name: string; rate: string | null; description: string | null }>
  payment_types: Array<{ code: string; name: string }>
}

export interface EtimsInvoiceStatus {
  invoice_id: string
  invoice_number: string
  etims_status:
    | null
    | "registering_items"
    | "locked_pending"
    | "submitted"
    | "completed"
    | "failed"
    | "response_invalid"
    | "voided_with_cn"
  etims_sale_id: string | null
  etims_signature: string | null
  etims_qr_url: string | null
  etims_trader_invoice_number: string | null
  etims_submitted_at: string | null
  etims_synced_at: string | null
  etims_last_error: string | null
  etims_lock_state: "locked_pending" | null
  etims_lock_acquired_at: string | null
}

export interface EtimsSupplierReceipt {
  id: string
  company_id: string
  supplier_bill_id: string | null
  supplier_id: string | null
  supplier_kra_pin: string | null
  trader_invoice_number: string | null
  invoice_date: string | null
  total_amount: number | null
  tax_amount: number | null
  currency: string
  verification_status: "pending" | "verified" | "invalid" | "error"
  verification_error: string | null
  verified_at: string | null
  vat_reclaimable: boolean
}

export interface EtimsWorklistCard {
  key: string
  title: string
  count: number
  severity: "ok" | "warning" | "critical"
}

// ─────────── Config (wizard) ───────────

export const getEtimsConfig = () =>
  apiCall<EtimsConfigResponse>("/etims/config", "GET", undefined, true)

export const updateEtimsIdentity = (name: string, country_code: "KE", kra_pin: string, branch_id?: string) =>
  apiCall<EtimsConfigResponse>("/etims/config/identity", "PATCH", { name, country_code, kra_pin, branch_id }, true)

export const updateEtimsCredentials = (digitax_api_key: string, environment: "test" | "live") =>
  apiCall<EtimsConfigResponse & { callback_secret: string; callback_secret_notice: string }>(
    "/etims/config/credentials",
    "PATCH",
    { digitax_api_key, environment },
    true,
  )

export const testEtimsConnection = () =>
  apiCall<{
    success: boolean
    message: string
    status_code: number | null
    latency_ms: number | null
    diagnostics: Record<string, unknown> | null
    tested_at: string
  }>("/etims/config/test-connection", "POST", {}, true)

export const updateEtimsActivation = (enabled: boolean, go_live_date?: string) =>
  apiCall<EtimsConfigResponse>("/etims/config/activation", "PATCH", { enabled, go_live_date }, true)

export const regenerateEtimsSecret = () =>
  apiCall<{ callback_secret: string; webhook_url: string; notice: string }>(
    "/etims/config/regenerate-secret",
    "POST",
    {},
    true,
  )

// ─────────── Items ───────────

export const getEtimsReference = () => apiCall<EtimsReference>("/etims/items/reference", "GET", undefined, true)

export const listEtimsItems = (status?: "pending" | "synced" | "failed") =>
  apiCall<{ data: { data: EtimsItemRegistration[]; current_page: number; last_page: number; total: number } }>(
    `/etims/items${status ? `?status=${status}` : ""}`,
    "GET",
    undefined,
    true,
  )

export const getEtimsItem = (productId: string) =>
  apiCall<{ product: { id: string; name: string; sku: string | null }; registration: EtimsItemRegistration }>(
    `/etims/items/${productId}`,
    "GET",
    undefined,
    true,
  )

export const updateEtimsItem = (
  productId: string,
  data: Partial<
    Pick<
      EtimsItemRegistration,
      "item_class_code" | "item_type_code" | "packaging_unit_code" | "quantity_unit_code" | "country_of_origin_code" | "tax_type_code"
    >
  >,
) => apiCall<{ registration: EtimsItemRegistration }>(`/etims/items/${productId}`, "PATCH", data, true)

export const syncEtimsItem = (productId: string) =>
  apiCall<{ queued: boolean; message: string }>(`/etims/items/${productId}/sync`, "POST", {}, true)

// ─────────── Invoices ───────────

export const getEtimsInvoiceStatus = (invoiceId: string) =>
  apiCall<EtimsInvoiceStatus>(`/etims/invoices/${invoiceId}/status`, "GET", undefined, true)

export const retryEtimsInvoice = (invoiceId: string) =>
  apiCall<{ queued: boolean }>(`/etims/invoices/${invoiceId}/retry`, "POST", {}, true)

export const submitEtimsInvoice = (invoiceId: string) =>
  apiCall<{ queued: boolean }>(`/etims/invoices/${invoiceId}/submit`, "POST", {}, true)

export const forceUnlockEtimsInvoice = (invoiceId: string) =>
  apiCall<{ unlocked: boolean }>(`/etims/invoices/${invoiceId}/force-unlock`, "POST", {}, true)

export const getEtimsCreditNoteStatus = (creditNoteId: string) =>
  apiCall<EtimsInvoiceStatus>(`/etims/credit-notes/${creditNoteId}/status`, "GET", undefined, true)

export const retryEtimsCreditNote = (creditNoteId: string) =>
  apiCall<{ queued: boolean }>(`/etims/credit-notes/${creditNoteId}/retry`, "POST", {}, true)

// ─────────── Supplier receipts (AP) ───────────

export const listEtimsSupplierReceipts = (params?: { only_unsigned?: boolean; status?: string }) => {
  const q = new URLSearchParams()
  if (params?.only_unsigned) q.set("only_unsigned", "1")
  if (params?.status) q.set("status", params.status)
  return apiCall<{ data: { data: EtimsSupplierReceipt[]; current_page: number; last_page: number; total: number } }>(
    `/etims/supplier-receipts${q.size ? `?${q.toString()}` : ""}`,
    "GET",
    undefined,
    true,
  )
}

export const uploadEtimsSupplierReceipt = (form: FormData) =>
  apiCall<{ receipt: EtimsSupplierReceipt }>("/etims/supplier-receipts", "POST", form, true)

export const reverifyEtimsSupplierReceipt = (id: string) =>
  apiCall<{ receipt: EtimsSupplierReceipt }>(`/etims/supplier-receipts/${id}/verify`, "POST", {}, true)

export const linkEtimsReceiptToBill = (id: string, supplier_bill_id: string) =>
  apiCall<{ receipt: EtimsSupplierReceipt }>(
    `/etims/supplier-receipts/${id}/link-bill`,
    "POST",
    { supplier_bill_id },
    true,
  )

export const getEtimsReceiptReconciliation = () =>
  apiCall<{ verified_count: number; pending_count: number; invalid_count: number; vat_reclaimable_total: number }>(
    "/etims/supplier-receipts/reconciliation",
    "GET",
    undefined,
    true,
  )

// ─────────── Reports ───────────

export const getEtimsWorklist = () => apiCall<{ cards: EtimsWorklistCard[] }>("/etims/reports/worklist", "GET", undefined, true)

export const getEtimsFailures = () =>
  apiCall<{ data: Array<{ error: string; count: number; sample_invoice_ids: string[] }> }>(
    "/etims/reports/failures",
    "GET",
    undefined,
    true,
  )

export const getEtimsHealth = () =>
  apiCall<{ window_days: number; totals: Array<{ result_status: string; n: number; avg_latency: number }> }>(
    "/etims/reports/health",
    "GET",
    undefined,
    true,
  )
