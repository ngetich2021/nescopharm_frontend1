"use client"

import { priceFloorErrors } from "../price-floor"
import { useState, useEffect, useRef, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Loader2, Plus, Image as ImageIcon, Package, Trash2, X, Check, ChevronsUpDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createProduct, fileToDataUrl, type PackagingUnit, type PriceTierInput } from "@/lib/products"
import { tierRowsForForm } from "@/lib/price-codes"
import { PriceCodeFields } from "./price-code-fields"
import { getProductCategories } from "@/lib/product-categories"
import { getSuppliers } from "@/lib/suppliers"
import { getStores } from "@/lib/stores"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import type { ProductCategory } from "@/lib/product-categories"
import type { Supplier } from "@/lib/suppliers"
import type { Store } from "@/lib/stores"
import type { ProductVariant as LibProductVariant } from "@/lib/products"
import { CreateCategoryModal } from "@/components/modals/create-category-modal"

interface ProductVariant {
  id: string
  name: string
  sku: string
  price: string
  cost: string
  stock_quantity: string
  is_active: boolean
  store_id?: string
  images: string[]
  attributes: { key: string; value: string }[]
  allocated: number
  on_hand: number
  options: string[]
  damaged: number
  on_hold: number
  price_tiers: PriceTierInput[]
}

interface Dimensions {
  length: string
  width: string
  height: string
}

interface CreateProductSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductCreated: () => void
}

