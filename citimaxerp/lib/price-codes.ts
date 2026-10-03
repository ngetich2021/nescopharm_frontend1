// NSPV is the default price and is mirrored to products.price; every list is stored as a price tier
// with its own item code and unit of measure, so a line can be priced by typing e.g. "NSPD 001".
export const DEFAULT_PRICE_CODE = "NSPV"
// Price lists that give no unit of measure are sold in pieces.
export const DEFAULT_UNIT = "pcs"
export const PRICE_LIST_CODES = ["NSPV", "NSPH", "NSPO", "NSPD"] as const

export interface PriceTierRow {
  id?: string
  tier_name: string
  item_code: string
  price: number
  unit_of_measure: string
}

export interface PriceOption {
  // What is stored on the line and printed on the pricing copy, e.g. "NSPD 001".
  code: string
  list: string
  price: number
  unit: string | null
}

type TierLike = {
  id?: string
  tier_name: string
  item_code?: string | null
  price: number | string
  unit_of_measure?: string | null
}

export const priceCode = (list: string, itemCode?: string | null) => `${list} ${itemCode ?? ""}`.trim()

const normalizeCode = (value: string) => value.replace(/\s+/g, "").toUpperCase()

// Fixed NSPV/NSPH/NSPO/NSPD rows first (blank when unset), then any extra lists.
// NSPV's price comes from products.price when no NSPV tier exists yet.
export function tierRowsForForm(tiers: TierLike[] | undefined, nspvPrice?: number | string | null): PriceTierRow[] {
  const list = tiers ?? []
  const toRow = (t: TierLike): PriceTierRow => ({
    id: t.id,
    tier_name: t.tier_name,
    item_code: t.item_code ?? "",
    price: Number(t.price) || 0,
    unit_of_measure: t.unit_of_measure ?? "",
  })
  const fixed = PRICE_LIST_CODES.map((code) => {
    const found = list.find((t) => t.tier_name === code)
    if (found) return toRow(found)
    const price = code === DEFAULT_PRICE_CODE ? Number(nspvPrice) || 0 : 0
    return { tier_name: code, item_code: "", price, unit_of_measure: "" }
  })
  const others = list.filter((t) => !(PRICE_LIST_CODES as readonly string[]).includes(t.tier_name)).map(toRow)
  return [...fixed, ...others]
}

// Rows worth saving: a list name and a price.
export const tiersForSave = (rows: PriceTierRow[]) =>
  rows
    .filter((t) => t.tier_name.trim() && t.price > 0)
    .map((t) => ({
      ...(t.id ? { id: t.id } : {}),
      tier_name: t.tier_name.trim(),
      item_code: t.item_code.trim() || null,
      price: t.price,
      unit_of_measure: t.unit_of_measure.trim() || DEFAULT_UNIT,
    }))

// Every price a line item can be set to. A product with no price-list entries at all falls back to
// products.price as NSPV; one that is only on e.g. the NSPO list just offers its NSPO price.
export function priceOptionsFor(product: any, variant?: any): PriceOption[] {
  const tiers = ((variant ? variant.price_tiers : product?.price_tiers) ?? []) as TierLike[]
  const options: PriceOption[] = []
  if (tiers.length === 0) {
    const base = Number(variant ? variant.price : product?.price ?? 0)
    if (base > 0) options.push({ code: DEFAULT_PRICE_CODE, list: DEFAULT_PRICE_CODE, price: base, unit: DEFAULT_UNIT })
  }
  for (const t of tiers) {
    const price = Number(t.price)
    if (!t.tier_name || !(price > 0)) continue
    options.push({ code: priceCode(t.tier_name, t.item_code), list: t.tier_name, price, unit: t.unit_of_measure || DEFAULT_UNIT })
  }
  return options.sort((a, b) => listOrder(a.list) - listOrder(b.list))
}

// The price lists a product is on, e.g. ["NSPV", "NSPH"].
export const priceListsFor = (product: any): string[] =>
  Array.from(new Set(priceOptionsFor(product).map((o) => o.list)))

const listOrder = (list: string) => {
  const i = (PRICE_LIST_CODES as readonly string[]).indexOf(list)
  return i === -1 ? PRICE_LIST_CODES.length : i
}

export const defaultPriceOption = (product: any, variant?: any): PriceOption | undefined => {
  const options = priceOptionsFor(product, variant)
  return options.find((o) => o.list === DEFAULT_PRICE_CODE) ?? options[0]
}

// Price codes among the given products that contain the typed text, e.g. "nspd 00" -> NSPD 001, NSPD 002...
export function priceCodeHits(products: any[], query: string, limit = 8): { product: any; option: PriceOption }[] {
  const wanted = normalizeCode(query)
  if (wanted.length < 2) return []
  const hits: { product: any; option: PriceOption }[] = []
  for (const product of products) {
    for (const option of priceOptionsFor(product)) {
      if (option.code !== option.list && normalizeCode(option.code).includes(wanted)) hits.push({ product, option })
    }
  }
  return hits.sort((a, b) => a.option.code.localeCompare(b.option.code, undefined, { numeric: true })).slice(0, limit)
}

export const describeOption = (o: PriceOption) =>
  `${o.code} - ${o.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${o.unit ? ` / ${o.unit}` : ""}`

// "Code No." printed on quotes/invoices: the price-list code used (e.g. "NSPD 001"), else the item number.
export function documentCode(priceLabel: string | null | undefined, itemNumber: number | string | null | undefined): string {
  if (priceLabel && /\d/.test(priceLabel)) return priceLabel
  return itemNumber != null && itemNumber !== "" ? String(itemNumber) : "-"
}

// Pieces in one pack from a unit like "Per pack of 100's" or "Box of 50"; null for a single piece.
export function piecesPerPack(unit: string | null | undefined): number | null {
  const m = unit?.match(/(\d[\d,]*)/)
  const n = m ? parseInt(m[1].replace(/,/g, ""), 10) : NaN
  return n > 1 ? n : null
}

// The unit a dispatch line was sold in: the order line's, else the product's tier for that code.
export function dispatchItemUnit(item: any): string | null {
  if (item?.order_item?.price_unit) return item.order_item.price_unit
  const code = item?.order_item?.price_label
  const option = priceOptionsFor(item?.product).find((o) => o.code === code)
  return option?.unit ?? null
}

// Code for a dispatch line: the one it was sold under (e.g. "NSPH 001"), else the item's own codes.
export function dispatchItemCode(item: any): string {
  const sold = item?.order_item?.price_label
  if (sold && /\d/.test(sold)) return sold
  const codes = priceOptionsFor(item?.product).map((o) => o.code).filter((c) => /\d/.test(c))
  if (codes.length) return codes.join(" / ")
  return documentCode(null, item?.product?.item_number)
}

// Finds the product and price for a typed code such as "NSPD 001" or "nspd001".
export function findByPriceCode(products: any[], query: string): { product: any; option: PriceOption } | undefined {
  const wanted = normalizeCode(query)
  if (!wanted) return undefined
  for (const product of products) {
    const option = priceOptionsFor(product).find((o) => normalizeCode(o.code) === wanted)
    if (option) return { product, option }
  }
  return undefined
}
