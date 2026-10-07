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
  notes: "",
  is_active: true,
}

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
      setFormData({
        name: asset.name,
        category: asset.category || "",
        serial_number: asset.serial_number || "",
        location: asset.location || "",
        quantity: asset.quantity ?? 1,
        purchase_cost: Number(asset.purchase_cost) || 0,
        notes: asset.notes || "",
        is_active: asset.is_active,
      })
    } else {
      setFormData(EMPTY)
    }
  }, [asset, open])

  const handleChange = (field: keyof CreateAssetPayload, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (isEdit && asset) {
        await updateAsset(asset.id, formData)
        toast({ title: "Success", description: "Asset updated successfully." })
      } else {
        await createAsset(formData)
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
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="name">Asset Name / Description *</Label>
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
                  label="Category"
                  placeholder="Select category"
                  value={formData.category || ""}
                  onChange={(v) => handleChange("category", v)}
                />
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial / Model Number</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) => handleChange("serial_number", e.target.value)}
                    placeholder="e.g. 4CE502BSF3"
                  />
                </div>
                <OptionSelect
                  type="department"
                  label="Location / Department"
                  placeholder="Select department"
                  value={formData.location || ""}
                  onChange={(v) => handleChange("location", v)}
                />
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity (Pcs)</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => handleChange("quantity", parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_cost">Purchase Cost (Ksh)</Label>
                  <Input
                    id="purchase_cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.purchase_cost}
                    onChange={(e) => handleChange("purchase_cost", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder="Any additional notes"
                  />
                </div>
              </div>
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
