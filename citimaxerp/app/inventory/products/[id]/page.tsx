"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Edit,
  Trash2,
  Star,
  Share2,
  Heart,
  Bookmark,
  TrendingUp,
  Package,
  Zap,
  Clock,
  BarChart3,
  Layers,
  Sparkles,
  DollarSign,
  Warehouse,
  Building,
  Settings,
  ImageIcon,
  Tag,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DeleteProductModal } from "./delete-product-modal"
import { getProductById } from "@/lib/products"
import { fetchProductPriceHistory, type ProductPriceHistoryRecord } from "@/lib/price-lists"
import { ProductDetailsSkeleton } from "./product-details-skeleton"
import { cn } from "@/lib/utils"
import type { Product, ProductVariant } from "@/lib/products"

// Extend ProductVariant to include optional fields for UI compatibility
type ProductVariantUI = ProductVariant & {
  id?: string;
  on_hand?: number;
  allocated?: number;
  images?: string[];
  image_urls?: string[];
  primary_image_url?: string;
  options?: string[];
  store?: { name: string };
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export default function ProductDetailsPage() {
  const router = useRouter()
  const { id } = useParams()
  const { toast } = useToast()

  const [product, setProduct] = useState<import("@/lib/products").Product | null>(null)
  const [variants, setVariants] = useState<ProductVariantUI[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistoryRecord[]>([])

  useEffect(() => {
    if (id) {
      loadProductData()
      fetchProductPriceHistory(id as string).then(setPriceHistory).catch(() => setPriceHistory([]))
    }
  }, [id])

  const loadProductData = async () => {
    try {
      setIsLoading(true)
      const productResult = await getProductById(id as string)

      if (productResult?.status === "success" && productResult?.product) {
        setProduct(productResult.product)
        setSelectedImageIndex(productResult.product.primary_image_index || 0)
        // Variants come directly from the product response (API uses "variants" field)
        setVariants(
          (productResult.product.variants || []).map((v: any) => ({
            ...v,
            id: v.id ?? undefined,
            on_hand: v.on_hand ?? undefined,
            allocated: v.allocated ?? undefined,
            images: v.images ?? [],
            image_urls: v.image_urls ?? [],
            primary_image_url: v.primary_image_url ?? undefined,
            options: v.options ?? [],
            store: v.store ?? undefined,
            created_at: v.created_at ?? undefined,
            updated_at: v.updated_at ?? undefined,
          }))
        )
      } else {
        toast({
          title: "Error",
          description: productResult?.message || "Product not found",
          variant: "destructive",
        })
        router.push("/inventory")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load product details",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditSuccess = () => {
    loadProductData()
    toast({
      title: "Success",
      description: "Product updated successfully",
    })
  }

  const handleDeleteSuccess = () => {
    toast({
      title: "Success",
      description: "Product deleted successfully",
    })
    router.push("/inventory")
  }

  if (isLoading) {
    return <ProductDetailsSkeleton />
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-cyan-50">
        <div className="text-center space-y-6 p-8">
          <div className="relative">
            <Package className="h-24 w-24 text-gray-300 mx-auto" />
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-500 text-xl">✕</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Product Not Found</h1>
            <p className="text-gray-600">The product you're looking for doesn't exist or has been removed.</p>
          </div>
          <Button
            onClick={() => router.push("/inventory")}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
    )
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

  // Helper function to normalize image URLs
  const normalizeImageUrl = (url: string | undefined | null): string => {
    if (!url) return "/placeholder.svg"
    if (url.startsWith("http")) return url
    if (url.startsWith("/")) return url
    return `/${url}`
  }

  // Prepare images - use image_urls if available, otherwise fall back to images array or image_url
  const images = (product.image_urls && product.image_urls.length > 0) 
    ? product.image_urls 
    : (product.images || (product.image_url ? [product.image_url] : [])).map(img => 
        typeof img === 'string' ? normalizeImageUrl(img) : normalizeImageUrl(null)
      ) as string[]
  const currentImage = product.primary_image_url || images[selectedImageIndex] || "/placeholder.svg"

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      {/* Floating Navigation */}
      <div className="fixed top-6 left-6 z-50">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="bg-white/80 backdrop-blur-xl border-white/20 shadow-xl hover:bg-white/90 transition-all duration-300"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Floating Actions */}
      <div className="fixed top-6 right-6 z-50 flex space-x-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsLiked(!isLiked)}
          className={cn(
            "bg-white/80 backdrop-blur-xl border-white/20 shadow-xl transition-all duration-300",
            isLiked ? "text-red-500 bg-red-50/80" : "hover:bg-white/90",
          )}
        >
          <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsBookmarked(!isBookmarked)}
          className={cn(
            "bg-white/80 backdrop-blur-xl border-white/20 shadow-xl transition-all duration-300",
            isBookmarked ? "text-blue-500 bg-blue-50/80" : "hover:bg-white/90",
          )}
        >
          <Bookmark className={cn("h-4 w-4", isBookmarked && "fill-current")} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="bg-white/80 backdrop-blur-xl border-white/20 shadow-xl hover:bg-white/90 transition-all duration-300"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Hero Section */}
        <div className="mb-16">
          {/* Product Info */}
          <div className="space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-600 font-mono text-xs">
                  Item No. {product.item_number ?? "-"}
                </Badge>
              </div>

              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight mb-4">
                {product.name}
              </h1>

            </div>

            {/* Price Section */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-green-700 mb-1">NSPV</p>
                  <p className="text-4xl font-bold text-green-900">Ksh. {productPrice.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-600 mb-1">Profit Margin</p>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-800">{profitMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600">Cost: Ksh. {productUnitCost.toFixed(2)}</span>
                <span className="text-green-700 font-medium">
                  Profit: Ksh. {(productPrice - productUnitCost).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/60 backdrop-blur-xl rounded-xl p-4 border border-white/20 shadow-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Stock Level</p>
                    <p className="text-xl font-bold text-gray-900">{stockQuantity}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-xl rounded-xl p-4 border border-white/20 shadow-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(product.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-4">
              <Button
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                size="lg"
              >
                <Edit className="mr-2 h-5 w-5" />
                Edit Product
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsDeleteModalOpen(true)}
                className="bg-white/80 backdrop-blur-xl border-white/20 shadow-xl hover:bg-red-50 hover:border-red-300 transition-all duration-300"
                size="lg"
              >
                <Trash2 className="mr-2 h-5 w-5" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-12">
          {/* Specifications Grid */}
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
              <BarChart3 className="mr-3 h-6 w-6 text-violet-600" />
              Specifications
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Basic Info */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Basic Information</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Item No.</span>
                    <code className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-mono">{product.item_number ?? "N/A"}</code>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Barcode</span>
                    <code className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-mono">
                      {product.barcode || "N/A"}
                    </code>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Supplier</span>
                    <span className="font-medium">
                      {typeof product.supplier === 'string' 
                        ? product.supplier 
                        : typeof product.supplier === 'object' && product.supplier !== null
                          ? (product.supplier as any).name || "N/A"
                          : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Inventory */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Inventory</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Track Inventory</span>
                    <Badge variant={product.track_inventory ? "default" : "secondary"}>
                      {product.track_inventory ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Low Stock Alert</span>
                    <span className="font-medium">{lowStockThreshold}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Unit</span>
                    <span className="font-medium">{product.unit_of_measurement || "pcs"}</span>
                  </div>
                </div>
              </div>

              {/* Physical Properties */}
              {!product.is_digital && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                    Physical Properties
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Weight</span>
                      <span className="font-medium">{product.weight ? `${product.weight} kg` : "N/A"}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Dimensions</span>
                      <span className="font-medium text-sm">
                        {product.length && product.width && product.height
                          ? `${product.length} × ${product.width} × ${product.height} cm`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Shipping Class</span>
                      <Badge variant="outline">{product.shipping_class || "Standard"}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Variants - Enhanced Section */}
          {product.has_variations && variants.length > 0 && (
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                <Layers className="mr-3 h-6 w-6 text-gray-600" />
                Product Variants
              </h2>

              <div className="space-y-8">
                {variants.map((variant, index) => {
                  // Ensure all numeric values are properly converted
                  const variantPrice = Number(variant.price || 0)
                  const variantCost = Number(variant.cost || 0)
                  const variantMargin = variantPrice > 0 ? ((variantPrice - variantCost) / variantPrice) * 100 : 0
                  const variantStock = Number(variant.stock_quantity || 0)
                  const variantOnHand = Number(variant.on_hand || 0)
                  const variantAllocated = Number(variant.allocated || 0)
                  // Use image_urls if available, otherwise fall back to images array and normalize
                  const variantImages = (variant.image_urls && variant.image_urls.length > 0) 
                    ? variant.image_urls 
                    : (variant.images || []).map(img => 
                        typeof img === 'string' ? normalizeImageUrl(img) : normalizeImageUrl(null)
                      )
                  const variantOptions = variant.options || []
                  const availableStock = variantOnHand - variantAllocated

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
                          {typeof variant.store === 'object' && variant.store?.name && (
                            <p className="text-sm text-gray-500 mb-2">Store: {variant.store.name}</p>
                          )}
                          {variant.sku && (
                            <p className="text-sm text-gray-600 font-mono bg-white px-3 py-1 rounded border inline-block">
                              SKU: {(variant.sku ?? "")}
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
                            {variantImages.map((image: string, imgIndex: number) => (
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
                              <span className="font-medium text-green-600">{availableStock}</span>
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
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Price History Section */}
          {priceHistory.length > 0 && (
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                <TrendingUp className="mr-3 h-6 w-6 text-green-600" />
                Price History
              </h2>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Price List</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Old Price</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">New Price</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Change</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Source</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.map((h) => {
                      const d = new Date(h.created_at)
                      const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                      const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                      const change = h.change_amount ? parseFloat(h.change_amount) : null
                      return (
                        <tr key={h.id} className="border-b last:border-b-0 hover:bg-gray-50/30">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div>{dateStr}</div>
                            <div className="text-xs text-gray-400">{timeStr}</div>
                          </td>
                          <td className="py-3 px-4 font-medium">{h.price_type}</td>
                          <td className="py-3 px-4 text-right text-gray-500">
                            {h.old_value != null ? `Ksh ${parseFloat(h.old_value).toFixed(2)}` : "-"}
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            Ksh {parseFloat(h.new_value).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {change !== null ? (
                              <span className={change > 0 ? "text-red-600" : change < 0 ? "text-green-600" : "text-gray-400"}>
                                {change > 0 ? "+" : ""}{change.toFixed(2)}
                                {h.change_percentage ? ` (${parseFloat(h.change_percentage) > 0 ? "+" : ""}${parseFloat(h.change_percentage).toFixed(1)}%)` : ""}
                              </span>
                            ) : (
                              <span className="text-blue-600 text-xs">New</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500">
                            {h.source_reference || h.source.replace(/_/g, " ")}
                          </td>
                          <td className="py-3 px-4 text-sm">{h.changed_by_user?.name || "-"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Product Images Section */}
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
              <ImageIcon className="mr-3 h-6 w-6 text-gray-600" />
              Product Images
            </h2>
            
            <div className="space-y-6">
              {/* Main Image */}
              <div className="relative aspect-square max-w-2xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow-2xl">
                <Image
                  src={currentImage}
                  alt={product.name}
                  fill
                  className="object-cover transition-all duration-500"
                  priority
                />

                {/* Floating Badges */}
                <div className="absolute top-6 left-6 flex flex-col space-y-2">
                  {product.is_featured && (
                    <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-lg">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      Featured
                    </Badge>
                  )}
                  {product.is_digital && (
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-lg">
                      <Zap className="w-3 h-3 mr-1" />
                      Digital
                    </Badge>
                  )}
                  <Badge
                    className={cn(
                      "border-0 shadow-lg",
                      product.is_active
                        ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                        : "bg-gradient-to-r from-gray-400 to-gray-500 text-white",
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full mr-2 bg-white")} />
                    {product.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Stock Status Indicator */}
                <div className="absolute top-6 right-6">
                  <div
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium shadow-lg backdrop-blur-xl",
                      stockStatus === "critical"
                        ? "bg-red-500/90 text-white"
                        : stockStatus === "low"
                          ? "bg-amber-500/90 text-white"
                          : "bg-green-500/90 text-white",
                    )}
                  >
                    {stockQuantity} in stock
                  </div>
                </div>

                {/* Image Navigation Dots */}
                {images.length > 1 && (
                  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
                    <div className="flex space-x-2 bg-black/20 backdrop-blur-xl rounded-full px-4 py-2">
                      {images.map((_: string, index: number) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={cn(
                            "w-3 h-3 rounded-full transition-all duration-300",
                            index === selectedImageIndex ? "bg-white scale-125" : "bg-white/50 hover:bg-white/75",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Thumbnail Gallery */}
              {images.length > 1 && (
                <div className="flex space-x-4 justify-center overflow-x-auto pb-2">
                  {images.map((image: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={cn(
                        "flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-3 transition-all duration-300",
                        index === selectedImageIndex
                          ? "border-violet-500 shadow-lg scale-105"
                          : "border-gray-200 hover:border-gray-300 hover:scale-102",
                      )}
                    >
                      <Image
                        src={image || "/placeholder.svg"}
                        alt={`${product.name} ${index + 1}`}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        {product && (
          <>
          
            <DeleteProductModal
              isOpen={isDeleteModalOpen}
              onClose={() => setIsDeleteModalOpen(false)}
              onSuccess={handleDeleteSuccess}
              product={product as any}
            />
          </>
        )}
      </div>
    </div>
  )
}
