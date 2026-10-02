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
import { deleteStockAdjustmentAction } from "../actions"
import type { StockAdjustment } from "@/lib/stock-adjustments"

interface DeleteAdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adjustment: StockAdjustment
  onSuccess: () => void
}

export function DeleteAdjustmentDialog({
  open,
  onOpenChange,
  adjustment,
  onSuccess,
}: DeleteAdjustmentDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDelete = async () => {
    setIsSubmitting(true)

    try {
      const result = await deleteStockAdjustmentAction(adjustment.id)

      if (result.success) {
        toast({
          title: "Success",
          description: "Stock adjustment deleted successfully",
        })
        onOpenChange(false)
        onSuccess()
      } else {
        throw new Error(result.message || "Failed to delete adjustment")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete adjustment",
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
          <AlertDialogTitle>Delete Stock Adjustment</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Are you sure you want to delete this stock adjustment? This action cannot be undone.</p>
            <div className="mt-4 p-3 bg-muted rounded-md space-y-1 text-sm">
              <p><strong>Adjustment #:</strong> {adjustment.adjustment_number}</p>
              {adjustment.product ? (
                <p><strong>Product:</strong> {adjustment.product.name}</p>
              ) : adjustment.items && adjustment.items.length > 0 ? (
                <p><strong>Items:</strong> {adjustment.total_items || adjustment.items.length} product(s)</p>
              ) : null}
              <p><strong>Quantity:</strong> {(adjustment.total_quantity_adjusted || adjustment.quantity_adjusted || 0) > 0 ? '+' : ''}{adjustment.total_quantity_adjusted || adjustment.quantity_adjusted || 0}</p>
              <p><strong>Status:</strong> {adjustment.status}</p>
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
          <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
