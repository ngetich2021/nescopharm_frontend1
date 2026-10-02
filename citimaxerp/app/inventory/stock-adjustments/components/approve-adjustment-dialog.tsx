"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { approveStockAdjustmentAction, applyStockAdjustmentAction } from "../actions"
import type { StockAdjustment } from "@/lib/stock-adjustments"

interface ApproveAdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adjustment: StockAdjustment
  onSuccess: () => void
}

export function ApproveAdjustmentDialog({
  open,
  onOpenChange,
  adjustment,
  onSuccess,
}: ApproveAdjustmentDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [applyImmediately, setApplyImmediately] = useState(false)

  const handleApprove = async () => {
    setIsSubmitting(true)

    try {
      // First approve
      const approveResult = await approveStockAdjustmentAction(adjustment.id)

      if (!approveResult.success) {
        throw new Error(approveResult.message || "Failed to approve adjustment")
      }

      // If apply immediately, apply the adjustment
      if (applyImmediately) {
        const applyResult = await applyStockAdjustmentAction(adjustment.id)
        if (!applyResult.success) {
          throw new Error(applyResult.message || "Failed to apply adjustment")
        }
      }

      toast({
        title: "Success",
        description: applyImmediately 
          ? "Stock adjustment approved and applied successfully" 
          : "Stock adjustment approved successfully",
      })
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve adjustment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve Stock Adjustment</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Are you sure you want to approve this stock adjustment?</p>
            <div className="mt-4 p-3 bg-muted rounded-md space-y-1 text-sm">
              <p><strong>Adjustment #:</strong> {adjustment.adjustment_number}</p>
              {adjustment.product ? (
                <p><strong>Product:</strong> {adjustment.product.name}</p>
              ) : adjustment.items && adjustment.items.length > 0 ? (
                <p><strong>Items:</strong> {adjustment.total_items || adjustment.items.length} product(s)</p>
              ) : null}
              <p><strong>Quantity:</strong> {(adjustment.total_quantity_adjusted || adjustment.quantity_adjusted || 0) > 0 ? '+' : ''}{adjustment.total_quantity_adjusted || adjustment.quantity_adjusted || 0}</p>
              <p><strong>Reason:</strong> {adjustment.reason}</p>
            </div>
            <div className="flex items-center space-x-2 mt-4">
              <input
                type="checkbox"
                id="apply-immediately"
                checked={applyImmediately}
                onChange={(e) => setApplyImmediately(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="apply-immediately" className="text-sm font-medium">
                Apply to inventory immediately
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve {applyImmediately && "& Apply"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
