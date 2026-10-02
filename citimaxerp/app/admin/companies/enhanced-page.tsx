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
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Building2, 
  Users, 
  CreditCard,
  MoreHorizontal,
  AlertTriangle,
  Loader2,
  Eye,
  UserCheck,
  UserX,
  Ban,
  CheckCircle
} from "lucide-react"
import { format } from "date-fns"
import {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  toggleCompanyStatus,
  getSubscriptionPlans,
  type Company,
  type CompanyDetails,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
  type SubscriptionPlan,
  type CompanyFilters
} from "@/lib/admin"

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    last_page: 1
  })
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  
  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<CompanyDetails | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    subscription_plan_id: 0
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadCompanies()
  }, [currentPage, searchTerm, statusFilter])

  const loadInitialData = async () => {
    try {
      const plans = await getSubscriptionPlans(false) // Only active plans by default
      setSubscriptionPlans(Array.isArray(plans) ? plans : [])
    } catch (error: any) {
      console.error('Error loading subscription plans:', error)
      setSubscriptionPlans([]) // Ensure we always have an array
      toast({
        title: "Error",
        description: error.message || "Failed to load subscription plans",
        variant: "destructive",
      })
    }
  }

  const loadCompanies = async () => {
    try {
      setLoading(true)
      
      const filters: CompanyFilters = {
        page: currentPage,
        per_page: pagination.per_page,
        search: searchTerm || undefined,
        // Only pass status if explicitly set, don't pass by default
        status: statusFilter !== "all" ? statusFilter as any : undefined
      }

      const response = await getCompanies(filters)
      setCompanies(response.data || [])
      setPagination(response.pagination || {
        current_page: 1,
        per_page: 20,
        total: 0,
        last_page: 1
      })
    } catch (error: any) {
      console.error('Error loading companies:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load companies",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCompanyDetails = async (companyId: string) => {
    try {
      const details = await getCompanyById(companyId)
      setSelectedCompanyDetails(details)
      setIsDetailsDialogOpen(true)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load company details",
        variant: "destructive",
      })
    }
  }

  const handleCreateCompany = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const payload: CreateCompanyPayload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        subscription_plan_id: formData.subscription_plan_id ? formData.subscription_plan_id.toString() : undefined
      }

      await createCompany(payload)
      
      toast({
        title: "Success",
        description: "Company created successfully",
      })
      
      setIsCreateDialogOpen(false)
      resetForm()
      loadCompanies()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateCompany = async () => {
    if (!selectedCompany || !formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const payload: UpdateCompanyPayload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim()
      }

      await updateCompany(selectedCompany.id, payload)
      
      toast({
        title: "Success",
        description: "Company updated successfully",
      })
      
      setIsEditDialogOpen(false)
      setSelectedCompany(null)
      resetForm()
      loadCompanies()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update company",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return

    try {
      setIsSubmitting(true)
      await deleteCompany(selectedCompany.id)
      
      toast({
        title: "Success",
        description: "Company deleted successfully",
      })
      
      setIsDeleteDialogOpen(false)
      setSelectedCompany(null)
      loadCompanies()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (company: Company, newStatus: 'active' | 'suspended' | 'inactive') => {
    try {
      const isActive = newStatus === 'active';
      await toggleCompanyStatus(company.id, isActive, `Company ${newStatus} by admin`);
      
      toast({
        title: "Success",
        description: `Company ${newStatus === 'active' ? 'activated' : newStatus} successfully`,
      })
      
      loadCompanies()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update company status",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      subscription_plan_id: 0
    })
  }

  const openEditDialog = (company: Company) => {
    setSelectedCompany(company)
    setFormData({
      name: company.name,
      email: company.email,
      phone: company.phone || "",
      address: company.address || "",
      subscription_plan_id: 0
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (company: Company) => {
    setSelectedCompany(company)
    setIsDeleteDialogOpen(true)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'suspended': return 'destructive'
      case 'inactive': return 'secondary'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Management</h1>
          <p className="text-muted-foreground">Manage companies and their subscriptions</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Company</DialogTitle>
              <DialogDescription>
                Add a new company to the system
              </DialogDescription>
            </DialogHeader>
            <CompanyForm 
              formData={formData}
              setFormData={setFormData}
              subscriptionPlans={subscriptionPlans}
              onSubmit={handleCreateCompany}
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
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Array.isArray(companies) ? companies.filter(c => c.status === 'active').length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended Companies</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {Array.isArray(companies) ? companies.filter(c => c.status === 'suspended').length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(companies) ? companies.reduce((sum, company) => sum + company.users_count, 0) : 0}
            </div>
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
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Companies ({Array.isArray(companies) ? companies.length : 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[#E30040]" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(companies) && companies.length > 0 ? companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{company.name}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {company.address}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{company.email}</div>
                          <div className="text-sm text-muted-foreground">{company.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(company.status)}>
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant={company.subscription_status === 'active' ? 'default' : 'secondary'}>
                            {company.subscription_status}
                          </Badge>
                          {company.current_subscription && (
                            <div className="text-xs text-muted-foreground">
                              {company.current_subscription.plan_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{company.users_count}</TableCell>
                      <TableCell>
                        {format(new Date(company.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => loadCompanyDetails(company.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(company)}>
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {company.status === 'active' ? (
                              <DropdownMenuItem 
                                onClick={() => handleToggleStatus(company, 'suspended')}
                                className="text-orange-600"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Suspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => handleToggleStatus(company, 'active')}
                                className="text-green-600"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => openDeleteDialog(company)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {Array.isArray(companies) ? (
                          companies.length === 0 ? "No companies found" : "Loading companies..."
                        ) : (
                          "Error loading companies data"
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.last_page > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.current_page - 1) * pagination.per_page) + 1} to{" "}
                    {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{" "}
                    {pagination.total} companies
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                        const page = i + 1
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === pagination.last_page}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update company information
            </DialogDescription>
          </DialogHeader>
          <CompanyForm 
            formData={formData}
            setFormData={setFormData}
            subscriptionPlans={subscriptionPlans}
            onSubmit={handleUpdateCompany}
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
            <DialogTitle>Delete Company</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this company? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">
                Deleting company: {selectedCompany?.name}
              </p>
              <p className="text-sm text-red-700">
                This will affect {selectedCompany?.users_count} users
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
              onClick={handleDeleteCompany}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Company"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Company Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
          </DialogHeader>
          {selectedCompanyDetails && (
            <CompanyDetailsView company={selectedCompanyDetails} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Company Form Component
interface CompanyFormProps {
  formData: {
    name: string
    email: string
    phone: string
    address: string
    subscription_plan_id: number
  }
  setFormData: (data: any) => void
  subscriptionPlans: SubscriptionPlan[]
  onSubmit: () => void
  onCancel: () => void
  isSubmitting: boolean
  isEdit: boolean
}

function CompanyForm({ 
  formData, 
  setFormData, 
  subscriptionPlans,
  onSubmit, 
  onCancel, 
  isSubmitting,
  isEdit 
}: CompanyFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="name">Company Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter company name"
          />
        </div>
        
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter email address"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="Enter phone number"
          />
        </div>

        {!isEdit && (
          <div>
            <Label htmlFor="subscription">Subscription Plan</Label>
            <Select 
              value={formData.subscription_plan_id.toString()} 
              onValueChange={(value) => setFormData({ ...formData, subscription_plan_id: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select subscription plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No subscription</SelectItem>
                {Array.isArray(subscriptionPlans) && subscriptionPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id.toString()}>
                    {plan.name} - ${plan.price}/{plan.billing_cycle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Enter company address"
          rows={3}
        />
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
            isEdit ? "Update Company" : "Create Company"
          )}
        </Button>
      </div>
    </div>
  )
}

// Company Details View Component
function CompanyDetailsView({ company }: { company: CompanyDetails }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div><strong>Name:</strong> {company.name}</div>
            <div><strong>Email:</strong> {company.email}</div>
            <div><strong>Phone:</strong> {company.phone || "Not provided"}</div>
            <div><strong>Address:</strong> {company.address || "Not provided"}</div>
            <div><strong>Status:</strong> 
              <Badge variant={company.status === 'active' ? 'default' : 'destructive'} className="ml-2">
                {company.status}
              </Badge>
            </div>
            <div><strong>Users:</strong> {company.users_count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            {company.current_subscription ? (
              <div className="space-y-2">
                <div><strong>Plan:</strong> {company.current_subscription.plan_name}</div>
                <div><strong>Status:</strong> 
                  <Badge variant="default" className="ml-2">
                    {company.current_subscription.status}
                  </Badge>
                </div>
                <div><strong>Expires:</strong> {format(new Date(company.current_subscription.expires_at), "MMM dd, yyyy")}</div>
              </div>
            ) : (
              <p className="text-muted-foreground">No active subscription</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Users ({company.users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {company.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.last_login ? format(new Date(user.last_login), "MMM dd, yyyy HH:mm") : "Never"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {company.activity_logs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                  <div className="text-sm text-muted-foreground">{log.description}</div>
                  <div className="text-xs text-muted-foreground">by {log.performed_by}</div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(log.created_at), "MMM dd, HH:mm")}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
