import { piecesPerPack } from "@/lib/price-codes"

// Same rule the server applies when an order is saved: packs ordered x pieces per pack
// of the line's price-list unit must not exceed the pieces in stock.
export function stockCheck(quantity: number, priceUnit: string | null | undefined, available: number | null | undefined) {
  const perPack = piecesPerPack(priceUnit) ?? 1
  const needed = Math.round((Number(quantity) || 0) * perPack)
  const inStock = Math.max(0, Math.floor(Number(available ?? 0)))
  return { perPack, needed, inStock, maxPacks: Math.floor(inStock / perPack), short: available != null && needed > inStock }
}

export function StockHint({ quantity, priceUnit, available }: { quantity: number; priceUnit?: string | null; available?: number | null }) {
  if (available == null) return null
  const { perPack, inStock, maxPacks, short } = stockCheck(quantity, priceUnit, available)
  const stockText = perPack > 1
    ? `${inStock.toLocaleString()} pcs in stock (max ${maxPacks.toLocaleString()} packs)`
    : `${inStock.toLocaleString()} in stock`
  return (
    <div className={`mt-1 text-xs ${short ? "font-medium text-red-600" : "text-gray-500"}`}>
      {short ? `Not enough stock: ${stockText}` : stockText}
    </div>
  )
}
