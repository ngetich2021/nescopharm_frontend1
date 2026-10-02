"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { 
  getPermissions,
  type Permission
} from "@/lib/permissions"
import { 
  createRole,
  type CreateRolePayload
} from "@/lib/roles"
import type { Company } from "@/lib/admin"

interface AddRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  companies: Company[]
}

export function AddRoleDialog({ open, onOpenChange, onSuccess, companies }: AddRoleDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    company_id: "",
    permission_ids: [] as string[],
    is_warehouse_incharge: false,
  })
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load permissions when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen)
    if (isOpen) {
      loadPermissions()
      resetForm()
    }
  }

  const loadPermissions = async () => {
    try {
      setLoading(true)
      const data = await getPermissions()
      setPermissions(Array.isArray(data.permissions) ? data.permissions : [])
      setCategories(Array.isArray(data.categories) ? data.categories : [])
      
      // Expand all categories by default
      const initialExpanded: Record<string, boolean> = {}
      if (Array.isArray(data.categories)) {
        data.categories.forEach(category => {
          initialExpanded[category] = true
        })
      }
      setExpandedCategories(initialExpanded)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load permissions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      company_id: "",
      permission_ids: [],
      is_warehouse_incharge: false,
    })
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: checked 
        ? [...prev.permission_ids, permissionId]
        : prev.permission_ids.filter(id => id !== permissionId)
    }))
  }

  const toggleCategory = (category: string) => {
    const categoryPermissions = permissions.filter(p => p.category === category)
    const categoryPermissionIds = categoryPermissions.map(p => p.id)
    
    // Check if all permissions in this category are selected
    const allSelected = categoryPermissionIds.every(id => formData.permission_ids.includes(id))
    
    if (allSelected) {
      // Deselect all permissions in this category
      setFormData(prev => ({
        ...prev,
        permission_ids: prev.permission_ids.filter(id => !categoryPermissionIds.includes(id))
      }))
    } else {
      // Select all permissions in this category
      setFormData(prev => ({
        ...prev,
        permission_ids: [
          ...prev.permission_ids,
          ...categoryPermissionIds.filter(id => !prev.permission_ids.includes(id))
        ]
      }))
    }
  }

  const toggleAllPermissions = () => {
    if (formData.permission_ids.length === permissions.length) {
      // Deselect all permissions
      setFormData(prev => ({ ...prev, permission_ids: [] }))
    } else {
      // Select all permissions
      setFormData(prev => ({ ...prev, permission_ids: permissions.map(p => p.id) }))
    }
  }

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.description.trim() || !formData.company_id) {
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
        company_id: formData.company_id,
        permission_ids: formData.permission_ids,
        is_warehouse_incharge: formData.is_warehouse_incharge,
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

  // Group permissions by category
  const groupedPermissions = Array.isArray(categories) ? categories.map(category => ({
    category,
    permissions: Array.isArray(permissions) ? permissions.filter(p => p.category === category) : []
  })) : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>
            Create a new system role with permissions
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
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

            <div>
              <Label htmlFor="company">Company *</Label>
              <Select 
                value={formData.company_id} 
                onValueChange={(value) => setFormData({ ...formData, company_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_warehouse_incharge"
                checked={formData.is_warehouse_incharge}
                onCheckedChange={(checked) => setFormData({ ...formData, is_warehouse_incharge: checked as boolean })}
              />
              <Label htmlFor="is_warehouse_incharge" className="cursor-pointer">
                Warehouse In-Charge
              </Label>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <Label>Permissions</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleAllPermissions}
              >
                {formData.permission_ids.length === permissions.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-lg">
                  {groupedPermissions.map(group => {
                    const categoryPermissionIds = group.permissions.map(p => p.id)
                    const selectedInCategory = categoryPermissionIds.filter(id => formData.permission_ids.includes(id))
                    const allSelected = selectedInCategory.length === categoryPermissionIds.length && categoryPermissionIds.length > 0
                    const someSelected = selectedInCategory.length > 0 && !allSelected
                    
                    return (
                      <div key={group.category} className="border-b last:border-b-0">
                        <div 
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleCategoryExpansion(group.category)}
                        >
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="p-0 h-6 w-6"
                            >
                              {expandedCategories[group.category] ? 
                                <ChevronDown className="h-4 w-4" /> : 
                                <ChevronRight className="h-4 w-4" />
                              }
                            </Button>
                            <div className="font-medium">
                              {group.category.replace(/_/g, ' ')}
                            </div>
                            <Badge variant="outline">
                              {selectedInCategory.length}/{group.permissions.length}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleCategory(group.category)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {allSelected ? "All selected" : someSelected ? `${selectedInCategory.length} selected` : "None selected"}
                            </span>
                          </div>
                        </div>
                        
                        {expandedCategories[group.category] && (
                          <div className="pl-10 pr-4 pb-4">
                            <div className="grid gap-3">
                              {group.permissions.map(permission => (
                                <div 
                                  key={permission.id} 
                                  className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50"
                                >
                                  <Checkbox
                                    id={`permission-${permission.id}`}
                                    checked={formData.permission_ids.includes(permission.id)}
                                    onCheckedChange={(checked) => 
                                      handlePermissionChange(permission.id, checked as boolean)
                                    }
                                  />
                                  <div className="space-y-1">
                                    <Label 
                                      htmlFor={`permission-${permission.id}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                      {permission.name}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                      {permission.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}