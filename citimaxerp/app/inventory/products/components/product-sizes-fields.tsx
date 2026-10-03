"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Wand2 } from "lucide-react"
import { parseSizesFromName, type SizeRow } from "@/lib/product-sizes"

interface Props {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  sizes: SizeRow[]
  onSizesChange: (sizes: SizeRow[]) => void
  productName: string
}

export function ProductSizesFields({ enabled, onEnabledChange, sizes, onSizesChange, productName }: Props) {
  const update = (index: number, patch: Partial<SizeRow>) =>
    onSizesChange(sizes.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const suggestions = parseSizesFromName(productName)
  const existing = new Set(sizes.map((s) => s.name.trim().toLowerCase()))
  const missing = suggestions.filter((s) => !existing.has(s.toLowerCase()))

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Switch id="hasSizes" checked={enabled} onCheckedChange={onEnabledChange} />
        <Label htmlFor="hasSizes">This item comes in several sizes</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        All sizes share the item&apos;s price code and price - sizes only decide which stock and which batch goes out.
      </p>

      {enabled && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSizesChange([...sizes, { name: "", sku: "" }])}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add size
            </Button>
            {missing.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSizesChange([...sizes, ...missing.map((name) => ({ name, sku: "" }))])}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                Add {missing.length} from description
              </Button>
            )}
          </div>

          {sizes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sizes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2 font-medium w-40">Size</th>
                    <th className="py-1 pr-2 font-medium w-40">SKU (optional)</th>
                    <th className="py-1 pr-2 font-medium w-24">In stock</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size, i) => (
                    <tr key={size.id ?? `new-${i}`}>
                      <td className="py-1 pr-2">
                        <Input
                          value={size.name}
                          onChange={(e) => update(i, { name: e.target.value })}
                          placeholder="e.g. Fr28"
                          aria-label={`Size ${i + 1} label`}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          value={size.sku}
                          onChange={(e) => update(i, { sku: e.target.value })}
                          placeholder="Optional"
                          aria-label={`Size ${i + 1} SKU`}
                        />
                      </td>
                      <td className="py-1 pr-2 text-muted-foreground">
                        {size.id ? (size.stock_quantity ?? 0).toLocaleString() : "-"}
                      </td>
                      <td className="py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onSizesChange(sizes.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-2">
                Stock per size is set by receiving batches, not here. Removing a size that still holds
                stock deactivates it rather than deleting it.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
