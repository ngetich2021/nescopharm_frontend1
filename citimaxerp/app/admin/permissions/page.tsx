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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Key, 
  Shield,
  AlertTriangle,
  Loader2,
  Lock
} from "lucide-react"
import {
  getPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  type Permission,
  type CreatePermissionPayload
} from "@/lib/permissions"
import { useAuth } from "@/lib/auth-context"

export default function PermissionsPage() {
  const { user, hasPermission } = useAuth()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    category: "",
    is_system: false,
    is_active: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasViewPermission, setHasViewPermission] = useState(false)

  useEffect(() => {
    // Check if the user has permission to view permissions
    if (user) {
      const canViewPermissions = hasPermission('view_permissions')
      setHasViewPermission(canViewPermissions)
      
      if (canViewPermissions) {
        loadPermissions()
      } else {
        toast({
          title: "Access Denied",
          description: "You don't have permission to view the permissions page.",
          variant: "destructive"
        })
      }
    }
  }, [user, hasPermission])

  const loadPermissions = async () => {
    try {
      setLoading(true)
      const data = await getPermissions()
      
      // Ensure permissions is always an array
      const permissionsArray = Array.isArray(data.permissions) ? data.permissions : [];
      const categoriesArray = Array.isArray(data.categories) ? data.categories : [];
      
      console.log('Permissions data received:', { 
        permissions: permissionsArray, 
        categories: categoriesArray 
      });
      
      setPermissions(permissionsArray)
      setCategories(categoriesArray)
    } catch (error: any) {
      console.error('Error loading permissions:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load permissions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredPermissions = Array.isArray(permissions) 
    ? permissions.filter(permission => {
        const matchesSearch = permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           permission.description.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = selectedCategory === "all" || permission.category === selectedCategory
        return matchesSearch && matchesCategory
      })
    : []

  const handleCreatePermission = async () => {
    if (!hasPermission('create_permission')) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to create new permissions.",
        variant: "destructive"
      })
      return
    }
    
    // Only require name and category for creation, key and description are optional
    if (!formData.name.trim() || !formData.category.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Name and Category)",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const payload: CreatePermissionPayload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        key: formData.key.trim() || '', // Ensure key is always a string
        description: formData.description.trim() || '', // Ensure description is always a string
        is_system: formData.is_system,
        is_active: formData.is_active
      }

      await createPermission(payload)
      
      toast({
        title: "Success",
        description: "Permission created successfully",
      })
      
      setIsCreateDialogOpen(false)
      resetForm()
      loadPermissions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create permission",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdatePermission = async () => {
    if (!hasPermission('update_permission')) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to update permissions.",
        variant: "destructive"
      })
      return
    }
    
    if (!selectedPermission || !formData.name.trim() || !formData.category.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Name and Category)",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const payload: Partial<CreatePermissionPayload> = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        key: formData.key.trim() || '', // Ensure key is always a string
        description: formData.description.trim() || '', // Ensure description is always a string
        is_system: formData.is_system,
        is_active: formData.is_active
      }

      await updatePermission(selectedPermission.id, payload)
      
      toast({
        title: "Success",
        description: "Permission updated successfully",
      })
      
      setIsEditDialogOpen(false)
      setSelectedPermission(null)
      resetForm()
      loadPermissions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update permission",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePermission = async () => {
    if (!hasPermission('delete_permission')) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to delete permissions.",
        variant: "destructive"
      })
      return
    }
    
    if (!selectedPermission) return

    try {
      setIsSubmitting(true)
      await deletePermission(selectedPermission.id)
      
      toast({
        title: "Success",
        description: "Permission deleted successfully",
      })
      
      setIsDeleteDialogOpen(false)
      setSelectedPermission(null)
      loadPermissions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete permission",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      key: "",
      description: "",
      category: "",
      is_system: false,
      is_active: true
    })
  }

  const openEditDialog = (permission: Permission) => {
    setSelectedPermission(permission)
    setFormData({
      name: permission.name,
      key: permission.key,
      description: permission.description,
      category: permission.category,
      is_system: permission.is_system,
      is_active: permission.is_active
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (permission: Permission) => {
    setSelectedPermission(permission)
    setIsDeleteDialogOpen(true)
  }

  const getPermissionsByCategory = () => {
    const grouped: { [key: string]: Permission[] } = {}
    
    // Ensure filteredPermissions is an array before attempting to iterate
    if (!Array.isArray(filteredPermissions)) {
      console.error('filteredPermissions is not an array:', filteredPermissions);
      return grouped;
    }
    
    filteredPermissions.forEach(permission => {
      if (!grouped[permission.category]) {
        grouped[permission.category] = []
      }
      grouped[permission.category].push(permission)
    })
    return grouped
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#E30040]" />
      </div>
    )
  }

  if (!hasViewPermission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Lock className="h-16 w-16 text-[#E30040]" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to view this page. Please contact your administrator to request access.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Permission Management</h1>
          <p className="text-muted-foreground">Manage system permissions and access controls</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={resetForm} 
              disabled={!hasPermission('create_permission')}
              title={!hasPermission('create_permission') ? "You don't have permission to create permissions" : ""}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Permission
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Permission</DialogTitle>
              <DialogDescription>
                Create a new system permission
              </DialogDescription>
            </DialogHeader>
            <PermissionForm 
              formData={formData}
              setFormData={setFormData}
              categories={categories}
              onSubmit={handleCreatePermission}
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
            <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(permissions) ? permissions.length : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Permissions</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(permissions) ? permissions.filter(p => p.is_system_permission).length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Permissions</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(permissions) ? permissions.filter(p => !p.is_system_permission).length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(categories) ? categories.length : 0}</div>
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
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Permissions by Category */}
      <div className="space-y-6">
        {Object.entries(getPermissionsByCategory() || {}).map(([category, categoryPermissions]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                <Badge variant="outline">{categoryPermissions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created On</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryPermissions.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell className="font-medium">{permission.name}</TableCell>
                      <TableCell className="font-mono text-sm">{permission.key}</TableCell>
                      <TableCell className="max-w-md">{permission.description}</TableCell>
                      <TableCell>
                        <Badge variant={permission.is_system_permission ? "default" : "outline"}>
                          {permission.is_system_permission ? "System" : "Custom"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={permission.is_active ? "default" : "secondary"}>
                          {permission.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {permission.creator ? `${permission.creator.first_name} ${permission.creator.last_name}` : "Unknown"}
                      </TableCell>
                      <TableCell>
                        {new Date(permission.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(permission)}
                            disabled={permission.is_system_permission || !hasPermission('update_permission')}
                            title={!hasPermission('update_permission') ? "You don't have permission to edit permissions" : 
                                  permission.is_system_permission ? "System permissions cannot be edited" : ""}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(permission)}
                            disabled={permission.is_system_permission || !hasPermission('delete_permission')}
                            title={!hasPermission('delete_permission') ? "You don't have permission to delete permissions" : 
                                  permission.is_system_permission ? "System permissions cannot be deleted" : ""}
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
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
            <DialogDescription>
              Update permission information
            </DialogDescription>
          </DialogHeader>
          <PermissionForm 
            formData={formData}
            setFormData={setFormData}
            categories={categories}
            onSubmit={handleUpdatePermission}
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
            <DialogTitle>Delete Permission</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this permission? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">
                Deleting permission: {selectedPermission?.name}
              </p>
              <p className="text-sm text-red-700">
                This will remove the permission from all roles and users
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
              onClick={handleDeletePermission}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Permission"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Permission Form Component
interface PermissionFormProps {
  formData: {
    name: string
    key: string
    description: string
    category: string
    is_system: boolean
    is_active: boolean
  }
  setFormData: (data: any) => void
  categories: string[]
  onSubmit: () => void
  onCancel: () => void
  isSubmitting: boolean
  isEdit: boolean
}

function PermissionForm({ 
  formData, 
  setFormData, 
  categories,
  onSubmit, 
  onCancel, 
  isSubmitting,
  isEdit 
}: PermissionFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Permission Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter permission name (e.g., manage_users)"
        />
      </div>
      
      <div>
        <Label htmlFor="key">{isEdit ? "Permission Key *" : "Permission Key"}</Label>
        <Input
          id="key"
          value={formData.key}
          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
          placeholder="Enter permission key (e.g., can_manage_users)"
        />
      </div>

      <div>
        <Label htmlFor="description">{isEdit ? "Description *" : "Description"}</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter permission description"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="category">Category *</Label>
        <Select 
          value={formData.category} 
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select or enter category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="mt-2"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="Or type a new category"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="is_system"
            checked={formData.is_system}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_system: checked })}
          />
          <Label htmlFor="is_system">System Permission</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_active: checked })}
          />
          <Label htmlFor="is_active">Active</Label>
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
            isEdit ? "Update Permission" : "Create Permission"
          )}
        </Button>
      </div>
    </div>
  )
}
