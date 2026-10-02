"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PlusCircle, Edit, Trash2, Shield, Check, ChevronsUpDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { fetchUsers, createUser, updateUser, deleteUser } from "../actions"
import {
  Sheet, // Changed from Dialog
  SheetContent, // Changed from DialogContent
  SheetDescription, // Changed from DialogDescription
  SheetFooter, // Changed from DialogFooter
  SheetHeader, // Changed from DialogHeader
  SheetTitle, // Changed from DialogTitle
  SheetTrigger, // Changed from DialogTrigger
} from "@/components/ui/sheet" // Import Sheet components
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import type { PermissionKey } from "@/types/rbac"
import type { Role, Permissions } from "@/app/types"
import { fetchRoles } from "../actions"
import { useAuth } from "@/lib/auth-context"
import { AssignUserPermissionsSheet } from "./assign-user-permissions-sheet"
import { PermissionGuard } from "@/components/PermissionGuard"
import { usePermissions } from "@/hooks/use-permissions"

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

export function UsersTable() {
  const [users, setUsers] = useState<UserData[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<UserData | null>(null)
  const [isPermissionsSheetOpen, setIsPermissionsSheetOpen] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [roleSearchOpen, setRoleSearchOpen] = useState(false)
  const { toast } = useToast()
  const { userProfile } = useAuth()
  const { hasPermission } = usePermissions()

  const canManageUsers = hasPermission("can_manage_users_and_roles") || 
                        hasPermission("can_manage_system") || 
                        hasPermission("can_manage_company")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersData, rolesData] = await Promise.all([fetchUsers(), fetchRoles()])
      setUsers(usersData as UserData[])
      // Convert roles to match the expected Role interface
      const convertedRoles = rolesData.map(role => {
        // Create a default permissions object with all permissions set to false
        const defaultPermissions: Permissions = {
          can_view_dashboard_menu: false,
          // Customers
          can_view_customers_menu: false,
          // Sales - General
          can_view_sales_menu: false,
          // Sales - Orders
          can_view_orders_menu: false,
          // Sales - Quotes
          can_view_quotes_menu: false,
          // Sales - Invoices
          can_view_invoices_menu: false,
          // Inventory - General
          can_view_inventory_menu: false,
          // Inventory - Products
          can_view_products_menu: false,
          // Inventory - Stock Counts
          can_view_stock_counts_menu: false,
          // Logistics
          can_view_logistics_menu: false,
          // Dispatch
          can_view_dispatch_menu: false,
          // Product Receipt
          can_view_product_receipt_menu: false,
          // Requisitions
          can_view_requisitions_menu: false,
          // Breakages
          can_view_breakages_menu: false,
          // Repairs
          can_view_repairs_menu: false,
          // Payments
          can_view_payments_menu: false,
          can_view_payment_reports_menu: false,
          // Suppliers
          can_view_suppliers_menu: false,
          // Purchase Orders
          can_view_purchase_orders_menu: false,
          // Expenses
          can_view_expenses_menu: false,
          // Finance
          can_view_finance_menu: false,
          // HR & Payroll
          can_view_employees_menu: false,
          can_view_payroll_menu: false,
          // POS
          can_view_pos_menu: false,
          // Chat
          can_view_chat_menu: false,
          // Reports
          can_view_reports_menu: false,
          // Settings
          can_view_settings_menu: false,
          can_manage_users_and_roles: false,
          // Admin Portal
          can_access_admin_portal: false,
          can_manage_companies: false,
          can_manage_all_users: false,
          can_manage_system: false,
          can_manage_company: false,
          can_manage_permissions: false,
          can_manage_roles: false,
          // Analytics
          can_view_analytics_dashboard_menu: false,
          // Finance Dashboard
          can_view_finance_dashboard_menu: false,
          // HR Dashboard
          can_view_hr_dashboard_menu: false,
          // Financial Reports
          can_view_balance_sheet: false,
          can_view_income_statement: false,
          can_view_cash_flow_statement: false,
          can_view_financial_ratios: false,
          can_view_account_aging: false,
          can_view_budget_variance: false,
          can_view_chart_of_accounts: false,
          can_view_journal_entries: false,
          can_view_general_ledger: false,
          can_view_trial_balance: false,
          can_view_bank_accounts: false,
          can_view_budgets: false
        };
        
        // Override with actual permissions from the role
        if (role.permissions) {
          role.permissions.forEach(perm => {
            const key = perm.key as PermissionKey;
            if (key in defaultPermissions) {
              defaultPermissions[key] = true;
            }
          });
        }
        
        return {
          id: role.id,
          name: role.name,
          description: role.description,
          permissions: defaultPermissions,
          is_active: role.is_active,
          created_at: role.created_at,
          company_id: role.company_id
        } as Role;
      });
      setRoles(convertedRoles);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load user and role data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const formData = new FormData(event.currentTarget)

    try {
      let result
      if (editingUser) {
        result = await updateUser(editingUser.id, formData)
      } else {
        result = await createUser(formData)
      }

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        setIsModalOpen(false)
        setEditingUser(null)
        await loadData() // Reload data after successful operation
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

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return
    }
    try {
      const result = await deleteUser(userId)
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        await loadData()
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
    setEditingUser(null)
    setSelectedRoleId("")
    setIsModalOpen(true)
  }

  const openEditModal = (user: UserData) => {
    setEditingUser(user)
    setSelectedRoleId(user.role?.id || "")
    setIsModalOpen(true)
  }

  const openAssignPermissionsSheet = (user: UserData) => {
    setSelectedUserForPermissions(user)
    setIsPermissionsSheetOpen(true)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-2xl font-bold">Users</CardTitle>
        <PermissionGuard permissions={["can_manage_users_and_roles", "can_manage_system", "can_manage_company"]} hideOnDenied>
          <>
            <Sheet open={isModalOpen} onOpenChange={setIsModalOpen}>
              {" "}
              {/* Changed from Dialog */}
              <SheetTrigger asChild>
                {" "}
                {/* Changed from DialogTrigger */}
                <Button onClick={openCreateModal} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add User
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
                {" "}
                {/* Changed from DialogContent, added side="right" and flex-col */}
                <SheetHeader>
                  {" "}
                  {/* Changed from DialogHeader */}
                  <SheetTitle>{editingUser ? "Edit User" : "Create New User"}</SheetTitle>{" "}
                  {/* Changed from DialogTitle */}
                  <SheetDescription>
                    {" "}
                    {/* Changed from DialogDescription */}
                    {editingUser ? "Make changes to this user's profile." : "Add a new user to your company."}
                  </SheetDescription>
                </SheetHeader>
                <form id="edit-user-form" onSubmit={handleFormSubmit} className="grid gap-4 py-4 flex-grow overflow-y-auto">
                  {" "}
                  {/* Added flex-grow and overflow-y-auto */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="first_name" className="text-right">
                      First Name
                    </Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      defaultValue={editingUser?.first_name || ""}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="last_name" className="text-right">
                      Last Name
                    </Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      defaultValue={editingUser?.last_name || ""}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={editingUser?.email || ""}
                      className="col-span-3"
                      required
                      disabled={!!editingUser} // Disable email editing for existing users
                    />
                  </div>
                  {!editingUser && ( // Only show password field when creating a new user
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="password" className="text-right">
                        Password
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        className="col-span-3"
                        required
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
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
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role_id" className="text-right">
                      Role
                    </Label>
                    <Popover open={roleSearchOpen} onOpenChange={setRoleSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={roleSearchOpen}
                          className="col-span-3 w-full justify-between font-normal"
                        >
                          {selectedRoleId
                            ? roles.find((role) => role.id === selectedRoleId)?.name
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
                              {roles.map((role) => (
                                <CommandItem
                                  key={role.id}
                                  value={role.name}
                                  onSelect={() => {
                                    setSelectedRoleId(role.id)
                                    setRoleSearchOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedRoleId === role.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {role.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <input type="hidden" name="role_id" value={selectedRoleId} required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
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
                </form>
                {" "}
                {/* Added form closing tag */}
                <SheetFooter className="mt-auto pt-4 border-t">
                  {" "}
                  {/* Changed from DialogFooter, added mt-auto and pt-4 */}
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" form="edit-user-form" disabled={saving}>
                    {" "}
                    {/* Added form attribute */}
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingUser ? "Update User" : "Create User"}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            
            <AssignUserPermissionsSheet
              user={selectedUserForPermissions}
              open={isPermissionsSheetOpen}
              onOpenChange={setIsPermissionsSheetOpen}
              onPermissionsAssigned={loadData}
            />
          </>
        </PermissionGuard>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.first_name} {user.last_name}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role?.name || "No role assigned"}</TableCell>
                  <TableCell>
                    {user.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <PermissionGuard permissions={["can_manage_users_and_roles", "can_manage_system", "can_manage_company"]} hideOnDenied>
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAssignPermissionsSheet(user)}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      </PermissionGuard>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}