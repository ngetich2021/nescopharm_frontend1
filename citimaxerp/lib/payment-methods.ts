// Customer receipts are taken by cash, M-Pesa paybill, bank transfer or cheque. M-Pesa keeps the
// value "mpesa", the one the paybill integration (PaymentController) records.
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa Paybill" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
] as const

export type PaymentMethodValue = typeof PAYMENT_METHODS[number]["value"]

// For any flow that marks a payment as settled immediately (an instant or down payment).
// Cheques can bounce, so they go through their own pending -> approved workflow
// (ChequeController / RecordPaymentModal + lib/cheques.ts) and are kept out of these lists.
export const INSTANT_PAYMENT_METHODS = PAYMENT_METHODS.filter((m) => m.value !== "cheque")

// How a stored method reads on screen ("mpesa" -> "M-Pesa Paybill"); older values are tidied.
export function paymentMethodLabel(value?: string | null): string {
  if (!value) return "N/A"
  const known = PAYMENT_METHODS.find((m) => m.value === value.toLowerCase())
  if (known) return known.label
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
