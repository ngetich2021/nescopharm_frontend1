"use client"

import { useEffect, useState } from "react"
import { getProducts } from "@/lib/products"
import { findAllByPriceCode } from "@/lib/price-codes"
import { activeSizesOf, sizedName } from "@/lib/product-sizes"

// Lines rendering together share one request per code, but nothing is kept once it settles, so a
// size or product added to the catalogue is pickable the next time a code is looked up.
const inFlight = new Map<string, Promise<any[]>>()

function loadSameCode(code: string): Promise<any[]> {
  const key = code.replace(/\s+/g, "").toUpperCase()
  if (!inFlight.has(key)) {
    const request = getProducts(1, 100, { search: key })
      .then(({ data }) => findAllByPriceCode(data || [], code)?.products ?? [])
      .catch(() => [] as any[])
      .finally(() => inFlight.delete(key))
    inFlight.set(key, request)
  }
  return inFlight.get(key)!
}

interface SizeOption {
  value: string
  text: string
  stock: number
  product: any
  size?: { id: string; name: string }
}

export function useSameCodeProducts(code: string | null | undefined) {
  const [products, setProducts] = useState<any[]>([])
  useEffect(() => {
    let cancelled = false
    if (!code || !/\d/.test(code)) {
      setProducts([])
      return
    }
    loadSameCode(code).then((list) => !cancelled && setProducts(list))
    return () => {
      cancelled = true
    }
  }, [code])
  return products
}

interface Props {
  code: string | null | undefined
  productId: string | null | undefined
  onPick: (product: any) => void
  // When given, a product stocked in sizes is listed once per size, so "G10" can be picked
  // straight from the list instead of hiding behind "Surgical Blades Disposable G10,g11,...".
  onPickSize?: (product: any, size: { id: string; name: string }) => void
  label?: string
}

// One price code can cover several sizes at the same price, each stocked as its own product
// (NSPO 014 Tracheostomy Tubes Cuffed ID 2.5 ... 8.0). Renders nothing for single-product codes.
export function SameCodeSizeSelect({ code, productId, onPick, onPickSize, label }: Props) {
  const products = useSameCodeProducts(code)
  const options: SizeOption[] = products.flatMap((p): SizeOption[] => {
    const sizes = onPickSize ? activeSizesOf(p) : []
    if (sizes.length === 0) return [{ value: String(p.id), text: p.name, stock: Number(p.stock_quantity ?? 0), product: p }]
    return sizes.map((s) => ({ value: `${p.id}:${s.id}`, text: sizedName(p.name, s.name), stock: s.stock_quantity, product: p, size: s }))
  })
  if (options.length < 2) return null
  const picked = options.some((o) => o.value === productId)

  return (
    <div className="mt-1">
      <select
        value={picked ? String(productId) : ""}
        aria-label={label ?? `Size for ${code}`}
        className={
          picked
            ? "h-7 w-auto max-w-full rounded border border-input bg-background px-1 text-xs text-gray-700"
            : "h-9 w-full rounded-md border border-red-500 bg-background px-2 text-sm"
        }
        onChange={(e) => {
          const option = options.find((o) => o.value === e.target.value)
          if (!option) return
          if (option.size && onPickSize) onPickSize(option.product, option.size)
          else onPick(option.product)
        }}
      >
        <option value="" disabled>
          {`${code} covers ${options.length} sizes - pick one`}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text} ({Number(o.stock ?? 0).toLocaleString()} in stock)
          </option>
        ))}
      </select>
      {!picked && <p className="text-xs text-red-600 mt-1">Pick a size</p>}
    </div>
  )
}
