import apiCall from "./api"

export interface StatementInvoice {
  id: string
  invoice_number: string
  invoice_date: string
  total_amount: string | number
  balance_amount: string | number
}

export interface StatementPayment {
  id: string
  transaction_id: string | null
  payment_date: string
  amount_paid: string | number
  payment_method: string | null
}

export interface StatementCreditNote {
  id: string
  credit_note_number: string
  credit_note_date: string
  total_amount: string | number
}

export interface StatementCheque {
  id: string
  cheque_number: string
  bank_name: string
  issue_date: string
  maturity_date: string
  amount: string | number
  status: string
}

export interface PendingBill {
  invoice_id: string
  invoice_number: string
  invoice_date: string
  particulars: string
  opening_amount: string | number
  pending_amount: string | number
  due_date: string
  overdue_days: number
}

export interface CompanyPaymentDetails {
  bank_name?: string | null
  account_name?: string | null
  account_number?: string | null
  bank_branch?: string | null
  mpesa_paybill?: string | null
  mpesa_account_number?: string | null
}

export interface StatementTransaction {
  date: string
  type: "opening" | "invoice" | "payment" | "credit_note" | "refund"
  reference: string
  description: string
  debit: number | null
  credit: number | null
  balance: number
}

export interface StatementOrder {
  id: string
  order_number: string
  order_date: string
  status: string
  payment_status: string
  invoice_number: string | null
  total: number
  paid: number
  // Brought across from the old system.
  is_historical: boolean
}

export interface StatementAgeing {
  as_at: string
  buckets: { label: string; amount: number }[]
  unallocated: number
  total: number
}

export interface StatementAccount {
  account_number: string | null
  payment_method: string | null
  credit_days: number | null
  credit_limit: number | null
  available_credit: number | null
}

export interface CustomerStatement {
  customer: {
    id: string
    name: string
    business_name?: string | null
    customer_type?: "individual" | "company" | null
    email?: string | null
    phone?: string | null
    address?: string | null
    postal_code?: string | null
    city?: string | null
    county?: string | null
    country?: string | null
    pin_number?: string | null
  }
  company: {
    id: string
    name: string
    logo_url: string | null
    letterhead_url: string | null
    payment_details?: CompanyPaymentDetails | null
  } | null
  period: {
    from: string
    to: string
    label: string
  }
  opening_balance: number
  closing_balance: number
  account: StatementAccount
  transactions: StatementTransaction[]
  ageing: StatementAgeing
  invoices: StatementInvoice[]
  // Every order dated in the period, invoiced or not (cancelled ones included, flagged by status).
  orders?: StatementOrder[]
  payments: StatementPayment[]
  credit_notes: StatementCreditNote[]
  pd_cheques: StatementCheque[]
  pending_bills: PendingBill[]
  summary: {
    orders_count?: number
    orders_total?: number
    invoices_count: number
    invoices_total: number
    payments_count: number
    payments_total: number
    credit_notes_count: number
    credit_notes_total: number
    pd_cheques_count: number
    pd_cheques_total: number
  }
}

export async function fetchCustomerStatement(
  customerId: string,
  filters?: { date_from?: string; date_to?: string; period?: "all" }
): Promise<CustomerStatement> {
  const params = new URLSearchParams()
  if (filters?.period) params.append("period", filters.period)
  if (filters?.date_from) params.append("date_from", filters.date_from)
  if (filters?.date_to) params.append("date_to", filters.date_to)
  const query = params.toString() ? `?${params.toString()}` : ""

  const response = await apiCall<{ status: string; data: CustomerStatement }>(
    `/customers/${customerId}/statement${query}`,
    "GET",
    undefined,
    true
  )
  return response.data
}
