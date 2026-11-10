import apiCall from "./api"
import * as XLSX from "xlsx"
import { documentFileName, todayFileDate, sessionCompanyName } from "@/lib/document-names"
import { exportTable, type ExportFormat } from "@/lib/table-export"

function toQueryString(params: Record<string, any>): string {
  return (
    Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null && v !== "")
      .map(
        ([k, v]) =>
          encodeURIComponent(k) + "=" + encodeURIComponent(String(v))
      )
      .join("&")
  )
}

export interface Supplier {
  id: string
  company_id: string
  name: string
  email: string
  phone: string
  address: string
  contact_person: string
  notes?: string
  is_active: boolean
  bank_name: string
  bank_account_number: string
  bank_branch: string
  bank_swift_code: string
  payment_terms_type: string
  payment_terms_days: number
  payment_terms_description: string
  tax_information: string
  credit_limit?: number | string | null // how much we may owe them; ordering past it warns, never blocks
  created_at: string
  updated_at: string
}

export interface CreateSupplierPayload {
  name: string
  email?: string
  phone?: string
  address?: string
  contact_person?: string
  notes?: string
  is_active?: boolean
  bank_name?: string
  bank_account_number?: string
  bank_branch?: string
  bank_swift_code?: string
  payment_terms_type?: string
  payment_terms_days?: number
  payment_terms_description?: string
  tax_information?: string
  credit_limit?: number | null
}

export interface UpdateSupplierPayload {
  name?: string
  email?: string
  phone?: string
  address?: string
  contact_person?: string
  notes?: string
  is_active?: boolean
  bank_name?: string
  bank_account_number?: string
  bank_branch?: string
  bank_swift_code?: string
  payment_terms_type?: string
  payment_terms_days?: number
  payment_terms_description?: string
  tax_information?: string
  credit_limit?: number | null
}

export interface SupplierSummary {
  totalSuppliers: number
  activeSuppliers: number
  inactiveSuppliers: number
  averagePaymentTerms: number
}

export interface GetSuppliersParams {
  is_active?: boolean
}

// Get all suppliers
export async function getSuppliers(params?: GetSuppliersParams): Promise<Supplier[]> {
  const query = params ? "?" + Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&") : ""
  const response = await apiCall<{ status: string; data: Supplier[]; message?: string }>(
    `/suppliers${query}`,
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  } else {
    throw new Error(response.message || "Failed to fetch suppliers")
  }
}

// Get supplier by ID
export async function getSupplier(id: string): Promise<Supplier> {
  const response = await apiCall<{ status: string; data: Supplier; message?: string }>(
    `/suppliers/${id}`,
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  } else {
    throw new Error(response.message || "Failed to fetch supplier")
  }
}

// Create new supplier
export interface SupplierStatementEntry {
  date: string
  type: "opening_balance" | "bill" | "receipt" | "debit_note" | "payment"
  reference: string
  description: string
  billed: number
  paid: number
  balance: number
}

export interface SupplierStatement {
  entries: SupplierStatementEntry[]
  totals: { billed: number; paid: number; balance: number }
}

// Bills, debit notes and payments with the running amount owed to the supplier.
/** One line of a supplier's ledger, as Tally prints it: Particulars is the other side of the entry. */
export interface SupplierLedgerRow {
  id: string
  date: string | null
  side: "Dr" | "Cr"
  particulars: string
  other_accounts: string[]
  voucher_type: string
  voucher_no: string
  narration: string | null
  reversed: boolean
  debit: number
  credit: number
  balance: number
  balance_side: "Dr" | "Cr"
}

export interface SupplierLedger {
  supplier: { id: string; name: string }
  payable_accounts: string[]
  date_from: string | null
  date_to: string | null
  opening_balance: { amount: number; side: "Dr" | "Cr" }
  rows: SupplierLedgerRow[]
  totals: { debit: number; credit: number }
  closing_balance: { amount: number; side: "Dr" | "Cr" }
}

export async function getSupplierLedger(id: string, period?: { from?: string; to?: string; corrections?: boolean }): Promise<SupplierLedger> {
  const qs = toQueryString({ date_from: period?.from, date_to: period?.to, corrections: period?.corrections ? 1 : undefined })
  const response = await apiCall<{ status: string; data: SupplierLedger; message?: string }>(
    `/suppliers/${id}/ledger${qs ? `?${qs}` : ""}`, "GET", undefined, true
  )
  if (response.status === "success" && response.data) {
    return response.data
  }
  throw new Error(response.message || "Failed to fetch supplier ledger")
}

export async function getSupplierStatement(id: string, period?: { from?: string; to?: string }): Promise<SupplierStatement> {
  const qs = toQueryString({ date_from: period?.from, date_to: period?.to })
  const response = await apiCall<{ status: string; data: SupplierStatement; message?: string }>(
    `/suppliers/${id}/statement${qs ? `?${qs}` : ""}`,
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  }
  throw new Error(response.message || "Failed to fetch supplier statement")
}

export async function createSupplier(payload: CreateSupplierPayload): Promise<Supplier> {
  const response = await apiCall<{ status: string; data: Supplier; message?: string }>(
    "/suppliers",
    "POST",
    payload,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  } else {
    throw new Error(response.message || "Failed to create supplier")
  }
}

// Update supplier
export async function updateSupplier(id: string, payload: UpdateSupplierPayload): Promise<Supplier> {
  const response = await apiCall<{ status: string; data: Supplier; message?: string }>(
    `/suppliers/${id}`,
    "PUT",
    payload,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  } else {
    throw new Error(response.message || "Failed to update supplier")
  }
}

