"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { CheckCircle2, AlertCircle, Clock, RefreshCw, ChevronsUpDown, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getEtimsItem, getEtimsReference, updateEtimsItem, syncEtimsItem,
  type EtimsItemRegistration, type EtimsReference,
} from "@/lib/etims"

/**
 * Drop-in KRA fields editor for the Product page (Kenyan companies only).
 *
 * Per plan design review:
 *   - Item type is the gate (1=raw, 2=finished, 3=service).
 *   - Tax type as segmented control (5 options, fixed taxonomy).
 *   - Item class as searchable combobox over CPC codes.
 *   - "Save & Sync" button - failure state surfaces clearly with retry.
 *
 * Usage inside a product edit tab:
 *   <ProductKraTab productId={product.id} />
 */
export function ProductKraTab({ productId }: { productId: string }) {
  const [registration, setRegistration] = useState<EtimsItemRegistration | null>(null)
  const [reference, setReference] = useState<EtimsReference | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [classPickerOpen, setClassPickerOpen] = useState(false)

  // editable state
  const [itemTypeCode, setItemTypeCode] = useState<EtimsItemRegistration["item_type_code"]>(null)
  const [itemClassCode, setItemClassCode] = useState<string | null>(null)
  const [packagingUnitCode, setPackagingUnitCode] = useState<string | null>(null)
  const [quantityUnitCode, setQuantityUnitCode] = useState<string | null>(null)
  const [taxTypeCode, setTaxTypeCode] = useState<EtimsItemRegistration["tax_type_code"]>("B")
  const [countryOfOriginCode, setCountryOfOriginCode] = useState("KE")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, ref] = await Promise.all([getEtimsItem(productId), getEtimsReference()])
      setRegistration(r.registration)
      setReference(ref)
      const reg = r.registration
      setItemTypeCode(reg.item_type_code)
      setItemClassCode(reg.item_class_code)
      setPackagingUnitCode(reg.packaging_unit_code)
      setQuantityUnitCode(reg.quantity_unit_code)
      setTaxTypeCode(reg.tax_type_code ?? "B")
      setCountryOfOriginCode(reg.country_of_origin_code ?? "KE")
    } catch (e) {
      toast.error("Failed to load KRA fields", { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { void load() }, [load])

  const save = async (alsoSync = false) => {
    setSaving(true)
    try {
      const res = await updateEtimsItem(productId, {
        item_type_code: itemTypeCode ?? undefined,
        item_class_code: itemClassCode ?? undefined,
        packaging_unit_code: packagingUnitCode ?? undefined,
        quantity_unit_code: quantityUnitCode ?? undefined,
        tax_type_code: taxTypeCode ?? undefined,
        country_of_origin_code: countryOfOriginCode || undefined,
      })
      setRegistration(res.registration)
      toast.success("KRA fields saved")
      if (alsoSync) await sync()
    } catch (e) {
      toast.error("Save failed", { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const sync = async () => {
    setSyncing(true)
    try {
      await syncEtimsItem(productId)
      toast.success("Queued for sync - status will update via webhook")
      await load()
    } catch (e) {
      toast.error("Sync failed", { description: (e as Error).message })
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading KRA fields…</div>
  if (!reference) return <div className="p-4 text-sm text-destructive">Reference data unavailable.</div>

  // type-3 services skip packaging/quantity gating
  const requiresStockFields = itemTypeCode === "1" || itemTypeCode === "2"

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">KRA / eTIMS fields</h3>
        {registration && <SyncBadge status={registration.sync_status} />}
      </div>

      {registration?.last_error && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
          Last error: {registration.last_error}
        </div>
      )}

      {/* Item type - gates packaging/quantity */}
      <div>
        <Label>Item type</Label>
        <div className="flex gap-2 mt-1">
          {[
            { v: "1", label: "Raw material" },
            { v: "2", label: "Finished good" },
            { v: "3", label: "Service" },
          ].map((opt) => (
            <Button
              key={opt.v}
              type="button"
              size="sm"
              variant={itemTypeCode === opt.v ? "default" : "outline"}
              onClick={() => setItemTypeCode(opt.v as EtimsItemRegistration["item_type_code"])}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tax type - segmented control */}
      <div>
        <Label>Tax type</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {reference.tax_types.map((t) => (
            <Button
              key={t.code}
              type="button"
              size="sm"
              variant={taxTypeCode === t.code ? "default" : "outline"}
              onClick={() => setTaxTypeCode(t.code as EtimsItemRegistration["tax_type_code"])}
            >
              <span className="font-mono text-xs mr-1">{t.code}</span> {t.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Item class - searchable combobox */}
      <div>
        <Label>Item class code</Label>
        <Popover open={classPickerOpen} onOpenChange={setClassPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal mt-1">
              {itemClassCode ? (
                <span className="truncate">
                  <span className="font-mono text-xs mr-2">{itemClassCode}</span>
                  {reference.item_classes.find((c) => c.code === itemClassCode)?.name ?? ""}
                </span>
              ) : (
                <span className="text-muted-foreground">Choose an item class…</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command
              filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}
            >
              <CommandInput placeholder="Search by code or name…" />
              <CommandList>
                <CommandEmpty>No item class found.</CommandEmpty>
                <CommandGroup>
                  {reference.item_classes.map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.code} ${c.name}`}
                      onSelect={() => { setItemClassCode(c.code); setClassPickerOpen(false) }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", itemClassCode === c.code ? "opacity-100" : "opacity-0")} />
                      <span className="font-mono text-xs mr-2">{c.code}</span>
                      <span className="truncate">{c.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Packaging + quantity (gated on stockable types) */}
      {requiresStockFields && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Packaging unit</Label>
            <Select value={packagingUnitCode ?? ""} onValueChange={(v) => setPackagingUnitCode(v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {reference.packaging_units.map((u) => (
                  <SelectItem key={u.code} value={u.code}>
                    <span className="font-mono text-xs mr-2">{u.code}</span> {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity unit</Label>
            <Select value={quantityUnitCode ?? ""} onValueChange={(v) => setQuantityUnitCode(v)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {reference.quantity_units.map((u) => (
                  <SelectItem key={u.code} value={u.code}>
                    <span className="font-mono text-xs mr-2">{u.code}</span> {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div>
        <Label>Country of origin (ISO-2)</Label>
        <Input value={countryOfOriginCode} onChange={(e) => setCountryOfOriginCode(e.target.value.toUpperCase().slice(0, 2))} className="w-24 font-mono" />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
        <Button onClick={() => save(true)} disabled={saving || syncing}>
          {(saving || syncing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save & sync to eTIMS
        </Button>
      </div>
    </div>
  )
}

function SyncBadge({ status }: { status: EtimsItemRegistration["sync_status"] }) {
  if (status === "synced") return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Synced</Badge>
  if (status === "failed") return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>
  return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>
}
