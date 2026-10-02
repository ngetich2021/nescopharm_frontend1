"use client"

import { useState, useEffect, JSXElementConstructor, ReactElement, ReactNode, ReactPortal } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import {
  X,
  Edit,
  Trash2,
  DollarSign,
  Warehouse,
  Tag,
  Calendar,
  Star,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Layers,
  Eye,
  ImageIcon,
  Package,
  Building,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import type { Product, ProductVariant } from "@/lib/products"

interface ViewProductModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  variants?: ProductVariant[]
  onProductUpdated?: () => void
}

export function ViewProductModal({ isOpen, onClose, product, variants = [], onProductUpdated }: ViewProductModalProps) {
  const { toast } = useToast()
  const [isVisible, setIsVisible] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Animation control
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      if (product) {
        setSelectedImageIndex(product.primary_image_index || 0)
      }
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, product, variants])

  const handleEditSuccess = () => {
    setIsEditModalOpen(false)
    onProductUpdated?.()
    toast({
      title: "Success",
      description: "Product updated successfully",
    })
  }

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false)
    onClose()
    onProductUpdated?.()
    toast({
      title: "Success",
      description: "Product deleted successfully",
    })
  }

  if (!isVisible) {
    return null
  }

  if (!product) {
    return null
  }

  // Get variants from the product response itself (API uses "variants" field)
  const productVariants = product.variants || product.variations || variants || []

  let images: string[] = [];
  if (Array.isArray(product.images) && product.images.length > 0) {
    images = product.images.filter((img) => typeof img === 'string' && img.trim() !== '');
  } else if (product.image_url && typeof product.image_url === 'string' && product.image_url.trim() !== '') {
    images = [product.image_url];
  }
  if (images.length === 0) {
    images = ["/placeholder.svg"];
  }
  const currentImage = images[selectedImageIndex] || "/placeholder.svg";
  const safePrice = Number(product.price ?? 0)
  const safeCost = Number(product.unit_cost ?? 0)
  const profitMargin = safePrice > 0 ? ((safePrice - safeCost) / safePrice) * 100 : 0
  const safeStockQty = Number(product.stock_quantity ?? 0)
  const safeLowStock = Number(product.low_stock_threshold ?? 10)

  const stockStatus = safeStockQty <= safeLowStock ? "critical" : safeStockQty <= safeLowStock * 2 ? "low" : "good"

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-6xl bg-white shadow-2xl z-50 transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Product Details</h2>
              <p className="text-sm text-gray-500">View and manage product information</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-100">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* Product Header */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                      {typeof product.category === 'string' ? product.category || "Uncategorized" : (product.category as any)?.name || "Uncategorized"}
                    </Badge>
                    {product.sku && (
                      <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-600 font-mono text-xs">
                        {product.sku}
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name || "Unnamed Product"}</h1>
                  {product.brand && (
                    <p className="text-gray-600">
                      by <span className="font-medium">{product.brand}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Badge
                    variant={product.is_active ? "default" : "secondary"}
                    className={cn(
                      product.is_active
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-gray-100 text-gray-600 border-gray-200",
                    )}
                  >
                    <div
                      className={cn("w-2 h-2 rounded-full mr-2", product.is_active ? "bg-green-500" : "bg-gray-400")}
                    />
                    {product.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {product.short_description && (
                <p className="text-gray-700 leading-relaxed">{product.short_description}</p>
              )}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Pricing */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2">Selling Price</p>
                  <p className="text-3xl font-bold text-green-900">Ksh. {safePrice.toFixed(2)}</p>
                  <div className="flex items-center justify-between text-sm mt-3">
                    <span className="text-green-600">Cost: Ksh. {safeCost.toFixed(2)}</span>
                    <span className="font-medium text-green-700">{profitMargin.toFixed(1)}% margin</span>
                  </div>
                </div>
              </div>

              {/* Inventory */}
              <div
                className={cn(
                  "rounded-xl p-6 border",
                  stockStatus === "critical"
                    ? "bg-gradient-to-br from-red-50 to-rose-50 border-red-100"
                    : stockStatus === "low"
                      ? "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100"
                      : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100",
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={cn(
                      "p-3 rounded-lg",
                      stockStatus === "critical"
                        ? "bg-red-100"
                        : stockStatus === "low"
                          ? "bg-amber-100"
                          : "bg-blue-100",
                    )}
                  >
                    <Warehouse
                      className={cn(
                        "h-6 w-6",
                        stockStatus === "critical"
                          ? "text-red-600"
                          : stockStatus === "low"
                            ? "text-amber-600"
                            : "text-blue-600",
                      )}
                    />
                  </div>
                  {stockStatus === "critical" ? (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium mb-2",
                      stockStatus === "critical"
                        ? "text-red-700"
                        : stockStatus === "low"
                          ? "text-amber-700"
                          : "text-blue-700",
                    )}
                  >
                    Stock Level
                  </p>
                  <p
                    className={cn(
                      "text-3xl font-bold",
                      stockStatus === "critical"
                        ? "text-red-900"
                        : stockStatus === "low"
                          ? "text-amber-900"
                          : "text-blue-900",
                    )}
                  >
                    {safeStockQty}
                  </p>
                  <div className="flex items-center justify-between text-sm mt-3">
                    <span
                      className={cn(
                        stockStatus === "critical"
                          ? "text-red-600"
                          : stockStatus === "low"
                            ? "text-amber-600"
                            : "text-blue-600",
                      )}
                    >
                      Alert at: {safeLowStock}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        stockStatus === "critical"
                          ? "border-red-200 text-red-700 bg-red-50"
                          : stockStatus === "low"
                            ? "border-amber-200 text-amber-700 bg-amber-50"
                            : "border-blue-200 text-blue-700 bg-blue-50",
                      )}
                    >
                      {stockStatus === "critical" ? "Critical" : stockStatus === "low" ? "Low Stock" : "In Stock"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Calendar className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-700 mb-2">Last Updated</p>
                  <p className="text-lg font-bold text-purple-900">
                    {product.updated_at ? new Date(product.updated_at).toLocaleDateString() : "N/A"}
                  </p>
                  <div className="text-sm text-purple-600 mt-3">
                    Created: {product.created_at ? new Date(product.created_at).toLocaleDateString() : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <Tag className="mr-3 h-6 w-6 text-gray-600" />
                Product Information
              </h3>

              <div className="bg-gray-50 rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Basic Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">SKU</span>
                        <code className="bg-white px-3 py-1 rounded text-sm font-mono border">
                          {product.sku || "N/A"}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Barcode</span>
                        <code className="bg-white px-3 py-1 rounded text-sm font-mono border">
                          {product.barcode || "N/A"}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Supplier</span>
                        <span className="font-medium">{product.supplier || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Unit</span>
                        <span className="font-medium">{product.unit_of_measurement || "pcs"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Settings</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Track Inventory</span>
                        <Badge variant={product.track_inventory ? "default" : "secondary"}>
                          {product.track_inventory ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Physical Properties */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-4">Physical Properties</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Weight</span>
                        <span className="font-medium">{product.weight != null ? `${product.weight} kg` : "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Dimensions</span>
                        <span className="font-medium text-sm">
                          {product.length && product.width && product.height
                            ? `${product.length} × ${product.width} × ${product.height} cm`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping Class</span>
                        <Badge variant="outline">{product.shipping_class || "Standard"}</Badge>
                      </div>
                    </div>
                  </div>
              </div>
            </div>

            {/* Store Information */}
            {/* REMOVE THIS SECTION */}

            {/* Full Description */}
            {product.description && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Layers className="mr-3 h-6 w-6 text-gray-600" />
                  Description
                </h3>
                <div className="bg-gray-50 rounded-xl p-6">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {product.description ?? "No description provided."}
                  </p>
                </div>
              </div>
            )}

            {/* Tags */}
            {product.tags && (Array.isArray(product.tags) ? product.tags.length > 0 : product.tags.length > 0) && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(product.tags) ? product.tags : [product.tags]).map((tag, index) => (
                    <Badge key={index} variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Product Variants - ENHANCED SECTION */}
            {product.has_variations && productVariants.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                    <Layers className="mr-3 h-6 w-6 text-gray-600" />
                    Product Variants
                  </h3>
                  <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                    {productVariants.length} variant{productVariants.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="space-y-6">
                  {productVariants.map((variant: { price: any; cost: any; stock_quantity: any; on_hand: any; allocated: any; images: never[]; options: never[]; id: any; name: any; is_active: any; store: { name: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined }; sku: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; created_at: string | number | Date; updated_at: string | number | Date; attributes: ArrayLike<unknown> | { [s: string]: unknown } }, index: number) => {
                    const variantPrice = Number(variant.price || 0)
                    const variantCost = Number(variant.cost || 0)
                    const variantMargin = variantPrice > 0 ? ((variantPrice - variantCost) / variantPrice) * 100 : 0
                    const variantStock = Number(variant.stock_quantity || 0)
                    const variantOnHand = Number(variant.on_hand || 0)
                    const variantAllocated = Number(variant.allocated || 0)
                    const variantImages = variant.images || []
                    const variantOptions = variant.options || []

                    return (
                      <div
                        key={variant.id || index}
                        className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100"
                      >
                        {/* Variant Header */}
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="text-xl font-bold text-gray-900">
                                {variant.name || `Variant ${index + 1}`}
                              </h4>
                              <Badge
                                variant={variant.is_active ? "default" : "secondary"}
                                className={cn(
                                  variant.is_active
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-gray-100 text-gray-600 border-gray-200",
                                )}
                              >
                                {variant.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            {variant.store?.name && (
                              <p className="text-sm text-gray-500 mb-2">Store: {variant.store.name}</p>
                            )}
                            {variant.sku && (
                              <p className="text-sm text-gray-600 font-mono bg-white px-3 py-1 rounded border inline-block">
                                SKU: {variant.sku}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Variant Images */}
                        {variantImages.length > 0 && (
                          <div className="mb-6">
                            <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                              <ImageIcon className="mr-2 h-4 w-4" />
                              Variant Images ({variantImages.length})
                            </h5>
                            <div className="flex space-x-3 overflow-x-auto pb-2">
                              {variantImages.map((image, imgIndex) => (
                                <div
                                  key={imgIndex}
                                  className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-gray-200 overflow-hidden bg-white"
                                >
                                  <Image
                                    src={image || "/placeholder.svg"}
                                    alt={`${variant.name} image ${imgIndex + 1}`}
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Variant Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                          {/* Pricing Information */}
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                              <DollarSign className="mr-2 h-4 w-4 text-green-600" />
                              Pricing
                            </h5>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Price</span>
                                <span className="font-bold text-green-600">Ksh. {variantPrice.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Cost</span>
                                <span className="font-medium">Ksh. {variantCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Profit</span>
                                <span className="font-medium text-green-700">
                                  Ksh. {(variantPrice - variantCost).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Margin</span>
                                <span className="font-medium text-green-700">{variantMargin.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Inventory Information */}
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                              <Warehouse className="mr-2 h-4 w-4 text-blue-600" />
                              Inventory
                            </h5>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Stock Quantity</span>
                                <span className="font-bold text-blue-600">{variantStock}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">On Hand</span>
                                <span className="font-medium">{variantOnHand}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Allocated</span>
                                <span className="font-medium text-orange-600">{variantAllocated}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Available</span>
                                <span className="font-medium text-green-600">{variantOnHand - variantAllocated}</span>
                              </div>
                            </div>
                          </div>

                          {/* Store & System Information */}
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                              <Building className="mr-2 h-4 w-4 text-purple-600" />
                              Store
                            </h5>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Store Name</span>
                                <span className="font-medium">{variant.store?.name || "N/A"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Created</span>
                                <span className="text-sm">
                                  {variant.created_at ? new Date(variant.created_at).toLocaleDateString() : "N/A"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Updated</span>
                                <span className="text-sm">
                                  {variant.updated_at ? new Date(variant.updated_at).toLocaleDateString() : "N/A"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Variant Options */}
                        {variantOptions.length > 0 && (
                          <div className="mb-4">
                            <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                              <Settings className="mr-2 h-4 w-4 text-indigo-600" />
                              Variant Options
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {variantOptions.map((option, optIndex) => (
                                <Badge
                                  key={optIndex}
                                  variant="outline"
                                  className="bg-indigo-50 border-indigo-200 text-indigo-700"
                                >
                                  {option}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Variant Attributes */}
                        {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                          <div>
                            <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                              <Tag className="mr-2 h-4 w-4 text-violet-600" />
                              Attributes
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(variant.attributes).map(([key, value]) => (
                                <Badge
                                  key={key}
                                  variant="outline"
                                  className="bg-violet-50 border-violet-200 text-violet-700"
                                >
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Variants Summary */}
                {/* REMOVE THIS SECTION */}
              </div>
            )}

            {/* No Variants Message */}
            {product.has_variations && productVariants.length === 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Layers className="mr-3 h-6 w-6 text-gray-600" />
                  Product Variants
                </h3>
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    This product is configured to have variants, but none are currently defined.
                  </p>
                </div>
              </div>
            )}

            {/* Product Images */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <ImageIcon className="mr-3 h-6 w-6 text-gray-600" />
                Product Images
              </h3>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                <div className="space-y-6">
                  {/* Main Selected Image */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="w-80 h-80 rounded-2xl overflow-hidden bg-white border-2 border-gray-200 shadow-lg">
                        <Image
                          src={currentImage || "/placeholder.svg"}
                          alt={product.name || "Product image"}
                          width={320}
                          height={320}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Primary Image Badge */}
                      {selectedImageIndex === (product.primary_image_index || 0) && (
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-blue-600 text-white border-0 shadow-lg">
                            <Star className="w-3 h-3 mr-1 fill-current" />
                            Primary
                          </Badge>
                        </div>
                      )}

                      {/* Image Counter */}
                      <div className="absolute bottom-4 right-4">
                        <Badge variant="outline" className="bg-white/90 backdrop-blur-sm border-gray-300 shadow-sm">
                          {selectedImageIndex + 1} of {images.length || 1}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* All Images in One Row */}
                  {images.length > 1 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-700">All Images</h4>
                        <span className="text-sm text-gray-500">{images.length} images</span>
                      </div>

                      <div className="flex space-x-3 overflow-x-auto pb-2">
                        {images.map((image, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedImageIndex(index)}
                            className={cn(
                              "relative flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all duration-200 hover:scale-105",
                              index === selectedImageIndex
                                ? "border-blue-500 ring-2 ring-blue-200 shadow-md"
                                : "border-gray-200 hover:border-gray-300 hover:shadow-sm",
                            )}
                          >
                            <Image
                              src={image || "/placeholder.svg"}
                              alt={`${product.name} ${index + 1}`}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />

                            {/* Primary indicator on thumbnail */}
                            {index === (product.primary_image_index || 0) && (
                              <div className="absolute top-1 right-1">
                                <div className="w-3 h-3 bg-blue-600 rounded-full border border-white shadow-sm">
                                  <Star className="w-2 h-2 text-white fill-current absolute top-0.5 left-0.5" />
                                </div>
                              </div>
                            )}

                            {/* Selected indicator */}
                            {index === selectedImageIndex && (
                              <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Single Image Message */}
                  {images.length <= 1 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">Single product image</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex justify-between items-center gap-3 px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Product ID: <code className="bg-gray-200 px-2 py-1 rounded font-mono text-xs">{product.id}</code>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
