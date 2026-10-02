"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import { DEFAULT_PRICE_CODE, TIER_PRICE_CODES } from "@/lib/price-codes"
import type { PriceTierInput } from "@/lib/products"

interface Props {
  idPrefix?: string
  title?: string
  nspv: string
  onNspvChange: (value: string) => void
  tiers: PriceTierInput[]
  onTiersChange: (tiers: PriceTierInput[]) => void
}

const isFixedCode = (name: string) => (TIER_PRICE_CODES as readonly string[]).includes(name)

export function PriceCodeFields({ idPrefix = "", title = "Prices", nspv, onNspvChange, tiers, onTiersChange }: Props) {
  const update = (index: number, patch: Partial<PriceTierInput>) =>
    onTiersChange(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)))

  const fixed = tiers.map((t, i) => ({ t, i })).filter(({ t }) => isFixedCode(t.tier_name))
  const extra = tiers.map((t, i) => ({ t, i })).filter(({ t }) => !isFixedCode(t.tier_name))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground">{DEFAULT_PRICE_CODE} is the default price. The others are optional and can be filled in later.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onTiersChange([...tiers, { tier_name: "", price: 0 }])}>
          <Plus className="h-4 w-4 mr-1" />
          Add Price
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}price`}>{DEFAULT_PRICE_CODE}</Label>
          <Input id={`${idPrefix}price`} type="number" step="0.01" value={nspv} onChange={(e) => onNspvChange(e.target.value)} placeholder="0.00" />
        </div>
        {fixed.map(({ t, i }) => (
          <div key={t.tier_name} className="space-y-2">
            <Label htmlFor={`${idPrefix}tier-${t.tier_name}`}>{t.tier_name}</Label>
            <Input
              id={`${idPrefix}tier-${t.tier_name}`}
              type="number"
              step="0.01"
              value={t.price || ""}
              onChange={(e) => update(i, { price: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
          </div>
        ))}
      </div>

      {extra.length > 0 && (
        <div className="space-y-2">
          {extra.map(({ t, i }) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={t.tier_name}
                onChange={(e) => update(i, { tier_name: e.target.value })}
                placeholder="Price name, e.g. NSPX"
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                value={t.price || ""}
                onChange={(e) => update(i, { price: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-32"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => onTiersChange(tiers.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
