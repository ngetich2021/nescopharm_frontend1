"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { Loader2, Check, X } from "lucide-react"
import { 
  getPermissions,
  type Permission
} from "@/lib/permissions"
import { 
  assignPermissionsToRole
} from "@/lib/roles"
import { 
  type AdminUser
} from "@/lib/admin"

interface AssignPermissionsDialogProps {
  user: AdminUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPermissionsAssigned: () => void
}

export function AssignPermissionsDialog({ user, open, onOpenChange, onPermissionsAssigned }: AssignPermissionsDialogProps) {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  
  // Initialize selected permissions from user's current permissions
  useEffect(() => {
    if (user && user.role && user.role.permissions) {
      const currentPermissionIds = Object.keys(user.role.permissions)
        .filter(key => user.role!.permissions[key])
      setSelectedPermissions(currentPermissionIds)
    } else {
      setSelectedPermissions([])
    }
  }, [user, open])

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

  const handleAssignPermissions = async () => {
    if (!user) return

    try {
      setAssigning(true)
      await assignPermissionsToRole(user.id, selectedPermissions)
      
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Permissions</DialogTitle>
          <DialogDescription>
            Manage permissions for user <span className="font-semibold">{user?.first_name} {user?.last_name}</span>.
            Select the permissions you want to grant to this user.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
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
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Command>
              <CommandInput placeholder="Search permissions..." />
              <CommandList>
                <CommandEmpty>No permissions found.</CommandEmpty>
                {groupedPermissions.map(group => (
                  <CommandGroup key={group.category} heading={group.category}>
                    {group.permissions.map(permission => (
                      <CommandItem
                        key={permission.id}
                        onSelect={() => togglePermission(permission.id)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <div className="font-medium">{permission.name}</div>
                          <div className="text-sm text-muted-foreground">{permission.description}</div>
                        </div>
                        {selectedPermissions.includes(permission.id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          )}
          
          <div className="flex justify-end gap-2">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}