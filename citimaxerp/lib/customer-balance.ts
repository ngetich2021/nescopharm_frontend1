import apiCall from "@/lib/api"

// A customer's running account (CustomerAccountService on the backend): what they owe across
// all their invoices, their money not yet used on an invoice, and PD cheques still pending.

export interface AccountOpenInvoice {
  id: string
  invoice_number: string
  invoice_date: string | null
  due_date: string | null
  total_amount: number
  amount_paid: number
  amount_credited: number
  balance: number
  status: string
  overdue: boolean
}

export interface AccountUnappliedPayment {
  id: string
  order_id: string | null
  order_number: string | null
  payment_method: string | null
  reference: string | null
  payment_date: string | null
  amount_paid: number
  allocated: number
  refunded: number
  available: number
}

export interface AccountUnappliedCreditNote {
  id: string
  credit_note_number: string
  credit_note_date: string | null
  total_amount: number
  amount_applied: number
  amount_refunded: number
  available: number
}

export interface AccountSplitLine {
  invoice_id: string
  invoice_number?: string
  amount: number
}

export interface AccountPendingCheque {
  id: string
  cheque_number: string
  bank_name: string
  amount: number
  issue_date: string | null
  maturity_date: string | null
  invoice_number: string | null
  allocation_plan: AccountSplitLine[] | null
}

export interface CustomerAccountBalance {
  customer: { id: string; name: string; business_name?: string | null; customer_number?: string | null; payment_method?: string | null }
  account: {
    id: string
    account_number: string | null
    credit_limit: number | null
    credit_days: number | null
    credit_period_pd_cheque_days: number | null
  } | null
  totals: {
    invoiced: number
    paid: number
    credited: number
    outstanding: number
    overdue: number
    credit_from_payments: number
    credit_from_credit_notes: number
    credit_available: number
    deposits_on_uninvoiced_orders: number
    pending_cheques: number
    // Positive: the customer owes us. Negative: we hold the customer's money.
    net_balance: number
    available_credit_limit: number | null
  }
  open_invoices: AccountOpenInvoice[]
  unapplied_payments: AccountUnappliedPayment[]
  deposits: AccountUnappliedPayment[]
  unapplied_credit_notes: AccountUnappliedCreditNote[]
  pending_cheques: AccountPendingCheque[]
}

export interface ReceiveOnAccountRequest {
  amount: number
  payment_method: string
  payment_date?: string
  transaction_id?: string
  notes?: string
  // Omit to apply oldest invoice first.
  allocations?: AccountSplitLine[]
}

export interface ChequeOnAccountRequest {
  customer_id: string
  cheque_number: string
  bank_name: string
  amount: number
  issue_date: string
  maturity_date: string
  notes?: string
  attachment?: File | null
  allocations?: AccountSplitLine[]
}

export async function fetchCustomerAccountBalance(customerId: string): Promise<CustomerAccountBalance> {
  const response = await apiCall<{ data: CustomerAccountBalance }>(`/customers/${customerId}/account-balance`, "GET", undefined, true)
  return response.data
}

// The customer's double entries (CustomerLedgerService): every journal entry touching them,
// with all its lines; balance is their receivable after each entry.
export interface CustomerLedgerLine {
  account_id: string
  account_code: string | null
  account_name: string | null
  description: string | null
  debit: number
  credit: number
  is_customer_line: boolean
}

export interface CustomerLedgerEntry {
  id: string
  entry_number: string
  date: string | null
  reference: string | null
  description: string | null
  status: string
  transaction_type: string | null
  lines: CustomerLedgerLine[]
  total_debit: number
  total_credit: number
  receivable_change: number
  balance: number
}

export interface CustomerLedger {
  receivable_accounts: { id: string; code: string; name: string }[]
  period: { from: string | null; to: string | null }
  opening_balance: number
  entries: CustomerLedgerEntry[]
  totals: { debit: number; credit: number; closing_balance: number }
}

export async function fetchCustomerLedger(customerId: string, params: { date_from?: string; date_to?: string } = {}): Promise<CustomerLedger> {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString()
  const response = await apiCall<{ data: CustomerLedger }>(
    `/customers/${customerId}/account-balance/ledger${query ? `?${query}` : ""}`,
    "GET",
    undefined,
    true,
  )
  return response.data
}

export async function fetchSuggestedSplit(customerId: string, amount: number): Promise<AccountSplitLine[]> {
  const response = await apiCall<{ data: AccountSplitLine[] }>(
    `/customers/${customerId}/account-balance/split?amount=${encodeURIComponent(amount)}`,
    "GET",
    undefined,
    true
  )
  return response.data
}

export async function receiveOnAccount(customerId: string, data: ReceiveOnAccountRequest): Promise<{ message: string }> {
  const response = await apiCall<{ message: string }>(`/customers/${customerId}/account-balance/receive`, "POST", data, true)
  return { message: response.message }
}

export async function applyCustomerCredit(customerId: string): Promise<{ message: string }> {
  const response = await apiCall<{ message: string }>(`/customers/${customerId}/account-balance/apply-credit`, "POST", undefined, true)
  return { message: response.message }
}

// A PD cheque on the customer's account, spread over several invoices once it is approved.
export async function recordChequeOnAccount(data: ChequeOnAccountRequest): Promise<{ message: string }> {
  const { attachment, allocations, ...fields } = data
  const formData = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") formData.append(key, String(value))
  })
  allocations?.forEach((line, i) => {
    formData.append(`allocations[${i}][invoice_id]`, line.invoice_id)
    formData.append(`allocations[${i}][amount]`, String(line.amount))
  })
  if (attachment) formData.append("attachment", attachment)

  const response = await apiCall<{ message: string }>("/cheques", "POST", formData, true)
  if (typeof window !== "undefined") {
    const { invalidateCacheKey } = await import("@/lib/data-cache")
    invalidateCacheKey("cheques")
  }
  return { message: response.message }
}
