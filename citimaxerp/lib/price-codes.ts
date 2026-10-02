// NSPV is the product's selling price (products.price); the others are stored as named price tiers.
export const DEFAULT_PRICE_CODE = "NSPV"
export const TIER_PRICE_CODES = ["NSPH", "NSPO", "NSPD"] as const

export interface PriceOption {
  code: string
  price: number
}

type TierLike = { id?: string; tier_name: string; price: number | string }

// Fixed NSPH/NSPO/NSPD rows first (blank when unset), then any other legacy tiers.
export function tierRowsForForm<T extends TierLike>(tiers: T[] | undefined): { id?: string; tier_name: string; price: number }[] {
  const list = tiers ?? []
  const fixed = TIER_PRICE_CODES.map((code) => {
    const found = list.find((t) => t.tier_name === code)
    return { id: found?.id, tier_name: code, price: found ? Number(found.price) || 0 : 0 }
  })
  const others = list
    .filter((t) => !(TIER_PRICE_CODES as readonly string[]).includes(t.tier_name))
    .map((t) => ({ id: t.id, tier_name: t.tier_name, price: Number(t.price) || 0 }))
  return [...fixed, ...others]
}

// Every price a line item can be set to: NSPV plus each filled tier - a variant's own prices when a variant is chosen.
export function priceOptionsFor(product: any, variant?: any): PriceOption[] {
  const options: PriceOption[] = []
  const base = Number(variant ? variant.price : product?.price ?? 0)
  if (base > 0) options.push({ code: DEFAULT_PRICE_CODE, price: base })
  const tiers = (variant ? variant.price_tiers : product?.price_tiers) ?? []
  for (const t of tiers as TierLike[]) {
    const price = Number(t.price)
    if (t.tier_name && price > 0) options.push({ code: t.tier_name, price })
  }
  return options
}
