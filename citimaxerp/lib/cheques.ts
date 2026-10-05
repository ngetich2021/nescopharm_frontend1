import apiCall from "@/lib/api"

export type ChequeStatus = "pending" | "approved" | "bounced" | "cancelled"

export type ChequeDirection = "received" | "issued"

export interface Cheque {
  id: string
  company_id: string
  direction: ChequeDirection
  customer_id: string | null
  supplier_id: string | null
  // Free-text payee for issued cheques with no supplier/customer master
  // record - office supplies, logistics/courier fees, etc.
  payee_name: string | null
  payee_display_name: string | null
  invoice_id: string | null
  purchase_order_id: string | null
  payment_id: string | null
  cheque_number: string
  bank_name: string
  amount: string | number
  issue_date: string
  maturity_date: string
  status: ChequeStatus
  notes: string | null
  attachment_path: string | null
  attachment_url: string | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  reminder_sent_at: string | null
  created_at: string
  updated_at: string
  customer?: { id: string; name: string; business_name?: string | null; customer_type?: "individual" | "company" | null }
  invoice?: { id: string; invoice_number: string }
  supplier?: { id: string; name: string }
  purchase_order?: { id: string; order_number: string }
}

export interface CreateChequeRequest {
  invoice_id: string
  cheque_number: string
  bank_name: string
  amount: number
  issue_date: string
  maturity_date: string
  notes?: string
  attachment?: File | null
}

export interface CreateIssuedChequeRequest {
  // Who we're paying: a supplier, a customer refund (against a specific
  // invoice, or just the customer directly), or - if neither has a master
  // record - a free-text payee name (office supplies, logistics, etc.).
  supplier_id?: string
  purchase_order_id?: string
  customer_id?: string
  invoice_id?: string
  payee_name?: string
  cheque_number: string
  bank_name: string
  amount: number
  issue_date: string
  maturity_date: string
  notes?: string
}

export interface ChequeFilters {
  status?: ChequeStatus
  direction?: ChequeDirection
  customer_id?: string
  invoice_id?: string
  supplier_id?: string
}

// The Cheques page caches its list for 5 minutes (useDataCache). Every mutation below is reachable
// from elsewhere in the app too - most often Record Payment on an invoice, far from that page - so
// each one invalidates that cache directly rather than relying on whoever calls it to remember to.
async function invalidateChequesCache(): Promise<void> {
  if (typeof window === "undefined") return
  const { invalidateCacheKey } = await import("@/lib/data-cache")
  invalidateCacheKey("cheques")
}

export async function fetchCheques(filters?: ChequeFilters): Promise<Cheque[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.append("status", filters.status)
  if (filters?.direction) params.append("direction", filters.direction)
  if (filters?.customer_id) params.append("customer_id", filters.customer_id)
  if (filters?.invoice_id) params.append("invoice_id", filters.invoice_id)
  if (filters?.supplier_id) params.append("supplier_id", filters.supplier_id)
  const query = params.toString() ? `?${params.toString()}` : ""

  const response = await apiCall<{ data: Cheque[] }>(`/cheques${query}`, "GET", undefined, true)
  return response.data
}

export async function createCheque(data: CreateChequeRequest): Promise<Cheque> {
  const { attachment, ...fields } = data
  const formData = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value))
    }
  })
  if (attachment) {
    formData.append("attachment", attachment)
  }

  const response = await apiCall<{ message: string; data: Cheque }>("/cheques", "POST", formData, true)
  await invalidateChequesCache()
  return response.data
}

/**
 * A post-dated cheque issued to a supplier (accounts payable) rather than
 * received from a customer. Purely a tracking record for the maturity
 * alert - it does not create a supplier payment or touch PO balances.
 */
export async function createIssuedCheque(data: CreateIssuedChequeRequest): Promise<Cheque> {
  const response = await apiCall<{ message: string; data: Cheque }>(
    "/cheques",
    "POST",
    { ...data, direction: "issued" },
    true
  )
  await invalidateChequesCache()
  return response.data
}

export async function approveCheque(id: string): Promise<Cheque> {
  const response = await apiCall<{ message: string; data: Cheque }>(`/cheques/${id}/approve`, "POST", undefined, true)
  await invalidateChequesCache()
  return response.data
}

export async function bounceCheque(id: string): Promise<Cheque> {
  const response = await apiCall<{ message: string; data: Cheque }>(`/cheques/${id}/bounce`, "POST", undefined, true)
  await invalidateChequesCache()
  return response.data
}

export async function cancelCheque(id: string): Promise<Cheque> {
  const response = await apiCall<{ message: string; data: Cheque }>(`/cheques/${id}/cancel`, "POST", undefined, true)
  await invalidateChequesCache()
  return response.data
}

export function getChequeStatusColor(status: ChequeStatus): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "approved":
      return "bg-green-100 text-green-800"
    case "bounced":
      return "bg-red-100 text-red-800"
    case "cancelled":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}
