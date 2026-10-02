import apiCall from "./api"
import type { Debt, DebtPayment, DebtSummary, CreateDebtRequest, RecordPaymentRequest } from "@/types/debts"

export interface CreateDebtPayload {
  customer_id: string
  order_id: string
  company_id: string
  amount: number
  status: string
  due_date: string
  notes?: string
  payment_id?: string | null
}

// Re-export the types from types/debts.ts for backward compatibility
export type { Debt, DebtPayment, DebtSummary, CreateDebtRequest, RecordPaymentRequest }

export async function createDebt(payload: CreateDebtPayload): Promise<Debt> {
  const response = await apiCall<{ status: string; debt: Debt; message?: string }>(
    "/debts",
    "POST",
    payload,
    true
  )
  if (response.status === "success" && response.debt) {
    return response.debt
  } else {
    throw new Error(response.message || "Failed to create debt")
  }
}

export async function updateDebtByOrderId(orderId: string, payload: Partial<CreateDebtPayload>): Promise<Debt> {
  const response = await apiCall<{ status: string; debt: Debt; message?: string }>(
    `/debts/order/${orderId}`,
    "PATCH",
    payload,
    true
  )
  if (response.status === "success" && response.debt) {
    return response.debt
  } else {
    throw new Error(response.message || "Failed to update debt")
  }
}

// Add a function to fetch the current debt for an order
export async function getDebtForOrder(orderId: string): Promise<Debt | null> {
  // Try GET /debts/order/{orderId} if supported, otherwise fallback to null
  // If not supported, you may need to implement this on the backend
  // For now, return null to avoid breaking the frontend
  return null;
}

// Get all debts for the current company
export async function getDebts(): Promise<Debt[]> {
  const response = await apiCall<{ status: string; debts: Debt[]; message?: string }>(
    "/debts",
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && response.debts) {
    return response.debts
  } else {
    throw new Error(response.message || "Failed to fetch debts")
  }
}

// Get debt summary statistics
export async function getDebtSummary(): Promise<DebtSummary> {
  const response = await apiCall<{ status: string; summary: DebtSummary; message?: string }>(
    "/debts/summary",
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && response.summary) {
    return response.summary
  } else {
    throw new Error(response.message || "Failed to fetch debt summary")
  }
}

// Update debt by ID
export async function updateDebt(debtId: string, payload: Partial<CreateDebtPayload>): Promise<Debt> {
  const response = await apiCall<{ status: string; debt: Debt; message?: string }>(
    `/debts/${debtId}`,
    "PATCH",
    payload,
    true
  )
  if (response.status === "success" && response.debt) {
    return response.debt
  } else {
    throw new Error(response.message || "Failed to update debt")
  }
}

// Get payments for a specific debt
export async function getDebtPayments(debtId: string): Promise<DebtPayment[]> {
  const response = await apiCall<{ status: string; payments: DebtPayment[]; message?: string }>(
    `/debts/${debtId}/payments`,
    "GET",
    undefined,
    true
  )
  if (response.status === "success" && response.payments) {
    return response.payments
  } else {
    throw new Error(response.message || "Failed to fetch debt payments")
  }
}

// Record a payment for a debt
export async function recordPayment(debtId: string, amount: number, notes?: string): Promise<DebtPayment> {
  const response = await apiCall<{ status: string; payment: DebtPayment; message?: string }>(
    `/debts/${debtId}/payments`,
    "POST",
    { amount, notes },
    true
  )
  if (response.status === "success" && response.payment) {
    return response.payment
  } else {
    throw new Error(response.message || "Failed to record payment")
  }
}
