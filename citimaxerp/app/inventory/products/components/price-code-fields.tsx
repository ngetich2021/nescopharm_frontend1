"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import { PRICE_LIST_CODES, type PriceTierRow } from "@/lib/price-codes"

interface Props {
  tiers: PriceTierRow[]
  onTiersChange: (tiers: PriceTierRow[]) => void
}

const isFixedList = (name: string) => (PRICE_LIST_CODES as readonly string[]).includes(name)

export function PriceCodeFields({ tiers, onTiersChange }: Props) {
  const update = (index: number, patch: Partial<PriceTierRow>) =>
    onTiersChange(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-sm">Prices</h4>
          <p className="text-xs text-muted-foreground">
            NSPV is the default price. Fill in only the lists that apply - the code (e.g. NSPD 001) is what staff type on quotes, orders and invoices.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onTiersChange([...tiers, { tier_name: "", item_code: "", price: 0, unit_of_measure: "" }])}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Price
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium w-28">Price list</th>
              <th className="py-1 pr-2 font-medium w-32">Item code</th>
              <th className="py-1 pr-2 font-medium w-32">Price</th>
              <th className="py-1 pr-2 font-medium">Unit of measure</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((t, i) => {
              const fixed = isFixedList(t.tier_name)
              return (
                <tr key={fixed ? t.tier_name : `extra-${i}`}>
                  <td className="py-1 pr-2">
                    {fixed ? (
                      <span className="font-semibold">{t.tier_name}</span>
                    ) : (
                      <Input
                        value={t.tier_name}
                        onChange={(e) => update(i, { tier_name: e.target.value.toUpperCase() })}
                        placeholder="e.g. NSPX"
                        aria-label="Price list name"
                      />
                    )}
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      value={t.item_code}
                      onChange={(e) => update(i, { item_code: e.target.value })}
                      placeholder="001"
                      aria-label={`${t.tier_name || "Price"} item code`}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={t.price || ""}
                      onChange={(e) => update(i, { price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      aria-label={`${t.tier_name || "Price"} price`}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      value={t.unit_of_measure}
                      onChange={(e) => update(i, { unit_of_measure: e.target.value })}
                      placeholder="pcs"
                      aria-label={`${t.tier_name || "Price"} unit of measure`}
                    />
                  </td>
                  <td className="py-1">
                    {!fixed && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => onTiersChange(tiers.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
