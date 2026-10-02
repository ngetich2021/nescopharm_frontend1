import { ReactNode } from "react"

export interface Expense {
  store_name: ReactNode
  category_name: ReactNode
  id: string
  company_id: string
  store_id: string | null
  category_id: string
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
