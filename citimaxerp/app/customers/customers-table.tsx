"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MoreHorizontal,
  Search,
  Filter,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  CheckSquare,
  Loader2,
  FileSpreadsheet,
  FileUp,
  FileDown,
} from "lucide-react"
import { type Customer, getCustomers, updateCustomer, deleteCustomer, getCustomerDisplayName } from "@/lib/customers"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CustomerProfile } from "./[id]/customer-profile"
import { CreateCustomerModal } from "./components/CreateCustomerModal"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useDataCache } from "@/lib/data-cache" // Import the data cache hook
import * as XLSX from "xlsx"
import { CustomersTableSkeleton } from "./customers-table-skeleton"

export default function Customers() {
  // Changed to default export
  const { isLoading: authIsLoading, userProfile } = useAuth()
  const { toast } = useToast()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [isCustomerProfileOpen, setIsCustomerProfileOpen] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Use data cache hook to fetch and cache customer data
  const {
    data: customers = [],
    isLoading: isLoadingData,
    error: dataError,
    refetch: fetchCustomers,
    invalidateCache
  } = useDataCache<Customer[]>(
    'customers',
    async () => {
      // Add a small delay to ensure auth is loaded (helps with race conditions)
      if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return await getCustomers()
    },
    {
      enabled: !authIsLoading,
      expirationMs: 5 * 60 * 1000, // 5 minutes cache
      onError: (error) => {
        // Only show error in console for company_id on null errors
        if (error.message && error.message.includes("company_id") && error.message.includes("null")) {
          // console.warn("CustomersTable: company_id on null error, handled silently");
        } else {
          // console.error("CustomersTable: Failed to fetch customers", error);
        }
      }
    }
  )

  const handleCustomerCreated = () => {
    // CreateCustomerModal already shows its own success/"submitted for
    // review" toast - just refresh the list here.
    invalidateCache() // Invalidate the cache so data will be refetched
    fetchCustomers() // Force refresh the data
  }

  const handleUpdateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      const updatedCustomer = await updateCustomer(id, updates)
      if (updatedCustomer) {
        // Update the cache after successful update
        invalidateCache()
        fetchCustomers() // Force refresh with new data
        toast({ title: "Success", description: "Customer updated successfully." })
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to update customer: ${error.message}`, variant: "destructive" })
    }
  }

  const handleDeleteCustomer = async (id: string) => {
    try {
      const success = await deleteCustomer(id)
      if (success) {
        // Update the cache after successful delete
        invalidateCache()
        fetchCustomers() // Force refresh with new data
        setSelectedCustomers(selectedCustomers.filter((customerId) => customerId !== id))
        toast({ title: "Success", description: "Customer deleted successfully." })
      } else {
        toast({ title: "Error", description: "Failed to delete customer.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete customer: ${error.message}`, variant: "destructive" })
    }
  }

  const handleRowClick = (customerId: string) => {
    setSelectedCustomerId(customerId)
    setIsCustomerProfileOpen(true)
  }

  const toggleSelectCustomer = (customerId: string) => {
    setSelectedCustomers((prev) => {
      if (prev.includes(customerId)) {
        return prev.filter((id) => id !== customerId)
      } else {
        return [...prev, customerId]
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectedCustomers.length === paginatedCustomers.length && paginatedCustomers.length > 0) {
      setSelectedCustomers([])
    } else {
      setSelectedCustomers(paginatedCustomers.map((customer) => customer.id))
    }
  }

  const handleBulkAction = async (action: string) => {
    if (selectedCustomers.length === 0) {
      toast({
        title: "No customers selected",
        description: "Please select customers to perform bulk actions.",
        variant: "default",
      })
      return
    }

    if (action === "delete") {
      try {
        await Promise.all(selectedCustomers.map((id) => deleteCustomer(id)))
        toast({ title: "Success", description: `${selectedCustomers.length} customers deleted.` })
        invalidateCache() // Invalidate cache after bulk delete
        fetchCustomers() // Force refresh data
        setSelectedCustomers([])
      } catch (error: any) {
        toast({
          title: "Bulk Delete Error",
          description: error.message || "Failed to delete some customers.",
          variant: "destructive",
        })
      }
    } else if (action === "export-selected-csv") {
      exportToCSV(true)
    } else if (action === "export-selected-excel") {
      exportToExcel(true)
    } else {
      // console.log(`Performing ${action} on ${selectedCustomers.length} customers: ${selectedCustomers.join(", ")}`)
      toast({ title: "Action Triggered", description: `${action} action for ${selectedCustomers.length} customers.` })
    }
    setIsBulkActionOpen(false)
  }

  // Create a safe version of customers that can't be null
  const safeCustomers = (customers || []).filter(customer => customer !== null)
  
  const filteredCustomers = safeCustomers.filter(
    (customer) =>
      (statusFilter === "all" || customer?.status === statusFilter) &&
      ((customer?.name && customer.name.toLowerCase().includes(search.toLowerCase())) ||
        (customer?.business_name && customer.business_name.toLowerCase().includes(search.toLowerCase())) ||
        (customer?.email && customer.email.toLowerCase().includes(search.toLowerCase())) ||
        (customer?.phone && customer.phone.toLowerCase().includes(search.toLowerCase())) ||
        (customer?.city && customer.city.toLowerCase().includes(search.toLowerCase())) ||
        (customer?.address && customer.address.toLowerCase().includes(search.toLowerCase()))),
  )

  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage)
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  const isEffectivelyLoading = authIsLoading || isLoadingData

  const customerToExportArray = (c: Customer) => [
    c.id,
    getCustomerDisplayName(c),
    c.email || "",
    c.phone || "",
    c.status,
    c.company || "",
    c.address || "",
    c.city || "",
    c.state || "",
    c.country || "",
    c.postal_code || "",
    c.notes || "",
    Array.isArray(c.tags) ? c.tags.join(", ") : (c.tags || ""), // Handle tags array
    c.preferred_communication_channel || "",
    c.last_contact_date ? new Date(c.last_contact_date).toLocaleDateString() : "",
    c.customer_type || "",
    c.total_spend || "0.00",
    c.total_orders || 0,
    c.loyalty_points || 0,
    new Date(c.created_at).toLocaleString(),
    new Date(c.updated_at).toLocaleString(),
  ]

  const exportHeaders = [
    "ID",
    "Name",
    "Email",
    "Phone",
    "Status",
    "Company",
    "Address",
    "City",
    "State",
    "Country",
    "Postal Code",
    "Notes",
    "Tags",
    "Preferred Communication",
    "Last Contact Date",
    "Customer Type",
    "Total Spend (KES)",
    "Total Orders",
    "Loyalty Points",
    "Created At",
    "Updated At",
  ]

  // --- EXPORT FUNCTIONS ---
  const getCustomersToExport = (selectedOnly = false) => {
    return selectedOnly && selectedCustomers.length > 0
      ? (customers ?? []).filter((customer) => selectedCustomers.includes(customer.id))
      : filteredCustomers
  }

  const exportToCSV = (selectedOnly = false) => {
    const customersToExport = getCustomersToExport(selectedOnly)
    if (customersToExport.length === 0) {
      toast({ title: "No Data", description: "No customers to export.", variant: "default" })
      return
    }

    const csvContent = [
      exportHeaders.join(","),
      ...customersToExport.map((c) =>
        customerToExportArray(c)
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `customers_export_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Export Successful", description: `Exported ${customersToExport.length} customers to CSV.` })
  }

  const exportToExcel = (selectedOnly = false) => {
    const customersToExport = getCustomersToExport(selectedOnly)
    if (customersToExport.length === 0) {
      toast({ title: "No Data", description: "No customers to export.", variant: "default" })
      return
    }
    const worksheetData = [exportHeaders, ...customersToExport.map((c) => customerToExportArray(c))]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers")
    XLSX.writeFile(workbook, `customers_export_${new Date().toISOString().split("T")[0]}.xlsx`)
    toast({ title: "Export Successful", description: `Exported ${customersToExport.length} customers to Excel.` })
  }

  // --- IMPORT FUNCTION ---
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      toast({ title: "Import Error", description: "No file selected.", variant: "destructive" })
      return
    }

    if (importFileRef.current) {
      importFileRef.current.value = ""
    }
    // Implement further CSV parsing and customer insertion here if needed.
    // This part would also need to use your new API for bulk customer creation.
  }

  if (isEffectivelyLoading && safeCustomers.length === 0 && !dataError) {
    return <CustomersTableSkeleton />
  }

  if (dataError) {
    return (
      <div className="text-center py-10">
        <p className="text-primary text-lg mb-2">Error loading customers:</p>
        <p className="text-gray-700 mb-4">{dataError instanceof Error ? dataError.message : String(dataError)}</p>
        <Button onClick={fetchCustomers} disabled={isEffectivelyLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isEffectivelyLoading ? "animate-spin" : ""}`} /> Try Again
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-8 max-w-sm"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isEffectivelyLoading && safeCustomers.length === 0}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
                disabled={isEffectivelyLoading && safeCustomers.length === 0}
              >
                <SelectTrigger className="w-[180px] pl-8">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {selectedCustomers.length > 0 && (
              <TooltipProvider>
                <DropdownMenu open={isBulkActionOpen} onOpenChange={setIsBulkActionOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90">
                          <CheckSquare className="mr-2 h-4 w-4" />
                          {selectedCustomers.length} Selected
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Perform actions on selected customers</p>
                    </TooltipContent>
                  </Tooltip>
                </DropdownMenu>
              </TooltipProvider>
            )}
            
            <input type="file" ref={importFileRef} className="hidden" accept=".csv" onChange={handleImportCSV} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => importFileRef.current?.click()}
              disabled={authIsLoading || isEffectivelyLoading}
            >
              <FileUp className="mr-2 h-4 w-4" />
              Import
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={authIsLoading || safeCustomers.length === 0 || isEffectivelyLoading}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportToCSV()}>
                  <FileText className="mr-2 h-4 w-4" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToExcel()}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              disabled={authIsLoading || isEffectivelyLoading}
              className="border-primary text-primary hover:bg-primary/10"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </div>

        {/* Table and Pagination */}
        {!isEffectivelyLoading && safeCustomers.length === 0 && !dataError && (
          <div className="text-center py-10 border rounded-lg bg-white mt-4">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding a new customer, importing from CSV, or try adjusting your filters.
            </p>
            <div className="mt-6 space-x-2">
              <Button
                onClick={() => importFileRef.current?.click()}
                variant="outline"
                className="border-gray-300 hover:border-primary hover:text-primary"
              >
                <FileUp className="mr-2 h-4 w-4" /> Import CSV
              </Button>
              <Button onClick={() => setIsCreateModalOpen(true)} className="bg-primary hover:bg-primary/90">
                <UserPlus className="mr-2 h-4 w-4" /> Add Customer
              </Button>
            </div>
          </div>
        )}

        {(safeCustomers.length> 0 || isEffectivelyLoading) && (
          <div className="rounded-md border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[50px] px-2 py-3">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={
                          selectedCustomers.length === paginatedCustomers.length && paginatedCustomers.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all customers on current page"
                        className="rounded-sm border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        disabled={paginatedCustomers.length === 0}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-gray-600 px-4 py-3">Name</TableHead>
                  <TableHead className="font-semibold text-gray-600 px-4 py-3 hidden md:table-cell">Email</TableHead>
                  <TableHead className="font-semibold text-gray-600 px-4 py-3">Phone</TableHead>
                  <TableHead className="font-semibold text-gray-600 px-4 py-3 hidden sm:table-cell">Status</TableHead>
                  <TableHead className="font-semibold text-gray-600 px-4 py-3 hidden lg:table-cell">
                    Created At
                  </TableHead>
                  <TableHead className="text-right font-semibold text-gray-600 px-4 py-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isEffectivelyLoading && safeCustomers.length === 0
                  ? Array.from({ length: rowsPerPage }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        <TableCell className="px-2 py-3">
                          <Skeleton className="h-5 w-5 mx-auto rounded-sm" />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Skeleton className="h-5 w-3/4" />
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden md:table-cell">
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Skeleton className="h-5 w-3/4" />
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden sm:table-cell">
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden lg:table-cell">
                          <Skeleton className="h-5 w-24" />
                        </TableCell>
                        <TableCell className="text-right px-4 py-3">
                          <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                        </TableCell>
                      </TableRow>
                    ))
                  : paginatedCustomers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className={`hover:bg-primary/5 transition-colors duration-150 ${
                          selectedCustomers.includes(customer.id) ? "bg-primary/10" : ""
                        }`}
                      >
                        <TableCell className="px-2 py-3">
                          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedCustomers.includes(customer.id)}
                              onCheckedChange={() => toggleSelectCustomer(customer.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${getCustomerDisplayName(customer)}`}
                              className="rounded-sm border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          </div>
                        </TableCell>
                        <TableCell
                          className="font-medium text-gray-800 px-4 py-3 cursor-pointer"
                          onClick={() => handleRowClick(customer.id)}
                        >
                          {getCustomerDisplayName(customer)}
                        </TableCell>
                        <TableCell
                          className="text-gray-600 px-4 py-3 hidden md:table-cell cursor-pointer"
                          onClick={() => handleRowClick(customer.id)}
                        >
                          {customer.email || "N/A"}
                        </TableCell>
                        <TableCell
                          className="text-gray-600 px-4 py-3 cursor-pointer"
                          onClick={() => handleRowClick(customer.id)}
                        >
                          {customer.phone || "N/A"}
                        </TableCell>
                        <TableCell
                          className="px-4 py-3 hidden sm:table-cell cursor-pointer"
                          onClick={() => handleRowClick(customer.id)}
                        >
                          <Badge
                            variant={customer.status === "active" ? "default" : "secondary"}
                            className={
                              customer.status === "active"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : customer.status === "inactive"
                                  ? "bg-red-100 text-red-700 border-red-200"
                                  : "bg-gray-100 text-gray-700 border-gray-200"
                            }
                          >
                            {customer.status
                              ? customer.status.charAt(0).toUpperCase() + customer.status.slice(1)
                              : "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-gray-600 px-4 py-3 hidden lg:table-cell cursor-pointer"
                          onClick={() => handleRowClick(customer.id)}
                        >
                          {new Date(customer.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4 text-gray-600" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRowClick(customer.id)
                                }}
                              >
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUpdateCustomer(customer.id, {
                                    status: customer.status === "active" ? "inactive" : "active",
                                  })
                                }}
                              >
                                Toggle Status to {customer.status === "active" ? "Inactive" : "Active"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCustomer(customer.id)
                                }}
                                className="text-primary focus:text-primary"
                              >
                                Delete Customer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                {!isEffectivelyLoading && paginatedCustomers.length === 0 && safeCustomers.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-gray-500">
                      No customers match your current search or filter criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {(safeCustomers.length > 0 || (isEffectivelyLoading && safeCustomers.length === 0)) && totalPages > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4">
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 text-sm text-gray-600 order-2 sm:order-1">
              <span className="whitespace-nowrap">Rows per page</span>
              <Select
                value={rowsPerPage.toString()}
                onValueChange={(value) => {
                  setRowsPerPage(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[70px] text-sm">
                  <SelectValue placeholder={rowsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={pageSize.toString()} className="text-sm">
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="hidden lg:inline whitespace-nowrap">
                | {selectedCustomers.length > 0 ? `${selectedCustomers.length} selected | ` : ""}
                Total: {filteredCustomers.length}
              </span>
            </div>
            <div className="flex items-center space-x-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((old) => Math.max(old - 1, 1))}
                disabled={currentPage === 1}
                className="border-gray-300 hover:border-primary hover:text-primary"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <div className="flex items-center justify-center text-sm font-medium text-gray-700 px-2">
                <span className="whitespace-nowrap">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((old) => Math.min(old + 1, totalPages > 0 ? totalPages : 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="border-gray-300 hover:border-primary hover:text-primary"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedCustomerId && (
        <CustomerProfile
          customerId={selectedCustomerId}
          isOpen={isCustomerProfileOpen}
          onClose={() => {
            setIsCustomerProfileOpen(false)
            setSelectedCustomerId(null)
          }}
        />
      )}

      <CreateCustomerModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCustomerCreated}
      />
    </>
  )
}
