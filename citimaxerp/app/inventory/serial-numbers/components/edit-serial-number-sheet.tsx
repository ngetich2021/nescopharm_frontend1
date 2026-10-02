"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { updateSerialNumber } from "@/lib/serial-numbers"
import type { SerialNumber } from "@/types/serial-numbers"
import { usePermissions } from "@/hooks/use-permissions"

interface EditSerialNumberSheetProps {
  serialNumber: SerialNumber
  open: boolean
  onOpenChange: (open: boolean) => void
  onSerialNumberUpdated: () => void
}

export function EditSerialNumberSheet({ serialNumber, open, onOpenChange, onSerialNumberUpdated }: EditSerialNumberSheetProps) {
  const [formData, setFormData] = useState({
    serial_number: "",
    product_id: "",
    batch_id: "",
    status: "active" as "active" | "inactive" | "sold" | "returned" | "damaged" | "expired",
    unit_cost: "",
    unit_price: "",
    purchase_reference: "",
    notes: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  // Initialize form data when serial number changes
  useEffect(() => {
    if (serialNumber) {
      setFormData({
        serial_number: serialNumber.serial_number || "",
        product_id: serialNumber.product_id || "",
        batch_id: serialNumber.batch_id || "",
        status: serialNumber.status || "active",
        unit_cost: serialNumber.unit_cost || "",
        unit_price: serialNumber.unit_price || "",
        purchase_reference: serialNumber.purchase_reference || "",
        notes: serialNumber.notes || "",
      })
    }
  }, [serialNumber])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      await updateSerialNumber(serialNumber.id, {
        serial_number: formData.serial_number,
        product_id: formData.product_id,
        batch_id: formData.batch_id || undefined,
        status: formData.status,
        unit_cost: formData.unit_cost || undefined,
        unit_price: formData.unit_price || undefined,
        purchase_reference: formData.purchase_reference || undefined,
        notes: formData.notes || undefined,
      })
      
      toast({
        title: "Success",
        description: "Serial number updated successfully",
      })
      
      onSerialNumberUpdated()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update serial number",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Serial Number</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial Number *</Label>
              <Input
                id="serial_number"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleInputChange}
                required
                placeholder="Enter serial number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="product_id">Product ID *</Label>
              <Input
                id="product_id"
                name="product_id"
                value={formData.product_id}
                onChange={handleInputChange}
                required
                placeholder="Enter product ID"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="batch_id">Batch ID</Label>
              <Input
                id="batch_id"
                name="batch_id"
                value={formData.batch_id}
                onChange={handleInputChange}
                placeholder="Enter batch ID (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="sold">Sold</option>
                <option value="returned">Returned</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="unit_cost">Unit Cost</Label>
              <Input
                id="unit_cost"
                name="unit_cost"
                type="number"
                value={formData.unit_cost}
                onChange={handleInputChange}
                placeholder="Enter unit cost (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="unit_price">Unit Price</Label>
              <Input
                id="unit_price"
                name="unit_price"
                type="number"
                value={formData.unit_price}
                onChange={handleInputChange}
                placeholder="Enter unit price (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="purchase_reference">Purchase Reference</Label>
              <Input
                id="purchase_reference"
                name="purchase_reference"
                value={formData.purchase_reference}
                onChange={handleInputChange}
                placeholder="Enter purchase reference (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Enter any additional notes"
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !hasPermission("can_update_serial_numbers")}>
              {isLoading ? "Updating..." : "Update Serial Number"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}