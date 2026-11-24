"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Save, Check, X } from "lucide-react"
import {
  Asset,
  CreateAssetPayload,
  createAsset,
  updateAsset,
  getAssetOptions,
  createAssetOption,
  AssetOptionType,
  ASSET_CLASSES,
  ASSET_STATUSES,
  DEPRECIATION_COMMENCEMENT,
} from "@/lib/assets"
import { useToast } from "@/hooks/use-toast"

interface AssetSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  asset?: Asset | null
}

const EMPTY: CreateAssetPayload = {
  name: "",
  category: "",
  serial_number: "",
  location: "",
  quantity: 1,
  purchase_cost: 0,
  total_cost: 0,
  notes: "",
  is_active: true,
  asset_code: "",
  tag_number: "",
  assigned_to: "",
  supplier: "",
  invoice_number: "",
  purchase_date: "",
  date_basis: "",
  depreciation_rate: undefined,
  useful_life_years: undefined,
  residual_percent: 0,
  depreciation_start_date: "",
  status: "In Use",
}

const MONEY = new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const later = (a: string, b: string) => (a > b ? a : b)

// A company-wide option picker with an inline "+" to add a new value.
function OptionSelect({
  type,
  label,
  placeholder,
  value,
  onChange,
}: {
  type: AssetOptionType
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  const { toast } = useToast()
  const [options, setOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newValue, setNewValue] = useState("")
  const [saving, setSaving] = useState(false)

  const loadOptions = async () => {
    setLoading(true)
    try {
      const data = await getAssetOptions(type)
      setOptions(data)
    } catch {
      // non-fatal — the field still works with whatever value is set
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAdd = async () => {
    const trimmed = newValue.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await createAssetOption(type, trimmed)
      setOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()))
      onChange(trimmed)
      setNewValue("")
      setAdding(false)
      toast({ title: "Added", description: `${label} "${trimmed}" added.` })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to add ${label.toLowerCase()}`,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Ensure the current value is selectable even if it isn't in the fetched list yet.
  const mergedOptions = value && !options.includes(value) ? [value, ...options] : options

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`New ${label.toLowerCase()}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAdd()
              }
            }}
          />
          <Button type="button" size="icon" variant="outline" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              setAdding(false)
              setNewValue("")
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={loading ? "Loading..." : placeholder} />
            </SelectTrigger>
            <SelectContent>
              {mergedOptions.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No options yet</div>
              ) : (
                mergedOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant="outline"
            title={`Add ${label.toLowerCase()}`}
            onClick={() => setAdding(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export function AssetSheet({ open, onOpenChange, onSaved, asset }: AssetSheetProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<CreateAssetPayload>(EMPTY)
  const isEdit = !!asset

  useEffect(() => {
    if (asset) {
      const num = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number(v))
      setFormData({
        name: asset.name,
        category: asset.category || "",
        serial_number: asset.serial_number || "",
        location: asset.location || "",
        quantity: asset.quantity ?? 1,
        purchase_cost: Number(asset.purchase_cost) || 0,
        total_cost: Number(asset.total_cost ?? (Number(asset.purchase_cost) || 0) * (asset.quantity || 1)),
        notes: asset.notes || "",
        is_active: asset.is_active,
        asset_code: asset.asset_code || "",
        tag_number: asset.tag_number || "",
        assigned_to: asset.assigned_to || "",
        supplier: asset.supplier || "",
        invoice_number: asset.invoice_number || "",
        purchase_date: asset.purchase_date?.slice(0, 10) || "",
        date_basis: asset.date_basis || "",
        depreciation_rate: num(asset.depreciation_rate),
        useful_life_years: num(asset.useful_life_years),
        residual_percent: num(asset.residual_percent) ?? 0,
        depreciation_start_date: asset.depreciation_start_date?.slice(0, 10) || "",
        status: asset.status || "In Use",
      })
    } else {
      setFormData(EMPTY)
    }
  }, [asset, open])

  const handleChange = (field: keyof CreateAssetPayload, value: string | number | boolean | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Choosing a class fills its straight-line rate and life (the register's Rates sheet).
  const handleClass = (value: string) => {
    const rates = ASSET_CLASSES[value]
    setFormData((prev) => ({
      ...prev,
      category: value,
      ...(rates ? { depreciation_rate: rates.rate, useful_life_years: rates.life } : {}),
    }))
  }

  // Depreciation starts on the later of the purchase date and 01/10/2025 (when trading began).
  const handlePurchaseDate = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      purchase_date: value,
      depreciation_start_date: value ? later(value, DEPRECIATION_COMMENCEMENT) : prev.depreciation_start_date,
    }))
  }

  const qty = Math.max(1, Number(formData.quantity) || 1)
  const unitCost = (Number(formData.total_cost) || 0) / qty
  const annual = formData.useful_life_years
    ? ((Number(formData.total_cost) || 0) * (1 - (Number(formData.residual_percent) || 0) / 100)) / Number(formData.useful_life_years)
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      // Line cost is what is typed; the per-piece cost follows from it.
      const payload: CreateAssetPayload = { ...formData, purchase_cost: Math.round(unitCost * 100) / 100 }
      for (const k of ["purchase_date", "depreciation_start_date", "asset_code"] as const) {
        if (!payload[k]) delete payload[k]
      }
      if (isEdit && asset) {
        await updateAsset(asset.id, payload)
        toast({ title: "Success", description: "Asset updated successfully." })
      } else {
        await createAsset(payload)
        toast({ title: "Success", description: "Asset created successfully." })
      }
      onSaved()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save asset",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[640px] max-w-[640px] sm:max-w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isEdit ? <Save className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {isEdit ? "Edit Asset" : "Add New Asset"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="asset_code">Asset ID</Label>
                  <Input
                    id="asset_code"
                    value={formData.asset_code}
                    onChange={(e) => handleChange("asset_code", e.target.value.toUpperCase())}
                    placeholder={isEdit ? "e.g. FUR-001" : "Given automatically (e.g. FUR-038)"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag_number">Asset Tag No.</Label>
                  <Input
                    id="tag_number"
                    value={formData.tag_number}
                    onChange={(e) => handleChange("tag_number", e.target.value.toUpperCase())}
                    placeholder="e.g. TAG-069 (the label stuck on it)"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="name">Asset Description *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="e.g. HP Pro 290 Desktop"
                    required
                  />
                </div>
                <OptionSelect
                  type="category"
                  label="Asset Class"
                  placeholder="Select class"
                  value={formData.category || ""}
                  onChange={handleClass}
                />
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial / Model No.</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) => handleChange("serial_number", e.target.value)}
                    placeholder="e.g. 4CE502BSF3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status || "In Use"} onValueChange={(v) => handleChange("status", v)}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSET_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Who Has It</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <OptionSelect
                type="department"
                label="Location / Department"
                placeholder="Select location"
                value={formData.location || ""}
                onChange={(v) => handleChange("location", v)}
              />
              <OptionSelect
                type="assignee"
                label="Assigned To / User"
                placeholder="Who is answerable for it"
                value={formData.assigned_to || ""}
                onChange={(v) => handleChange("assigned_to", v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier / Vendor</Label>
                <Input id="supplier" value={formData.supplier} onChange={(e) => handleChange("supplier", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice No.</Label>
                <Input id="invoice_number" value={formData.invoice_number} onChange={(e) => handleChange("invoice_number", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input id="purchase_date" type="date" value={formData.purchase_date} onChange={(e) => handlePurchaseDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (Pcs)</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  className="w-32"
                  value={formData.quantity}
                  onChange={(e) => handleChange("quantity", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_cost">Total Cost (Ksh)</Label>
                <Input
                  id="total_cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.total_cost}
                  onChange={(e) => handleChange("total_cost", parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Unit cost: Ksh {MONEY.format(unitCost)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Depreciation (straight line)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="depreciation_rate">Rate % p.a.</Label>
                <Input
                  id="depreciation_rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.0001"
                  className="w-40"
                  value={formData.depreciation_rate ?? ""}
                  onChange={(e) => {
                    const rate = e.target.value === "" ? undefined : parseFloat(e.target.value)
                    setFormData((prev) => ({ ...prev, depreciation_rate: rate, useful_life_years: rate ? Math.round((100 / rate) * 100) / 100 : prev.useful_life_years }))
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="useful_life_years">Useful Life (Yrs)</Label>
                <Input
                  id="useful_life_years"
                  type="number"
                  min={0}
                  step="0.5"
                  className="w-40"
                  value={formData.useful_life_years ?? ""}
                  onChange={(e) => {
                    const life = e.target.value === "" ? undefined : parseFloat(e.target.value)
                    setFormData((prev) => ({ ...prev, useful_life_years: life, depreciation_rate: life ? Math.round((100 / life) * 10000) / 10000 : prev.depreciation_rate }))
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="residual_percent">Residual Value %</Label>
                <Input
                  id="residual_percent"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="w-40"
                  value={formData.residual_percent ?? 0}
                  onChange={(e) => handleChange("residual_percent", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depreciation_start_date">Depreciation Start Date</Label>
                <Input
                  id="depreciation_start_date"
                  type="date"
                  value={formData.depreciation_start_date}
                  onChange={(e) => handleChange("depreciation_start_date", e.target.value)}
                />
              </div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                About Ksh {MONEY.format(annual)} a year (Ksh {MONEY.format(annual / 12)} a month), charged from the start month until the cost is written off.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => handleChange("notes", e.target.value)} placeholder="Any additional notes" />
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Asset
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
