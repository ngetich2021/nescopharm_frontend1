"use client"

import type React from "react"
import { useState, useEffect } from "react"
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
  Download,
  Upload,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Trash2,
  CheckSquare,
  Loader2,
  Plus,
  Edit,
  Eye,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SupplierDetailsSheet } from "./supplier-details-sheet"
import { CreateSupplierSheet } from "./components/create-supplier-sheet"
import { Supplier, getSuppliers, deleteSupplier, exportSuppliers, importSuppliers } from "@/lib/suppliers"
import { fetchImportSchema, downloadTemplate } from "@/lib/data-import"
import { Skeleton } from "@/components/ui/skeleton"
import { SuppliersTableSkeleton } from "./suppliers-table-skeleton"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"
import { PermissionGuard } from "@/components/PermissionGuard"

interface SuppliersTableProps {
  onDataChanged?: () => void
}

export function SuppliersTable({ onDataChanged }: SuppliersTableProps) {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [isSupplierDetailsOpen, setIsSupplierDetailsOpen] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importPreviewData, setImportPreviewData] = useState<any>(null)
  const [importFile, setImportFile] = useState<File | null>(null)

  // Cache utility functions
  function getCachedSuppliers(): Supplier[] | null {
    try {
      const cachedString = localStorage.getItem('suppliers_cache')
      if (!cachedString) return null
      
      const cache = JSON.parse(cachedString)
      const now = Date.now()
      
      // Cache is valid for 5 minutes
      if (now - cache.timestamp < 5 * 60 * 1000) {
        return cache.data
      }
      return null
    } catch (e) {
      return null
    }
  }
  
  function cacheSuppliers(data: Supplier[]): void {
    try {
      localStorage.setItem('suppliers_cache', JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (e) {
      //
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Try to get data from cache first
      const cachedData = getCachedSuppliers()
      if (cachedData) {
        setSuppliers(cachedData)
        setIsLoading(false)
      }
      // Fetch fresh data regardless of cache status
      fetchSuppliers()
    }
  }, [])

  async function fetchSuppliers() {
    setIsLoading(true)
    setError(null)
    
    try {
      // Add a small delay to ensure auth is loaded (helps with race conditions)
      if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Fetch suppliers from API
      const data = await getSuppliers({
        is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
      })
      
      // Filter out any null or undefined entries
      const validSuppliers = data.filter(item => item != null)
      
      setSuppliers(validSuppliers)
      setLastRefreshTime(new Date())
      
      // Cache the data
      cacheSuppliers(validSuppliers)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch suppliers'))
      
      // Don't clear existing data on error if we have some
      if (suppliers.length === 0) {
        // Only show toast if we don't already have cached data
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : 'Failed to fetch suppliers',
          variant: "destructive"
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Apply client-side filtering
  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      (statusFilter === "all" || 
       (statusFilter === "active" && supplier.is_active) ||
       (statusFilter === "inactive" && !supplier.is_active)) &&
      (search === "" || 
        supplier.name.toLowerCase().includes(search.toLowerCase()) ||
        supplier.email.toLowerCase().includes(search.toLowerCase()) ||
        supplier.phone.toLowerCase().includes(search.toLowerCase()) ||
        supplier.contact_person.toLowerCase().includes(search.toLowerCase()))
  )

  const totalPages = Math.ceil(filteredSuppliers.length / rowsPerPage)
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const handleSupplierCreated = () => {
    fetchSuppliers()
    toast({
      title: "Success",
      description: "Supplier created successfully."
    })
    if (onDataChanged) onDataChanged()
  }
  
  // Apply search and filter changes
  const applyFilters = () => {
    // Reset to first page when filters change
    setCurrentPage(1)
    fetchSuppliers()
  }
  
  // Debounce search to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilters()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  const handleRowClick = (supplierId: string) => {
    setSelectedSupplierId(supplierId)
    setIsSupplierDetailsOpen(true)
  }

  const toggleSelectSupplier = (e: React.MouseEvent, supplierId: string) => {
    e.stopPropagation()
    setSelectedSuppliers((prev) => {
      if (prev.includes(supplierId)) {
        return prev.filter((id) => id !== supplierId)
      } else {
        return [...prev, supplierId]
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectedSuppliers.length === paginatedSuppliers.length) {
      setSelectedSuppliers([])
    } else {
      setSelectedSuppliers(paginatedSuppliers.map((supplier) => supplier.id))
    }
  }

  const handleBulkAction = (action: string) => {
    // Implement bulk actions here
    setIsBulkActionOpen(false)
  }

  const handleDeleteSupplier = async (supplierId: string) => {
    try {
      await deleteSupplier(supplierId)
      await fetchSuppliers()
      toast({
        title: "Success",
        description: "Supplier deleted successfully."
      })
      if (onDataChanged) onDataChanged()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete supplier",
        variant: "destructive"
      })
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportSuppliers()
      toast({
        title: "Success",
        description: "Suppliers exported successfully."
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export suppliers",
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      // First, preview the import
      const result = await importSuppliers(file, true)
      setImportPreviewData(result)
      setImportFile(file)
      toast({
        title: "Preview ready",
        description: `${result.summary.rows} rows will be processed.`
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to read import file",
        variant: "destructive"
      })
    } finally {
      setIsImporting(false)
      e.target.value = ""
    }
  }

  const handleConfirmImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    try {
      await importSuppliers(importFile, false)
      await fetchSuppliers()
      setImportPreviewData(null)
      setImportFile(null)
      toast({
        title: "Success",
        description: "Suppliers imported successfully."
      })
      if (onDataChanged) onDataChanged()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import suppliers",
        variant: "destructive"
      })
    } finally {
      setIsImporting(false)
    }
  }

  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive 
      ? "bg-green-100 text-green-800" 
      : "bg-red-100 text-red-800"
  }

  // Show loading state
  if (isLoading) {
    return <SuppliersTableSkeleton />
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-8 max-w-sm"
                placeholder="Search suppliers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] pl-8">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSuppliers}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <PermissionGuard permissions={["can_create_suppliers", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddSupplierOpen(true)}
                className="border-primary text-primary hover:bg-primary/10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            </PermissionGuard>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export
            </Button>
            <div className="relative">
              <input
                type="file"
                id="import-suppliers-file"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleImportFile}
              />
              <Button
                onClick={() => document.getElementById("import-suppliers-file")?.click()}
                variant="outline"
                size="sm"
                disabled={isImporting}
              >
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedSuppliers.length === paginatedSuppliers.length && paginatedSuppliers.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSuppliers.map((supplier) => (
                <TableRow 
                  key={supplier.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(supplier.id)}
                >
                  <TableCell onClick={(e) => toggleSelectSupplier(e, supplier.id)}>
                    <Checkbox checked={selectedSuppliers.includes(supplier.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.contact_person}</TableCell>
                  <TableCell>{supplier.email}</TableCell>
                  <TableCell>{supplier.phone}</TableCell>
                  <TableCell>{supplier.payment_terms_days} days</TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeClass(supplier.is_active)}>
                      {supplier.is_active ? "Active" : "Inactive"}
                    </Badge>
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
                        <DropdownMenuItem onClick={() => handleRowClick(supplier.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <PermissionGuard permissions={["can_edit_suppliers", "can_manage_system", "can_manage_company"]} hideOnDenied>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        </PermissionGuard>
                        <PermissionGuard permissions={["can_delete_suppliers", "can_manage_system", "can_manage_company"]} hideOnDenied>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteSupplier(supplier.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </PermissionGuard>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * rowsPerPage) + 1} to{" "}
            {Math.min(currentPage * rowsPerPage, filteredSuppliers.length)} of{" "}
            {filteredSuppliers.length} suppliers
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <PermissionGuard permissions={["can_create_suppliers", "can_manage_system", "can_manage_company"]} hideOnDenied>
        {/* Create Supplier Sheet */}
        <CreateSupplierSheet
          open={isAddSupplierOpen}
          onOpenChange={setIsAddSupplierOpen}
          onSupplierCreated={handleSupplierCreated}
        />
      </PermissionGuard>

      {/* Supplier Details Sheet */}
      <SupplierDetailsSheet
        supplierId={selectedSupplierId}
        open={isSupplierDetailsOpen}
        onOpenChange={setIsSupplierDetailsOpen}
      />

      {/* Import Preview Dialog */}
      {importPreviewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Import Preview</h2>
              <p className="text-sm text-gray-600 mt-1">Review the import summary before proceeding</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-2xl font-bold text-blue-600">{importPreviewData.summary.created}</div>
                  <div className="text-sm text-gray-600">New suppliers</div>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <div className="text-2xl font-bold text-green-600">{importPreviewData.summary.updated}</div>
                  <div className="text-sm text-gray-600">Updated</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded">
                  <div className="text-2xl font-bold text-yellow-600">{importPreviewData.summary.unchanged}</div>
                  <div className="text-sm text-gray-600">Unchanged</div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <div className="text-2xl font-bold text-red-600">{importPreviewData.summary.errors}</div>
                  <div className="text-sm text-gray-600">Errors</div>
                </div>
              </div>
              {importPreviewData.summary.errors > 0 && (importPreviewData.summary.created + importPreviewData.summary.updated) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                  {importPreviewData.summary.errors} row(s) have problems and will be skipped. The {importPreviewData.summary.created + importPreviewData.summary.updated} valid row(s) will still be imported.
                </div>
              )}
              {importPreviewData.summary.errors > 0 && (importPreviewData.summary.created + importPreviewData.summary.updated) === 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                  No valid rows to import. Every row is missing a Supplier Name or has another problem. Make sure the Supplier Name column is filled in, then try again.
                </div>
              )}
              {importPreviewData.rows && importPreviewData.rows.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Details ({importPreviewData.rows.length} rows):</h3>
                  <div className="max-h-[300px] overflow-y-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewData.rows.slice(0, 20).map((row: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2">{row.row}</td>
                            <td className="px-3 py-2">{row.name}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 text-xs rounded ${
                                row.status === 'created' ? 'bg-blue-100 text-blue-800' :
                                row.status === 'updated' ? 'bg-green-100 text-green-800' :
                                row.status === 'unchanged' ? 'bg-gray-100 text-gray-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{row.message || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportPreviewData(null)
                  setImportFile(null)
                }}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting || (importPreviewData.summary.created + importPreviewData.summary.updated) === 0}
              >
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {importPreviewData.summary.errors > 0
                  ? `Import ${importPreviewData.summary.created + importPreviewData.summary.updated} valid row(s)`
                  : "Confirm Import"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}