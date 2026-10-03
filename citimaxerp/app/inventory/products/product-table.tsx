"use client"

import { useState, useEffect, useMemo } from "react"
import { createProductsBulk } from "@/lib/products"
import Image from "next/image"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Search, Download, ChevronLeft, ChevronRight, Eye, Edit, Loader2, Plus, AlertTriangle, RefreshCw, Delete } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { getProductById, type Product, type ProductSummary } from "@/lib/products"
import { priceOptionsFor, priceListsFor, PRICE_LIST_CODES } from "@/lib/price-codes"
import { sizedName } from "@/lib/product-sizes"
import { ImportProductsDialog } from "./components/import-products-dialog"
import * as XLSX from "xlsx"
import { PermissionGuard } from "@/components/PermissionGuard"
import { usePermissions } from "@/hooks/use-permissions"
import { useRouter } from "next/navigation"
import { deleteProduct } from "@/lib/products"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { CreateProductSheet } from "./components/create-product-sheet"
import { EditProductSheet } from "./components/edit-product-sheet"
import { ProductDetailsSheet } from "./components/product-details-sheet"
import { DeleteProductConfirmationDialog } from "./components/DeleteProductConfirmationDialog"
import { ProductTableSkeleton } from "./components/product-table-skeleton"

// Helper function to normalize image URLs
function normalizeImageUrl(url: string | undefined | null): string {
  if (!url) return "/placeholder.svg"
  if (url.startsWith("http")) return url
  if (url.startsWith("/")) return url
  return `/${url}`
}

// Helper function to get primary image from product
function getPrimaryImage(product: Product): string {
  // Prioritize primary_image_url from API if available
  if (product.primary_image_url) {
    return product.primary_image_url
  }
  
  // Fall back to image_urls array if available
  if (product.image_urls && Array.isArray(product.image_urls) && product.image_urls.length > 0) {
    const primaryIndex = product.primary_image_index || 0
    return product.image_urls[primaryIndex] || product.image_urls[0]
  }
  
  // Fall back to images array
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    const primaryIndex = product.primary_image_index || 0
    const primaryImage = product.images[primaryIndex]
    return normalizeImageUrl(primaryImage)
  }
  
  // Final fallback to image_url
  return normalizeImageUrl(product.image_url)
}

// Helper function to check if a product matches search criteria
function productMatchesSearch(product: Product, searchTerm: string): boolean {
  const term = searchTerm.toLowerCase()
  const compact = term.replace(/\s+/g, "")
  return (
    product.name.toLowerCase().includes(term) ||
    String(product.item_number ?? "") === term.trim() ||
    priceOptionsFor(product).some(o => o.code.toLowerCase().replace(/\s+/g, "").includes(compact))
  )
}

const productCodes = (product: Product) => priceOptionsFor(product).map(o => o.code).join(", ")

const costOf = (product: Product) => parseFloat(String(product.unit_cost ?? "0")) || 0

// Same layout the products import reads back: one row per item, then one row per size (164.1, 164.2 ...).
const EXPORT_HEADERS = [
  "S/No.", "Item No.", "Row Type", "Size", "Item Description", "Unit of Measure", "Cost Price",
  "Tax Status", "Reorder Level",
]

const taxStatus = (product: Product) => {
  const p = product as any
  if (p.is_taxable === false || p.is_taxable === "false") return "Exempt"
  const rate = Number(p.tax_rate ?? 0)
  return rate > 0 ? `VAT ${rate}%` : "Zero rated"
}

const sortedSizes = (product: Product) =>
  [...(((product as any).variants ?? []) as any[])].sort((a, b) =>
    String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { numeric: true }),
  )

function exportRows(product: Product): (string | number)[][] {
  const p = product as any
  const sizes = p.has_variations ? sortedSizes(product) : []
  const itemNo = p.item_number ?? ""

  const rows: (string | number)[][] = [[
    itemNo, "Item", sizes.length ? `${sizes.length} sizes` : "", p.name,
    p.unit_of_measurement ?? "", costOf(product), taxStatus(product),
    p.low_stock_threshold ?? "",
  ]]
  sizes.forEach((v: any, i: number) => {
    rows.push([
      `${itemNo}.${i + 1}`, "Size", v.name ?? "", sizedName(p.name, v.name), "", Number(v.cost || 0),
      "", "",
    ])
  })
  return rows
}

// Every row - items and sizes alike - gets the next serial number.
const exportSheet = (products: Product[]) => [
  EXPORT_HEADERS,
  ...products.flatMap(exportRows).map((row, i) => [i + 1, ...row]),
]

const exportFileName = (ext: string) => `products_${new Date().toISOString().split("T")[0]}.${ext}`

