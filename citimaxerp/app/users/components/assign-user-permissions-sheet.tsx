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
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from "@/lib/rbac"
import apiCall from "@/lib/api"

interface UserData {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: { id: string; name: string } | null
}

interface AssignUserPermissionsSheetProps {
  user: UserData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPermissionsAssigned: () => void
}

export function AssignUserPermissionsSheet({ user, open, onOpenChange, onPermissionsAssigned }: AssignUserPermissionsSheetProps) {
  const [saving, setSaving] = useState(false)
  const [currentPermissions, setCurrentPermissions] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  // Initialize permissions when user changes
  useEffect(() => {
    if (user && open) {
      // Initialize all permissions to false by default
      const initialPermissions: Record<string, boolean> = {}
      ALL_PERMISSIONS.forEach((perm) => {
        initialPermissions[perm] = false
      })
      setCurrentPermissions(initialPermissions)
    }
  }, [user, open])

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setCurrentPermissions((prev) => ({
      ...prev,
      [permission]: checked,
    }))
  }

  const handleGroupSelectAll = (groupPermissions: string[], checked: boolean) => {
    setCurrentPermissions((prev) => {
      const newPermissions = { ...prev }
      groupPermissions.forEach((perm) => {
        newPermissions[perm] = checked
      })
      return newPermissions
    })
  }

  const handleGlobalSelectAll = (checked: boolean) => {
    const newPermissions: Record<string, boolean> = {}
    ALL_PERMISSIONS.forEach((perm) => {
      newPermissions[perm] = checked
    })
    setCurrentPermissions(newPermissions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return

    try {
      setSaving(true)
      
      // Get only the enabled permissions
      const enabledPermissions: string[] = []
      Object.entries(currentPermissions).forEach(([permission, enabled]) => {
        if (enabled) {
          enabledPermissions.push(permission)
        }
      })
      
      // Assign permissions to user
      await apiCall(`/users/${user.id}/permissions`, "POST", {
        permission_ids: enabledPermissions
      })
      
      toast({
        title: "Success",
        description: "User permissions updated successfully.",
      })
      onOpenChange(false)
      onPermissionsAssigned()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const allPermissionsChecked = ALL_PERMISSIONS.every((perm) => currentPermissions[perm])
  const isGlobalIndeterminate = !allPermissionsChecked && ALL_PERMISSIONS.some((perm) => currentPermissions[perm])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Assign Permissions</SheetTitle>
          <SheetDescription>
            Assign specific permissions to user <span className="font-semibold">{user?.first_name} {user?.last_name}</span>.
            These permissions will be in addition to their role-based permissions.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto py-4">
          <div className="space-y-6">
            {/* Global Select All */}
            <div className="flex items-center space-x-2 p-4 border rounded-lg">
              <Checkbox
                id="select-all"
                checked={allPermissionsChecked}
                onCheckedChange={handleGlobalSelectAll}
              />
              <Label htmlFor="select-all" className="font-medium">
                Select All Permissions
              </Label>
            </div>
            
            {/* Permission Groups */}
            <Accordion type="multiple" className="w-full">
              {PERMISSION_GROUPS.map((group) => {
                const groupPermissionsChecked = group.permissions.every(
                  (perm) => currentPermissions[perm]
                )
                const isGroupIndeterminate = 
                  !groupPermissionsChecked && 
                  group.permissions.some((perm) => currentPermissions[perm])
                
                return (
                  <AccordionItem value={group.title} key={group.title}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={groupPermissionsChecked}
                          onCheckedChange={(checked) => 
                            handleGroupSelectAll(
                              group.permissions, 
                              checked as boolean
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-medium">{group.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {group.permissions.map((permission) => (
                          <div key={permission} className="flex items-center space-x-2">
                            <Checkbox
                              id={permission}
                              checked={currentPermissions[permission] || false}
                              onCheckedChange={(checked) => 
                                handlePermissionChange(
                                  permission, 
                                  checked as boolean
                                )
                              }
                            />
                            <Label htmlFor={permission} className="text-sm">
                              {permission}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        </form>
        
        <SheetFooter className="mt-auto pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Permissions
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}