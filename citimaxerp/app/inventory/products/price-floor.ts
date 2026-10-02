// Client-side mirror of ProductController::collectPriceFloorErrors - keep the two in sync.
// Every price must exceed cost + shipping + logistics + margin; variants use their own cost when set.

interface PriceFloorInput {
  hasVariations: boolean
  unitCost: number
  shippingCost: number
  logisticsCost: number
  marginAmount: number
  price: number
  lastPrice?: number
  tiers: { tier_name: string; price: number }[]
  variants: { name: string; sku?: string; price: number; cost: number; price_tiers?: { tier_name: string; price: number }[] }[]
}

export function priceFloorErrors(input: PriceFloorInput): string[] {
  const overheads = input.shippingCost + input.logisticsCost + input.marginAmount
  const productMin = input.unitCost + overheads
  const errors: string[] = []
  const check = (label: string, value: number, min: number) => {
    if (value <= min) {
      errors.push(`${label} (${value.toFixed(2)}) must be greater than the minimum valid price of KES ${min.toFixed(2)}`)
    }
  }

  // A variation product is priced per variant, so an unset parent price is fine.
  if (!(input.hasVariations && input.price <= 0)) check("NSPV (selling price)", input.price, productMin)
  // A last price of 0 means "no previous price"; a blank tier is simply not set yet.
  if (input.lastPrice && input.lastPrice > 0) check("Last price", input.lastPrice, productMin)
  input.tiers.filter(t => t.tier_name.trim() && t.price > 0).forEach(t => check(t.tier_name, t.price, productMin))

  if (input.hasVariations) {
    input.variants
      .filter(v => v.name.trim() || v.sku?.trim() || v.price)
      .forEach(v => {
        const min = (v.cost > 0 ? v.cost : input.unitCost) + overheads
        check(`Variant "${v.name}" NSPV`, v.price, min)
        ;(v.price_tiers ?? []).filter(t => t.tier_name.trim() && t.price > 0).forEach(t => check(`Variant "${v.name}" ${t.tier_name}`, t.price, min))
      })
  }

  return errors
}
