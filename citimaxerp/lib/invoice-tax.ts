export type InvoiceTaxCode = "A" | "B" | "C" | "D" | "E"

export const INVOICE_TAX_OPTIONS: ReadonlyArray<{
  code: InvoiceTaxCode
  label: string
  rate: number
}> = [
  { code: "A", label: "Exempt", rate: 0 },
  { code: "B", label: "VAT 16%", rate: 16 },
  { code: "C", label: "Zero-rated", rate: 0 },
  { code: "D", label: "Non-VAT", rate: 0 },
  { code: "E", label: "VAT 8%", rate: 8 },
]

export function invoiceTaxRate(code?: InvoiceTaxCode | null): number {
  return INVOICE_TAX_OPTIONS.find((option) => option.code === code)?.rate ?? 0
}

export function invoiceTaxCodeFromRate(rate: number | string | null | undefined): InvoiceTaxCode {
  const parsedRate = Number(rate)
  if (parsedRate === 16) return "B"
  if (parsedRate === 8) return "E"
  return "D"
}

export function invoiceTaxCodeForProduct(product: {
  is_taxable?: boolean | null
  tax_rate?: number | string | null
}): InvoiceTaxCode {
  // Matches the backend: is_taxable defaults to true on every product, so
  // only an explicit rate counts - no rate set means Non-VAT, not 16%.
  if (product.is_taxable === false) return "D"
  if (product.tax_rate === null || product.tax_rate === undefined || product.tax_rate === "") return "D"

  const rate = Number(product.tax_rate)
  if (rate === 0) return "C"
  if (rate === 8) return "E"
  return "B"
}

export function vatRateForProduct(product?: { is_taxable?: boolean | null; tax_rate?: number | string | null } | null): number {
  return product ? invoiceTaxRate(invoiceTaxCodeForProduct(product)) : 0
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Mirrors OrderController: VAT is per line, added on top, and a discount
// (sent to the API as a Ksh amount) shrinks the taxable base proportionally.
export function orderTotals(items: Array<{ total_price: number; tax_rate: number }>, discountPercent: number) {
  const subtotal = round2(items.reduce((sum, item) => sum + item.total_price, 0))
  const pct = Math.min(Math.max(discountPercent || 0, 0), 100)
  const discount = round2(subtotal * pct / 100)
  const lineVat = items.reduce((sum, item) => sum + item.total_price * item.tax_rate / 100, 0)
  const tax = subtotal > 0 ? round2(lineVat * (subtotal - discount) / subtotal) : 0
  return { subtotal, discount, tax, total: round2(subtotal - discount + tax) }
}
