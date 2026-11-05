// A sale is known by its invoice's NSK number wherever it is referred to. The ORD number is only for
// an order that has no NSK number yet, and for the order's own pages.

type OrderLike = { order_number?: string | null; invoice?: { invoice_number?: string | null } | null } | null | undefined

/** NSK/0438, or ORD-0466 until the order has been invoiced. */
export function orderRef(order: OrderLike): string | undefined {
  const invoiceNumber = order?.invoice?.invoice_number
  if (invoiceNumber?.startsWith("NSK/")) return invoiceNumber
  return order?.order_number ?? undefined
}