function downloadCSVTemplate(products: Product[]) {
  const csvContent = exportSheet(products)
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", exportFileName("csv"))
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function downloadExcelTemplate(products: Product[]) {
  const ws = XLSX.utils.aoa_to_sheet(exportSheet(products))
  ws["!cols"] = EXPORT_HEADERS.map((h) => ({ wch: h === "Item Description" ? 55 : h === "S/No." ? 7 : Math.max(h.length + 2, 10) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Products")
  XLSX.writeFile(wb, exportFileName("xlsx"))
}

interface ProductTableProps {
  products: Product[]
  summaryData: ProductSummary
  onProductUpdated: () => void
  isLoading?: boolean
  onRefresh?: () => void
}

const ALL_LISTS = "all"
const PAGE_SIZES = [10, 20, 50, 100, "all"] as const
type PageSize = (typeof PAGE_SIZES)[number]

export function ProductTable({
  products,
  summaryData,
  onProductUpdated,
  isLoading = false,
  onRefresh,
}: ProductTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priceListFilter, setPriceListFilter] = useState<string>(ALL_LISTS)
  const [sortBy, setSortBy] = useState<"name" | "cost" | "stock">("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(20)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false)
  const [isLoadingProductDetails, setIsLoadingProductDetails] = useState(false)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const { toast } = useToast()

  // Handler to fetch complete product details including packaging
  const handleViewProductDetails = async (product: Product) => {
    console.log('handleViewProductDetails - Initial row product:', {
      id: product.id,
      name: product.name,
      primary_image_url: product.primary_image_url,
      image_urls: product.image_urls,
      image_url: product.image_url,
      images: product.images,
    })
    
    setIsDetailsSheetOpen(true)
    setIsLoadingProductDetails(true)
    setSelectedProduct(product) // Show basic info immediately
    
    try {
      const result = await getProductById(product.id)
      console.log('handleViewProductDetails - API result:', {
        status: result.status,
        hasData: !!result.data,
        primary_image_url: result.data?.primary_image_url,
        image_urls: result.data?.image_urls,
        image_url: result.data?.image_url,
        images: result.data?.images,
      })
      
      if (result.status === "success" && result.data) {
        console.log('handleViewProductDetails - Setting selected product with complete data')
        setSelectedProduct(result.data) // Update with complete data including packaging
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to load complete product details",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading product details:", error)
      toast({
        title: "Error",
        description: "An error occurred while loading product details",
        variant: "destructive",
      })
    } finally {
      setIsLoadingProductDetails(false)
    }
  }

  // Every list the catalog actually uses, so imported lists beyond the fixed four are filterable too.
  const availableLists = useMemo(() => {
    const found = new Set<string>(PRICE_LIST_CODES)
    products.forEach((p) => priceListsFor(p).forEach((list) => found.add(list)))
    return Array.from(found)
  }, [products])

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products]
    if (searchTerm.trim()) {
      result = result.filter(product => productMatchesSearch(product, searchTerm))
    }
    if (statusFilter !== "all") {
      result = result.filter(product =>
        statusFilter === "active" ? product.is_active : !product.is_active
      )
    }
    if (priceListFilter !== ALL_LISTS) {
      result = result.filter(product => priceListsFor(product).includes(priceListFilter))
    }
    result.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "cost":
          comparison = costOf(a) - costOf(b)
          break
        case "stock":
          comparison = (a.stock_quantity || 0) - (b.stock_quantity || 0)
          break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return result
  }, [products, searchTerm, statusFilter, priceListFilter, sortBy, sortOrder])

  const total = filteredAndSortedProducts.length
  const lastPage = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, lastPage)
  const pagedProducts = useMemo(() => {
    if (pageSize === "all") return filteredAndSortedProducts
    const start = (safePage - 1) * pageSize
    return filteredAndSortedProducts.slice(start, start + pageSize)
  }, [filteredAndSortedProducts, safePage, pageSize])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter, priceListFilter, pageSize])

  // Handle delete success
  const handleDeleteSuccess = () => {
    setProductToDelete(null)
    setIsDeleteDialogOpen(false)
    onProductUpdated()
    toast({
      title: "Success",
      description: "Product deleted successfully",
    })
  }

  // Exports what the table currently shows, filters included.
  const handleExport = (format: "csv" | "excel") => {
    if (format === "csv") {
      downloadCSVTemplate(filteredAndSortedProducts)
    } else {
      downloadExcelTemplate(filteredAndSortedProducts)
    }
  }

  if (isLoading) {
    return <ProductTableSkeleton />
  }

  return (
    <>
      <div className="space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by description, item no. or code (e.g. NSPD 001)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={priceListFilter} onValueChange={setPriceListFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Price list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_LISTS}>All price lists</SelectItem>
                  {availableLists.map((list) => (
                    <SelectItem key={list} value={list}>{list}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [newSortBy, newSortOrder] = value.split('-') as [typeof sortBy, typeof sortOrder]
                setSortBy(newSortBy)
                setSortOrder(newSortOrder)
              }}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="cost-asc">Cost (Low-High)</SelectItem>
                  <SelectItem value="cost-desc">Cost (High-Low)</SelectItem>
                  <SelectItem value="stock-asc">Stock (Low-High)</SelectItem>
                  <SelectItem value="stock-desc">Stock (High-Low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <PermissionGuard permissions={["can_create_products", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button 
                onClick={() => setIsCreateSheetOpen(true)}
                variant="outline"
                size="sm"
                className="border-[#1E2764] text-[#1E2764] hover:bg-[#1E2764]/10"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </PermissionGuard>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <PermissionGuard permissions={["can_create_products"]}>
              <ImportProductsDialog onImported={onProductUpdated} />
            </PermissionGuard>
            
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Products Table */}
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Image</TableHead>
                <TableHead className="font-semibold">Item No.</TableHead>
                <TableHead className="font-semibold">Item Description</TableHead>
                <TableHead className="font-semibold">Cost Price</TableHead>
                <TableHead className="font-semibold">Price Codes</TableHead>
                <TableHead className="font-semibold">Stock</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    <div className="text-gray-500">
                      <p className="font-semibold">No products found</p>
                      <p className="text-sm">Create your first product to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedProducts.map((product) => (
                  <TableRow 
                    key={product.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleViewProductDetails(product)}
                  >
                    <TableCell>
                      <div className="relative h-10 w-10 rounded-md overflow-hidden">
                        <img
                          src={getPrimaryImage(product)}
                          alt={product.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="text-sm font-semibold text-[#1E2764]">
                        {product.item_number ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                    </TableCell>
                    <TableCell>
                      KES {costOf(product).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-[220px]">
                      {productCodes(product) || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span>{(() => {
                          // If product has variants, show the sum of all variant stock quantities
                          if (product.has_variations && product.variants && product.variants.length > 0) {
                            const total = product.variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0)
                            return total.toLocaleString()
                          }
                          // Otherwise show the product's base stock quantity
                          return (product.stock_quantity || 0).toLocaleString()
                        })()}</span>
                        {(() => {
                          const stockQty = product.has_variations && product.variants && product.variants.length > 0
                            ? product.variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0)
                            : product.stock_quantity || 0
                          
                          if (stockQty === 0) {
                            return <AlertTriangle className="ml-2 h-4 w-4 text-red-500" />
                          } else if (stockQty <= product.low_stock_threshold) {
                            return <AlertTriangle className="ml-2 h-4 w-4 text-yellow-500" />
                          }
                          return null
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "default" : "secondary"} className={product.is_active ? "bg-green-500" : ""}>
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product)
                            setIsDetailsSheetOpen(true)
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <PermissionGuard permissions={["can_update_products", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(product)
                              setIsEditSheetOpen(true)
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Product
                            </DropdownMenuItem>
                          </PermissionGuard>
                          <PermissionGuard permissions={["can_delete_products", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProductToDelete(product)
                                setIsDeleteDialogOpen(true)
                              }}
                            >
                              <Delete className="mr-2 h-4 w-4" />
                              Delete Product
                            </DropdownMenuItem>
                          </PermissionGuard>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">
                {pageSize === "all"
                  ? `Showing all ${total} products`
                  : `Showing ${(safePage - 1) * pageSize + 1} to ${Math.min(safePage * pageSize, total)} of ${total} products`}
              </p>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(value === "all" ? "all" : (Number(value) as PageSize))}
              >
                <SelectTrigger className="h-8 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size === "all" ? "All" : size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pageSize !== "all" && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                  className="border-gray-200 hover:bg-[#1E2764]/10 hover:text-[#1E2764] hover:border-[#1E2764]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center justify-center text-sm font-medium">
                  Page {safePage} of {lastPage}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(lastPage, safePage + 1))}
                  disabled={safePage === lastPage}
                  className="border-gray-200 hover:bg-[#1E2764]/10 hover:text-[#1E2764] hover:border-[#1E2764]"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <CreateProductSheet 
        open={isCreateSheetOpen}
        onOpenChange={setIsCreateSheetOpen}
        onProductCreated={onProductUpdated}
      />
      
      {selectedProduct && (
        <EditProductSheet 
          open={isEditSheetOpen}
          onOpenChange={setIsEditSheetOpen}
          product={selectedProduct}
          onProductUpdated={onProductUpdated}
        />
      )}
      
      {selectedProduct && (
        <ProductDetailsSheet 
          open={isDetailsSheetOpen}
          onOpenChange={setIsDetailsSheetOpen}
          product={selectedProduct}
          isLoading={isLoadingProductDetails}
          onEdit={(product) => {
            setSelectedProduct(product);
            setIsDetailsSheetOpen(false);
            setIsEditSheetOpen(true);
          }}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <DeleteProductConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        product={productToDelete}
        onSuccess={handleDeleteSuccess}
      />
    </>
  )
}