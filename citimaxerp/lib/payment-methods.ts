// Customer receipts are taken by cash, M-Pesa paybill or bank transfer only. M-Pesa keeps the
// value "mpesa", the one the paybill integration (PaymentController) records.
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa Paybill" },
  { value: "bank_transfer", label: "Bank Transfer" },
] as const

export type PaymentMethodValue = typeof PAYMENT_METHODS[number]["value"]

// All three settle on the spot, so any of them can be an instant or down payment.
export const INSTANT_PAYMENT_METHODS = PAYMENT_METHODS

// How a stored method reads on screen ("mpesa" -> "M-Pesa Paybill"); older values are tidied.
export function paymentMethodLabel(value?: string | null): string {
  if (!value) return "N/A"
  const known = PAYMENT_METHODS.find((m) => m.value === value.toLowerCase())
  if (known) return known.label
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
