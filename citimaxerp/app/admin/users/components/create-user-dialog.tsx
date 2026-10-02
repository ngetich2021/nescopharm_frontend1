"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { Loader2, Plus, Shield } from "lucide-react"
import { 
  getCompanies,
  type Company,
} from "@/lib/admin"
import { 
  getRoles,
  createRole,
  type Role,
  type CreateRolePayload
} from "@/lib/roles"
import { createUser } from "@/lib/users"

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserCreated: () => void
}

export function CreateUserDialog({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    company_id: "",
    role_id: ""
  })
  
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
    company_id: ""
  })
  
  const [showCreateRoleForm, setShowCreateRoleForm] = useState(false)

  useEffect(() => {
    if (open) {
      loadInitialData()
    }
  }, [open])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [companiesData, rolesData] = await Promise.all([
        getCompanies({ per_page: 1000 }),
        getRoles()
      ])
      setCompanies(companiesData.data || [])
      setRoles(rolesData || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load initial data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // When company changes, reset role and show create role form
    if (name === "company_id") {
      setFormData(prev => ({ ...prev, role_id: "" }))
      setNewRole(prev => ({ ...prev, company_id: value }))
    }
  }

  const handleNewRoleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNewRole(prev => ({ ...prev, [name]: value }))
  }

  const handleCreateRole = async () => {
    if (!newRole.name.trim() || !newRole.description.trim() || !newRole.company_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields for the role",
        variant: "destructive",
      })
      return
    }

    try {
      setIsCreatingRole(true)
      const payload: CreateRolePayload = {
        name: newRole.name.trim(),
        description: newRole.description.trim(),
        company_id: newRole.company_id,
        permission_ids: []
      }

      const createdRole = await createRole(payload)
      
      toast({
        title: "Success",
        description: "Role created successfully",
      })
      
      // Add the new role to the roles list
      setRoles(prev => [...prev, createdRole])
      
      // Select the new role
      setFormData(prev => ({ ...prev, role_id: createdRole.id }))
      
      // Hide the create role form
      setShowCreateRoleForm(false)
      
      // Reset new role form
      setNewRole({
        name: "",
        description: "",
        company_id: formData.company_id
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create role",
        variant: "destructive",
      })
    } finally {
      setIsCreatingRole(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.first_name.trim() || 
        !formData.last_name.trim() || 
        !formData.email.trim() || 
        !formData.password.trim() || 
        !formData.company_id || 
        !formData.role_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      
      // Create FormData object for the API call
      const formDataObj = new FormData()
      formDataObj.append("first_name", formData.first_name.trim())
      formDataObj.append("last_name", formData.last_name.trim())
      formDataObj.append("email", formData.email.trim())
      formDataObj.append("password", formData.password)
      formDataObj.append("company_id", formData.company_id)
      formDataObj.append("role_id", formData.role_id)
      
      if (formData.phone) {
        formDataObj.append("phone", formData.phone)
      }

      await createUser(formDataObj)
      
      toast({
        title: "Success",
        description: "User created successfully",
      })
      
      // Reset form
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        password: "",
        company_id: "",
        role_id: ""
      })
      
      // Close dialog and refresh user list
      onOpenChange(false)
      onUserCreated()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const companyRoles = roles.filter(role => 
    role.company_id === formData.company_id || role.is_system_role
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system. Fill in the user details and assign a role.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="Enter first name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Enter last name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter email address"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter phone number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter password"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company_id">Company *</Label>
              <Select 
                value={formData.company_id} 
                onValueChange={(value) => handleSelectChange("company_id", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="role_id">Role *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateRoleForm(true)
                    setNewRole(prev => ({ ...prev, company_id: formData.company_id }))
                  }}
                  disabled={!formData.company_id}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Role
                </Button>
              </div>
              
              <Select 
                value={formData.role_id} 
                onValueChange={(value) => handleSelectChange("role_id", value)}
                required
                disabled={!formData.company_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {companyRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center">
                        {role.name}
                        {role.is_system_role && (
                          <Shield className="ml-2 h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {showCreateRoleForm && (
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium">Create New Role</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role_name">Role Name *</Label>
                  <Input
                    id="role_name"
                    name="name"
                    value={newRole.name}
                    onChange={handleNewRoleChange}
                    placeholder="Enter role name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role_company">Company</Label>
                  <Select 
                    value={newRole.company_id} 
                    onValueChange={(value) => setNewRole(prev => ({ ...prev, company_id: value }))}
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies
                        .filter(c => c.id === formData.company_id)
                        .map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="role_description">Description *</Label>
                  <Textarea
                    id="role_description"
                    name="description"
                    value={newRole.description}
                    onChange={handleNewRoleChange}
                    placeholder="Enter role description"
                    required
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateRoleForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateRole}
                  disabled={isCreatingRole}
                >
                  {isCreatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Role
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}