"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Shield, 
  Users, 
  Key,
  Building2,
  AlertTriangle,
  Loader2
} from "lucide-react"
import {
  getCompanies,
  type Company
} from "@/lib/admin"
import {
  getPermissions,
  type Permission,
} from "@/lib/permissions"
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  assignPermissionsToRole,
  type Role,
  type CreateRolePayload,
  type UpdateRolePayload
} from "@/lib/roles"

// Add this import for the new AssignPermissionsDialog component
import { AssignPermissionsDialog } from "./components/assign-permissions-dialog"

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionCategories, setPermissionCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  // Add state for the assign permissions dialog
  const [isAssignPermissionsDialogOpen, setIsAssignPermissionsDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    company_id: "",
    permission_ids: [] as string[]
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      // Remove the getCompanies call since we don't need all companies to display roles
      // The role objects already contain company information
      const [rolesData, permissionsData] = await Promise.all([
        getRoles(),
        getPermissions()
      ])
      
      setRoles(Array.isArray(rolesData) ? rolesData : [])
      // Extract unique companies from roles instead of fetching all companies
      const uniqueCompaniesMap = new Map<string, { id: string; name: string }>()
      
      if (Array.isArray(rolesData)) {
        rolesData.forEach(role => {
          if (role.company && role.company.id && role.company.name) {
            uniqueCompaniesMap.set(role.company.id, {
              id: role.company.id,
              name: role.company.name
            })
          }
        })
      }
      
      const uniqueCompanies = Array.from(uniqueCompaniesMap.values())
      setCompanies(uniqueCompanies as unknown as Company[])
      setPermissions(Array.isArray(permissionsData.permissions) ? permissionsData.permissions : [])
      setPermissionCategories(Array.isArray(permissionsData.categories) ? permissionsData.categories : [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         role.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCompany = selectedCompany === "all" || 
                          role.company_id?.toString() === selectedCompany ||
                          (selectedCompany === "system" && role.is_system_role)
    return matchesSearch && matchesCompany
  })

  const handleCreateRole = async () => {
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
        permission_ids: formData.permission_ids
      }

      await createRole(payload)
      
      toast({
        title: "Success",
        description: "Role created successfully",
      })
      
      setIsCreateDialogOpen(false)
      resetForm()
      loadData()
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

  const handleUpdateRole = async () => {
    if (!selectedRole || !formData.name.trim() || !formData.description.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      
      // Convert permission_ids array to permissions object
      const permissionsObject: Record<string, boolean> = {}
      permissions.forEach(permission => {
        permissionsObject[permission.id] = formData.permission_ids.includes(permission.id)
      })
      
      const payload: UpdateRolePayload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        permissions: permissionsObject
      }

      await updateRole(selectedRole.id, payload)
      
      toast({
        title: "Success",
        description: "Role updated successfully",
      })
      
      setIsEditDialogOpen(false)
      setSelectedRole(null)
      resetForm()
      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!selectedRole) return

    try {
      setIsSubmitting(true)
      await deleteRole(selectedRole.id)
      
      toast({
        title: "Success",
        description: "Role deleted successfully",
      })
      
      setIsDeleteDialogOpen(false)
      setSelectedRole(null)
      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      company_id: "",
      permission_ids: []
    })
  }

  const openEditDialog = (role: Role) => {
    setSelectedRole(role)
    setFormData({
      name: role.name,
      description: role.description,
      company_id: role.company_id || "",
      permission_ids: role.permissions?.map(p => p.id) || []
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (role: Role) => {
    setSelectedRole(role)
    setIsDeleteDialogOpen(true)
  }

  // Add function to open assign permissions dialog
  const openAssignPermissionsDialog = (role: Role) => {
    setSelectedRole(role)
    setIsAssignPermissionsDialogOpen(true)
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: checked 
        ? [...prev.permission_ids, permissionId]
        : prev.permission_ids.filter(id => id !== permissionId)
    }))
  }

  const getPermissionsByCategory = (category: string) => {
    if (!Array.isArray(permissions)) {
      console.error('permissions is not an array:', permissions);
      return [];
    }
    return permissions.filter(p => p.category === category)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#E30040]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">Manage system roles and permissions</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Create a new system role with permissions
              </DialogDescription>
            </DialogHeader>
            <RoleForm 
              formData={formData}
              setFormData={setFormData}
              companies={companies}
              permissions={permissions}
              permissionCategories={permissionCategories}
              onSubmit={handleCreateRole}
              onCancel={() => setIsCreateDialogOpen(false)}
              isSubmitting={isSubmitting}
              isEdit={false}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.filter(r => r.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.filter(r => r.is_system_role).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="system">System Roles</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Roles Table */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    {role.company ? role.company.name : role.is_system_role ? "System" : "Unknown"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.is_system_role ? "default" : "outline"}>
                      {role.is_system_role ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.is_active ? "default" : "secondary"}>
                      {role.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{role.users?.length || 0}</TableCell>
                  <TableCell>{role.permissions?.length || 0}</TableCell>
                  <TableCell>
                    {new Date(role.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Add Assign Permissions button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignPermissionsDialog(role)}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(role)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(role)}
                        disabled={role.is_system_role}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role information and permissions
            </DialogDescription>
          </DialogHeader>
          <RoleForm 
            formData={formData}
            setFormData={setFormData}
            companies={companies}
            permissions={permissions}
            permissionCategories={permissionCategories}
            onSubmit={handleUpdateRole}
            onCancel={() => setIsEditDialogOpen(false)}
            isSubmitting={isSubmitting}
            isEdit={true}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this role? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">
                Deleting role: {selectedRole?.name}
              </p>
              <p className="text-sm text-red-700">
                This will remove the role from all users
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRole}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Role"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Assign Permissions Dialog */}
      <AssignPermissionsDialog
        role={selectedRole}
        open={isAssignPermissionsDialogOpen}
        onOpenChange={setIsAssignPermissionsDialogOpen}
        onPermissionsAssigned={loadData}
      />
    </div>
  )
}

