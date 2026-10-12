"use client"

import { useEffect, useState } from "react"
import { getProducts } from "@/lib/products"
import { findAllByPriceCode } from "@/lib/price-codes"

// Products sharing a code are fetched once per code and reused by every line on the page.
const cache = new Map<string, Promise<any[]>>()

function loadSameCode(code: string): Promise<any[]> {
  const key = code.replace(/\s+/g, "").toUpperCase()
  if (!cache.has(key)) {
    const request = getProducts(1, 100, { search: key })
      .then(({ data }) => findAllByPriceCode(data || [], code)?.products ?? [])
      .catch(() => {
        cache.delete(key)
        return []
      })
    cache.set(key, request)
  }
  return cache.get(key)!
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
  label?: string
}

// One price code can cover several sizes at the same price, each stocked as its own product
// (NSPO 014 Tracheostomy Tubes Cuffed ID 2.5 ... 8.0). Renders nothing for single-product codes.
export function SameCodeSizeSelect({ code, productId, onPick, label }: Props) {
  const sizes = useSameCodeProducts(code)
  if (sizes.length < 2) return null
  const picked = sizes.some((p) => p.id === productId)

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
          const product = sizes.find((p) => p.id === e.target.value)
          if (product) onPick(product)
        }}
      >
        <option value="" disabled>
          {`${code} covers ${sizes.length} sizes - pick one`}
        </option>
        {sizes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({Number(p.stock_quantity ?? 0).toLocaleString()} in stock)
          </option>
        ))}
      </select>
      {!picked && <p className="text-xs text-red-600 mt-1">Pick a size</p>}
    </div>
  )
}
