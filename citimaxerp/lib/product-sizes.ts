// A "size" is a product variant that exists only to separate stock: every size of an item
// shares the item's price code (e.g. NSPO 002) and therefore its price. Sizes exist so staff
// can say which one a line is for, and so batches can be received and dispatched per size.

export interface SizeRow {
  id?: string
  name: string
  sku: string
  stock_quantity?: number
}

// Catalogue descriptions often carry the sizes inline, e.g.
// "Endobronchial Tubes Left Fr26,28,31" or "Et Tubes Cuffed Id 2.0,2.5,3".
// A unit glued to the first number (Fr) belongs on every label; one separated by a
// space (Id) is part of the item name, not the size.
const SIZE_LIST = /([A-Za-z]+)?(\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)+)\s*$/

const SIZE_LIST_TAIL = /\s*[A-Za-z]*\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)+\s*$/

// The item name for one size: "Endobronchial Tubes Left Fr26,28,31" + "Fr26" -> "Endobronchial Tubes Left Fr26".
export function sizedName(productName: string | null | undefined, size: string | null | undefined): string {
  const name = (productName ?? "").trim()
  const s = (size ?? "").trim()
  if (!s) return name
  const base = name.replace(SIZE_LIST_TAIL, "").trim()
  return `${base || name} ${s}`
}

// Display name for a line that may carry a size (variant).
export const itemDisplayName = (product: any, variant?: any, fallback?: string | null): string =>
  variant?.name
    ? variant.display_name || sizedName(product?.name ?? fallback, variant.name)
    : product?.name ?? fallback ?? ""

export function parseSizesFromName(name: string): string[] {
  const match = SIZE_LIST.exec((name ?? "").trim())
  if (!match) return []
  const prefix = match[1] ?? ""
  return match[2].split(",").map((value) => `${prefix}${value.trim()}`)
}

export const sizeRowsFor = (product: any): SizeRow[] =>
  (product?.variants ?? []).map((v: any) => ({
    id: v.id ? String(v.id) : undefined,
    name: v.name ?? "",
    sku: v.sku ?? "",
    stock_quantity: Number(v.stock_quantity ?? 0),
  }))

// Sizes a line can actually be placed against. A size deactivated after it ran out is
// hidden here but still referenced by the quotes and dispatches that already used it.
export const activeSizesOf = (product: any): { id: string; name: string; stock_quantity: number }[] =>
  !product?.has_variations || !Array.isArray(product?.variants)
    ? []
    : product.variants
        .filter((v: any) => v?.id && v.is_active !== false)
        .map((v: any) => ({
          id: String(v.id),
          name: v.name ?? "",
          stock_quantity: Number(v.stock_quantity ?? 0),
        }))

// Only rows with a label are worth saving; the backend skips the rest anyway.
export const sizesForSave = (rows: SizeRow[]) =>
  rows
    .filter((s) => s.name.trim())
    .map((s) => ({
      ...(s.id ? { id: s.id } : {}),
      name: s.name.trim(),
      sku: s.sku.trim() || null,
      is_active: true,
    }))
