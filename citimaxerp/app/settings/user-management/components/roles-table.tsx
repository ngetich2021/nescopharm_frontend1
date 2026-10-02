"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, PlusCircle } from "lucide-react" // Added Check and X for status icons
import { useToast } from "@/hooks/use-toast"
import { fetchRoles, createRole, updateRole, deleteRole } from "../actions"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { Role } from "@/lib/roles";
import type { PermissionKey } from "@/types/rbac";
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from "@/lib/rbac"
import { useAuth } from "@/lib/auth-context"
import { Separator } from "@/components/ui/separator" // New import for visual separation
import { Checkbox } from "@/components/ui/checkbox"
import RolesTableComponent from "./RolesTableComponent"

// Define the Permissions type for our component's needs
type Permissions = Record<PermissionKey, boolean>;

interface UserData {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  role: { id: string; name: string } | null
}

export function RolesTable() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [saving, setSaving] = useState(false)
  const [currentPermissions, setCurrentPermissions] = useState<Permissions>({} as Permissions)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const { toast } = useToast()
  const { userProfile } = useAuth()

  const canManageRoles = true // Simplified for now

  useEffect(() => {
    loadRoles()
  }, [])

  useEffect(() => {
    // In a real implementation, you would filter/paginate the data based on these values
    // For now, we're just showing all data but with the new table UI
  }, [searchTerm, currentPage, rowsPerPage])

  const loadRoles = async () => {
    setLoading(true)
    try {
      const rolesData = await fetchRoles()
      setRoles(rolesData);
      setTotalPages(Math.ceil(rolesData.length / rowsPerPage) || 1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load role data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = (permission: PermissionKey, checked: boolean) => {
    setCurrentPermissions((prev: Permissions) => ({
      ...prev,
      [permission]: checked,
    }))
  }

  const handleGroupSelectAll = (groupPermissions: PermissionKey[], checked: boolean) => {
    setCurrentPermissions((prev: Permissions) => {
      const newPermissions = { ...prev }
      groupPermissions.forEach((perm) => {
        newPermissions[perm] = checked
      })
      return newPermissions
    })
  }

  const handleGlobalSelectAll = (checked: boolean) => {
    const allPermissions: Permissions = {} as Permissions;
    ALL_PERMISSIONS.forEach(perm => {
      allPermissions[perm as PermissionKey] = checked;
    });
    setCurrentPermissions(allPermissions);
  }

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const formData = new FormData(event.currentTarget)
    
    // Add permissions to form data
    const permissionsArray: PermissionKey[] = []
    Object.entries(currentPermissions).forEach(([permission, enabled]) => {
      if (enabled) {
        permissionsArray.push(permission as PermissionKey)
      }
    })
    formData.append("permissions", JSON.stringify(permissionsArray))

    try {
      let result
      if (editingRole) {
        result = await updateRole(editingRole.id, formData)
      } else {
        result = await createRole(formData)
      }

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        setIsModalOpen(false)
        setEditingRole(null)
        setCurrentPermissions({} as Permissions)
        await loadRoles() // Reload data after successful operation
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        })
      }
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

  const handleDeleteRole = async (role: Role) => {
    if (!confirm("Are you sure you want to delete this role? This action cannot be undone.")) {
      return
    }
    try {
      const result = await deleteRole(role.id)
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        await loadRoles()
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    }
  }

  const openCreateModal = () => {
    setEditingRole(null)
    // Initialize all permissions to false for a new role
    const initialPermissions: Permissions = {} as Permissions;
    ALL_PERMISSIONS.forEach(perm => {
      initialPermissions[perm as PermissionKey] = false;
    });
    setCurrentPermissions(initialPermissions);
    setIsModalOpen(true)
  }

  const openEditModal = (role: Role) => {
    setEditingRole(role)
    // Convert role permissions array to our Permissions object
    const rolePermissions: Permissions = {} as Permissions;
    
    // Initialize all permissions to false
    ALL_PERMISSIONS.forEach(perm => {
      rolePermissions[perm as PermissionKey] = false;
    });
    
    // Set permissions that exist in the role to true
    if (Array.isArray(role.permissions)) {
      role.permissions.forEach(perm => {
        if (perm.key in rolePermissions) {
          rolePermissions[perm.key as PermissionKey] = true;
        }
      });
    }
    
    setCurrentPermissions(rolePermissions);
    setIsModalOpen(true)
  }

  const allPermissionsChecked = ALL_PERMISSIONS.every((perm) => currentPermissions[perm as PermissionKey])
  const isGlobalIndeterminate = !allPermissionsChecked && ALL_PERMISSIONS.some((perm) => currentPermissions[perm as PermissionKey])

  // Filter roles based on search term
  const filteredRoles = roles.filter(role => {
    const searchTermLower = searchTerm.toLowerCase()
    return (
      (role.name && role.name.toLowerCase().includes(searchTermLower)) ||
      (role.description && role.description.toLowerCase().includes(searchTermLower))
    )
  })

  // Paginate roles
  const paginatedRoles = filteredRoles.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-2xl font-bold">Roles</CardTitle>
        {canManageRoles && (
          <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
            <SheetTrigger asChild>
              <Button onClick={openCreateModal} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Role
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
              <SheetHeader>
                <SheetTitle>{editingRole ? "Edit Role" : "Create New Role"}</SheetTitle>
                <SheetDescription>
                  {editingRole
                    ? "Make changes to this role and its permissions."
                    : "Define a new role with specific access rights."}
                </SheetDescription>
              </SheetHeader>
              <form id="edit-role-form" onSubmit={handleFormSubmit} className="grid gap-6 py-4 flex-grow overflow-y-auto">
                {/* Role Details Section */}
                <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                  <h3 className="text-xl font-semibold mb-4">Role Details</h3>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Role Name *
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={editingRole?.name || ""}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4 mt-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={editingRole?.description || ""}
                      className="col-span-3"
                      placeholder="Enter role description"
                    />
                  </div>
                </div>

                {/* Permissions Section */}
                <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                  <h3 className="text-xl font-semibold mb-4">Permissions</h3>
                  
                  {/* Global Select All */}
                  <div className="flex items-center space-x-2 mb-4 p-3 border rounded">
                    <Checkbox
                      id="global-select-all"
                      checked={allPermissionsChecked}
                      onCheckedChange={handleGlobalSelectAll}
                    />
                    <Label htmlFor="global-select-all" className="font-medium">
                      Select All Permissions
                    </Label>
                  </div>
                  
                  {/* Permission Groups */}
                  <Accordion type="multiple" className="w-full">
                    {PERMISSION_GROUPS.map((group) => {
                      const groupPermissionsChecked = group.permissions.every(
                        (perm) => currentPermissions[perm as PermissionKey]
                      )
                      const isGroupIndeterminate = 
                        !groupPermissionsChecked && 
                        group.permissions.some((perm) => currentPermissions[perm as PermissionKey])
                      
                      return (
                        <AccordionItem value={group.title} key={group.title}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={groupPermissionsChecked}
                                onCheckedChange={(checked) => 
                                  handleGroupSelectAll(
                                    group.permissions as PermissionKey[], 
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
                                    id={`perm-${permission}`}
                                    checked={currentPermissions[permission as PermissionKey] || false}
                                    onCheckedChange={(checked) => 
                                      handlePermissionChange(
                                        permission as PermissionKey, 
                                        checked as boolean
                                      )
                                    }
                                  />
                                  <Label htmlFor={`perm-${permission}`} className="text-sm">
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
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" form="edit-role-form" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRole ? "Update Role" : "Create Role"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}
      </CardHeader>
      <CardContent>
        <RolesTableComponent
          roles={paginatedRoles}
          loading={loading}
          onViewRole={(role) => {
            // For now, we'll just show a toast. In a real implementation, you might open a modal.
            toast({
              title: "View Role",
              description: `Viewing details for ${role.name}`,
            })
          }}
          onEditRole={openEditModal}
          onDeleteRole={handleDeleteRole}
          search={searchTerm}
          onSearchChange={setSearchTerm}
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          totalItems={filteredRoles.length}
          onRefresh={loadRoles}
          onCreateNew={openCreateModal}
        />
      </CardContent>
    </Card>
  )
}