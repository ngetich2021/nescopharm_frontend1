"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, PlusCircle, Check, ChevronsUpDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/lib/auth-context"
import { AssignRoleSheet } from "@/app/users/components/assign-role-sheet"
import { ViewUserSheet } from "@/app/users/components/view-user-sheet"
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from "@/lib/rbac"
import UsersTableComponent from "./UsersTableComponent"
import { fetchUsers, createUser, updateUser, deleteUser, assignRoleToUser, UserData, softDeleteUser, terminateUser, restoreUser } from "@/lib/users"
import { getRoles } from "@/lib/roles"
import apiCall from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Interfaces are now imported from @/lib/users

export function UsersTable() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserData | null>(null)
  const [isRoleSheetOpen, setIsRoleSheetOpen] = useState(false)
  const [isCreateRoleSheetOpen, setIsCreateRoleSheetOpen] = useState(false)
  const [creatingRole, setCreatingRole] = useState(false)
  const [currentPermissions, setCurrentPermissions] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [roles, setRoles] = useState<any[]>([])
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false)
  const [terminateUserTarget, setTerminateUserTarget] = useState<UserData | null>(null)
  const [terminateReason, setTerminateReason] = useState("")
  const [terminating, setTerminating] = useState(false)
  const [softDeletingUser, setSoftDeletingUser] = useState<UserData | null>(null)
  const [viewingUser, setViewingUser] = useState<UserData | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [roleSearchOpen, setRoleSearchOpen] = useState(false)
  const { toast } = useToast()
  const { userProfile } = useAuth()

  const canManageUsers = true // Simplified for now

  useEffect(() => {
    loadUsers()
    loadRolesData()
  }, [])

  const loadRolesData = async () => {
    try {
      const rolesData = await getRoles()
      setRoles(Array.isArray(rolesData) ? rolesData : (rolesData as any)?.roles || [])
    } catch {
      setRoles([])
    }
  }

  useEffect(() => {
    // In a real implementation, you would filter/paginate the data based on these values
    // For now, we're just showing all data but with the new table UI
  }, [searchTerm, currentPage, rowsPerPage])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const usersData = await fetchUsers()
      setUsers(usersData)
      setTotalPages(Math.ceil(usersData.length / rowsPerPage) || 1)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load users.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    // Note: Roles are now loaded on-demand by AssignRoleSheet when needed
    // This function is kept for potential future use
  }

  const loadData = async () => {
    // Deprecated: Use loadUsers instead
    // This function is kept for backward compatibility but just calls loadUsers
    await loadUsers()
  }

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    
    try {
      const formData = new FormData(event.currentTarget)
      const firstName = formData.get("first_name") as string
      const lastName = formData.get("last_name") as string
      const phone = formData.get("phone") as string
      const roleId = formData.get("role_id") as string
      const isActive = formData.get("is_active") === "on"
      
      // Simple validation for required fields
      if (!firstName || !lastName) {
        toast({
          title: "Validation Error",
          description: "First name and last name are required.",
          variant: "destructive",
        })
        setSaving(false)
        return
      }
      
      // Create clean user data object
      let userData = {}
      
      // Always include these fields
      userData = {
        ...userData,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_active: isActive,
      }
      
      // Conditionally add optional fields only if they have values
      if (phone && phone.trim() !== "") {
        userData = { ...userData, phone: phone.trim() }
      }
      
      // Include role_id if provided
      userData = { 
        ...userData, 
        role_id: roleId && roleId.trim() !== "" && roleId !== "__no_role__" ? roleId : null 
      }
      
      // For new users only, include email
      if (!editingUser) {
        const email = formData.get("email") as string
        if (!email || email.trim() === "") {
          toast({
            title: "Validation Error",
            description: "Email is required for new users.",
            variant: "destructive",
          })
          setSaving(false)
          return
        }
        userData = { ...userData, email: email.trim() }
      }
      
      let result
      if (editingUser) {
        // Update existing user
        result = await updateUser(editingUser.id, userData)
        toast({
          title: "Success",
          description: "User updated successfully.",
        })
      } else {
        // Create new user
        result = await createUser(userData)
        toast({
          title: "Success",
          description: "User created successfully.",
        })
      }

      setIsModalOpen(false)
      setEditingUser(null)
      await loadData() // Reload data after successful operation
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

  const handleDeleteUser = async (user: UserData) => {
    const choice = confirm("Soft-delete this user (deactivate + hide)? OK = Soft Delete, Cancel = show options.\n\nFor Terminate or Hard Delete, use the row actions menu.")
    if (!choice) return
    try {
      await deleteUser(user.id, false)
      toast({
        title: "Success",
        description: "User soft-deleted successfully.",
      })
      await loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    }
  }

  const handleSoftDelete = async (user: UserData) => {
    if (!confirm(`Soft-delete ${user.email}? Account will be deactivated and hidden. You can restore it later.`)) return
    try {
      await softDeleteUser(user.id)
      toast({ title: "Success", description: "User soft-deleted." })
      await loadData()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleTerminate = async () => {
    if (!terminateUserTarget) return
    setTerminating(true)
    try {
      await terminateUser(terminateUserTarget.id, terminateReason)
      toast({ title: "Success", description: "User terminated successfully. Tokens revoked." })
      setTerminateDialogOpen(false)
      setTerminateReason("")
      setTerminateUserTarget(null)
      await loadData()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setTerminating(false)
    }
  }

  const handleRestore = async (user: UserData) => {
    if (!confirm(`Restore ${user.email}?`)) return
    try {
      await restoreUser(user.id)
      toast({ title: "Success", description: "User restored." })
      await loadData()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const openTerminateDialog = (user: UserData) => {
    setTerminateUserTarget(user)
    setTerminateReason("")
    setTerminateDialogOpen(true)
  }

  const openViewSheet = (user: UserData) => {
    setViewingUser(user)
    setIsViewOpen(true)
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setSelectedRoleId("")
    setIsModalOpen(true)
  }

  const openEditModal = (user: UserData) => {
    setEditingUser(user)
    setSelectedRoleId(user.role_id || "")
    setIsModalOpen(true)
  }

  const openAssignRoleSheet = (user: UserData) => {
    setSelectedUserForRole(user)
    setIsRoleSheetOpen(true)
  }

  const handleCreateRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreatingRole(true)
    
    try {
      const formData = new FormData(event.currentTarget)
      const roleData = {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
      }
      
      // Get enabled permissions
      const permissionIds: string[] = []
      Object.entries(currentPermissions).forEach(([permission, enabled]) => {
        if (enabled) {
          permissionIds.push(permission)
        }
      })

      // For now, we'll keep the direct API call for role creation as it's not yet in the roles.ts file
      const result = await apiCall("/roles", "POST", {
        ...roleData,
        permission_ids: permissionIds,
        is_active: true
      })
      
      toast({
        title: "Success",
        description: "Role created successfully.",
      })

      setIsCreateRoleSheetOpen(false)
      setCurrentPermissions({})
      await loadData() // Reload data after successful operation
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setCreatingRole(false)
    }
  }

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

  const openCreateRoleSheet = () => {
    // Initialize all permissions to false for a new role
    const initialPermissions: Record<string, boolean> = {}
    ALL_PERMISSIONS.forEach((perm) => {
      initialPermissions[perm] = false
    })
    setCurrentPermissions(initialPermissions)
    setIsCreateRoleSheetOpen(true)
  }

  const allPermissionsChecked = ALL_PERMISSIONS.every((perm) => currentPermissions[perm])
  const isGlobalIndeterminate = !allPermissionsChecked && ALL_PERMISSIONS.some((perm) => currentPermissions[perm])

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchTermLower = searchTerm.toLowerCase()
    return (
      (user.first_name && user.first_name.toLowerCase().includes(searchTermLower)) ||
      (user.last_name && user.last_name.toLowerCase().includes(searchTermLower)) ||
      (user.email && user.email.toLowerCase().includes(searchTermLower)) ||
      (user.role && user.role.name && user.role.name.toLowerCase().includes(searchTermLower))
    )
  })

  // Paginate users
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Users</CardTitle>
          {canManageUsers && (
            <>
              <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
                <SheetTrigger asChild>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="text-2xl font-bold">{editingUser ? "Edit User" : "Create New User"}</SheetTitle>
                    <SheetDescription className="text-base">
                      {editingUser ? "Make changes to this user's profile." : "Add a new user to your company."}
                    </SheetDescription>
                  </SheetHeader>
                  <form id="edit-user-form" onSubmit={handleFormSubmit} className="grid gap-6 py-4 flex-grow overflow-y-auto">
                    <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                      <h3 className="text-lg font-semibold mb-4">User Information</h3>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="first_name" className="text-right">
                          First Name *
                        </Label>
                        <Input
                          id="first_name"
                          name="first_name"
                          defaultValue={editingUser?.first_name || ""}
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-4">
                        <Label htmlFor="last_name" className="text-right">
                          Last Name *
                        </Label>
                        <Input
                          id="last_name"
                          name="last_name"
                          defaultValue={editingUser?.last_name || ""}
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-4">
                        <Label htmlFor="email" className="text-right">
                          Email {!editingUser && "*"}
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          defaultValue={editingUser?.email || ""}
                          className="col-span-3"
                          required={!editingUser}
                          readOnly={!!editingUser}
                          disabled={!!editingUser}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-4">
                        <Label htmlFor="phone" className="text-right">
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          defaultValue={editingUser?.phone || ""}
                          className="col-span-3"
                        />
                      </div>
                    </div>
                    
                    <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                      <h3 className="text-lg font-semibold mb-4">Role & Status</h3>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role_id" className="text-right">
                          Role
                        </Label>
                        <div className="col-span-3">
                          <Popover open={roleSearchOpen} onOpenChange={setRoleSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={roleSearchOpen}
                                className="w-full justify-between font-normal"
                              >
                                {selectedRoleId
                                  ? selectedRoleId === "__no_role__"
                                    ? "No role"
                                    : roles.find((r: any) => r.id === selectedRoleId)?.name
                                  : "Select a role"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search roles..." />
                                <CommandList>
                                  <CommandEmpty>No role found.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="No role"
                                      onSelect={() => {
                                        setSelectedRoleId("__no_role__")
                                        setRoleSearchOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedRoleId === "__no_role__" ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      No role
                                    </CommandItem>
                                    {roles.map((r: any) => (
                                      <CommandItem
                                        key={r.id}
                                        value={r.name}
                                        onSelect={() => {
                                          setSelectedRoleId(r.id)
                                          setRoleSearchOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedRoleId === r.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {r.name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <input type="hidden" name="role_id" value={selectedRoleId} />
                          <p className="text-xs text-muted-foreground mt-1">
                            Role determines permissions. You can also use "Assign Role" for detailed permission sync.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-4">
                        <Label htmlFor="is_active" className="text-right">
                          Status
                        </Label>
                        <div className="col-span-3 flex items-center">
                          <Switch
                            id="is_active"
                            name="is_active"
                            defaultChecked={editingUser?.is_active ?? true}
                          />
                          <Label htmlFor="is_active" className="ml-2">
                            Active
                          </Label>
                        </div>
                      </div>
                      {editingUser && (editingUser as any).terminated_at && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          Terminated at {(editingUser as any).terminated_at} — Reason: {(editingUser as any).termination_reason || "—"}
                        </div>
                      )}
                      {editingUser && (editingUser as any).deleted_at && !(editingUser as any).terminated_at && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                          Soft-deleted at {(editingUser as any).deleted_at}. Use Restore to recover.
                        </div>
                      )}
                    </div>
                  </form>
                  <SheetFooter className="mt-auto pt-4 border-t flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="submit" form="edit-user-form" disabled={saving} className="bg-primary hover:bg-primary/90">
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingUser ? "Update User" : "Create User"}
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              
              {/* Create Role Sheet */}
              <Sheet open={isCreateRoleSheetOpen} onOpenChange={setIsCreateRoleSheetOpen}>
                <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="text-2xl font-bold">Create New Role</SheetTitle>
                    <SheetDescription className="text-base">
                      Define a new role with specific access rights.
                    </SheetDescription>
                  </SheetHeader>
                  <form id="create-role-form" onSubmit={handleCreateRole} className="flex-grow overflow-y-auto py-4">
                    <div className="space-y-6">
                      {/* Role Details Section */}
                      <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                        <h3 className="text-lg font-semibold mb-4">Role Details</h3>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="name" className="text-right">
                            Role Name *
                          </Label>
                          <Input
                            id="name"
                            name="name"
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
                            className="col-span-3"
                            placeholder="Enter role description"
                          />
                        </div>
                      </div>

                      {/* Permissions Section */}
                      <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                        <h3 className="text-lg font-semibold mb-4">Permissions</h3>
                        
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
                                          id={`perm-${permission}`}
                                          checked={currentPermissions[permission] || false}
                                          onCheckedChange={(checked) => 
                                            handlePermissionChange(
                                              permission, 
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
                    </div>
                  </form>
                  <SheetFooter className="mt-auto pt-4 border-t flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setIsCreateRoleSheetOpen(false)} disabled={creatingRole}>
                      Cancel
                    </Button>
                    <Button type="submit" form="create-role-form" disabled={creatingRole} className="bg-primary hover:bg-primary/90">
                      {creatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Role
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </>
          )}
        </CardHeader>
        <CardContent>
          <UsersTableComponent
            users={paginatedUsers}
            loading={loading}
            onViewUser={openViewSheet}
            onEditUser={openEditModal}
            onDeleteUser={handleDeleteUser}
            onAssignRole={openAssignRoleSheet}
            onSoftDelete={handleSoftDelete}
            onTerminate={openTerminateDialog}
            onRestore={handleRestore}
            search={searchTerm}
            onSearchChange={setSearchTerm}
            currentPage={currentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
            totalItems={filteredUsers.length}
            onRefresh={loadData}
            onCreateNew={openCreateModal}
          />
        </CardContent>
      </Card>
      <AssignRoleSheet
        user={selectedUserForRole}
        open={isRoleSheetOpen}
        onOpenChange={setIsRoleSheetOpen}
        onRoleAssigned={loadData}
      />

      {/* Terminate Dialog */}
      <Dialog open={terminateDialogOpen} onOpenChange={setTerminateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate User Account</DialogTitle>
            <DialogDescription>
              This will permanently deactivate <span className="font-semibold">{terminateUserTarget?.email}</span>, revoke all tokens, and soft-delete the account. Provide a reason (optional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="terminate_reason">Reason</Label>
            <Textarea
              id="terminate_reason"
              placeholder="e.g. Violation of policy, left organization..."
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateDialogOpen(false)} disabled={terminating}>Cancel</Button>
            <Button variant="destructive" onClick={handleTerminate} disabled={terminating}>
              {terminating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ViewUserSheet
        user={viewingUser}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        onEdit={(u) => openEditModal(u)}
      />
    </>
  )
}
