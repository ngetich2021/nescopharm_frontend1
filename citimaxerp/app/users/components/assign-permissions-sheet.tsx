"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Check, X, ChevronDown, ChevronRight } from "lucide-react"
import { 
  getPermissions,
  type Permission
} from "@/lib/permissions"
import { 
  assignPermissionsToRole,
  getRolePermissions
} from "@/lib/roles"
import { 
  type Role
} from "@/lib/roles"

interface AssignPermissionsSheetProps {
  role: Role | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPermissionsAssigned: () => void
}

export function AssignPermissionsSheet({ role, open, onOpenChange, onPermissionsAssigned }: AssignPermissionsSheetProps) {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const { toast } = useToast()
  
  // Initialize selected permissions from role's current permissions
  useEffect(() => {
    if (role && open) {
      loadRolePermissions();
    } else {
      setSelectedPermissions([]);
    }
  }, [role, open]);

  const loadRolePermissions = async () => {
    if (!role) return;
    
    try {
      const rolePermissions = await getRolePermissions(role.id);
      const permissionIds = rolePermissions.map(p => p.id);
      setSelectedPermissions(permissionIds);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load role permissions",
        variant: "destructive",
      });
      setSelectedPermissions([]);
    }
  };

  useEffect(() => {
    if (open) {
      loadPermissions()
    }
  }, [open])

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

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId) 
        ? prev.filter(id => id !== permissionId) 
        : [...prev, permissionId]
    )
  }

  const toggleCategory = (category: string) => {
    const categoryPermissions = permissions.filter(p => p.category === category)
    const categoryPermissionIds = categoryPermissions.map(p => p.id)
    
    // Check if all permissions in this category are selected
    const allSelected = categoryPermissionIds.every(id => selectedPermissions.includes(id))
    
    if (allSelected) {
      // Deselect all permissions in this category
      setSelectedPermissions(prev => 
        prev.filter(id => !categoryPermissionIds.includes(id))
      )
    } else {
      // Select all permissions in this category
      setSelectedPermissions(prev => [
        ...prev,
        ...categoryPermissionIds.filter(id => !prev.includes(id))
      ])
    }
  }

  const toggleAllPermissions = () => {
    if (selectedPermissions.length === permissions.length) {
      // Deselect all permissions
      setSelectedPermissions([])
    } else {
      // Select all permissions
      setSelectedPermissions(permissions.map(p => p.id))
    }
  }

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const handleAssignPermissions = async () => {
    if (!role) return

    try {
      setAssigning(true)
      await assignPermissionsToRole(role.id, selectedPermissions)
      
      toast({
        title: "Success",
        description: "Permissions assigned successfully",
      })
      
      onOpenChange(false)
      onPermissionsAssigned()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign permissions",
        variant: "destructive",
      })
    } finally {
      setAssigning(false)
    }
  }

  // Group permissions by category
  const groupedPermissions = Array.isArray(categories) ? categories.map(category => ({
    category,
    permissions: Array.isArray(permissions) ? permissions.filter(p => p.category === category) : []
  })) : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Assign Permissions</SheetTitle>
          <SheetDescription>
            Manage permissions for role <span className="font-semibold">{role?.name}</span>.
            Select the permissions you want to grant to this role.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium">Selected Permissions:</span>
            {selectedPermissions.length === 0 ? (
              <span className="text-sm text-muted-foreground">No permissions selected</span>
            ) : (
              selectedPermissions.map(permissionId => {
                const permission = permissions.find(p => p.id === permissionId)
                return (
                  <Badge key={permissionId} variant="secondary">
                    {permission?.name || permissionId}
                    <button 
                      className="ml-1 hover:bg-secondary-foreground/10 rounded-full"
                      onClick={() => togglePermission(permissionId)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })
            )}
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {selectedPermissions.length} of {permissions.length} permissions selected
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleAllPermissions}
            >
              {selectedPermissions.length === permissions.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="border rounded-lg">
              {groupedPermissions.map(group => {
                const categoryPermissionIds = group.permissions.map(p => p.id)
                const selectedInCategory = categoryPermissionIds.filter(id => selectedPermissions.includes(id))
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
                                checked={selectedPermissions.includes(permission.id)}
                                onCheckedChange={() => togglePermission(permission.id)}
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
        
        <SheetFooter className="border-t bg-background pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssignPermissions}
            disabled={assigning}
          >
            {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign Permissions
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}