"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle, X, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { deleteProduct } from "@/lib/products"

interface Product {
  id: string
  name: string
  sku?: string
}

interface DeleteProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  product: Product
}

export function DeleteProductModal({ isOpen, onClose, onSuccess, product }: DeleteProductModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [confirmationText, setConfirmationText] = useState("")

  const expectedText = "DELETE"
  const isConfirmed = confirmationText === expectedText

  const handleDelete = async () => {
    if (!isConfirmed) {
      toast({
        title: "Confirmation Required",
        description: `Please type "${expectedText}" to confirm deletion`,
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const result = await deleteProduct(product.id)

      if (result) {
        toast({
          title: "Success",
          description: "Product deleted successfully",
        })
        onSuccess()
        onClose()
      } else {
        toast({
          title: "Error",
          description: "Failed to delete product",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-lg shadow-xl z-50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-600">Delete Product</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800">This action cannot be undone</h3>
                <p className="text-sm text-red-700 mt-1">
                  This will permanently delete the product and all associated data including variants, if any.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Product to be deleted:</h4>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold">{product.name}</p>
              {product.sku && <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <span className="font-mono font-bold">{expectedText}</span> to confirm deletion:
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={`Type "${expectedText}" here`}
              className={cn("font-mono", confirmationText && !isConfirmed && "border-red-500 focus:border-red-500")}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isLoading}
            className="min-w-[120px]"
          >
            {isLoading ? (
              "Deleting..."
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Product
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  )
}