// Delete supplier
export async function deleteSupplier(id: string): Promise<void> {
  const response = await apiCall<{ status: string; message?: string }>(
    `/suppliers/${id}`,
    "DELETE",
    undefined,
    true
  )
  if (response.status !== "success") {
    throw new Error(response.message || "Failed to delete supplier")
  }
}

// Get supplier summary statistics
export async function getSupplierSummary(): Promise<SupplierSummary> {
  const response = await apiCall<{ status: string; data: SupplierSummary; message?: string }>(
    "/suppliers/summary",
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && response.data) {
    return response.data
  } else {
    // Return default summary if API endpoint doesn't exist yet
    return {
      totalSuppliers: 0,
      activeSuppliers: 0,
      inactiveSuppliers: 0,
      averagePaymentTerms: 0
    }
  }
}

// Get real-time supplier summary from the database
export async function getSupplierSummaryFromDB(): Promise<SupplierSummary> {
  const suppliers = await getSuppliers();
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter(s => s.is_active).length;
  const inactiveSuppliers = suppliers.filter(s => !s.is_active).length;
  const averagePaymentTerms = suppliers.length > 0
    ? Math.round(suppliers.reduce((sum, s) => sum + (s.payment_terms_days || 0), 0) / suppliers.length)
    : 0;
  return {
    totalSuppliers,
    activeSuppliers,
    inactiveSuppliers,
    averagePaymentTerms
  };
}

/** Every item bought from each supplier (goods receipts and purchase orders), for the export. */
export interface SupplierProductRow {
  supplier_id: string
  supplier: string
  item_number: number | null
  item: string
  received: number
  receipts: number
  last_received: string | null
  ordered: number
  orders: number
  last_ordered: string | null
  last_cost: number | null
}

export async function getSupplierProducts(): Promise<SupplierProductRow[]> {
  const res = await apiCall<{ data: SupplierProductRow[] }>("/suppliers/products", "GET")
  return res.data ?? []
}

const dmyOrBlank = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "")

// Export suppliers: the list (first sheet, which the supplier import reads back), then every item
// bought from each supplier (a second sheet in Excel, a second section in PDF/CSV).
export async function exportSuppliers(format: ExportFormat = "xlsx"): Promise<void> {
  const [suppliers, products] = await Promise.all([getSuppliers(), getSupplierProducts().catch(() => [] as SupplierProductRow[])])
  const productHeaders = ["S/No", "Supplier", "Item No.", "Item", "Qty Received", "Receipts", "Last Received", "Qty Ordered", "Orders", "Last Ordered", "Last Cost (KES)"]
  const productRows = products.map((p, i) => [i + 1, p.supplier, p.item_number ?? "", p.item, p.received, p.receipts, dmyOrBlank(p.last_received),
    p.ordered, p.orders, dmyOrBlank(p.last_ordered), p.last_cost ?? ""])

  const rows = suppliers.map((s) => ({
    "Supplier Name": s.name,
    "Contact Person": s.contact_person || "",
    "Email": s.email || "",
    "Phone": s.phone || "",
    "Address": s.address || "",
    "Terms Type": s.payment_terms_type || "",
    "Terms Days": s.payment_terms_days || "",
    "Credit Limit": s.credit_limit != null && s.credit_limit !== "" ? Number(s.credit_limit) : "",
    "Terms Notes": s.payment_terms_description || "",
    "Bank Name": s.bank_name || "",
    "Bank Account Number": s.bank_account_number || "",
    "Bank Branch": s.bank_branch || "",
    "Bank Swift Code": s.bank_swift_code || "",
    "KRA PIN": s.tax_information || "",
    "Notes": s.notes || "",
    "Active": s.is_active ? "Yes" : "No",
  }))
  if (format !== "xlsx") {
    const listHeaders = ["S/No", ...Object.keys(rows[0] ?? {})]
    return exportTable(format, {
      fileName: documentFileName([sessionCompanyName(), "Suppliers List", todayFileDate()]),
      title: "Suppliers",
      headers: [],
      rows: [],
      sheets: [
        { fileName: "", title: "Suppliers", headers: listHeaders, rows: rows.map((r, i) => [i + 1, ...Object.values(r)]) },
        { fileName: "", title: "Products by Supplier", subtitle: "Every item bought from each supplier (goods received and purchase orders)", headers: productHeaders, rows: productRows, moneyColumns: [10] },
      ],
    })
  }

  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(k.length + 2, 18) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Suppliers")
  const productSheet = XLSX.utils.aoa_to_sheet([productHeaders, ...productRows])
  productSheet["!cols"] = productHeaders.map((h) => ({ wch: h === "Item" ? 50 : h === "Supplier" ? 36 : Math.max(h.length + 2, 12) }))
  XLSX.utils.book_append_sheet(book, productSheet, "Products by Supplier")
  XLSX.writeFile(book, documentFileName([sessionCompanyName(), "Suppliers List", todayFileDate()], "xlsx"))
}

// Import suppliers from file
export async function importSuppliers(file: File, dryRun: boolean = true): Promise<any> {
  const form = new FormData()
  form.append("file", file)
  form.append("dry_run", dryRun ? "1" : "0")
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/data-import/suppliers`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || "Import failed")
  }
  return res.json()
} 
/** Credit used with a supplier against its limit (owed + on order + this order); warning when past it. */
export interface SupplierCreditUse {
  limit: number | null
  owed: number
  on_order: number
  adding: number
  total: number
  over: number
  warning: string | null
}

export async function getSupplierCreditUse(supplierId: string, adding = 0, except?: string): Promise<SupplierCreditUse> {
  const qs = new URLSearchParams({ adding: String(adding || 0), ...(except ? { except } : {}) })
  const res = await apiCall<{ data: SupplierCreditUse }>(`/suppliers/${supplierId}/credit-use?${qs}`, "GET")
  return res.data
}
