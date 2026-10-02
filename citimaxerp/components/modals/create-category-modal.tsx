"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { createProductCategory, type ProductCategory } from "@/lib/product-categories"
import { Loader2 } from "lucide-react"

interface CreateCategoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCategoryCreated: (category: ProductCategory) => void
}

export function CreateCategoryModal({ open, onOpenChange, onCategoryCreated }: CreateCategoryModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#6B7280",
    is_active: true
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      const result = await createProductCategory({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        is_active: formData.is_active
      })
      
      if (result.success && result.category) {
        toast({
          title: "Success",
          description: "Category created successfully"
        })
        
        // Reset form
        setFormData({
          name: "",
          description: "",
          color: "#6B7280",
          is_active: true
        })
        
        // Notify parent component
        onCategoryCreated(result.category)
        onOpenChange(false)
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to create category",
          variant: "destructive"
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>
            Add a new product category to organize your inventory
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Electronics"
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Electronic devices and accessories"
                rows={3}
                disabled={isSubmitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="color"
                  type="color"
                  className="w-16 p-1 h-10"
                  value={formData.color}
                  onChange={(e) => handleInputChange("color", e.target.value)}
                  disabled={isSubmitting}
                />
                <Input
                  value={formData.color}
                  onChange={(e) => handleInputChange("color", e.target.value)}
                  className="flex-1"
                  placeholder="#6B7280"
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Choose a color to help identify this category
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange("is_active", checked)}
                disabled={isSubmitting}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Category"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
