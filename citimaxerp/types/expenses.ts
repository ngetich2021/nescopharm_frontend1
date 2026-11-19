import { ReactNode } from "react"

export interface Expense {
  store_name: ReactNode
  category_name: ReactNode
  id: string
  company_id: string
  store_id: string | null
  category_id: string | null
  account_id?: string | null
  account?: { id: string; account_code: string; account_name: string; parent_id: string | null } | null
  /** The amount paid includes VAT; vat_amount of it goes to the VAT Account. */
  includes_vat?: boolean
  vat_rate?: number | string | null
  vat_amount?: number | string | null
  vendor_name: string
  description: string
  amount: number
  expense_date: string
  payment_method: PaymentMethod
  receipt_url: string | null
  notes: string | null
  is_recurring: boolean
  recurring_frequency: RecurringFrequency | null
  tags: string[] | null
  status: ExpenseStatus
  created_by: {
    id: string
    company_id: string
    email: string
    first_name: string
    last_name: string
    phone: string
    avatar_url: string | null
    is_active: boolean
    email_verified: boolean
    last_login_at: string
    role_id: string
    created_at: string
    updated_at: string
  }
  approved_by: {
    id: string
    company_id: string
    email: string
    first_name: string
    last_name: string
    phone: string
    avatar_url: string | null
    is_active: boolean
    email_verified: boolean
    last_login_at: string
    role_id: string
    created_at: string
    updated_at: string
  } | null
  created_at: string
  updated_at: string
  formatted_amount: string
  category: {
    id: string
    company_id: string
    name: string
    description: string | null
    color: string
    is_active: boolean
    created_at: string
    updated_at: string
  }
}

export interface ExpenseCategory {
  id: string
  company_id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Store {
  id: string
  company_id: string
  name: string
  description: string | null
  store_code: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postal_code: string | null
  manager_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "check" | "other"
export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly"
export type ExpenseStatus = "pending" | "approved" | "rejected" | "paid"

/** Ledger account an expense is charged to: main account (5000 Cost of Sales, 6000 Expenses) -> sub-account. */
export interface ExpenseLedgerGroup {
  id: string
  code: string
  name: string
  accounts: { id: string; code: string; name: string }[]
}

/** Where an expense is paid from: Petty Cash (cash) or Prime Bank (cheque / transfer). */
export interface ExpensePaidFrom {
  key: "petty_cash" | "prime_bank"
  methods: PaymentMethod[]
  account_id: string
  code: string | null
  name: string | null
  balance: number
}

export const EXPENSE_VAT_RATE = 16

/** The VAT inside a VAT-inclusive amount: 232,000 at 16% -> 32,000 (same rounding as the server). */
export function vatIn(amount: number, rate: number = EXPENSE_VAT_RATE): number {
  return rate > 0 ? Math.round(((amount * rate) / (100 + rate)) * 100) / 100 : 0
}

/** "6400 Transport" - the account an expense is charged to, else its old category. */
export function expenseAccountLabel(e: Pick<Expense, "account" | "category">): string {
  if (e.account) return `${e.account.account_code} ${e.account.account_name}`
  return e.category?.name || "Not set"
}
