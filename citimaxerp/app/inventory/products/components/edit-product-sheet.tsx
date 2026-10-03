"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Plus, Image as ImageIcon, Package, Trash2, X, Star, Check, ChevronsUpDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { updateProduct, fileToDataUrl } from "@/lib/products"
import { getProductCategories } from "@/lib/product-categories"
import { getSuppliers } from "@/lib/suppliers"
import { getStores } from "@/lib/stores"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import type { ProductCategory } from "@/lib/product-categories"
import type { Product, PackagingUnit } from "@/lib/products"
import type { Supplier } from "@/lib/suppliers"
import type { Store } from "@/lib/stores"
import { ProductKraTab } from "@/components/etims/product-kra-tab"
import { ProductSizesFields } from "./product-sizes-fields"
import { sizeRowsFor, sizesForSave, type SizeRow } from "@/lib/product-sizes"

interface Dimensions {
  length: string
  width: string
  height: string
}

interface EditProductSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onProductUpdated: () => void
}

export function EditProductSheet({ open, onOpenChange, product, onProductUpdated }: EditProductSheetProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    name: "",
    cost: "",
    barcode: "",
    stock: "",
    lowStockThreshold: "10",
    trackInventory: true,
    isActive: true,
    weight: "",
    dimensions: { length: "", width: "", height: "" } as Dimensions,
    shippingClass: "standard",
    images: [] as string[],
    primaryImageIndex: 0,
    store_id: "",
    hasPackaging: false,
    baseUnit: "",
    isTaxable: true,
    taxRate: "",
    hsCode: ""
  })

  // Sizes (variants kept purely to split stock - price always comes from the item's price code)
  const [hasSizes, setHasSizes] = useState(false)
  const [sizes, setSizes] = useState<SizeRow[]>([])

  // Packaging state
  const [packagingUnits, setPackagingUnits] = useState<Omit<PackagingUnit, 'id' | 'company_id' | 'product_id' | 'created_at' | 'updated_at'>[]>([])
  
  // Predefined unit names for packaging
  const predefinedUnitNames = [
    "Piece",
    "Box",
    "Carton",
    "Pack",
    "Case",
    "Pallet",
    "Container",
    "Bag",
    "Bundle",
    "Dozen",
    "Kilogram",
    "Gram",
    "Liter",
    "Milliliter"
  ]
  
  const [unitNameOpen, setUnitNameOpen] = useState<{ [key: number]: boolean }>({})
  const [customUnitName, setCustomUnitName] = useState<{ [key: number]: string }>({})


  // Dropdown data
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stores, setStores] = useState<Store[]>([])
  // dropdownsLoaded removed

  
  
  // Load dropdown data
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])
  
  // Load product data immediately when product is available
  useEffect(() => {
    if (product && open) {
      loadProductData()
    }
  }, [product, open])
  
  // Retry helper function
  const retryFetch = async <T,>(
    fetchFn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000,
    name: string = "data"
  ): Promise<T> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await fetchFn()
        return result
      } catch (error) {
        const isLastAttempt = attempt === retries - 1
        
        if (isLastAttempt) {
          throw error
        }
        
        // Wait before retrying (exponential backoff)
        const waitTime = delay * Math.pow(1.5, attempt)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
    throw new Error(`Failed to fetch ${name} after ${retries} attempts`)
  }
  
  const loadData = async () => {
    setIsLoading(true)
    const errors: string[] = []
    
    try {
      // Load each dropdown independently with retry logic
      const [categoriesResult, suppliersResult, storesResult] = await Promise.allSettled([
        retryFetch(
          () => getProductCategories(),
          3,
          1000,
          "categories"
        ).catch(err => {
          errors.push("categories")
          console.error("Failed to load categories after retries:", err)
          return []
        }),
        retryFetch(
          () => getSuppliers(),
          3,
          1000,
          "suppliers"
        ).catch(err => {
          errors.push("suppliers")
          console.error("Failed to load suppliers after retries:", err)
          return []
        }),
        retryFetch(
          () => getStores(),
          3,
          1000,
          "stores"
        ).catch(err => {
          errors.push("stores")
          console.error("Failed to load stores after retries:", err)
          return []
        })
      ])
      
      // Extract data from settled promises
      const categoriesData = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
      const suppliersData = suppliersResult.status === 'fulfilled' ? suppliersResult.value : []
      const storesData = storesResult.status === 'fulfilled' ? storesResult.value : []
      
      setCategories(categoriesData)
      setSuppliers(suppliersData)
      setStores(storesData)
      

      
      // Show specific error message only if all dropdowns failed
      if (errors.length === 3) {
        toast({
          title: "Error",
          description: "Failed to load dropdown data after multiple attempts. Please check your connection and try again.",
          variant: "destructive"
        })
      } else if (errors.length > 0) {
        // Show warning for partial failures
        toast({
          title: "Warning",
          description: `Failed to load: ${errors.join(", ")}. You can still edit the product.`,
          variant: "default"
        })
      }
    } catch (error) {
      console.error("Unexpected error loading dropdown data:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading data",
        variant: "destructive"
      })

    } finally {
      setIsLoading(false)
    }
  }
  
  const loadProductData = () => {
    if (!product) return
    
    setFormData({
      name: product.name || "",
      cost: product.unit_cost !== null && product.unit_cost !== undefined ? parseFloat(product.unit_cost.toString()).toString() : "",
      barcode: product.barcode || "",
      stock: product.stock_quantity !== undefined && product.stock_quantity !== null ? product.stock_quantity.toString() : "0",
      lowStockThreshold: product.low_stock_threshold !== undefined && product.low_stock_threshold !== null ? product.low_stock_threshold.toString() : "10",
      trackInventory: product.track_inventory ?? true,
      isActive: product.is_active ?? true,
      weight: product.weight !== null && product.weight !== undefined ? parseFloat(product.weight.toString()).toString() : "",
      dimensions: {
        length: product.length !== null && product.length !== undefined ? parseFloat(product.length.toString()).toString() : "",
        width: product.width !== null && product.width !== undefined ? parseFloat(product.width.toString()).toString() : "",
        height: product.height !== null && product.height !== undefined ? parseFloat(product.height.toString()).toString() : ""
      },
      shippingClass: product.shipping_class || "standard",
      images: Array.isArray(product.images) ? product.images : product.image_url ? [product.image_url] : [],
      primaryImageIndex: product.primary_image_index || 0,
      store_id: product.store_id || "",
      hasPackaging: product.has_packaging || false,
      baseUnit: product.base_unit || "",
      isTaxable: product.is_taxable ?? true,
      taxRate: product.tax_rate !== null && product.tax_rate !== undefined ? parseFloat(product.tax_rate.toString()).toString() : "",
      hsCode: product.hs_code || ""
    })

    const existingSizes = sizeRowsFor(product)
    setSizes(existingSizes)
    setHasSizes(Boolean(product.has_variations) && existingSizes.length > 0)

    // Load packaging units if they exist
    if (product.has_packaging && Array.isArray(product.packaging_units) && product.packaging_units.length > 0) {
      const mappedPackagingUnits = product.packaging_units.map((unit: any) => ({
        unit_name: unit.unit_name || "",
        unit_abbreviation: unit.unit_abbreviation || "",
        description: unit.description || "",
        base_unit_quantity: unit.base_unit_quantity?.toString() || "1",
        is_base_unit: unit.is_base_unit || false,
        is_sellable: unit.is_sellable ?? true,
        is_purchasable: unit.is_purchasable ?? true,
        is_active: unit.is_active ?? true,
        price_per_unit: unit.price_per_unit?.toString() || "",
        cost_per_unit: unit.cost_per_unit?.toString() || "",
        barcode: unit.barcode || "",
        display_order: unit.display_order || 0,
        weight: unit.weight?.toString() || "",
        length: unit.length?.toString() || "",
        width: unit.width?.toString() || "",
        height: unit.height?.toString() || ""
      }))
      setPackagingUnits(mappedPackagingUnits)
    } else {
      setPackagingUnits([])
    }
  }
  
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }
  
  const handleDimensionsChange = (field: keyof Dimensions, value: string) => {
    setFormData(prev => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        [field]: value
      }
    }))
  }
  
  const triggerFileInput = (inputId: string) => {
    const fileInput = document.getElementById(inputId) as HTMLInputElement | null
    if (fileInput) {
      fileInput.click()
    }
  }
  
  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Read files as base64 data URIs - the backend decodes and persists these
    // (it rejects blob: URLs, which are only ever valid in this browser tab).
    const newImages = await Promise.all(Array.from(files).map((file) => fileToDataUrl(file)))

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...newImages]
    }))
    
    // Reset the file input
    e.target.value = ""
  }
  
  // Packaging handlers
  const handlePackagingUnitChange = (index: number, field: string, value: string | boolean | number) => {
    setPackagingUnits(prev => 
      prev.map((unit, i) => 
        i === index ? { ...unit, [field]: value } : unit
      )
    )
  }
  
  const addPackagingUnit = () => {
    setPackagingUnits(prev => [
      ...prev,
      {
        unit_name: "",
        unit_abbreviation: "",
        description: "",
        base_unit_quantity: "1",
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: true,
        is_active: true,
        price_per_unit: "",
        cost_per_unit: "",
        barcode: "",
        display_order: prev.length,
        weight: "",
        length: "",
        width: "",
        height: ""
      }
    ])
  }
  
  const removePackagingUnit = (index: number) => {
    setPackagingUnits(prev => prev.filter((_, i) => i !== index))
  }
  
  const removeProductImage = (imageIndex: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== imageIndex),
      primaryImageIndex: prev.primaryImageIndex >= prev.images.length - 1 
        ? Math.max(0, prev.images.length - 2) 
        : prev.primaryImageIndex
    }))
  }
  
  const setPrimaryImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      primaryImageIndex: index
    }))
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return
    
    setIsSubmitting(true)
    
    try {
      // Fields no longer on this form (SKU, product code, brand, description, category, tags,
      // landed cost) are left out so the product keeps whatever it already has.
      // price and price_tiers are deliberately omitted: selling prices are owned by the
      // imported price lists, and sending them here would overwrite the import.
      const productData = {
        name: formData.name.trim(),
        unit_cost: parseFloat(formData.cost) || 0,
        has_variations: hasSizes,
        variations: hasSizes ? sizesForSave(sizes) : [],
        barcode: formData.barcode.trim() || undefined,
        unit_of_measurement: product.unit_of_measurement || "piece",
        low_stock_threshold: parseInt(formData.lowStockThreshold) || 10,
        track_inventory: formData.trackInventory,
        is_active: formData.isActive,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        length: formData.dimensions.length ? parseFloat(formData.dimensions.length) : undefined,
        width: formData.dimensions.width ? parseFloat(formData.dimensions.width) : undefined,
        height: formData.dimensions.height ? parseFloat(formData.dimensions.height) : undefined,
        shipping_class: formData.shippingClass,
        images: formData.images,
        primary_image_index: formData.primaryImageIndex,
        store_id: formData.store_id,
        has_packaging: formData.hasPackaging,
        base_unit: formData.hasPackaging ? formData.baseUnit : undefined,
        is_taxable: formData.isTaxable,
        tax_rate: formData.taxRate ? parseFloat(formData.taxRate) : null,
        hs_code: formData.hsCode.trim() || null,
        packaging_units: formData.hasPackaging && packagingUnits.length > 0
          ? packagingUnits.map(unit => ({
              unit_name: unit.unit_name.trim(),
              unit_abbreviation: unit.unit_abbreviation.trim(),
              description: unit.description?.trim() || undefined,
              base_unit_quantity: parseFloat(unit.base_unit_quantity as string) || 1,
              is_base_unit: unit.is_base_unit,
              is_sellable: unit.is_sellable,
              is_purchasable: unit.is_purchasable,
              is_active: unit.is_active,
              price_per_unit: unit.price_per_unit ? parseFloat(unit.price_per_unit as string) : undefined,
              cost_per_unit: unit.cost_per_unit ? parseFloat(unit.cost_per_unit as string) : undefined,
              barcode: unit.barcode || undefined,
              display_order: unit.display_order,
              weight: unit.weight ? parseFloat(unit.weight as string) : undefined,
              length: unit.length ? parseFloat(unit.length as string) : undefined,
              width: unit.width ? parseFloat(unit.width as string) : undefined,
              height: unit.height ? parseFloat(unit.height as string) : undefined
            }))
          : []
      }

      const result = await updateProduct(product.id, productData)

      if (result.status === "success") {
        toast({
          title: "Success",
          description: "Product updated successfully."
        })
        
        onProductUpdated()
        onOpenChange(false)
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to update product",
          variant: "destructive"
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-full sm:max-w-4xl flex flex-col"
        style={{ maxWidth: '800px' }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Product
          </SheetTitle>
        </SheetHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
          <div className="flex-1 overflow-y-auto p-6">
            <form id="edit-product-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Item No.</Label>
                    <Input value={product?.item_number ?? ""} disabled />
                  </div>
                  <div className="col-span-3 space-y-2">
                    <Label htmlFor="name">Item Description *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="e.g. Syringe 5ml"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost Price</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => handleInputChange("cost", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Selling prices come from the imported price lists (NSPV, NSPH, NSPO, NSPD) and are changed by re-importing the list under Inventory &gt; Price Lists.
                </p>
              </CardContent>
            </Card>

            {/* Sizes */}
            <Card>
              <CardHeader>
                <CardTitle>Sizes</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductSizesFields
                  enabled={hasSizes}
                  onEnabledChange={setHasSizes}
                  sizes={sizes}
                  onSizesChange={setSizes}
                  productName={formData.name}
                />
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="store_id">Store *</Label>
                    <Select
                      value={formData.store_id}
                      onValueChange={(value) => handleInputChange("store_id", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map(store => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => handleInputChange("barcode", e.target.value)}
                      placeholder="Enter barcode"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      disabled
                      readOnly
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Adjust stock via Stock Adjustment or a Purchase Order.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      value={formData.lowStockThreshold}
                      onChange={(e) => handleInputChange("lowStockThreshold", e.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="trackInventory"
                      checked={formData.trackInventory}
                      onCheckedChange={(checked) => handleInputChange("trackInventory", checked)}
                    />
                    <Label htmlFor="trackInventory">Track Inventory</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => handleInputChange("isActive", checked)}
                    />
                    <Label htmlFor="isActive">Active Product</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Tax Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Tax Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isTaxable"
                    checked={formData.isTaxable}
                    onCheckedChange={(checked) => handleInputChange("isTaxable", checked)}
                  />
                  <Label htmlFor="isTaxable">Product is Taxable</Label>
                </div>
                
                {formData.isTaxable && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="taxRate">Tax Rate (%)</Label>
                      <Select
                        value={formData.taxRate}
                        onValueChange={(value) => handleInputChange("taxRate", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select tax rate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0% - Zero Rated</SelectItem>
                          <SelectItem value="8">8% - Reduced Rate</SelectItem>
                          <SelectItem value="16">16% - Standard Rate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hsCode">HS Code</Label>
                      <Input
                        id="hsCode"
                        value={formData.hsCode}
                        onChange={(e) => handleInputChange("hsCode", e.target.value)}
                        placeholder="e.g., 8471.30.00"
                      />
                      <p className="text-xs text-muted-foreground">
                        Harmonized System code for customs
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Shipping & Physical Properties */}
            <Card>
              <CardHeader>
                <CardTitle>Shipping & Physical Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (grams)</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      value={formData.weight}
                      onChange={(e) => handleInputChange("weight", e.target.value)}
                      placeholder="Enter weight"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingClass">Shipping Class</Label>
                    <Select
                      value={formData.shippingClass}
                      onValueChange={(value) => handleInputChange("shippingClass", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shipping class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="express">Express</SelectItem>
                        <SelectItem value="overnight">Overnight</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="heavy">Heavy</SelectItem>
                        <SelectItem value="fragile">Fragile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Dimensions (cm)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="length" className="text-xs">Length</Label>
                      <Input
                        id="length"
                        type="number"
                        step="0.01"
                        value={formData.dimensions.length}
                        onChange={(e) => handleDimensionsChange("length", e.target.value)}
                        placeholder="Length"
                      />
                    </div>
                    <div>
                      <Label htmlFor="width" className="text-xs">Width</Label>
                      <Input
                        id="width"
                        type="number"
                        step="0.01"
                        value={formData.dimensions.width}
                        onChange={(e) => handleDimensionsChange("width", e.target.value)}
                        placeholder="Width"
                      />
                    </div>
                    <div>
                      <Label htmlFor="height" className="text-xs">Height</Label>
                      <Input
                        id="height"
                        type="number"
                        step="0.01"
                        value={formData.dimensions.height}
                        onChange={(e) => handleDimensionsChange("height", e.target.value)}
                        placeholder="Height"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Packaging Units */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    <span>Packaging Units</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="hasPackaging"
                      checked={formData.hasPackaging}
                      onCheckedChange={(checked) => {
                        handleInputChange("hasPackaging", checked)
                        if (checked && !formData.baseUnit) {
                          handleInputChange("baseUnit", "Piece")
                        }
                      }}
                    />
                    <Label htmlFor="hasPackaging">Enable Packaging</Label>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {formData.hasPackaging && (
                  <div className="space-y-4">
                    
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Define packaging units (e.g., Piece, Box, Carton)
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={addPackagingUnit}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Unit
                      </Button>
                    </div>
                    
                    {packagingUnits.map((unit, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">Unit {index + 1}</h4>
                            {unit.is_base_unit && (
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                Base Unit
                              </span>
                            )}
                          </div>
                          {!unit.is_base_unit && packagingUnits.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removePackagingUnit(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`unit-name-${index}`}>Unit Name *</Label>
                            <Popover open={unitNameOpen[index]} onOpenChange={(open) => setUnitNameOpen(prev => ({ ...prev, [index]: open }))}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={unitNameOpen[index]}
                                  className="w-full justify-between"
                                >
                                  {unit.unit_name || "Select unit name..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput 
                                    placeholder="Search or type custom unit..." 
                                    value={customUnitName[index] || ""}
                                    onValueChange={(value) => setCustomUnitName(prev => ({ ...prev, [index]: value }))}
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      <div className="p-2">
                                        <p className="text-sm text-muted-foreground mb-2">
                                          No predefined unit found.
                                        </p>
                                        <Button
                                          size="sm"
                                          className="w-full"
                                          onClick={() => {
                                            if (customUnitName[index]?.trim()) {
                                              handlePackagingUnitChange(index, "unit_name", customUnitName[index].trim())
                                              setCustomUnitName(prev => ({ ...prev, [index]: "" }))
                                              setUnitNameOpen(prev => ({ ...prev, [index]: false }))
                                            }
                                          }}
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Use "{customUnitName[index]}"
                                        </Button>
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {predefinedUnitNames.map((unitName) => (
                                        <CommandItem
                                          key={unitName}
                                          value={unitName}
                                          onSelect={(currentValue) => {
                                            handlePackagingUnitChange(index, "unit_name", currentValue)
                                            setCustomUnitName(prev => ({ ...prev, [index]: "" }))
                                            setUnitNameOpen(prev => ({ ...prev, [index]: false }))
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              unit.unit_name === unitName ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {unitName}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`unit-abbr-${index}`}>Abbreviation *</Label>
                            <Input
                              id={`unit-abbr-${index}`}
                              value={unit.unit_abbreviation}
                              onChange={(e) => handlePackagingUnitChange(index, "unit_abbreviation", e.target.value)}
                              placeholder="e.g., PC, BOX, CTN"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`unit-quantity-${index}`}>
                              Base Unit Quantity *
                            </Label>
                            <Input
                              id={`unit-quantity-${index}`}
                              type="number"
                              min="1"
                              value={unit.base_unit_quantity}
                              onChange={(e) => handlePackagingUnitChange(index, "base_unit_quantity", parseInt(e.target.value) || 1)}
                              placeholder="1"
                              disabled={unit.is_base_unit}
                              required
                            />
                            <p className="text-xs text-muted-foreground">
                              How many base units in this packaging
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`unit-display-order-${index}`}>Display Order</Label>
                            <Input
                              id={`unit-display-order-${index}`}
                              type="number"
                              min="0"
                              value={unit.display_order || 0}
                              onChange={(e) => handlePackagingUnitChange(index, "display_order", parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                            <p className="text-xs text-muted-foreground">
                              Lower numbers appear first
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`unit-price-${index}`}>Price Per Unit</Label>
                            <Input
                              id={`unit-price-${index}`}
                              type="number"
                              step="0.01"
                              value={unit.price_per_unit || ""}
                              onChange={(e) => handlePackagingUnitChange(index, "price_per_unit", e.target.value ? parseFloat(e.target.value) : "")}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`unit-cost-${index}`}>Cost Per Unit</Label>
                            <Input
                              id={`unit-cost-${index}`}
                              type="number"
                              step="0.01"
                              value={unit.cost_per_unit || ""}
                              onChange={(e) => handlePackagingUnitChange(index, "cost_per_unit", e.target.value ? parseFloat(e.target.value) : "")}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label htmlFor={`unit-barcode-${index}`}>Barcode</Label>
                            <Input
                              id={`unit-barcode-${index}`}
                              value={unit.barcode || ""}
                              onChange={(e) => handlePackagingUnitChange(index, "barcode", e.target.value)}
                              placeholder="Enter barcode for this unit"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`unit-base-${index}`}
                              checked={unit.is_base_unit}
                              onCheckedChange={(checked) => handlePackagingUnitChange(index, "is_base_unit", checked)}
                            />
                            <Label htmlFor={`unit-base-${index}`}>Is Base Unit</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`unit-sellable-${index}`}
                              checked={unit.is_sellable !== false}
                              onCheckedChange={(checked) => handlePackagingUnitChange(index, "is_sellable", checked)}
                            />
                            <Label htmlFor={`unit-sellable-${index}`}>Sellable</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`unit-purchasable-${index}`}
                              checked={unit.is_purchasable !== false}
                              onCheckedChange={(checked) => handlePackagingUnitChange(index, "is_purchasable", checked)}
                            />
                            <Label htmlFor={`unit-purchasable-${index}`}>Purchasable</Label>
                          </div>
                        </div>
                        
                        {!unit.is_base_unit && Number(unit.base_unit_quantity) > 1 && (
                          <div className="mt-2 p-3 bg-primary/10 rounded-md">
                            <p className="text-sm">
                              <strong>Conversion:</strong> 1 {unit.unit_name} = {unit.base_unit_quantity} {formData.baseUnit || 'Base Units'}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h5 className="font-medium text-sm mb-2">Quick Guide:</h5>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        <li>• Exactly one unit must be marked as "Base Unit"</li>
                        <li>• Base unit must have a quantity of 1</li>
                        <li>• Example: 1 Box = 10 Pieces, 1 Carton = 100 Pieces</li>
                        <li>• Use display order to control how units appear in dropdowns</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Product Images */}
            <Card>
              <CardHeader>
                <CardTitle>Product Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleProductImageUpload}
                    className="hidden"
                    id="product-image-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => triggerFileInput("product-image-upload")}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Upload Product Images
                  </Button>
                  
                  {formData.images.length > 0 && (
                    <div className="flex flex-wrap gap-4 mt-4">
                      {formData.images.map((image, imgIndex) => (
                        <div key={imgIndex} className="relative">
                          <img 
                            src={image} 
                            alt={`Product Image ${imgIndex + 1}`} 
                            className="w-24 h-24 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant={formData.primaryImageIndex === imgIndex ? "default" : "secondary"}
                            size="sm"
                            className="absolute -top-2 -left-2 h-6 w-6 p-0"
                            onClick={() => setPrimaryImage(imgIndex)}
                          >
                            <Star className={`h-3 w-3 ${formData.primaryImageIndex === imgIndex ? "fill-current" : ""}`} />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 p-0"
                            onClick={() => removeProductImage(imgIndex)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {product?.id && (
              <Card>
                <CardHeader>
                  <CardTitle>KRA eTIMS</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProductKraTab productId={product.id} />
                </CardContent>
              </Card>
            )}
          </form>
        </div>
        
        {/* Fixed Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" form="edit-product-form" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Update Product
                </>
              )}
            </Button>
          </div>
        </div>
        </>
      )}
      
      </SheetContent>
    </Sheet>
  )
}
