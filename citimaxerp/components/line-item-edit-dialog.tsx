"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getBatches } from "@/lib/batches"
import { quickEditProduct, type QuickEditPayload } from "@/lib/products"
import { DEFAULT_UNIT, priceOptionsFor } from "@/lib/price-codes"
import { sizedName } from "@/lib/product-sizes"

export interface LineEditResult {
  product: any
  // What the line should now show and charge.
  description: string
  unitPrice: number
  priceUnit: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: any
  variantId?: string | null
  priceCode?: string | null
  onSaved: (result: LineEditResult) => void
}

const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "")

// The pen on a quote/order line. It edits the item itself - name and description on the product,
// unit and price on the price-list entry the line uses, expiry on the batches - so the change is
// the same on the Products page, the price lists, batch tracking and every other document.
export function LineItemEditDialog({ open, onOpenChange, product, variantId, priceCode, onSaved }: Props) {
  const variant = variantId ? (product?.variants ?? []).find((v: any) => v.id === variantId) : undefined
  const option = priceCode ? priceOptionsFor(product, variant).find((o) => o.code === priceCode) : undefined

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [unit, setUnit] = useState("")
  const [price, setPrice] = useState("")
  const [batches, setBatches] = useState<{ id: string; batch_number: string; quantity_available: number; expiry_date: string; original: string }[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !product) return
    setName(product.name ?? "")
    setDescription(product.description ?? "")
    setUnit(option?.unit ?? DEFAULT_UNIT)
    setPrice(option ? String(option.price) : "")
    setError(null)
    setBatches([])
    setLoadingBatches(true)
    let cancelled = false
    getBatches({ product_id: product.id, per_page: 100, sort_by: "expiry_date", sort_order: "asc" })
      .then(({ data }) => {
        if (cancelled) return
        setBatches(
          data
            .filter((b: any) => (variantId ? b.variant_id === variantId : true))
            .map((b: any) => ({ id: b.id, batch_number: b.batch_number, quantity_available: Number(b.quantity_available ?? 0), expiry_date: day(b.expiry_date), original: day(b.expiry_date) })),
        )
      })
      .catch(() => !cancelled && setError("Could not load this item's batches - expiry dates can't be edited right now."))
      .finally(() => !cancelled && setLoadingBatches(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id, variantId, priceCode])

  const save = async () => {
    if (!name.trim()) {
      setError("Item name can't be empty.")
      return
    }
    const payload: QuickEditPayload = { variant_id: variantId ?? null }
    if (name.trim() !== (product.name ?? "")) payload.name = name.trim()
    if (description.trim() !== (product.description ?? "")) payload.description = description.trim() || null
    if (option) {
      payload.price_code = option.code
      if (price !== "" && Number(price) !== option.price) payload.price = Number(price)
      if (unit.trim() && unit.trim() !== option.unit) payload.unit_of_measure = unit.trim()
    }
    const changedBatches = batches.filter((b) => b.expiry_date !== b.original).map((b) => ({ id: b.id, expiry_date: b.expiry_date || null }))
    if (changedBatches.length) payload.batches = changedBatches

    setSaving(true)
    setError(null)
    try {
      const { data } = await quickEditProduct(product.id, payload)
      const fresh = data ?? product
      const freshVariant = variantId ? (fresh.variants ?? []).find((v: any) => v.id === variantId) : undefined
      const freshOption = option ? priceOptionsFor(fresh, freshVariant).find((o) => o.code === option.code) : undefined
      onSaved({
        product: fresh,
        description: freshVariant ? sizedName(fresh.name, freshVariant.name) : fresh.name,
        unitPrice: freshOption?.price ?? Number(price || 0),
        priceUnit: freshOption?.unit ?? (unit.trim() || DEFAULT_UNIT),
      })
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message || "Could not save the changes.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
          <DialogDescription>
            Changes are saved to the item itself, so they show everywhere: the Products page, price lists, batch tracking and other quotes and orders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="line-edit-name">Item name</Label>
            <Input id="line-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            {variant && <p className="text-xs text-gray-500">Size "{variant.name}" is added on the line: {sizedName(name, variant.name)}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="line-edit-description">Description</Label>
            <Textarea id="line-edit-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {option ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="line-edit-unit">Unit of measure ({option.code})</Label>
                <Input id="line-edit-unit" value={unit} placeholder="e.g. Per pack of 100's" onChange={(e) => setUnit(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="line-edit-price">Price ({option.code}, Ksh)</Label>
                <Input id="line-edit-price" type="number" step="0.01" min="0" className="text-right" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-gray-500">
                Updates the {option.code} price list. To give only this customer a different price, change the price on the line instead.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">This line has no price-list code, so its unit and price are set on the line itself.</p>
          )}

          <div className="space-y-1">
            <Label>Expiry dates</Label>
            {loadingBatches ? (
              <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading batches...</p>
            ) : batches.length === 0 ? (
              <p className="text-sm text-gray-500">No batches recorded for this item.</p>
            ) : (
              <div className="rounded border divide-y">
                {batches.map((b, i) => (
                  <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <span className="flex-1 min-w-0 truncate">
                      Batch <span className="font-mono">{b.batch_number}</span>
                      <span className="ml-1 text-xs text-gray-500">({b.quantity_available.toLocaleString()} pcs)</span>
                    </span>
                    <Input
                      type="date"
                      className="h-8 w-40"
                      aria-label={`Expiry for batch ${b.batch_number}`}
                      value={b.expiry_date}
                      onChange={(e) => setBatches((prev) => prev.map((x, j) => (j === i ? { ...x, expiry_date: e.target.value } : x)))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
