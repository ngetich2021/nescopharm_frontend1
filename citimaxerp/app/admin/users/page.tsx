"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, PlusCircle, Users, Check, RefreshCw, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getAdminUsers,
  getCompanies,
  type AdminUser,
  type Company,
} from "@/lib/admin"
import { 
  getRoles,
  type Role
} from "@/lib/roles"
import { deleteUser } from "@/lib/users"
import { CreateUserDialog } from "./components/create-user-dialog"
import { AssignPermissionsDialog } from "./components/assign-permissions-dialog"
import { ViewUserSheet } from "@/app/users/components/view-user-sheet"
import UsersTable from "./components/UsersTable"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [companyFilter, setCompanyFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false)
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<AdminUser | null>(null)
  const [isAssignPermissionsDialogOpen, setIsAssignPermissionsDialogOpen] = useState(false)
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadUsers()
  }, [currentPage, searchTerm, companyFilter, statusFilter, rowsPerPage])

  const loadInitialData = async () => {
    try {
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
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const filters: any = {
        page: currentPage,
        per_page: rowsPerPage
      }
      
      if (searchTerm) filters.search = searchTerm
      if (companyFilter && companyFilter !== "all") filters.company_id = companyFilter
      if (statusFilter && statusFilter !== "all") {
        // Convert status filter to is_active boolean for the API
        if (statusFilter === "active") {
          filters.is_active = true
        } else if (statusFilter === "inactive") {
          filters.is_active = false
        }
      }

      const data = await getAdminUsers(filters)
      setUsers(data.data || [])
      setTotalPages(data.pagination?.last_page || 1)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load users",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Table event handlers
  const handleViewUser = (user: AdminUser) => {
    setViewingUser(user)
    setIsViewOpen(true)
  }

  const handleEditUser = (user: AdminUser) => {
    // For now, we'll just show a toast. In a real implementation, you might open an edit modal.
    toast({
      title: "Edit User",
      description: `Editing ${user.first_name} ${user.last_name}`,
    })
  }

  const handleDeleteUser = async (user: AdminUser) => {
    try {
      await deleteUser(user.id)
      toast({
        title: "Success",
        description: `User ${user.first_name} ${user.last_name} deleted successfully`,
      })
      loadUsers() // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      })
    }
  }

  const handleAssignPermissions = (user: AdminUser) => {
    setSelectedUserForPermissions(user)
    setIsAssignPermissionsDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Users Management</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={companyFilter} onValueChange={(value) => setCompanyFilter(value === "all" ? undefined : value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value === "all" ? undefined : value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-blue-700">
                  {selectedUsers.length} user(s) selected
                </div>
                <div className="flex gap-2">
                  
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => setSelectedUsers([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(users) ? users.length : 0}</div>
            <p className="text-xs text-muted-foreground">All users in system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(users) ? users.filter(u => u.is_active).length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(companies) ? companies.length : 0}</div>
            <p className="text-xs text-muted-foreground">Total companies</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <UsersTable
        users={users}
        loading={loading}
        onViewUser={handleViewUser}
        onEditUser={handleEditUser}
        onDeleteUser={handleDeleteUser}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        totalItems={users.length}
        onRefresh={loadUsers}
        onCreateNew={() => setIsCreateUserDialogOpen(true)}
        onAssignPermissions={handleAssignPermissions}
      />

      <CreateUserDialog 
        open={isCreateUserDialogOpen} 
        onOpenChange={setIsCreateUserDialogOpen}
        onUserCreated={loadUsers}
      />
      
      <AssignPermissionsDialog
        user={selectedUserForPermissions}
        open={isAssignPermissionsDialogOpen}
        onOpenChange={setIsAssignPermissionsDialogOpen}
        onPermissionsAssigned={loadUsers}
      />

      <ViewUserSheet
        user={viewingUser as any}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        onEdit={(u: any) => handleEditUser(u)}
      />
    </div>
  )
}