// Role Form Component
interface RoleFormProps {
  formData: {
    name: string
    description: string
    company_id: string
    permission_ids: string[]
  }
  setFormData: (data: any) => void
  companies: Company[]
  permissions: Permission[]
  permissionCategories: string[]
  onSubmit: () => void
  onCancel: () => void
  isSubmitting: boolean
  isEdit: boolean
}

function RoleForm({ 
  formData, 
  setFormData, 
  companies, 
  permissions, 
  permissionCategories,
  onSubmit, 
  onCancel, 
  isSubmitting,
  isEdit 
}: RoleFormProps) {
  const getPermissionsByCategory = (category: string) => {
    if (!Array.isArray(permissions)) {
      console.error('permissions is not an array:', permissions);
      return [];
    }
    return permissions.filter(p => p.category === category)
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      permission_ids: checked 
        ? [...prev.permission_ids, permissionId]
        : prev.permission_ids.filter((id: string) => id !== permissionId)
    }))
  }

  return (
    <div className="space-y-6">
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

        {!isEdit && (
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
        )}
      </div>

      <div>
        <Label>Permissions</Label>
        <div className="space-y-6 mt-4">
          {permissionCategories.map((category) => {
            const categoryPermissions = getPermissionsByCategory(category)
            if (categoryPermissions.length === 0) return null

            return (
              <div key={category} className="space-y-3">
                <h4 className="font-medium text-sm text-gray-900 capitalize">
                  {category.replace(/_/g, ' ')}
                </h4>
                <div className="grid grid-cols-1 gap-3 pl-4">
                  {categoryPermissions.map((permission) => (
                    <div key={permission.id} className="flex items-start space-x-3">
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
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEdit ? "Updating..." : "Creating..."}
            </>
          ) : (
            isEdit ? "Update Role" : "Create Role"
          )}
        </Button>
      </div>
    </div>
  )
}
