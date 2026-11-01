"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Loader2, PackagePlus, Search } from "lucide-react"
import { getProducts, type Product } from "@/lib/products"
import { checkCountBatch } from "@/lib/stock-counts"
import type { StockCountItem } from "@/app/types"

// Stock found during a count that is on no line: the product (and size), the batch number on the
// pack, its expiry and how many. If the batch number is one of the product's batches, approving
// the count corrects that batch; if not, a new batch is created - so expiry is then required.

export type FoundStock = Pick<StockCountItem, "product_id" | "variant_id" | "product_name" | "batch_number" | "expiry_date" | "counted_quantity"> & {
  existing_batch: { id: string; quantity_available: number; expiry_date: string | null } | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (found: FoundStock) => void
}

export function FoundStockDialog({ open, onOpenChange, onAdd }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [variantId, setVariantId] = useState<string>("")
  const [batchNumber, setBatchNumber] = useState("")
  const [expiry, setExpiry] = useState("")
  const [quantity, setQuantity] = useState("")
  const [check, setCheck] = useState<Awaited<ReturnType<typeof checkCountBatch>> | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setProduct(null); setVariantId(""); setBatchNumber(""); setExpiry(""); setQuantity(""); setCheck(null)
    }
  }, [open])

  // Product search (description, item no. or price-list code).
  useEffect(() => {
    if (product || query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try { setResults((await getProducts(1, 12, { search: query.trim() })).data) } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query, product])

  const variants = (product?.variants ?? []) as any[]
  const needsVariant = !!product?.has_variations && variants.length > 0

  // Is the batch number already one of this product's batches?
  useEffect(() => {
    setCheck(null)
    if (!product || !batchNumber.trim() || (needsVariant && !variantId)) return
    const t = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await checkCountBatch({ product_id: product.id, variant_id: variantId || null, batch_number: batchNumber.trim() })
        setCheck(res)
        if (res.exists && res.batch?.expiry_date) setExpiry(res.batch.expiry_date)
      } catch { setCheck(null) }
      finally { setChecking(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [product, variantId, batchNumber, needsVariant])

  const qty = Number(quantity)
  const isNew = check ? !check.exists : null
  const valid = !!product && (!needsVariant || !!variantId) && batchNumber.trim() !== "" && check !== null
    && Number.isInteger(qty) && qty > 0 && (!isNew || expiry !== "")

  const add = () => {
    if (!product || !valid) return
    const variant = variants.find((v) => String(v.id) === variantId)
    onAdd({
      product_id: product.id,
      variant_id: variant ? String(variant.id) : null,
      product_name: variant ? `${product.name} - ${variant.name}` : product.name,
      batch_number: batchNumber.trim(),
      expiry_date: expiry || null,
      counted_quantity: qty,
      existing_batch: check?.exists && check.batch ? { id: check.batch.id, quantity_available: check.batch.quantity_available, expiry_date: check.batch.expiry_date } : null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" /> Add found stock</DialogTitle>
          <DialogDescription>
            Stock on the shelf that is on no line of this count. Enter the batch number printed on the pack: an existing
            batch is corrected on approval, a new batch number creates a new batch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product</Label>
            {product ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{product.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setProduct(null); setVariantId(""); setCheck(null) }}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search description, item no. or code" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
                {(searching || results.length > 0) && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-white shadow">
                    {searching && <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Searching...</div>}
                    {results.map((p) => (
                      <button key={p.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => { setProduct(p); setResults([]) }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {needsVariant && (
            <div className="space-y-1.5">
              <Label>Size</Label>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger><SelectValue placeholder="Choose the size" /></SelectTrigger>
                <SelectContent>
                  {variants.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Batch number</Label>
              <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="As on the pack" disabled={!product} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity found</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={!product} />
            </div>
          </div>

          {checking && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Checking the batch...</p>}
          {check?.exists && check.batch && (
            <p className="flex items-start gap-2 rounded-md bg-blue-50 p-2 text-xs text-blue-800">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Existing batch {check.batch.batch_number}: the system holds {check.batch.quantity_available}
              {check.batch.expiry_date ? `, expires ${check.batch.expiry_date}` : ""}. What is counted for it in this count becomes its quantity on approval.
            </p>
          )}
          {check && !check.exists && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              New batch: it will be created with this quantity when the count is approved. Enter its expiry date.
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Expiry date{isNew ? " (required for a new batch)" : ""}</Label>
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} disabled={!product || !!check?.exists} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={add} disabled={!valid}>Add to count</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
