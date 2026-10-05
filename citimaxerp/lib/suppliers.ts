import apiCall from "./api"
import * as XLSX from "xlsx"

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

// Export suppliers as Excel
export async function exportSuppliers(): Promise<void> {
  const suppliers = await getSuppliers()

  const rows = suppliers.map((s) => ({
    "Supplier Name": s.name,
    "Contact Person": s.contact_person || "",
    "Email": s.email || "",
    "Phone": s.phone || "",
    "Address": s.address || "",
    "Terms Type": s.payment_terms_type || "",
    "Terms Days": s.payment_terms_days || "",
    "Terms Notes": s.payment_terms_description || "",
    "Bank Name": s.bank_name || "",
    "Bank Account Number": s.bank_account_number || "",
    "Bank Branch": s.bank_branch || "",
    "Bank Swift Code": s.bank_swift_code || "",
    "Notes": s.notes || "",
    "Active": s.is_active ? "Yes" : "No",
  }))

  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(k.length + 2, 18) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Suppliers")
  XLSX.writeFile(book, `suppliers_${new Date().toISOString().split("T")[0]}.xlsx`)
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