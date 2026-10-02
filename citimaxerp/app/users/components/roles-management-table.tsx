"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { 
  getRoles, 
  createRole, 
  updateRole, 
  deleteRole, 
  type Role as ApiRole 
} from "@/lib/roles"
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from "@/lib/rbac"
import type { PermissionKey } from "@/types/rbac"
import { 
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Search,
  Download,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  Loader2
} from "lucide-react"
import { AssignRolePermissionsDialog } from "./assign-role-permissions-dialog"
import { AddRoleDialog } from "./add-role-dialog"

// Define the local Role interface to match the component's expectations
interface Role {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  permissions: Record<string, boolean>
  company?: {
    id: string
    name: string
  }
  users_count: number
}

export function RolesManagementTable() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [saving, setSaving] = useState(false)
  const [currentPermissions, setCurrentPermissions] = useState<Record<string, boolean>>({})
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<ApiRole | null>(null)
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false)
  const [isAddRoleSheetOpen, setIsAddRoleSheetOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const { toast } = useToast()
  const { userProfile } = useAuth()

  const canManageRoles = true // Simplified for now
  const companyId = userProfile?.company?.id || ""

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
      // Use the getRoles function from roles.ts which handles the API response properly
      const rolesData = await getRoles()
      
      // Transform the API response to match the component's expectations
      const transformedRoles: Role[] = rolesData.map((role: ApiRole) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        is_active: role.is_active,
        created_at: role.created_at,
        permissions: {}, // Will be populated if needed
        company: role.company ? {
          id: role.company.id,
          name: role.company.name
        } : undefined,
        users_count: role.users ? role.users.length : 0
      }))
      
      setRoles(transformedRoles)
      setTotalPages(Math.ceil(transformedRoles.length / rowsPerPage) || 1)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load role data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    
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

      let result
      if (editingRole) {
        // Update existing role
        result = await updateRole(editingRole.id, {
          name: roleData.name,
          description: roleData.description,
          permissions: currentPermissions
        })
        toast({
          title: "Success",
          description: "Role updated successfully.",
        })
      } else {
        // Create new role
        result = await createRole({
          name: roleData.name,
          description: roleData.description,
          company_id: companyId,
          permission_ids: permissionIds
        })
        toast({
          title: "Success",
          description: "Role created successfully.",
        })
      }

      setIsModalOpen(false)
      setEditingRole(null)
      setCurrentPermissions({})
      await loadRoles() // Reload data after successful operation
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
      await deleteRole(role.id)
      toast({
        title: "Success",
        description: "Role deleted successfully.",
      })
      await loadRoles()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    }
  }

  const openAssignPermissionsDialog = (role: Role) => {
    // Transform the local Role to the ApiRole type
    const apiRole: ApiRole = {
      id: role.id,
      name: role.name,
      description: role.description || "",
      is_active: role.is_active,
      created_at: role.created_at,
      updated_at: role.created_at, // Using created_at as updated_at for now
      company_id: role.company?.id || null,
      is_system_role: false, // Default value
      permissions: [] // Empty array for now, will be populated by the API
    };
    setSelectedRoleForPermissions(apiRole);
    setIsPermissionsDialogOpen(true);
  }

  const openCreateModal = () => {
    setEditingRole(null)
    // Initialize all permissions to false for a new role
    const initialPermissions: Record<string, boolean> = {}
    ALL_PERMISSIONS.forEach((perm) => {
      initialPermissions[perm] = false
    })
    setCurrentPermissions(initialPermissions)
    setIsModalOpen(true)
  }

  const openEditModal = (role: Role) => {
    setEditingRole(role)
    // Set current permissions from role
    setCurrentPermissions(role.permissions || {})
    setIsModalOpen(true)
  }

  const allPermissionsChecked = ALL_PERMISSIONS.every((perm) => currentPermissions[perm])
  const isGlobalIndeterminate = !allPermissionsChecked && ALL_PERMISSIONS.some((perm) => currentPermissions[perm])

  // Filter roles based on search term
  const filteredRoles = roles.filter(role => {
    const searchTermLower = searchTerm.toLowerCase()
    return (
      (role.name && role.name.toLowerCase().includes(searchTermLower)) ||
      (role.description && role.description.toLowerCase().includes(searchTermLower)) ||
      (role.company && role.company.name && role.company.name.toLowerCase().includes(searchTermLower))
    )
  })

  // Paginate roles
  const paginatedRoles = filteredRoles.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge variant="secondary" className="bg-red-100 text-red-800">Inactive</Badge>
    );
  };

  const ActionsDropdown = ({ 
    role,
    onView,
    onEdit,
    onDelete,
    onAssignPermissions
  }: { 
    role: Role;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onAssignPermissions: (role: Role) => void;
  }) => {
    // Define action availability based on role status/conditions
    const canEdit = true; // Can be modified based on role status
    const canDelete = true; // Can be modified based on role status

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={onView}>
            <Eye className="h-4 w-4 mr-2" /> View Details
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" /> Edit Role
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            onAssignPermissions(role);
          }}>
            <Shield className="h-4 w-4 mr-2" /> Assign Permissions
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4 mr-2" /> Delete Role
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-2xl font-bold">Roles</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
                <Input
                  className="pl-8 max-w-sm"
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddRoleSheetOpen(true)}
                className="border-primary text-primary hover:bg-primary/10"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Role
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={loadRoles}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Role Name</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Company</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Users</TableHead>
                  <TableHead className="font-semibold">Permissions</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#E30040]"></div>
                        <span>Loading roles...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="text-gray-500">
                        <p className="font-semibold">No roles found</p>
                        <p className="text-sm">Add your first role to get started</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRoles.map((role) => {
                    const permissionsCount = Object.values(role.permissions || {}).filter(Boolean).length;
                    
                    return (
                      <TableRow 
                        key={role.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          toast({
                            title: "View Role",
                            description: `Viewing details for ${role.name}`,
                          })
                        }}
                      >
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">
                              {role.name || "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {role.description || "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {role.company?.name || "System"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(role.is_active)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {role.users_count}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {permissionsCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {role.created_at ? format(new Date(role.created_at), "MMM dd, yyyy") : "-"}
                            {role.created_at && (
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(role.created_at), "HH:mm")}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <ActionsDropdown
                            role={role}
                            onView={() => {
                              toast({
                                title: "View Role",
                                description: `Viewing details for ${role.name}`,
                              })
                            }}
                            onEdit={() => openEditModal(role)}
                            onDelete={() => handleDeleteRole(role)}
                            onAssignPermissions={openAssignPermissionsDialog}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={rowsPerPage.toString()}
                onValueChange={(value) => {
                  setRowsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={rowsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={pageSize.toString()}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center justify-center text-sm font-medium">
                Page {currentPage} of {totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages || 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <AssignRolePermissionsDialog
          role={selectedRoleForPermissions}
          open={isPermissionsDialogOpen}
          onOpenChange={setIsPermissionsDialogOpen}
          onPermissionsAssigned={loadRoles}
        />
        <AddRoleDialog
          open={isAddRoleSheetOpen}
          onOpenChange={setIsAddRoleSheetOpen}
          onSuccess={loadRoles}
          companyId={companyId}
        />
      </CardContent>
    </Card>
  )
}