export function CreateProductSheet({ open, onOpenChange, onProductCreated }: CreateProductSheetProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form data
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    brand: "",
    supplier: "",
    tags: "",
    price: "",
    cost: "",
    shipping_cost: "",
    logistics_cost: "",
    margin_amount: "",
    last_price: "",
    sku: "",
    barcode: "",
    product_code: "",
    unit_of_measurement: "piece",
    stock: "",
    lowStockThreshold: "10",
    trackInventory: true,
    isActive: true,
    weight: "",
    dimensions: {
      length: "",
      width: "",
      height: ""
    } as Dimensions,
    shippingClass: "standard",
    images: [] as string[],
    primaryImageIndex: 0,
    hasVariations: false,
    hasPackaging: false,
    baseUnit: "",
    store_id: "",
    // Tax fields
    isTaxable: true,
    taxRate: "",
    hsCode: ""
  })
  
  // Packaging units
  const [packagingUnits, setPackagingUnits] = useState<PackagingUnit[]>([
    {
      unit_name: "Piece",
      unit_abbreviation: "PC",
      base_unit_quantity: 1,
      is_base_unit: true,
      is_sellable: true,
      is_purchasable: true,
      is_active: true,
      display_order: 1
    }
  ])
  const [baseUnitOpen, setBaseUnitOpen] = useState(false)
  const [customBaseUnit, setCustomBaseUnit] = useState("")
  
  // Predefined base units
  const predefinedBaseUnits = [
    "Piece",
    "Kilogram",
    "Gram",
    "Liter",
    "Milliliter",
    "Meter",
    "Centimeter",
    "Pack",
    "Unit",
    "Item"
  ]
  
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
  
  // Variants
  const [variants, setVariants] = useState<ProductVariant[]>([
    {
      id: Date.now().toString(),
      name: "",
      sku: "",
      price: "",
      cost: "",
      stock_quantity: "",
      is_active: true,
      store_id: "",
      images: [],
      attributes: [],
      allocated: 0,
      on_hand: 0,
      options: [],
      damaged: 0,
      on_hold: 0,
      price_tiers: tierRowsForForm([])
    }
  ])
  
  const [priceTiers, setPriceTiers] = useState<PriceTierInput[]>(() => tierRowsForForm([]))

  // Minimum valid price = unit cost + shipping cost + logistics cost + margin. No price
  // (selling price, last price, or any tier price) may be at or below this.
  const minimumValidPrice =
    (parseFloat(formData.cost) || 0) +
    (parseFloat(formData.shipping_cost) || 0) +
    (parseFloat(formData.logistics_cost) || 0) +
    (parseFloat(formData.margin_amount) || 0)

  // Dropdown data
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stores, setStores] = useState<Store[]>([])
  
  // Category modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [categorySearchOpen, setCategorySearchOpen] = useState(false)
  
  // Load dropdown data
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])
  
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
      
      // Set default store if only one exists
      if (storesData.length === 1) {
        setFormData(prev => ({
          ...prev,
          store_id: storesData[0].id
        }))
      }
      
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
          description: `Failed to load: ${errors.join(", ")}. You can still create a product.`,
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
  
  const handleCategoryCreated = (newCategory: ProductCategory) => {
    // Add new category to the list
    setCategories(prev => [...prev, newCategory])
    // Set the newly created category as selected
    setFormData(prev => ({
      ...prev,
      category: newCategory.id
    }))
    // Show success notification
    toast({
      title: "Category Created",
      description: `${newCategory.name} has been added successfully`
    })
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
  
  const handleVariantChange = (id: string, field: keyof ProductVariant, value: string | boolean) => {
    setVariants(prev => 
      prev.map(variant => 
        variant.id === id 
          ? { ...variant, [field]: value } 
          : variant
      )
    )
  }
  
  const addVariant = () => {
    setVariants(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "",
        sku: "",
        price: formData.price,
        cost: formData.cost,
        stock_quantity: "",
        is_active: true,
        store_id: formData.store_id,
        images: [],
        attributes: [],
        allocated: 0,
        on_hand: 0,
        options: [],
        damaged: 0,
        on_hold: 0,
        price_tiers: tierRowsForForm([])
      }
    ])
  }

  const setVariantTiers = (id: string, tiers: PriceTierInput[]) => {
    setVariants(prev => prev.map(variant => variant.id === id ? { ...variant, price_tiers: tiers } : variant))
  }
  
  const removeVariant = (id: string) => {
    if (variants.length > 1) {
      setVariants(prev => prev.filter(variant => variant.id !== id))
    }
  }
  
  const addVariantAttribute = (variantId: string) => {
    setVariants(prev => 
      prev.map(variant => 
        variant.id === variantId 
          ? { 
              ...variant, 
              attributes: [...variant.attributes, { key: "", value: "" }] 
            } 
          : variant
      )
    )
  }
  
  const updateVariantAttribute = (variantId: string, index: number, field: "key" | "value", value: string) => {
    setVariants(prev => 
      prev.map(variant => 
        variant.id === variantId 
          ? { 
              ...variant, 
              attributes: variant.attributes.map((attr, i) => 
                i === index ? { ...attr, [field]: value } : attr
              ) 
            } 
          : variant
      )
    )
  }
  
  const removeVariantAttribute = (variantId: string, index: number) => {
    setVariants(prev => 
      prev.map(variant => 
        variant.id === variantId 
          ? { 
              ...variant, 
              attributes: variant.attributes.filter((_, i) => i !== index) 
            } 
          : variant
      )
    )
  }
  
  const addVariantOption = (variantId: string, option: string) => {
    setVariants(prev => 
      prev.map(variant => 
        variant.id === variantId 
          ? { 
              ...variant, 
              options: [...variant.options, option] 
            } 
          : variant
      )
    )
  }
  
  const removeVariantOption = (variantId: string, optionIndex: number) => {
    setVariants(prev => 
      prev.map(variant => 
        variant.id === variantId 
          ? { 
              ...variant, 
              options: variant.options.filter((_, i) => i !== optionIndex) 
            } 
          : variant
      )
    )
  }
  
  const updateVariantOption = (variantId: string, optionIndex: number, value: string) => {
    setVariants(prev => 
      prev.map(variant => 
        variant.id === variantId 
          ? { 
              ...variant, 
              options: variant.options.map((option, i) => 
                i === optionIndex ? value : option
              ) 
            } 
          : variant
      )
    )
  }
  
  const handleVariantImageUpload = async (variantId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Read files as base64 data URIs - the backend decodes and persists these
    // (it rejects blob: URLs, which are only ever valid in this browser tab).
    const newImages = await Promise.all(Array.from(files).map((file) => fileToDataUrl(file)))

    setVariants(prev =>
      prev.map(variant =>
        variant.id === variantId
          ? {
              ...variant,
              images: [...variant.images, ...newImages]
            }
          : variant
      )
    )

    // Reset the file input
    e.target.value = ""
  }
  
  const removeVariantImage = (variantId: string, imageIndex: number) => {
    setVariants(prev => 
      prev.map(variant => 
        variant.id === variantId 
          ? { 
              ...variant, 
              images: variant.images.filter((_, i) => i !== imageIndex) 
            } 
          : variant
      )
    )
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
  
  const removeProductImage = (imageIndex: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== imageIndex)
    }))
  }
  
  // Calculate base_unit_quantity based on hierarchy
  const calculateBaseUnitQuantity = useCallback((units: PackagingUnit[], targetIndex: number): number => {
    const targetUnit = units[targetIndex]
    
    // Base unit always has quantity of 1
    if (targetUnit.is_base_unit) {
      return 1
    }
    
    // If no parent reference, use units_per_parent or default to 1
    if (!targetUnit.parent_unit_reference) {
      return Number(targetUnit.units_per_parent || 1)
    }
    
    // Find the parent unit
    const parentUnit = units.find(u => u.unit_name === targetUnit.parent_unit_reference)
    
    if (!parentUnit) {
      return Number(targetUnit.units_per_parent || 1)
    }
    
    // Get parent's base_unit_quantity (recursively calculated)
    const parentIndex = units.findIndex(u => u.unit_name === targetUnit.parent_unit_reference)
    const parentBaseQty = parentIndex >= 0 ? calculateBaseUnitQuantity(units, parentIndex) : 1
    
    // Multiply: parent's base quantity × units per parent
    return parentBaseQty * Number(targetUnit.units_per_parent || 1)
  }, [])
  
  // Packaging unit handlers
  const handlePackagingUnitChange = (index: number, field: keyof PackagingUnit, value: string | boolean | number | null) => {
    setPackagingUnits(prev => {
      const updated = prev.map((unit, i) => {
        if (i === index) {
          // If changing is_base_unit to true, set all others to false
          if (field === 'is_base_unit' && value === true) {
            return { 
              ...unit, 
              is_base_unit: true, 
              base_unit_quantity: 1,
              parent_unit_reference: null,
              units_per_parent: null
            }
          }
          
          // If setting parent_unit_reference, ensure it's a string or null
          if (field === 'parent_unit_reference') {
            return {
              ...unit,
              parent_unit_reference: typeof value === 'string' ? value : null,
            }
          }
          
          // If setting units_per_parent, ensure it's a number or null
          if (field === 'units_per_parent') {
            return {
              ...unit,
              units_per_parent: typeof value === 'number' ? value : null,
            }
          }
          
          // For other fields
          return { ...unit, [field]: value } as PackagingUnit
        }
        // If setting a new base unit, unset the old one
        if (field === 'is_base_unit' && value === true) {
          return { ...unit, is_base_unit: false }
        }
        return unit
      })
      
      // Recalculate all base_unit_quantities
      return updated.map((unit, i) => ({
        ...unit,
        base_unit_quantity: calculateBaseUnitQuantity(updated, i)
      }))
    })
  }
  
  const addPackagingUnit = () => {
    const maxOrder = packagingUnits.reduce((max, unit) => 
      Math.max(max, unit.display_order || 0), 0
    )
    
    setPackagingUnits(prev => [
      ...prev,
      {
        unit_name: "",
        unit_abbreviation: "",
        base_unit_quantity: 1,
        is_base_unit: false,
        is_sellable: true,
        is_purchasable: true,
        is_active: true,
        display_order: maxOrder + 1
      }
    ])
  }
  
  const removePackagingUnit = (index: number) => {
    if (packagingUnits.length > 1 && !packagingUnits[index].is_base_unit) {
      setPackagingUnits(prev => prev.filter((_, i) => i !== index))
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submission started')
    setIsSubmitting(true)
    
    try {
      // Prepare product data to match the ProductData interface
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category_id: formData.category || undefined,
        brand: formData.brand.trim() || undefined,
        supplier_id: formData.supplier || undefined,
        tags: formData.tags 
          ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
          : [],
        price: parseFloat(formData.price) || 0,
        cost: parseFloat(formData.cost) || 0,
        shipping_cost: parseFloat(formData.shipping_cost) || 0,
        logistics_cost: parseFloat(formData.logistics_cost) || 0,
        margin_amount: parseFloat(formData.margin_amount) || 0,
        price_tiers: priceTiers.filter(t => t.tier_name.trim() && t.price > 0),
        last_price: formData.last_price ? parseFloat(formData.last_price) : undefined,
        sku: formData.sku.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        product_code: formData.product_code.trim() || undefined,
        unit_of_measurement: formData.unit_of_measurement,
        stock: parseInt(formData.stock) || 0,
        lowStockThreshold: parseInt(formData.lowStockThreshold) || 10,
        trackInventory: formData.trackInventory,
        isActive: formData.isActive,
        // Tax fields
        is_taxable: formData.isTaxable,
        tax_rate: formData.taxRate ? parseFloat(formData.taxRate) : undefined,
        hs_code: formData.hsCode?.trim() || undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        dimensions: {
          length: formData.dimensions.length || "",
          width: formData.dimensions.width || "",
          height: formData.dimensions.height || ""
        },
        shippingClass: formData.shippingClass,
        images: formData.images,
        primaryImageIndex: formData.primaryImageIndex,
        hasVariations: formData.hasVariations,
        // Packaging fields
        has_packaging: formData.hasPackaging,
        base_unit: formData.hasPackaging ? formData.baseUnit : undefined,
        packaging_units: formData.hasPackaging ? packagingUnits : undefined,
        variants: formData.hasVariations 
          ? variants.map(variant => ({
              name: variant.name.trim(),
              sku: variant.sku.trim() || "",
              price: parseFloat(variant.price) || 0,
              cost: parseFloat(variant.cost) || 0,
              stock_quantity: parseInt(variant.stock_quantity) || 0,
              is_active: variant.is_active,
              options: variant.options || [],
              images: variant.images,
              store_id: variant.store_id || formData.store_id,
              allocated: variant.allocated,
              on_hand: variant.on_hand,
              attributes: variant.attributes.reduce((acc, attr) => {
                if (attr.key && attr.value) {
                  acc[attr.key] = attr.value;
                }
                return acc;
              }, {} as Record<string, string | string[]>),
              damaged: variant.damaged,
              on_hold: variant.on_hold,
              price_tiers: variant.price_tiers,
              id: 0 // New variants don't have IDs yet
            }))
          : [],
        store_id: formData.store_id
      }
      
      console.log('Prepared product data:', JSON.stringify(productData, null, 2))
      console.log('Has variations:', productData.hasVariations)
      console.log('Number of variants:', productData.variants.length)
      
      if (productData.hasVariations) {
        console.log('Variants data:', JSON.stringify(productData.variants, null, 2))
      }
      
      // Validate that we have required data
      if (!productData.name) {
        throw new Error("Product name is required");
      }
      
      if (productData.hasVariations && productData.variants.length === 0) {
        throw new Error("Product has variations enabled but no variants provided");
      }
      
      // Validate packaging units if packaging is enabled
      if (productData.has_packaging) {
        if (!productData.base_unit) {
          throw new Error("Base unit is required when packaging is enabled");
        }
        
        if (!productData.packaging_units || productData.packaging_units.length === 0) {
          throw new Error("At least one packaging unit is required when packaging is enabled");
        }
        
        const baseUnits = productData.packaging_units.filter(u => u.is_base_unit);
        if (baseUnits.length === 0) {
          throw new Error("Exactly one unit must be marked as base unit");
        }
        if (baseUnits.length > 1) {
          throw new Error("Only one unit can be marked as base unit");
        }
        
        const baseUnit = baseUnits[0];
        if (baseUnit.base_unit_quantity !== 1) {
          throw new Error("Base unit must have base_unit_quantity of 1");
        }
        
        for (let i = 0; i < productData.packaging_units.length; i++) {
          const unit = productData.packaging_units[i];
          if (!unit.unit_name) {
            throw new Error(`Packaging unit ${i + 1} name is required`);
          }
          if (!unit.unit_abbreviation) {
            throw new Error(`Packaging unit ${i + 1} abbreviation is required`);
          }
        }
      }
      
      // Validate each variant if we have variations
      if (productData.hasVariations) {
        for (let i = 0; i < productData.variants.length; i++) {
          const variant = productData.variants[i];
          if (!variant.name) {
            throw new Error(`Variant ${i + 1} name is required`);
          }
        }
      }
      
      const floorErrors = priceFloorErrors({
        hasVariations: productData.hasVariations,
        unitCost: parseFloat(formData.cost) || 0,
        shippingCost: parseFloat(formData.shipping_cost) || 0,
        logisticsCost: parseFloat(formData.logistics_cost) || 0,
        marginAmount: parseFloat(formData.margin_amount) || 0,
        price: productData.price,
        lastPrice: productData.last_price,
        tiers: priceTiers,
        variants: productData.variants,
      })
      if (floorErrors.length > 0) {
        throw new Error(`${floorErrors.join("; ")} (cost + shipping + logistics + margin).`)
      }

      const result = await createProduct(productData)

      // Add debug logging
      console.log('Product creation result:', result)
      
      if (result.success) {
        console.log('Product created successfully')
        toast({
          title: "Success",
          description: "Product created successfully."
        })
        
        // Reset form
        setFormData({
          name: "",
          description: "",
          category: "",
          brand: "",
          supplier: "",
          tags: "",
          price: "",
          cost: "",
          shipping_cost: "",
          logistics_cost: "",
          margin_amount: "",
          last_price: "",
          sku: "",
          barcode: "",
          product_code: "",
          unit_of_measurement: "piece",
          stock: "",
          lowStockThreshold: "10",
          trackInventory: true,
          isActive: true,
          weight: "",
          dimensions: {
            length: "",
            width: "",
            height: ""
          },
          shippingClass: "standard",
          images: [],
          primaryImageIndex: 0,
          hasVariations: false,
          hasPackaging: false,
          baseUnit: "",
          store_id: "",
          isTaxable: true,
          taxRate: "",
          hsCode: ""
        })
        setPriceTiers(tierRowsForForm([]))

        setPackagingUnits([
          {
            unit_name: "Piece",
            unit_abbreviation: "PC",
            base_unit_quantity: 1,
            is_base_unit: true,
            is_sellable: true,
            is_purchasable: true,
            is_active: true,
            display_order: 1
          }
        ])
        
        setVariants([
          {
            id: Date.now().toString(),
            name: "",
            sku: "",
            price: "",
            cost: "",
            stock_quantity: "",
            is_active: true,
            store_id: "",
            images: [],
            attributes: [],
            allocated: 0,
            on_hand: 0,
            options: [],
            damaged: 0,
            on_hold: 0,
            price_tiers: tierRowsForForm([])
          }
        ])

        onProductCreated()
        onOpenChange(false)
      } else {
        console.error('Product creation failed:', result.message)
        toast({
          title: "Error",
          description: result.message || "Failed to create product",
          variant: "destructive"
        })
      }
    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create product",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-full sm:max-w-4xl overflow-y-auto"
        style={{ maxWidth: '800px' }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Product
          </SheetTitle>
        </SheetHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Enter product name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => handleInputChange("brand", e.target.value)}
                      placeholder="Enter brand"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      placeholder="Enter product description"
                      rows={3}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Popover open={categorySearchOpen} onOpenChange={setCategorySearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={categorySearchOpen}
                          className="w-full justify-between"
                        >
                          {formData.category 
                            ? categories.find(cat => cat.id === formData.category)?.name 
                            : "Select category..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search categories..." />
                          <CommandList>
                            <CommandEmpty>
                              <div className="p-2 text-center">
                                <p className="text-sm text-muted-foreground mb-2">
                                  No category found.
                                </p>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => {
                                    setCategorySearchOpen(false)
                                    setIsCategoryModalOpen(true)
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Create New Category
                                </Button>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  setCategorySearchOpen(false)
                                  setIsCategoryModalOpen(true)
                                }}
                                className="bg-primary/5 font-medium"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create New Category
                              </CommandItem>
                              {categories
                                .filter(cat => cat.is_active)
                                .map((category) => (
                                  <CommandItem
                                    key={category.id}
                                    value={category.name}
                                    onSelect={() => {
                                      handleInputChange("category", category.id)
                                      setCategorySearchOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.category === category.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex items-center gap-2 flex-1">
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: category.color }}
                                      />
                                      <span>{category.name}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => handleInputChange("tags", e.target.value)}
                      placeholder="clothing, premium, cotton"
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
                  <div className="space-y-2">
                    <Label htmlFor="last_price">Last Price</Label>
                    <Input
                      id="last_price"
                      type="number"
                      step="0.01"
                      value={formData.last_price}
                      onChange={(e) => handleInputChange("last_price", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit_of_measurement">Unit of Measurement</Label>
                    <Select
                      value={formData.unit_of_measurement}
                      onValueChange={(value) => handleInputChange("unit_of_measurement", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="piece">Piece</SelectItem>
                        <SelectItem value="kg">Kilogram</SelectItem>
                        <SelectItem value="g">Gram</SelectItem>
                        <SelectItem value="lb">Pound</SelectItem>
                        <SelectItem value="oz">Ounce</SelectItem>
                        <SelectItem value="liter">Liter</SelectItem>
                        <SelectItem value="ml">Milliliter</SelectItem>
                        <SelectItem value="m">Meter</SelectItem>
                        <SelectItem value="cm">Centimeter</SelectItem>
                        <SelectItem value="ft">Foot</SelectItem>
                        <SelectItem value="inch">Inch</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="pack">Pack</SelectItem>
                        <SelectItem value="pair">Pair</SelectItem>
                        <SelectItem value="set">Set</SelectItem>
                        <SelectItem value="dozen">Dozen</SelectItem>
                        <SelectItem value="roll">Roll</SelectItem>
                        <SelectItem value="bottle">Bottle</SelectItem>
                        <SelectItem value="can">Can</SelectItem>
                        <SelectItem value="bag">Bag</SelectItem>
                        <SelectItem value="carton">Carton</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Landed cost + margin */}
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Landed Cost &amp; Margin</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shipping_cost">Shipping Cost</Label>
                      <Input
                        id="shipping_cost"
                        type="number"
                        step="0.01"
                        value={formData.shipping_cost}
                        onChange={(e) => handleInputChange("shipping_cost", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logistics_cost">Logistics Cost</Label>
                      <Input
                        id="logistics_cost"
                        type="number"
                        step="0.01"
                        value={formData.logistics_cost}
                        onChange={(e) => handleInputChange("logistics_cost", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="margin_amount">Margin (KES)</Label>
                      <Input
                        id="margin_amount"
                        type="number"
                        step="0.01"
                        value={formData.margin_amount}
                        onChange={(e) => handleInputChange("margin_amount", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Minimum valid price: <span className="font-medium text-foreground">KES {minimumValidPrice.toFixed(2)}</span> (cost + shipping + logistics + margin). NSPV, last price, and every other price must be greater than this.
                  </p>
                </div>

                {/* Price tiers */}
                <Separator />
                {formData.hasVariations ? (
                  <p className="text-sm text-muted-foreground">This product has variations - set NSPV, NSPH, NSPO, NSPD for each variation under Variations.</p>
                ) : (
                  <PriceCodeFields
                    nspv={formData.price}
                    onNspvChange={(value) => handleInputChange("price", value)}
                    tiers={priceTiers}
                    onTiersChange={setPriceTiers}
                  />
                )}

                {/* Tax Settings */}
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Tax Settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isTaxable"
                        checked={formData.isTaxable}
                        onCheckedChange={(checked) => handleInputChange("isTaxable", checked)}
                      />
                      <Label htmlFor="isTaxable">Taxable Product</Label>
                    </div>
                    {formData.isTaxable && (
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
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hsCode">HS Code (Harmonized System Code)</Label>
                    <Input
                      id="hsCode"
                      value={formData.hsCode}
                      onChange={(e) => handleInputChange("hsCode", e.target.value)}
                      placeholder="e.g., 8518.30.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for customs and international trade classification
                    </p>
                  </div>
                </div>
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
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => handleInputChange("sku", e.target.value)}
                      placeholder="Enter SKU"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_code">Product Code</Label>
                    <Input
                      id="product_code"
                      value={formData.product_code}
                      onChange={(e) => handleInputChange("product_code", e.target.value)}
                      placeholder="Enter product code"
                    />
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
                      onChange={(e) => handleInputChange("stock", e.target.value)}
                      placeholder="0"
                    />
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
                    <div>
                      <div className="flex items-center gap-2">
                        <span>Packaging Units</span>
                        {formData.hasPackaging && packagingUnits.length > 0 && (
                          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-primary bg-primary/10 rounded-full">
                            {packagingUnits.length}
                          </span>
                        )}
                      </div>
                      {formData.hasPackaging && (
                        <p className="text-xs font-normal text-muted-foreground mt-0.5">
                          Base: {formData.baseUnit || packagingUnits.find(u => u.is_base_unit)?.unit_name || 'Not set'}
                        </p>
                      )}
                    </div>
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
                    <Label htmlFor="hasPackaging" className="text-sm">Enable</Label>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {formData.hasPackaging && (
                  <div className="space-y-3">
                    
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={addPackagingUnit}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Unit
                      </Button>
                    </div>
                    
                    {packagingUnits.map((unit, index) => (
                      <div key={index} className="relative border rounded-lg bg-card overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 pb-3 border-b bg-muted/20">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                              <Package className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-sm">
                                  {unit.unit_name || `Unit ${index + 1}`}
                                </h4>
                                {unit.unit_abbreviation && (
                                  <span className="text-xs text-muted-foreground">({unit.unit_abbreviation})</span>
                                )}
                                {unit.is_base_unit && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded">
                                    Base
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {!unit.is_base_unit && packagingUnits.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePackagingUnit(index)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                          {/* Basic Info */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor={`unit-name-${index}`} className="text-xs font-medium">Unit Name *</Label>
                              <Popover open={unitNameOpen[index]} onOpenChange={(open) => setUnitNameOpen(prev => ({ ...prev, [index]: open }))}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={unitNameOpen[index]}
                                    className="w-full justify-between h-9 text-sm"
                                  >
                                    {unit.unit_name || "Select..."}
                                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                  <Command>
                                    <CommandInput 
                                      placeholder="Search or type custom..." 
                                      value={customUnitName[index] || ""}
                                      onValueChange={(value) => setCustomUnitName(prev => ({ ...prev, [index]: value }))}
                                    />
                                    <CommandList>
                                      <CommandEmpty>
                                        <div className="p-2">
                                          <p className="text-sm text-muted-foreground mb-2">No predefined unit found.</p>
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
                                            <Check className={cn("mr-2 h-4 w-4", unit.unit_name === unitName ? "opacity-100" : "opacity-0")} />
                                            {unitName}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`unit-abbr-${index}`} className="text-xs font-medium">Abbreviation *</Label>
                              <Input
                                id={`unit-abbr-${index}`}
                                value={unit.unit_abbreviation}
                                onChange={(e) => handlePackagingUnitChange(index, "unit_abbreviation", e.target.value)}
                                placeholder="e.g., PC, BOX"
                                className="h-9 text-sm"
                                required
                              />
                            </div>
                          </div>
                          
                          {/* Hierarchical Packaging */}
                          {!unit.is_base_unit && (
                            <>
                              <Separator />
                              <div className="space-y-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`unit-parent-${index}`} className="text-xs font-medium">Parent Unit</Label>
                                  <Select
                                    value={unit.parent_unit_reference || "__none__"}
                                    onValueChange={(value) => handlePackagingUnitChange(index, "parent_unit_reference", value === "__none__" ? null : value)}
                                  >
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="Select parent..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">
                                        <span className="text-muted-foreground">No parent (relative to base)</span>
                                      </SelectItem>
                                      {packagingUnits
                                        .filter((_, i) => i !== index)
                                        .filter(u => u.unit_name)
                                        .map((parentUnit) => (
                                          <SelectItem key={parentUnit.unit_name} value={parentUnit.unit_name}>
                                            {parentUnit.unit_name} {parentUnit.is_base_unit && '(Base)'}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label htmlFor={`unit-per-parent-${index}`} className="text-xs font-medium">
                                      {unit.parent_unit_reference 
                                        ? `${unit.parent_unit_reference}s per ${unit.unit_name || 'Unit'}` 
                                        : 'Base Units per Package'} *
                                    </Label>
                                    <Input
                                      id={`unit-per-parent-${index}`}
                                      type="number"
                                      min="1"
                                      value={unit.units_per_parent || 1}
                                      onChange={(e) => handlePackagingUnitChange(index, "units_per_parent", parseInt(e.target.value) || 1)}
                                      placeholder="1"
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                  
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Total Base Units</Label>
                                    <Input
                                      value={unit.base_unit_quantity}
                                      disabled
                                      className="h-9 text-sm bg-muted/50 font-medium"
                                    />
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Conversion Display */}
                          {!unit.is_base_unit && Number(unit.base_unit_quantity) > 1 && (
                            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-3 py-2">
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5">
                                  <svg className="h-4 w-4 text-amber-600 dark:text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div className="flex-1 text-xs">
                                  {unit.parent_unit_reference && (
                                    <p className="font-medium text-amber-900 dark:text-amber-200">
                                      1 {unit.unit_name} = {unit.units_per_parent} {unit.parent_unit_reference}
                                      {(() => {
                                        const parentUnit = packagingUnits.find(u => u.unit_name === unit.parent_unit_reference)
                                        if (parentUnit && !parentUnit.is_base_unit) {
                                          return ` (${parentUnit.units_per_parent} ${parentUnit.parent_unit_reference || 'units'} each)`
                                        }
                                        return ''
                                      })()}
                                    </p>
                                  )}
                                  <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                                    Total: <span className="font-semibold">1 {unit.unit_name} = {unit.base_unit_quantity} {formData.baseUnit || packagingUnits.find(u => u.is_base_unit)?.unit_name || 'Base Units'}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Additional Options - Collapsed by default */}
                          <Separator />
                          
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`unit-base-${index}`}
                                  checked={unit.is_base_unit}
                                  onCheckedChange={(checked) => handlePackagingUnitChange(index, "is_base_unit", checked)}
                                  className="scale-75"
                                />
                                <Label htmlFor={`unit-base-${index}`} className="text-xs">Base</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`unit-sellable-${index}`}
                                  checked={unit.is_sellable !== false}
                                  onCheckedChange={(checked) => handlePackagingUnitChange(index, "is_sellable", checked)}
                                  className="scale-75"
                                />
                                <Label htmlFor={`unit-sellable-${index}`} className="text-xs">Sellable</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`unit-purchasable-${index}`}
                                  checked={unit.is_purchasable !== false}
                                  onCheckedChange={(checked) => handlePackagingUnitChange(index, "is_purchasable", checked)}
                                  className="scale-75"
                                />
                                <Label htmlFor={`unit-purchasable-${index}`} className="text-xs">Purchasable</Label>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor={`unit-price-${index}`} className="text-xs font-medium">Price</Label>
                                <Input
                                  id={`unit-price-${index}`}
                                  type="number"
                                  step="0.01"
                                  value={unit.price_per_unit || ""}
                                  onChange={(e) => handlePackagingUnitChange(index, "price_per_unit", e.target.value ? parseFloat(e.target.value) : null)}
                                  placeholder="0.00"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`unit-cost-${index}`} className="text-xs font-medium">Cost</Label>
                                <Input
                                  id={`unit-cost-${index}`}
                                  type="number"
                                  step="0.01"
                                  value={unit.cost_per_unit || ""}
                                  onChange={(e) => handlePackagingUnitChange(index, "cost_per_unit", e.target.value ? parseFloat(e.target.value) : null)}
                                  placeholder="0.00"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`unit-display-order-${index}`} className="text-xs font-medium">Order</Label>
                                <Input
                                  id={`unit-display-order-${index}`}
                                  type="number"
                                  min="0"
                                  value={unit.display_order || 0}
                                  onChange={(e) => handlePackagingUnitChange(index, "display_order", parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="h-9 text-sm"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor={`unit-barcode-${index}`} className="text-xs font-medium">Barcode</Label>
                              <Input
                                id={`unit-barcode-${index}`}
                                value={unit.barcode || ""}
                                onChange={(e) => handlePackagingUnitChange(index, "barcode", e.target.value)}
                                placeholder="Enter barcode..."
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Packaging Hierarchy Summary */}
                    {packagingUnits.length > 1 && (
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 space-y-2">
                            <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Packaging Hierarchy</h5>
                            <div className="text-xs font-mono space-y-1 text-blue-800 dark:text-blue-200">
                              {(() => {
                                const baseUnit = packagingUnits.find(u => u.is_base_unit)
                                if (!baseUnit) return <p className="text-muted-foreground italic">Define a base unit first</p>
                                
                                const renderHierarchy = (unitName: string, level: number = 0): React.ReactElement[] => {
                                  const indent = '  '.repeat(level)
                                  const children = packagingUnits.filter(u => u.parent_unit_reference === unitName)
                                  const current = packagingUnits.find(u => u.unit_name === unitName)
                                  
                                  const elements: React.ReactElement[] = []
                                  if (current) {
                                    elements.push(
                                      <div key={unitName} className="flex items-center gap-2">
                                        <span className="text-blue-600 dark:text-blue-400">{indent}{level > 0 ? '↳' : '●'}</span>
                                        <span className="font-medium">{unitName}</span>
                                        {!current.is_base_unit && (
                                          <span className="text-blue-700 dark:text-blue-300">
                                            = {current.base_unit_quantity} {baseUnit.unit_name}
                                          </span>
                                        )}
                                      </div>
                                    )
                                  }
                                  
                                  children.forEach(child => {
                                    elements.push(...renderHierarchy(child.unit_name, level + 1))
                                  })
                                  
                                  return elements
                                }
                                
                                return <>{renderHierarchy(baseUnit.unit_name)}</>
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Variations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Variations</span>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="hasVariations"
                      checked={formData.hasVariations}
                      onCheckedChange={(checked) => handleInputChange("hasVariations", checked)}
                    />
                    <Label htmlFor="hasVariations">Has Variations</Label>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {formData.hasVariations && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Add product variations (e.g., size, color)
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Variation
                      </Button>
                    </div>
                    
                    {variants.map((variant, index) => (
                      <div key={variant.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Variation {index + 1}</h4>
                          {variants.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeVariant(variant.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`variant-name-${variant.id}`}>Name *</Label>
                            <Input
                              id={`variant-name-${variant.id}`}
                              value={variant.name}
                              onChange={(e) => handleVariantChange(variant.id, "name", e.target.value)}
                              placeholder="e.g., Small - Red"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`variant-sku-${variant.id}`}>SKU</Label>
                            <Input
                              id={`variant-sku-${variant.id}`}
                              value={variant.sku}
                              onChange={(e) => handleVariantChange(variant.id, "sku", e.target.value)}
                              placeholder="Enter SKU"
                            />
                          </div>
                          <div className="col-span-2">
                            <PriceCodeFields
                              idPrefix={`variant-${variant.id}-`}
                              title="Variation Prices"
                              nspv={variant.price}
                              onNspvChange={(value) => handleVariantChange(variant.id, "price", value)}
                              tiers={variant.price_tiers}
                              onTiersChange={(tiers) => setVariantTiers(variant.id, tiers)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`variant-cost-${variant.id}`}>Cost</Label>
                            <Input
                              id={`variant-cost-${variant.id}`}
                              type="number"
                              step="0.01"
                              value={variant.cost}
                              onChange={(e) => handleVariantChange(variant.id, "cost", e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`variant-stock-${variant.id}`}>Stock Quantity</Label>
                            <Input
                              id={`variant-stock-${variant.id}`}
                              type="number"
                              value={variant.stock_quantity}
                              onChange={(e) => handleVariantChange(variant.id, "stock_quantity", e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="flex items-center space-x-2 mt-6">
                            <Switch
                              id={`variant-active-${variant.id}`}
                              checked={variant.is_active}
                              onCheckedChange={(checked) => handleVariantChange(variant.id, "is_active", checked)}
                            />
                            <Label htmlFor={`variant-active-${variant.id}`}>Active</Label>
                          </div>
                        </div>
                        
                        {/* Variant Attributes */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Attributes</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addVariantAttribute(variant.id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Attribute
                            </Button>
                          </div>
                          
                          {variant.attributes.map((attr, attrIndex) => (
                            <div key={attrIndex} className="flex gap-2 items-center">
                              <Input
                                value={attr.key}
                                onChange={(e) => updateVariantAttribute(variant.id, attrIndex, "key", e.target.value)}
                                placeholder="Attribute name"
                                className="flex-1"
                              />
                              <Input
                                value={attr.value}
                                onChange={(e) => updateVariantAttribute(variant.id, attrIndex, "value", e.target.value)}
                                placeholder="Attribute value"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeVariantAttribute(variant.id, attrIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        
                        {/* Variant Options */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Options</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addVariantOption(variant.id, "")}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Option
                            </Button>
                          </div>
                          
                          {variant.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex gap-2 items-center">
                              <Input
                                value={option}
                                onChange={(e) => updateVariantOption(variant.id, optionIndex, e.target.value)}
                                placeholder="Option value (e.g., size, color)"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeVariantOption(variant.id, optionIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        
                        {/* Variant Images */}
                        <div className="space-y-2">
                          <Label>Variant Images</Label>
                          <div className="space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleVariantImageUpload(variant.id, e)}
                              className="hidden"
                              id={`variant-image-upload-${variant.id}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => triggerFileInput(`variant-image-upload-${variant.id}`)}
                            >
                              <ImageIcon className="h-4 w-4 mr-2" />
                              Upload Images
                            </Button>
                            
                            {variant.images.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {variant.images.map((image, imgIndex) => (
                                  <div key={imgIndex} className="relative">
                                    <img 
                                      src={image} 
                                      alt={`Variant ${index + 1} Image ${imgIndex + 1}`} 
                                      className="w-16 h-16 object-cover rounded border"
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="absolute -top-2 -right-2 h-5 w-5 p-0"
                                      onClick={() => removeVariantImage(variant.id, imgIndex)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
            
            <Separator />
            
            {/* Submit Button */}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Product
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
        
        {/* Create Category Modal */}
        <CreateCategoryModal
          open={isCategoryModalOpen}
          onOpenChange={setIsCategoryModalOpen}
          onCategoryCreated={handleCategoryCreated}
        />
      </SheetContent>
    </Sheet>
  )
}
