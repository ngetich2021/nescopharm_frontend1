export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "paybill", label: "Paybill" },
  { value: "bank_transfer", label: "Bank Transfer" },
] as const

export type PaymentMethodValue = typeof PAYMENT_METHODS[number]["value"]

// For any flow that marks a payment as settled immediately (an "instant"
// payment, or a down payment that unlocks a credit sale on the spot). Cheques
// can bounce, so they go through their own pending -> approved workflow
// (see ChequeController / RecordPaymentModal + lib/cheques.ts) instead of
// ever being recorded as instantly completed - keep them out of these lists.
export const INSTANT_PAYMENT_METHODS = PAYMENT_METHODS.filter((m) => m.value !== "cheque")
