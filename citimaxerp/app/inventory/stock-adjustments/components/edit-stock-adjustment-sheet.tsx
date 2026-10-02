"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { updateStockAdjustmentAction } from "../actions"
import type { StockAdjustment } from "@/lib/stock-adjustments"

interface EditStockAdjustmentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adjustment: StockAdjustment
  onSuccess: () => void
}

export function EditStockAdjustmentSheet({
  open,
  onOpenChange,
  adjustment,
  onSuccess,
}: EditStockAdjustmentSheetProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    quantity_adjusted: Math.abs(adjustment.quantity_adjusted || 0).toString(),
    reason: adjustment.reason,
    notes: adjustment.notes || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const quantity = parseInt(formData.quantity_adjusted)
      if (isNaN(quantity)) {
        throw new Error("Please enter a valid quantity")
      }

      const adjustedQuantity = adjustment.adjustment_type === "decrease" ? -Math.abs(quantity) : Math.abs(quantity)

      const result = await updateStockAdjustmentAction(adjustment.id, {
        quantity_adjusted: adjustedQuantity,
        reason: formData.reason,
        notes: formData.notes || undefined,
      })

      if (result.success) {
        toast({
          title: "Success",
          description: "Stock adjustment updated successfully",
        })
        onOpenChange(false)
        onSuccess()
      } else {
        throw new Error(result.message || "Failed to update stock adjustment")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update stock adjustment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>Edit Stock Adjustment</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Adjustment Number</Label>
              <Input value={adjustment.adjustment_number} disabled />
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <Input value={adjustment.product?.name || `${adjustment.total_items || adjustment.items?.length || 0} item(s)`} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity_adjusted">Quantity *</Label>
              <Input
                id="quantity_adjusted"
                type="number"
                value={formData.quantity_adjusted}
                onChange={(e) =>
                  setFormData({ ...formData, quantity_adjusted: e.target.value })
                }
                placeholder="Enter quantity"
                required
              />
              <p className="text-xs text-muted-foreground">
                This will {adjustment.adjustment_type === "decrease" ? "decrease" : "increase"} the stock
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Provide a detailed reason for this adjustment"
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional information (optional)"
                rows={2}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Adjustment
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
