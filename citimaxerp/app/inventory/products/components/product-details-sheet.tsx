"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Package, 
  Tag, 
  DollarSign, 
  Warehouse, 
  Building, 
  Settings, 
  ImageIcon,
  TrendingUp,
  Clock,
  Layers,
  Star,
  Zap,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Share2,
  Hash,
  Ruler,
  Weight,
  Barcode,
  Pencil,
  X,
  Receipt,
  Percent
} from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/products"
import { priceOptionsFor } from "@/lib/price-codes"

interface ProductDetailsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onEdit?: (product: Product) => void
  isLoading?: boolean
}

export function ProductDetailsSheet({ open, onOpenChange, product, onEdit, isLoading = false }: ProductDetailsSheetProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  
  if (!product) {
    return null
  }

  // Helper function to normalize image URLs
  const normalizeImageUrl = (url: string | undefined | null): string => {
    if (!url) return "/placeholder.svg"
    if (url.startsWith("http")) return url
    if (url.startsWith("/")) return url
    return `/${url}`
  }

  // Ensure numeric values for calculations
  const productPrice = Number(product.price) || 0
  const productUnitCost = Number(product.unit_cost) || 0
  const profitMargin = productPrice > 0 ? ((productPrice - productUnitCost) / productPrice) * 100 : 0
  const stockQuantity = Number(product.stock_quantity) || 0
  const lowStockThreshold = Number(product.low_stock_threshold) || 0
  const stockStatus =
    stockQuantity <= lowStockThreshold
      ? "critical"
      : stockQuantity <= lowStockThreshold * 2
        ? "low"
        : "ok"

  // Prepare images - use pre-authorized URLs from API if available
  const apiImages = product.image_urls && Array.isArray(product.image_urls) ? product.image_urls : []
  const primaryImage = product.primary_image_url
  
  // Debug logging to trace image URLs
  console.log('ProductDetailsSheet - Image Debug:', {
    primary_image_url: product.primary_image_url,
    image_urls: product.image_urls,
    image_url: product.image_url,
    images: product.images,
  })
  
  // Create a unified list of images, ensuring primary image is first and no duplicates
  let galleryImages: string[] = []
  if (primaryImage) galleryImages.push(primaryImage)
  
  apiImages.forEach(img => {
    if (!galleryImages.includes(img) && img !== primaryImage) galleryImages.push(img)
  })
  
  // If still empty, fall back to legacy images or image_url
  if (galleryImages.length === 0) {
    galleryImages = (product.images || (product.image_url ? [product.image_url] : [])).map(img => 
      typeof img === 'string' ? normalizeImageUrl(img) : normalizeImageUrl(null)
    ) as string[]
  }

  const currentImage = galleryImages[selectedImageIndex] || "/placeholder.svg"
  
  console.log('ProductDetailsSheet - Gallery Images:', galleryImages)
  console.log('ProductDetailsSheet - Current Image:', currentImage)

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "bg-red-500"
      case "low": return "bg-amber-500"
      default: return "bg-green-500"
    }
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical": return <AlertCircle className="h-4 w-4" />
      case "low": return <AlertTriangle className="h-4 w-4" />
      default: return <CheckCircle className="h-4 w-4" />
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-5xl overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 p-0">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-white to-white p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxkZWZzPjxwYXR0ZXJuIGlkPSJwYXR0ZXJuIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHBhdHRlcm5UcmFuc2Zvcm09InJvdGF0ZSg0NSkiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjAuNSIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4xNSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNwYXR0ZXJuKSIvPjwvc3ZnPg==')] opacity-20"></div>
          <SheetHeader className="relative z-10">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-3 text-2xl font-bold">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Package className="h-6 w-6" />
                </div>
                Product Details
              </SheetTitle>
            </div>
          </SheetHeader>
        </div>
        
        <div className="p-6 space-y-8">
          {/* Hero Section with Modern Card */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
              {/* Product Image Gallery */}
              <div className="space-y-4">
                <div className="relative aspect-square rounded-2xl overflow-hidden shadow-lg group">
                  <img
                    src={currentImage}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      console.error('ProductDetailsSheet - Image failed to load:', currentImage)
                      e.currentTarget.src = '/placeholder.svg'
                    }}
                    onLoad={() => console.log('ProductDetailsSheet - Image loaded successfully:', currentImage)}
                  />
                  
                  {/* Floating Badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {product.is_featured && (
                      <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-lg px-3 py-1 text-xs">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Featured
                      </Badge>
                    )}
                    {product.is_digital && (
                      <Badge className="bg-gradient-to-r from-primary to-blue-600 text-white border-0 shadow-lg px-3 py-1 text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        Digital
                      </Badge>
                    )}
                  </div>
                  
                  {/* Stock Status Indicator */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1 shadow-lg",
                      getStatusColor(stockStatus)
                    )}>
                      {getStatusIcon(stockStatus)}
                      {stockQuantity} in stock
                    </div>
                  </div>
                  
                </div>
                
                {/* Thumbnail Gallery */}
                {galleryImages.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {galleryImages.map((image: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={cn(
                          "flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-300",
                          index === selectedImageIndex
                            ? "border-violet-500 shadow-lg scale-105"
                            : "border-gray-200 hover:border-gray-300 hover:scale-102",
                        )}
                      >
                      <img
                          src={image || "/placeholder.svg"}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono bg-white text-xs px-3 py-1">
                    Item No. {product.item_number ?? "-"}
                  </Badge>
                  <Badge className={cn(
                    "border-0 text-xs px-3 py-1",
                    product.is_active 
                      ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800" 
                      : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full mr-2", product.is_active ? "bg-green-500" : "bg-gray-400")} />
                    {product.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                </div>
                
                {/* Pricing Card */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200 shadow-sm">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-sm text-green-700 mb-1">NSPV</p>
                      <p className="text-3xl font-bold text-green-900">KES {productPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-600 mb-1">Profit Margin</p>
                      <div className="flex items-center justify-end space-x-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <span className="text-2xl font-bold text-green-800">{profitMargin.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-sm mt-3 pt-3 border-t border-green-100">
                    <span className="text-green-600">Cost: KES {productUnitCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}</span>
                    <span className="text-green-700 font-medium">
                      Profit: KES {(productPrice - productUnitCost).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                </div>

                {/* Price lists */}
                {priceOptionsFor(product).length > 0 && (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-600">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Code</th>
                          <th className="text-right px-3 py-2 font-medium">Price</th>
                          <th className="text-left px-3 py-2 font-medium">Unit of measure</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceOptionsFor(product).map((o) => (
                          <tr key={o.code} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-semibold">{o.code}</td>
                            <td className="px-3 py-2 text-right">KES {o.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-gray-600">{o.unit || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Warehouse className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Stock</p>
                        <p className="text-lg font-bold text-gray-900">{stockQuantity}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-100">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Clock className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Last Updated</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(product.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Product Details - New Layout */}
          <div className="space-y-6">
            {/* Inventory, Product Details, and Physical Properties in Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Inventory Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Warehouse className="h-5 w-5 text-blue-600" />
                  Inventory
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Stock Quantity</span>
                    <span className="font-bold text-lg">{stockQuantity}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Low Stock Alert</span>
                    <span className="font-medium">{lowStockThreshold}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">On Hand</span>
                    <span className="font-medium">{product.on_hand}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Allocated</span>
                    <span className="font-medium">{product.allocated}</span>
                  </div>
                  
                  <Separator className="my-2" />
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600">Track Inventory</span>
                    <Badge variant={product.track_inventory ? "default" : "secondary"}>
                      {product.track_inventory ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Unit</span>
                    <span className="font-medium">{product.unit_of_measurement || "pcs"}</span>
                  </div>
                </div>
              </div>
              
              {/* Product Details Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-600" />
                  Product Details
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Hash className="h-4 w-4" /> Item No.
                    </span>
                    <code className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-mono">
                      {product.item_number ?? "N/A"}
                    </code>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Barcode className="h-4 w-4" /> Barcode
                    </span>
                    <code className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-mono">
                      {product.barcode || "N/A"}
                    </code>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Supplier</span>
                    <span className="font-medium text-right text-sm">
                      {typeof product.supplier === 'string' 
                        ? product.supplier 
                        : typeof product.supplier === 'object' && product.supplier !== null
                          ? (product.supplier as any).name || "N/A"
                          : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Store</span>
                    <span className="font-medium text-sm">{product.store?.name || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Created</span>
                    <span className="text-sm text-gray-500">{formatDate(product.created_at)}</span>
                  </div>
                </div>
              </div>
              
              {/* Physical Properties Card */}
              {!product.is_digital && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-amber-600" />
                    Physical Properties
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Weight className="h-4 w-4" /> Weight
                      </span>
                      <span className="font-medium">
                        {product.weight ? `${product.weight} kg` : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Shipping Class</span>
                      <Badge variant="outline" className="text-xs">{product.shipping_class || "Standard"}</Badge>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Ruler className="h-4 w-4" /> Dimensions
                      </span>
                      <span className="font-medium text-sm text-right">
                        {product.length && product.width && product.height
                          ? `${product.length} × ${product.width} × ${product.height} cm`
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Tax Information Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600" />
                Tax Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Taxable</p>
                      <Badge 
                        className={cn(
                          "border-0 text-xs",
                          product.is_taxable 
                            ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800" 
                            : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600"
                        )}
                      >
                        <div className={cn("w-2 h-2 rounded-full mr-2", product.is_taxable ? "bg-green-500" : "bg-gray-400")} />
                        {product.is_taxable ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Receipt className="h-4 w-4 text-emerald-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Tax Rate</p>
                      <p className="text-lg font-bold text-gray-900">
                        {product.tax_rate !== undefined && product.tax_rate !== null 
                          ? `${product.tax_rate}%` 
                          : "N/A"}
                      </p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Percent className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">HS Code</p>
                      <code className="text-sm font-mono font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
                        {product.hs_code || "N/A"}
                      </code>
                    </div>
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Hash className="h-4 w-4 text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Packaging Units Section */}
            {isLoading ? (
              <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-primary animate-pulse" />
                  <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-3 bg-gray-50 animate-pulse">
                      <div className="h-4 w-20 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 w-full bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : product.has_packaging && product.packaging_units && product.packaging_units.length > 0 && (
              <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-gray-900">Packaging Units</h3>
                    <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-primary bg-primary/10 rounded-full">
                      {product.packaging_units.length}
                    </span>
                  </div>
                  {product.base_unit && (
                    <span className="text-sm text-muted-foreground">
                      (Base: {product.base_unit})
                    </span>
                  )}
                </div>
                
                {/* Grid Layout for Packaging Units */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {product.packaging_units
                    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                    .map((unit, index) => {
                      const unitPrice = unit.price_per_unit ? Number(unit.price_per_unit) : null
                      const unitCost = unit.cost_per_unit ? Number(unit.cost_per_unit) : null
                      const baseQty = Number(unit.base_unit_quantity || 1)
                      
                      return (
                        <div 
                          key={unit.id || index} 
                          className="border rounded-lg bg-card overflow-hidden hover:shadow-md transition-shadow"
                        >
                          {/* Compact Header */}
                          <div className="px-3 py-2 bg-muted/20 border-b">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 text-primary" />
                                <div className="flex items-center gap-1.5">
                                  <h4 className="font-semibold text-sm">{unit.unit_name}</h4>
                                  <span className="text-xs text-muted-foreground">({unit.unit_abbreviation})</span>
                                </div>
                              </div>
                              {unit.is_base_unit && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-primary text-primary-foreground rounded">
                                  Base
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Compact Content */}
                          <div className="p-3 space-y-2">
                            {/* Conversion - Compact */}
                            {!unit.is_base_unit && baseQty > 1 && (
                              <div className="rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-2 py-1.5">
                                <p className="text-[11px] text-amber-900 dark:text-amber-200">
                                  <span className="font-semibold">1 {unit.unit_name} = {baseQty} {product.base_unit}</span>
                                </p>
                              </div>
                            )}
                            
                            {/* Base Qty */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                Base Qty
                              </span>
                              <span className="font-semibold">{baseQty} × {unit.is_base_unit ? unit.unit_name : product.base_unit}</span>
                            </div>
                            
                            {/* Price & Cost */}
                            {(unitPrice !== null || unitCost !== null) && (
                              <div className="pt-1 border-t space-y-1">
                                {unitPrice !== null && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Price</span>
                                    <span className="font-semibold text-green-700">
                                      KES {unitPrice.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}
                                    </span>
                                  </div>
                                )}
                                {unitCost !== null && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Cost</span>
                                    <span className="font-semibold text-blue-700">
                                      KES {unitCost.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Barcode */}
                            {unit.barcode && (
                              <div className="pt-1 border-t">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                                  <Barcode className="h-2.5 w-2.5" />
                                  <span>Barcode</span>
                                </div>
                                <code className="text-[10px] font-mono text-gray-900 block truncate">
                                  {unit.barcode}
                                </code>
                              </div>
                            )}
                            
                            {/* Badges */}
                            <div className="flex gap-1 pt-1">
                              {unit.is_sellable && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded">
                                  Sell
                                </span>
                              )}
                              {unit.is_purchasable && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded">
                                  Buy
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
                
             
              </div>
            )}
            
            {/* Variants Section (if applicable) */}
            {product.has_variations && product.variants && product.variants.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-gray-600" />
                  Sizes <Badge className="ml-2 bg-violet-100 text-violet-800">{product.variants.length}</Badge>
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  {product.variants.map((variant, index) => {
                    const variantStock = Number(variant.stock_quantity || 0)
                    // Use image_urls if available, otherwise fall back to images array and normalize
                    const variantImages = (variant.image_urls && variant.image_urls.length > 0) 
                      ? variant.image_urls 
                      : (variant.images || []).map(img => 
                          typeof img === 'string' ? normalizeImageUrl(img) : normalizeImageUrl(null)
                        )
                    
                    return (
                      <div 
                        key={variant.id || index} 
                        className="border border-gray-200 rounded-xl p-5 bg-gradient-to-br from-gray-50 to-white"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Variant Info */}
                          <div className="md:col-span-2">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                              <h4 className="text-lg font-semibold text-gray-900">
                                {variant.name || `Variant ${index + 1}`}
                              </h4>
                              <Badge 
                                className={cn(
                                  "border-0 text-xs",
                                  variant.is_active 
                                    ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800" 
                                    : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600"
                                )}
                              >
                                <div className={cn("w-2 h-2 rounded-full mr-2", variant.is_active ? "bg-green-500" : "bg-gray-400")} />
                                {variant.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="bg-gray-100 rounded-lg p-3">
                                <p className="text-xs text-gray-600 mb-1">SKU</p>
                                <p className="font-medium text-sm">{variant.sku || "N/A"}</p>
                              </div>
                              
                              <div className="bg-gray-100 rounded-lg p-3">
                                <p className="text-xs text-gray-600 mb-1">Options</p>
                                <div className="flex flex-wrap gap-1">
                                  {variant.options && variant.options.length > 0 ? (
                                    variant.options.map((option, optIndex) => (
                                      <Badge key={optIndex} variant="outline" className="text-xs">
                                        {option}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-gray-500 text-xs">No options</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Sizes share the item's price code, so only stock differs between them */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-2 border border-amber-100 text-center w-32">
                              <p className="text-xs text-gray-600 mb-1">Stock</p>
                              <p className="font-bold text-amber-900 text-sm">{variantStock}</p>
                            </div>
                          </div>
                          
                          {/* Variant Images */}
                          <div>
                            {variantImages.length > 0 ? (
                              <div className="h-full">
                                <h5 className="font-medium text-gray-900 mb-2 text-sm flex items-center gap-1">
                                  <ImageIcon className="h-4 w-4" />
                                  Images ({variantImages.length})
                                </h5>
                                <div className="flex gap-2 overflow-x-auto pb-2 h-[calc(100%-2rem)]">
                                  {variantImages.map((image: string, imgIndex: number) => (
                                    <div 
                                      key={imgIndex} 
                                      className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200"
                                    >
                                    <img
                                        src={image || "/placeholder.svg"}
                                        alt={`${variant.name} image ${imgIndex + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
                                <p className="text-gray-500 text-sm">No images</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Additional Variant Details */}
                        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-200">
                          <div className="bg-gray-100 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-600 mb-1">On Hand</p>
                            <p className="font-medium">{variant.on_hand || 0}</p>
                          </div>

                          <div className="bg-gray-100 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-600 mb-1">Allocated</p>
                            <p className="font-medium">{variant.allocated || 0}</p>
                          </div>

                          <div className="bg-gray-100 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-600 mb-1">On Hold</p>
                            <p className="font-medium">{variant.on_hold || 0}</p>
                          </div>

                          <div className="bg-gray-100 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-600 mb-1">Damaged</p>
                            <p className="font-medium">{variant.damaged || 0}</p>
                          </div>
                        </div>

                        {/* Batches for this size - each size holds its own
                            stock, so the parent product has no batches. */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h5 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-indigo-600" />
                            Batches
                            {variant.available_batches && variant.available_batches.length > 0 && (
                              <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">{variant.available_batches.length}</Badge>
                            )}
                          </h5>
                          {variant.available_batches && variant.available_batches.length > 0 ? (
                            <div className="overflow-x-auto border rounded-lg">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 text-gray-600">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left font-medium">S/No</th>
                                    <th className="px-2 py-1.5 text-left font-medium">Batch No.</th>
                                    <th className="px-2 py-1.5 text-left font-medium">Lot No.</th>
                                    <th className="px-2 py-1.5 text-right font-medium">Available</th>
                                    <th className="px-2 py-1.5 text-left font-medium">Mfg Date</th>
                                    <th className="px-2 py-1.5 text-left font-medium">Expiry</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {variant.available_batches.map((batch, bi) => (
                                    <tr key={batch.id} className="border-t">
                                      <td className="px-2 py-1.5">{bi + 1}</td>
                                      <td className="px-2 py-1.5 font-mono">{batch.batch_number || "—"}</td>
                                      <td className="px-2 py-1.5 font-mono">{batch.lot_number || "—"}</td>
                                      <td className="px-2 py-1.5 text-right font-semibold">{Number(batch.quantity_available).toLocaleString()}</td>
                                      <td className="px-2 py-1.5">{batch.manufacture_date ? new Date(batch.manufacture_date).toLocaleDateString() : "—"}</td>
                                      <td className="px-2 py-1.5">{batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No batches recorded for this size</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Batches for products without variants - the parent holds stock
                directly in this case. */}
            {!product.has_variations && product.available_batches && product.available_batches.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" />
                  Batches
                  <Badge className="ml-1 bg-indigo-100 text-indigo-800">{product.available_batches.length}</Badge>
                </h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">S/No</th>
                        <th className="px-3 py-2 text-left font-medium">Batch No.</th>
                        <th className="px-3 py-2 text-left font-medium">Lot No.</th>
                        <th className="px-3 py-2 text-right font-medium">Available</th>
                        <th className="px-3 py-2 text-left font-medium">Mfg Date</th>
                        <th className="px-3 py-2 text-left font-medium">Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.available_batches.map((batch, bi) => (
                        <tr key={batch.id} className="border-t">
                          <td className="px-3 py-2">{bi + 1}</td>
                          <td className="px-3 py-2 font-mono">{batch.batch_number || "—"}</td>
                          <td className="px-3 py-2 font-mono">{batch.lot_number || "—"}</td>
                          <td className="px-3 py-2 text-right font-semibold">{Number(batch.quantity_available).toLocaleString()}</td>
                          <td className="px-3 py-2">{batch.manufacture_date ? new Date(batch.manufacture_date).toLocaleDateString() : "—"}</td>
                          <td className="px-3 py-2">{batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Tags Card */}
            {product.tags && (
              (Array.isArray(product.tags) && product.tags.length > 0) || 
              (typeof product.tags === 'string' && (product.tags as string).length > 0)
            ) && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Tag className="h-5 w-5 text-violet-600" />
                  Tags
                </h3>
                
                <div className="flex flex-wrap gap-2">
                  {(
                    Array.isArray(product.tags)
                      ? product.tags
                      : typeof product.tags === 'string'
                        ? (product.tags as string).split(',').map((t: string) => t.trim()).filter((t: string) => t)
                        : []
                  ).map((tag: string, index: number) => (
                    <Badge
                      key={index}
                      className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200 text-violet-700 hover:from-violet-100 hover:to-purple-100 transition-all duration-300 text-xs"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer with Edit and Cancel Buttons */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onOpenChange(false);
                if (onEdit) {
                  onEdit(product);
                }
              }}
              className="bg-[#1E2764] hover:bg-[#1E2764]/90 text-white"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit Product
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}