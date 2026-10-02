export interface Debt {
  id: string
  customerId: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  reference: string
  description: string
  amount: number
  paidAmount: number
  outstandingAmount: number
  category: "customer_debt" | "supplier_debt" | "loan" | "other"
  priority: "low" | "medium" | "high" | "urgent"
  status: "pending" | "partial" | "paid" | "overdue"
  dueDate: string
  createdDate: string
  lastPaymentDate?: string
  notes?: string
  createdBy: string
  updatedAt: string
}

export interface DebtPayment {
  id: string
  debtId: string
  amount: number
  paymentMethod: "cash" | "card" | "bank_transfer" | "mpesa" | "other"
  reference?: string
  notes?: string
  paymentDate: string
  createdBy: string
  createdAt: string
}

export interface DebtSummary {
  totalOutstanding: number
  totalOverdue: number
  pendingCount: number
  paidThisMonth: number
  overdueCount: number
}

export interface CreateDebtRequest {
  customerId: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  description: string
  amount: number
  category: "customer_debt" | "supplier_debt" | "loan" | "other"
  priority: "low" | "medium" | "high" | "urgent"
  dueDate: string
  notes?: string
}

export interface RecordPaymentRequest {
  debtId: string
  amount: number
  paymentMethod: "cash" | "card" | "bank_transfer" | "mpesa" | "other"
  reference?: string
  notes?: string
  paymentDate: string
}
