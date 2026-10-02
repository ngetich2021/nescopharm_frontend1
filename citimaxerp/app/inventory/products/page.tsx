"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, PackageCheck, DollarSign, AlertTriangle } from "lucide-react"
import { ProductTable } from "./product-table"
import { useState, useEffect, useCallback } from "react"
import { getProducts, calculateProductSummary, type Product } from "@/lib/products"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()

  // Fetch all products function - can be called for initial load and refresh
  const fetchProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setInitialLoading(true)
    }
    try {
      // Fetch first page to get pagination info
      const first = await getProducts(1, 100)
      let allProducts = Array.isArray(first.data) ? first.data : []
      const lastPage = first.pagination?.last_page || 1
      // Fetch remaining pages in batches
      if (lastPage > 1) {
        for (let page = 2; page <= lastPage; page++) {
          const resp = await getProducts(page, 100)
          if (Array.isArray(resp.data)) {
            allProducts = allProducts.concat(resp.data)
          }
        }
      }
      setProducts(allProducts)
    } catch (error: any) {
      setProducts([])
      toast({
        title: "Error",
        description: error.message || "Failed to load products. Please try again.",
        variant: "destructive",
      })
    } finally {
      setInitialLoading(false)
      setIsRefreshing(false)
    }
  }, [toast])

  // Handler for refresh button and after product updates
  const handleRefresh = useCallback(() => {
    fetchProducts(true)
  }, [fetchProducts])

  // Fetch all products on mount
  useEffect(() => {
    fetchProducts(false)
  }, [fetchProducts])

  // Calculate summary from all products
  const calculatedSummary = calculateProductSummary(products)

  // Show full page loader only on initial load when no data exists
  if (initialLoading && products.length === 0) {
    return (
      <PermissionGuard permissions={["can_view_products_menu","can_view_products",  "can_manage_system", "can_manage_company"]}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permissions={["can_view_products_menu","can_view_products",  "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-gray-600">
            Manage your product inventory and catalog
          </p>
        </div>

        {/* Summary Cards - Only 4 key metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {calculatedSummary.totalProducts}
              </div>
              <p className="text-xs text-muted-foreground">All products in inventory</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Products</CardTitle>
              <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {calculatedSummary.activeProducts}
              </div>
              <p className="text-xs text-muted-foreground">Currently available</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {calculatedSummary.lowStockProducts}
              </div>
              <p className="text-xs text-muted-foreground">Products below threshold</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {`KES ${calculatedSummary.totalValue.toLocaleString()}`}
              </div>
              <p className="text-xs text-muted-foreground">Inventory value</p>
            </CardContent>
          </Card>
        </div>

        <ProductTable 
          products={products} 
          summaryData={calculatedSummary}
          onProductUpdated={handleRefresh}
          isLoading={isRefreshing}
          onRefresh={handleRefresh}
        />
      </div>
    </PermissionGuard>
  )
}