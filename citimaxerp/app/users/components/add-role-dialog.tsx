"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { 
  createRole,
  type CreateRolePayload
} from "@/lib/roles"

interface AddRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  companyId: string
}

export function AddRoleDialog({ open, onOpenChange, onSuccess, companyId }: AddRoleDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const resetForm = () => {
    setFormData({
      name: "",
      description: ""
    })
  }

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen)
    if (!isOpen) {
      resetForm()
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const payload: CreateRolePayload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        company_id: companyId,
        permission_ids: [] // Empty array since permissions are now optional
      }

      await createRole(payload)
      
      toast({
        title: "Success",
        description: "Role created successfully",
      })
      
      onSuccess()
      handleOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create role",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Create New Role</SheetTitle>
          <SheetDescription>
            Create a new role for your company. Permissions can be assigned later.
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 py-4 flex-grow overflow-y-auto">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter role name"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter role description"
                rows={3}
              />
            </div>
          </div>
        </div>
        
        <SheetFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Role"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
