"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { X, Plus, Upload, Trash2, Star, ImageIcon, PlusCircle, Search, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { createProduct } from "@/app/inventory/actions"
import { getCachedStores, type Store } from "@/lib/stores"
import { getProductCategories, createProductCategory, type ProductCategory } from "@/lib/product-categories"
import { getSuppliers, type Supplier } from "@/lib/suppliers"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ProductVariantForm {
  id: string
  name: string
  sku: string
  price: string
  cost: string
  stock_quantity: string
  is_active: boolean
  options: string[]
  option_stocks: { option: string; stock: string }[]
  images: string[]
  attributes: { key: string; value: string }[]
  store_id?: string
}

interface CreateProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface ValidationErrors {
  name?: string
  price?: string
  sku?: string
  store?: string
}

export function CreateProductModal({ isOpen, onClose, onSuccess }: CreateProductModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [currentTab, setCurrentTab] = useState("basic")
  const [errors, setErrors] = useState<ValidationErrors>({})

  // Define the tab order - moved up to avoid reference issues
  const tabOrder = ["basic", "pricing", "inventory", "variations", "media"]

  // Animation control
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Basic product info
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [brand, setBrand] = useState("")
  const [supplier, setSupplier] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  // Pricing and inventory
  const [price, setPrice] = useState("")
  const [cost, setCost] = useState("")
  const [sku, setSku] = useState("")
  const [stock, setStock] = useState("")
  const [lowStockThreshold, setLowStockThreshold] = useState("")
  const [trackInventory, setTrackInventory] = useState(true)

  // Product status
  const [isActive, setIsActive] = useState(true)

  // Shipping
  const [weight, setWeight] = useState("")
  const [dimensions, setDimensions] = useState({ length: "", width: "", height: "" })
  const [shippingClass, setShippingClass] = useState("")
  const shippingClasses = ["standard", "express", "overnight", "free", "heavy", "fragile"]

  // Units of measurement
  const unitsOfMeasurement = [
    "pcs", "kg", "g", "lb", "oz", "liter", "ml", "m", "cm", "ft", "inch",
    "box", "pack", "pair", "set", "dozen", "roll", "bottle", "can", "bag", "carton"
  ]

  // Images
  const [images, setImages] = useState<string[]>([])
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)

  // Variations
  const [hasVariations, setHasVariations] = useState(false)
  const [variants, setVariants] = useState<ProductVariantForm[]>([])

  // New fields for full API payload
  const [lastPrice, setLastPrice] = useState("")
  const [unitOfMeasurement, setUnitOfMeasurement] = useState("pcs")
  const [barcode, setBarcode] = useState("")

  // Store selection
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>("")
  const [isLoadingStores, setIsLoadingStores] = useState(false)

  // Categories state
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState("#6B7280")
  const [newCategoryActive, setNewCategoryActive] = useState(true)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false)
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("")
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false)

  // Load stores, categories, and suppliers when modal opens
  useEffect(() => {
    if (isOpen) {
      loadStores()
      loadCategories()
      loadSuppliers()
    }
  }, [isOpen])

  const loadStores = async () => {
    setIsLoadingStores(true)
    try {
      const storesData = await getCachedStores()
      setStores(storesData)
      // Set the first store as default if available
      if (storesData.length > 0 && !selectedStoreId) {
        setSelectedStoreId(storesData[0].id)
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load stores"
      toast({
        title: "Error loading stores",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoadingStores(false)
    }
  }

  const loadCategories = async () => {
    setIsLoadingCategories(true)
    try {
      const data = await getProductCategories()
      setCategories(data)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load categories"
      toast({
        title: "Error loading categories",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const loadSuppliers = async () => {
    setIsLoadingSuppliers(true)
    try {
      const data = await getSuppliers()
      setSuppliers(data)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load suppliers"
      toast({
        title: "Error loading suppliers",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoadingSuppliers(false)
    }
  }

  const validateCurrentTab = (tab: string): boolean => {
    const newErrors: ValidationErrors = {}

    if (tab === "basic") {
      if (!name.trim()) {
        newErrors.name = "Product name is required"
      }
    }

    if (tab === "pricing") {
      if (!price || Number.parseFloat(price) <= 0) {
        newErrors.price = "Valid selling price is required"
      }
    }

    if (tab === "inventory") {
      if (!selectedStoreId) {
        newErrors.store = "Store selection is required"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleTabChange = (newTab: string) => {
    const newTabIndex = tabOrder.indexOf(newTab)
    const currentIndex = tabOrder.indexOf(currentTab)
    
    // Allow going to previous tabs or the next tab if current tab is valid
    if (newTabIndex <= currentIndex || (newTabIndex === currentIndex + 1 && validateCurrentTab(currentTab))) {
      setCurrentTab(newTab)
      setErrors({})
    } else if (newTabIndex > currentIndex + 1) {
      toast({
        title: "Complete Previous Steps",
        description: "Please complete the current step before proceeding to later steps",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields before proceeding",
        variant: "destructive",
      })
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const compressImage = (file: File, maxWidth: number = 800, maxHeight: number = 800, targetSizeKB: number = 200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = document.createElement('img')
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      
      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img
          const aspectRatio = width / height
          
          if (width > height) {
            if (width > maxWidth) {
              width = maxWidth
              height = width / aspectRatio
            }
          } else {
            if (height > maxHeight) {
              height = maxHeight
              width = height * aspectRatio
            }
          }
          
          // Ensure both dimensions don't exceed limits
          if (width > maxWidth) {
            width = maxWidth
            height = width / aspectRatio
          }
          if (height > maxHeight) {
            height = maxHeight
            width = height * aspectRatio
          }
          
          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)
          
          // Function to get file size from base64 string (in KB)
          const getBase64SizeKB = (base64: string) => {
            const base64Length = base64.split(',')[1]?.length || 0
            return (base64Length * 0.75) / 1024
          }
          
          // Start with high quality and reduce until target size is reached
          let quality = 0.9
          let compressedImage = canvas.toDataURL('image/jpeg', quality)
          let currentSizeKB = getBase64SizeKB(compressedImage)
          
          // Iteratively reduce quality until under target size
          while (currentSizeKB > targetSizeKB && quality > 0.1) {
            quality -= 0.1
            compressedImage = canvas.toDataURL('image/jpeg', quality)
            currentSizeKB = getBase64SizeKB(compressedImage)
          }
          
          // If still too large, reduce dimensions further
          if (currentSizeKB > targetSizeKB) {
            const reductionFactor = Math.sqrt(targetSizeKB / currentSizeKB)
            canvas.width = Math.floor(width * reductionFactor)
            canvas.height = Math.floor(height * reductionFactor)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            compressedImage = canvas.toDataURL('image/jpeg', 0.8)
          }
          
          resolve(compressedImage)
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      
      img.src = URL.createObjectURL(file)
    })
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          try {
            const originalSizeKB = Math.round(file.size / 1024)
            const compressedImage = await compressImage(file)
            
            const base64Length = compressedImage.split(',')[1]?.length || 0
            const compressedSizeKB = Math.round((base64Length * 0.75) / 1024)
            
            setImages((prev) => {
              const newImages = [...prev, compressedImage]
              if (prev.length === 0) {
                setPrimaryImageIndex(0)
              }
              return newImages
            })
            
            toast({
              title: "Image Uploaded",
              description: `Image compressed from ${originalSizeKB}KB to ${compressedSizeKB}KB`,
            })
          } catch (error) {
            toast({
              title: "Upload Error",
              description: "Failed to process image",
              variant: "destructive",
            })
          }
        } else {
          toast({
            title: "Invalid File",
            description: "Please upload only image files",
            variant: "destructive",
          })
        }
      }
      event.target.value = ""
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          try {
            const originalSizeKB = Math.round(file.size / 1024)
            const compressedImage = await compressImage(file)
            
            const base64Length = compressedImage.split(',')[1]?.length || 0
            const compressedSizeKB = Math.round((base64Length * 0.75) / 1024)
            
            setImages((prev) => {
              const newImages = [...prev, compressedImage]
              if (prev.length === 0) {
                setPrimaryImageIndex(0)
              }
              return newImages
            })
            
            toast({
              title: "Image Uploaded",
              description: `Image compressed from ${originalSizeKB}KB to ${compressedSizeKB}KB`,
            })
          } catch (error) {
            toast({
              title: "Upload Error",
              description: "Failed to process image",
              variant: "destructive",
            })
          }
        } else {
          toast({
            title: "Invalid File",
            description: "Please upload only image files",
            variant: "destructive",
          })
        }
      }
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const newImages = prev.filter((_, i) => i !== index)
      if (index === primaryImageIndex) {
        setPrimaryImageIndex(0)
      } else if (index < primaryImageIndex) {
        setPrimaryImageIndex(primaryImageIndex - 1)
      }
      return newImages
    })
  }

  const handleSetPrimaryImage = (index: number) => {
    setPrimaryImageIndex(index)
    toast({
      title: "Primary Image Set",
      description: `Image ${index + 1} is now the primary image`,
    })
  }

  // Rest of the component remains the same...
  // [Continue with all the variant handling functions, submit handler, etc.]
  // I've only shown the key fixes to avoid an overly long response

  const addVariant = () => {
    const newVariant: ProductVariantForm = {
      id: Date.now().toString(),
      name: "",
      sku: "",
      price: price || "",
      cost: cost || "",
      stock_quantity: "",
      is_active: true,
      options: [],
      option_stocks: [],
      images: [],
      attributes: [],
    }
    setVariants([...variants, newVariant])
  }

  const updateVariant = (id: string, field: keyof ProductVariantForm, value: any) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
  }

  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id))
  }

  const addVariantAttribute = (variantId: string) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, attributes: [...v.attributes, { key: "", value: "" }] } : v)),
    )
  }

  const updateVariantAttribute = (variantId: string, attrIndex: number, field: "key" | "value", val: string) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              attributes: v.attributes.map((attr, i) => (i === attrIndex ? { ...attr, [field]: val } : attr)),
            }
          : v,
      ),
    )
  }

  const removeVariantAttribute = (variantId: string, attrIndex: number) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, attributes: v.attributes.filter((_, i) => i !== attrIndex) } : v)),
    )
  }

  const addVariantOption = (variantId: string) => {
    setVariants((prev) => prev.map((v) => (v.id === variantId ? { ...v, options: [...v.options, ""] } : v)))
  }

  const updateVariantOption = (variantId: string, optionIndex: number, value: string) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.id === variantId) {
          const oldOption = v.options[optionIndex]
          const newOptions = v.options.map((opt, i) => (i === optionIndex ? value : opt))
          
          let newOptionStocks = [...v.option_stocks]
          if (oldOption && oldOption !== value) {
            const stockIndex = newOptionStocks.findIndex(s => s.option === oldOption)
            if (stockIndex >= 0) {
              newOptionStocks[stockIndex] = { ...newOptionStocks[stockIndex], option: value }
            }
          }
          
          return { ...v, options: newOptions, option_stocks: newOptionStocks }
        }
        return v
      })
    )
  }

  const removeVariantOption = (variantId: string, optionIndex: number) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.id === variantId) {
          const optionToRemove = v.options[optionIndex]
          const newOptions = v.options.filter((_, i) => i !== optionIndex)
          const newOptionStocks = v.option_stocks.filter(s => s.option !== optionToRemove)
          return { ...v, options: newOptions, option_stocks: newOptionStocks }
        }
        return v
      })
    )
  }

  const updateVariantOptionStock = (variantId: string, option: string, stock: string) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.id === variantId) {
          const existingStockIndex = v.option_stocks.findIndex(s => s.option === option)
          if (existingStockIndex >= 0) {
            const updatedStocks = [...v.option_stocks]
            updatedStocks[existingStockIndex] = { option, stock }
            return { ...v, option_stocks: updatedStocks }
          } else {
            return { ...v, option_stocks: [...v.option_stocks, { option, stock }] }
          }
        }
        return v
      })
    )
  }

  const removeVariantOptionStock = (variantId: string, option: string) => {
    setVariants((prev) =>
      prev.map((v) => 
        v.id === variantId 
          ? { ...v, option_stocks: v.option_stocks.filter(s => s.option !== option) }
          : v
      )
    )
  }

  const getVariantTotalStock = (variant: ProductVariantForm): number => {
    return variant.option_stocks.reduce((total, stock) => {
      return total + (Number.parseInt(stock.stock) || 0)
    }, 0)
  }

  const handleVariantImageUpload = async (variantId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          try {
            const originalSizeKB = Math.round(file.size / 1024)
            const compressedImage = await compressImage(file)
            
            const base64Length = compressedImage.split(',')[1]?.length || 0
            const compressedSizeKB = Math.round((base64Length * 0.75) / 1024)
            
            setVariants((prev) =>
              prev.map((v) => (v.id === variantId ? { ...v, images: [...v.images, compressedImage] } : v)),
            )
            
            toast({
              title: "Variant Image Uploaded",
              description: `Image compressed from ${originalSizeKB}KB to ${compressedSizeKB}KB`,
            })
          } catch (error) {
            toast({
              title: "Upload Error",
              description: "Failed to process variant image",
              variant: "destructive",
            })
          }
        } else {
          toast({
            title: "Invalid File",
            description: "Please upload only image files",
            variant: "destructive",
          })
        }
      }
      event.target.value = ""
    }
  }

  const handleRemoveVariantImage = (variantId: string, imageIndex: number) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, images: v.images.filter((_, i) => i !== imageIndex) } : v)),
    )
  }

  const handleSubmit = async () => {
    const allTabsValid = ["basic", "pricing", "inventory", "variations"].every((tab) => validateCurrentTab(tab))

    if (!allTabsValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      if (!selectedStoreId) {
        toast({
          title: "Validation Error", 
          description: "Please select a store for this product",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      const productData = {
        name: name.trim(),
        description,
        category_id: category || undefined,
        brand,
        supplier,
        tags,
        price: Number.parseFloat(price) || 0,
        cost: Number.parseFloat(cost) || 0,
        sku,
        barcode: barcode.trim() || undefined,
        stock: Number.parseInt(stock) || 0,
        lowStockThreshold: Number.parseInt(lowStockThreshold) || 0,
        trackInventory: Boolean(trackInventory),
        isActive: Boolean(isActive),
        is_active: Boolean(isActive),
        weight: Number.parseFloat(weight) || 0,
        dimensions,
        shippingClass,
        last_price: lastPrice ? Number.parseFloat(lastPrice) : undefined,
        unit_of_measurement: unitOfMeasurement,
        images,
        image_url: images.length > 0 ? images[primaryImageIndex] : null,
        primaryImageIndex: primaryImageIndex,
        hasVariations: hasVariations,
        store_id: selectedStoreId,
        variants: hasVariations && variants.length > 0
          ? variants.map((v) => ({
              name: v.name.trim(),
              sku: v.sku.trim(),
              price: Number.parseFloat(v.price) || 0,
              cost: Number.parseFloat(v.cost) || 0,
              stock_quantity: Number.parseInt(v.stock_quantity) || 0,
              is_active: v.is_active,
              store_id: v.store_id || selectedStoreId,
              options: v.options.filter((opt) => opt.trim() !== ""),
              images: v.images,
              attributes: v.attributes && v.attributes.length > 0
                ? v.attributes.reduce((acc, attr) => {
                    if (attr.key.trim() && attr.value.trim()) {
                      acc[attr.key.trim()] = attr.value.includes(",")
                        ? attr.value.split(",").map((s) => s.trim())
                        : attr.value.trim()
                    }
                    return acc
                  }, {} as Record<string, string | string[]>)
                : {},
            }))
          : [],
      }

      const result = await createProduct(productData)

      if (result.success) {
        toast({
          title: "Success",
          description: result.message || "Product created successfully.",
        })

        resetForm()
        onClose()

        setTimeout(() => {
          onSuccess?.()
        }, 100)
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to create product.",
          variant: "destructive",
        })
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create product. Please try again."
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setName("")
    setDescription("")
    setCategory("")
    setBrand("")
    setSupplier("")
    setTags([])
    setPrice("")
    setCost("")
    setSku("")
    setBarcode("")
    setStock("")
    setLowStockThreshold("")
    setTrackInventory(true)
    setIsActive(true)
    setWeight("")
    setDimensions({ length: "", width: "", height: "" })
    setShippingClass("")
    setImages([])
    setPrimaryImageIndex(0)
    setHasVariations(false)
    setVariants([])
    setLastPrice("")
    setUnitOfMeasurement("pcs")
    setBarcode("")
    setSelectedStoreId("")
    setCurrentTab("basic")
    setErrors({})
    setSupplierSearchQuery("")
    setIsSupplierDropdownOpen(false)
  }

  const currentTabIndex = tabOrder.indexOf(currentTab)
  const isLastTab = currentTabIndex === tabOrder.length - 1

  const handleNext = () => {
    if (validateCurrentTab(currentTab)) {
      if (currentTabIndex < tabOrder.length - 1) {
        setCurrentTab(tabOrder[currentTabIndex + 1])
        setErrors({})
      }
    } else {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields before proceeding",
        variant: "destructive",
      })
    }
  }

  const handlePrevious = () => {
    if (currentTabIndex > 0) {
      setCurrentTab(tabOrder[currentTabIndex - 1])
      setErrors({})
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setIsCreatingCategory(true)
    try {
      const result = await createProductCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
        color: newCategoryColor,
        is_active: newCategoryActive,
      })
      if (result.success && result.category) {
        setCategories((prev) => [result.category!, ...prev])
        setCategory(result.category.id)
        toast({ title: "Category Created", description: result.message || "New category added." })
        setIsCategoryModalOpen(false)
        setNewCategoryName("")
        setNewCategoryDescription("")
        setNewCategoryColor("#6B7280")
        setNewCategoryActive(true)
      } else {
        toast({ title: "Error", description: result.message || "Failed to create category", variant: "destructive" })
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Failed to create category"
      toast({ title: "Error", description: errorMessage, variant: "destructive" })
    } finally {
      setIsCreatingCategory(false)
    }
  }

  if (!isVisible) return null

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:max-w-4xl bg-white shadow-xl z-50 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg sm:text-xl font-semibold">Create New Product</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 h-[calc(100vh-140px)]">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto gap-1 p-1">
              <TabsTrigger 
                value="basic" 
                className={cn(
                  "text-xs px-1 sm:px-2 py-2",
                  currentTabIndex >= 0 ? "opacity-100" : "opacity-50"
                )}
              >
                <span className="flex items-center gap-1">
                  {currentTabIndex > 0 && <span className="text-green-600">✓</span>}
                  Basic
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="pricing" 
                className={cn(
                  "text-xs px-1 sm:px-2 py-2",
                  currentTabIndex >= 1 ? "opacity-100" : "opacity-50"
                )}
                disabled={currentTabIndex < 1}
              >
                <span className="flex items-center gap-1">
                  {currentTabIndex > 1 && <span className="text-green-600">✓</span>}
                  Price
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="inventory" 
                className={cn(
                  "text-xs px-1 sm:px-2 py-2",
                  currentTabIndex >= 2 ? "opacity-100" : "opacity-50"
                )}
                disabled={currentTabIndex < 2}
              >
                <span className="flex items-center gap-1">
                  {currentTabIndex > 2 && <span className="text-green-600">✓</span>}
                  <span className="hidden sm:inline">Stock</span>
                  <span className="sm:hidden">Inv</span>
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="variations" 
                className={cn(
                  "text-xs px-1 sm:px-2 py-2 col-span-3 sm:col-span-1",
                  currentTabIndex >= 3 ? "opacity-100" : "opacity-50"
                )}
                disabled={currentTabIndex < 3}
              >
                <span className="flex items-center gap-1">
                  {currentTabIndex > 3 && <span className="text-green-600">✓</span>}
                  <span className="hidden sm:inline">Variants</span>
                  <span className="sm:hidden">Vars</span>
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="media" 
                className={cn(
                  "text-xs px-1 sm:px-2 py-2 col-span-3 sm:col-span-1",
                  currentTabIndex >= 4 ? "opacity-100" : "opacity-50"
                )}
                disabled={currentTabIndex < 4}
              >
                <span className="flex items-center gap-1">
                  {currentTabIndex > 4 && <span className="text-green-600">✓</span>}
                  <span className="hidden sm:inline">Images</span>
                  <span className="sm:hidden">Imgs</span>
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
                    }}
                    placeholder="Enter product name"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category (optional)</Label>
                  <div className="flex gap-2">
                    <Select
                      value={category}
                      onValueChange={(value) => {
                        setCategory(value)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingCategories ? "Loading categories..." : "Select category (optional)"} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 && !isLoadingCategories && (
                          <div className="px-2 py-1 text-sm text-muted-foreground">No categories found</div>
                        )}
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full border"
                                style={{ backgroundColor: cat.color || '#6B7280' }}
                              />
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                        <div className="border-t my-1" />
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start text-left text-sm"
                          onClick={() => setIsCategoryModalOpen(true)}
                        >
                          <PlusCircle className="h-4 w-4 mr-2" /> Create Category
                        </Button>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter product description (optional)"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Product brand (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag (optional)"
                    onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                  />
                  <Button type="button" onClick={handleAddTag} variant="outline">
                    Add
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Selling Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value)
                      if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }))
                    }}
                    placeholder="0.00"
                    className={errors.price ? "border-red-500" : ""}
                  />
                  {errors.price && <p className="text-sm text-red-500">{errors.price}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost Price</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00 (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lastPrice">Last Price</Label>
                  <Input
                    id="lastPrice"
                    type="number"
                    step="0.01"
                    value={lastPrice}
                    onChange={(e) => setLastPrice(e.target.value)}
                    placeholder="0.00 (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitOfMeasurement">Unit of Measurement</Label>
                  <Select value={unitOfMeasurement} onValueChange={setUnitOfMeasurement}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit of measurement (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitsOfMeasurement.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value)
                    }}
                    placeholder="Product SKU (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Product barcode (optional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.00 (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label>Dimensions (cm)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    value={dimensions.length}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, length: e.target.value }))}
                    placeholder="Length (optional)"
                  />
                  <Input
                    type="number"
                    value={dimensions.width}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, width: e.target.value }))}
                    placeholder="Width (optional)"
                  />
                  <Input
                    type="number"
                    value={dimensions.height}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, height: e.target.value }))}
                    placeholder="Height (optional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingClass">Shipping Class</Label>
                <Select value={shippingClass} onValueChange={setShippingClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shipping class (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingClasses.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Switch id="trackInventory" checked={trackInventory} onCheckedChange={setTrackInventory} />
                <Label htmlFor="trackInventory">Track Inventory</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="store">Store *</Label>
                <Select 
                  value={selectedStoreId} 
                  onValueChange={(value) => {
                    setSelectedStoreId(value)
                    if (errors.store) setErrors((prev) => ({ ...prev, store: undefined }))
                  }} 
                  disabled={isLoadingStores}
                >
                  <SelectTrigger className={cn("w-full", errors.store ? "border-red-500" : "")}>
                    <SelectValue placeholder={isLoadingStores ? "Loading stores..." : "Select a store"} />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.store && <p className="text-sm text-red-500">{errors.store}</p>}
                {stores.length === 0 && !isLoadingStores && (
                  <p className="text-sm text-red-500">No stores available. Please create a store first.</p>
                )}
              </div>

              {trackInventory && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      placeholder="0 (optional)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      placeholder="10 (optional)"
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="variations" className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Switch id="hasVariations" checked={hasVariations} onCheckedChange={setHasVariations} />
                <Label htmlFor="hasVariations">This product has variations</Label>
              </div>

              {hasVariations && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Product Variants</h4>
                    <Button onClick={addVariant} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Variant
                    </Button>
                  </div>
                  
                  {variants.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Variants:</span> {variants.length}
                        </div>
                        <div>
                          <span className="font-medium">Total Options:</span> {variants.reduce((total, v) => total + v.options.length, 0)}
                        </div>
                        <div>
                          <span className="font-medium">Total Stock:</span> {variants.reduce((total, v) => total + Number(v.stock_quantity || 0), 0)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Individual Variant Forms */}
                  {variants.map((variant, variantIndex) => (
                    <div key={variant.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">Variant {variantIndex + 1}</h5>
                        <Button
                          onClick={() => removeVariant(variant.id)}
                          variant="outline"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Basic Variant Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Variant Name</Label>
                          <Input
                            value={variant.name}
                            onChange={(e) => updateVariant(variant.id, 'name', e.target.value)}
                            placeholder="e.g. Red - Large"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SKU</Label>
                          <Input
                            value={variant.sku}
                            onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                            placeholder="Variant SKU"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variant.price}
                            onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cost</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variant.cost}
                            onChange={(e) => updateVariant(variant.id, 'cost', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Stock Quantity</Label>
                          <Input
                            type="number"
                            value={variant.stock_quantity}
                            onChange={(e) => updateVariant(variant.id, 'stock_quantity', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2 flex items-center">
                          <div className="flex items-center space-x-2 mt-6">
                            <Switch
                              checked={variant.is_active}
                              onCheckedChange={(checked) => updateVariant(variant.id, 'is_active', checked)}
                            />
                            <Label>Active</Label>
                          </div>
                        </div>
                      </div>

                      {/* Variant Options */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Variant Options</Label>
                          <Button
                            onClick={() => addVariantOption(variant.id)}
                            variant="outline"
                            size="sm"
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
                              placeholder="e.g. Red, Large, Cotton"
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              value={
                                variant.option_stocks.find(s => s.option === option)?.stock || ""
                              }
                              onChange={(e) => updateVariantOptionStock(variant.id, option, e.target.value)}
                              placeholder="Stock"
                              className="w-20"
                            />
                            <Button
                              onClick={() => removeVariantOption(variant.id, optionIndex)}
                              variant="outline"
                              size="sm"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Variant Attributes */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Attributes</Label>
                          <Button
                            onClick={() => addVariantAttribute(variant.id)}
                            variant="outline"
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Attribute
                          </Button>
                        </div>
                        
                        {variant.attributes.map((attr, attrIndex) => (
                          <div key={attrIndex} className="flex gap-2 items-center">
                            <Input
                              value={attr.key}
                              onChange={(e) => updateVariantAttribute(variant.id, attrIndex, 'key', e.target.value)}
                              placeholder="Attribute name"
                              className="flex-1"
                            />
                            <Input
                              value={attr.value}
                              onChange={(e) => updateVariantAttribute(variant.id, attrIndex, 'value', e.target.value)}
                              placeholder="Attribute value"
                              className="flex-1"
                            />
                            <Button
                              onClick={() => removeVariantAttribute(variant.id, attrIndex)}
                              variant="outline"
                              size="sm"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Variant Images */}
                      <div className="space-y-2">
                        <Label>Variant Images</Label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleVariantImageUpload(variant.id, e)}
                            className="hidden"
                            id={`variant-image-${variant.id}`}
                          />
                          <Button
                            onClick={() => document.getElementById(`variant-image-${variant.id}`)?.click()}
                            variant="outline"
                            size="sm"
                          >
                            <ImageIcon className="h-4 w-4 mr-1" />
                            Add Images
                          </Button>
                          <span className="text-sm text-gray-500">
                            {variant.images.length} image(s)
                          </span>
                        </div>
                        
                        {variant.images.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {variant.images.map((image, imgIndex) => (
                              <div key={imgIndex} className="relative">
                                <Image
                                  src={image}
                                  alt={`Variant ${variantIndex + 1} Image ${imgIndex + 1}`}
                                  width={60}
                                  height={60}
                                  className="rounded border object-cover"
                                />
                                <Button
                                  onClick={() => handleRemoveVariantImage(variant.id, imgIndex)}
                                  variant="destructive"
                                  size="sm"
                                  className="absolute -top-2 -right-2 h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="media" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Product Images</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload multiple images for your product. The first image will be used as the primary image.
                  </p>

                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                      isDragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400",
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("image-upload")?.click()}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <div className="flex flex-col items-center">
                      <Upload className="h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Product Images</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {isDragOver ? "Drop your images here" : "Drag and drop your images here, or click to browse"}
                      </p>
                      <Button type="button" variant="outline" onClick={(e) => e.stopPropagation()}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Choose Images
                      </Button>
                    </div>
                  </div>

                  {images.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Uploaded Images ({images.length})</h4>
                        <p className="text-sm text-muted-foreground">Click the star to set as primary image</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((image, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                              <Image
                                src={image || "/placeholder.svg"}
                                alt={`Product image ${index + 1}`}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {index === primaryImageIndex && (
                              <Badge className="absolute top-2 left-2 bg-yellow-500 text-white">
                                <Star className="h-3 w-3 mr-1 fill-current" />
                                Primary
                              </Badge>
                            )}

                            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                              <Button
                                onClick={() => handleSetPrimaryImage(index)}
                                variant="secondary"
                                size="sm"
                                className="text-xs"
                              >
                                <Star className={cn("h-3 w-3 mr-1", index === primaryImageIndex && "fill-current")} />
                                {index === primaryImageIndex ? "Primary" : "Set Primary"}
                              </Button>
                              <Button
                                onClick={() => handleRemoveImage(index)}
                                variant="destructive"
                                size="sm"
                                className="text-xs"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>

                            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                              {index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {images.length === 0 && (
                    <div className="mt-4 text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No images uploaded yet</p>
                      <p className="text-sm text-gray-500">Upload at least one image to showcase your product</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-between px-6 py-4 border-t">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {currentTabIndex > 0 && (
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {!isLastTab ? (
              <Button onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Product"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCategoryModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Product Category</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsCategoryModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="newCategoryName">Name *</Label>
                <Input id="newCategoryName" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Electronics" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newCategoryDescription">Description</Label>
                <Textarea id="newCategoryDescription" value={newCategoryDescription} onChange={(e) => setNewCategoryDescription(e.target.value)} rows={2} placeholder="Optional description" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newCategoryColor">Color</Label>
                <div className="flex items-center gap-2">
                  <Input id="newCategoryColor" type="color" className="w-16 p-1 h-9" value={newCategoryColor} onChange={(e) => setNewCategoryColor(e.target.value)} />
                  <Input value={newCategoryColor} onChange={(e) => setNewCategoryColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <Switch id="newCategoryActive" checked={newCategoryActive} onCheckedChange={setNewCategoryActive} />
                <Label htmlFor="newCategoryActive">Active</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateCategory} disabled={isCreatingCategory || !newCategoryName.trim()}>{isCreatingCategory ? 'Saving...' : 'Create'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
