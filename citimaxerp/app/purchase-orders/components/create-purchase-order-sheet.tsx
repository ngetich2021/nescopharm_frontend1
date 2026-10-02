"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, X, Package, Building2, Calendar, Store, MessageSquare, Trash2, UserPlus, Check, ChevronsUpDown } from "lucide-react"
import { createPurchaseOrder, CreatePurchaseOrderPayload, PurchaseOrderItem } from "@/lib/purchaseorders"
import { getSuppliers, createSupplier, Supplier } from "@/lib/suppliers"
import { getProducts, Product as BaseProduct } from "@/lib/products"
import { getStores } from "@/lib/stores"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, cn } from "@/lib/utils"

interface CreatePurchaseOrderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPurchaseOrderCreated: () => void
}

// Extend Product type locally to include variants
interface ProductWithVariants extends BaseProduct {
  variants?: any[]
}

export function CreatePurchaseOrderSheet({ open, onOpenChange, onPurchaseOrderCreated }: CreatePurchaseOrderSheetProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<CreatePurchaseOrderPayload>({
    supplier_id: "",
    order_date: "",
    delivery_date: "",
    store_id: "",
    comments: "",
    items: [],
  })
  const [newItem, setNewItem] = useState({
    product_id: "",
    variant_id: null as string | null,
    quantity: 1,
    unit_price: 0,
    store_id: ""
  })

  // State for suppliers and products
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false)
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [stores, setStores] = useState<any[]>([])
  const [storeId, setStoreId] = useState("")
  const [storeSearchOpen, setStoreSearchOpen] = useState(false)
  const [comments, setComments] = useState("")
  const [shippingCost, setShippingCost] = useState("")
  const [logisticsCost, setLogisticsCost] = useState("")
  const [variantOptions, setVariantOptions] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

  // New Supplier Creation State
  const [showSupplierDialog, setShowSupplierDialog] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierPhone, setNewSupplierPhone] = useState("")
  const [newSupplierEmail, setNewSupplierEmail] = useState("")
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)

  // Load suppliers and products when the sheet is opened
  useEffect(() => {
    if (open) {
      fetchSuppliers()
      fetchProducts()
      fetchStores()
    }
  }, [open])

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const data = await getSuppliers()
      setSuppliers(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load suppliers. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const { data } = await getProducts(1, 100, { status: "active" })
      setProducts(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load products. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchStores = async () => {
    try {
      const data = await getStores()
      setStores(data)
      setStoreId("")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load stores.",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const payload = {
        supplier_id: formData.supplier_id,
        order_date: formData.order_date,
        delivery_date: formData.delivery_date,
        store_id: storeId || "",
        comments,
        shipping_cost: shippingCost ? parseFloat(shippingCost) : 0,
        logistics_cost: logisticsCost ? parseFloat(logisticsCost) : 0,
        items: formData.items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          store_id: storeId || "",
        })),
      }
      await createPurchaseOrder(payload)
      toast({
        title: "Success",
        description: "Purchase order created successfully."
      })
      onPurchaseOrderCreated()
      onOpenChange(false)
      resetForm()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create purchase order",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      supplier_id: "",
      order_date: "",
      delivery_date: "",
      store_id: "",
      comments: "",
      items: [],
    })
    setComments("")
    setShippingCost("")
    setLogisticsCost("")
    setStoreId("")
    setNewItem({
      product_id: "",
      variant_id: null,
      quantity: 1,
      unit_price: 0,
      store_id: ""
    })
  }

  const handleInputChange = (field: keyof CreatePurchaseOrderPayload, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleItemInputChange = (field: keyof typeof newItem, value: any) => {
    setNewItem(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddItem = () => {
    if (!newItem.product_id || (variantOptions.length > 0 && !newItem.variant_id) || !newItem.quantity || !newItem.unit_price || newItem.quantity <= 0 || newItem.unit_price <= 0) {
      toast({
        title: "Error",
        description: "Please select a product, variant (if required), and enter a valid quantity and price.",
        variant: "destructive"
      })
      return
    }
    setFormData(prev => {
      const existingIdx = prev.items.findIndex(item =>
        item.product_id === newItem.product_id &&
        (item.variant_id || null) === (newItem.variant_id || null)
      )
      if (existingIdx !== -1) {
        const updatedItems = prev.items.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        )
        return { ...prev, items: updatedItems }
      } else {
        return { ...prev, items: [...prev.items, { ...newItem, store_id: storeId }] }
      }
    })
    setNewItem({
      product_id: "",
      variant_id: null,
      quantity: 1,
      unit_price: 0,
      store_id: storeId
    })
    setVariantOptions([])
    setSelectedProduct(null)
  }

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId)
    setSelectedProduct(product || null)
    if (product) {
      setNewItem({
        product_id: product.id,
        variant_id: null,
        quantity: 1,
        unit_price: parseFloat(product.price || "0"),
        store_id: storeId
      })
      if (product.has_variations && product.variants && product.variants.length > 0) {
        setVariantOptions(product.variants)
      } else {
        setVariantOptions([])
      }
    } else {
      setVariantOptions([])
    }
  }

  const handleVariantSelect = (variantId: string) => {
    const variant = variantOptions.find(v => v.id === variantId)
    if (!variant) return
    setNewItem(prev => ({
      ...prev,
      variant_id: variant.id,
      unit_price: parseFloat(variant.price || selectedProduct?.price || "0")
    }))
  }

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast({
        title: "Error",
        description: "Supplier name is required.",
        variant: "destructive"
      })
      return
    }
    setIsCreatingSupplier(true)
    try {
      const supplier = await createSupplier({
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim() || undefined,
        email: newSupplierEmail.trim() || undefined,
        is_active: true,
      })
      toast({
        title: "Success",
        description: `Supplier "${supplier.name}" created successfully.`
      })
      // Refresh suppliers and select the new one
      await fetchSuppliers()
      handleInputChange("supplier_id", supplier.id)
      // Reset dialog
      setNewSupplierName("")
      setNewSupplierPhone("")
      setNewSupplierEmail("")
      setShowSupplierDialog(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create supplier",
        variant: "destructive"
      })
    } finally {
      setIsCreatingSupplier(false)
    }
  }

  // Calculate totals
  const orderTotal = formData.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
  const itemCount = formData.items.length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-[850px] max-w-[850px] !w-[850px] !max-w-[850px] flex flex-col p-0"
        style={{ width: 850, maxWidth: 850 }}
      >
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b px-6 py-5">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="block">Create Purchase Order</span>
                <span className="text-sm font-normal text-muted-foreground">Fill in the details below to create a new purchase order</span>
              </div>
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Order Information Card */}
            <Card className="border-0 shadow-sm bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" />
                  Order Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  {/* Supplier with Plus Button */}
                  <div className="space-y-2">
                    <Label htmlFor="supplier_id" className="text-sm font-medium">Supplier *</Label>
                    <div className="flex gap-2">
                      <Popover
                        open={supplierSearchOpen}
                        onOpenChange={(isOpen) => {
                          setSupplierSearchOpen(isOpen)
                          if (isOpen && suppliers.length === 0) {
                            fetchSuppliers()
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={supplierSearchOpen}
                            className="flex-1 h-10 justify-between font-normal"
                          >
                            {formData.supplier_id
                              ? suppliers.find((supplier) => supplier.id === formData.supplier_id)?.name
                              : "Select a supplier"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search by name, email, or phone..." />
                            <CommandList>
                              {loadingSuppliers ? (
                                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading suppliers...
                                </div>
                              ) : (
                                <>
                                  <CommandEmpty>No suppliers found</CommandEmpty>
                                  <CommandGroup>
                                    {suppliers.map((supplier) => (
                                      <CommandItem
                                        key={supplier.id}
                                        value={`${supplier.name} ${supplier.email || ""} ${supplier.phone || ""}`}
                                        onSelect={() => {
                                          handleInputChange("supplier_id", supplier.id)
                                          setSupplierSearchOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            formData.supplier_id === supplier.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {supplier.name} {supplier.phone ? `• ${supplier.phone}` : ""}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="icon"
                              className="h-10 w-10 shrink-0"
                              onClick={() => setShowSupplierDialog(true)}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Add new supplier</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="order_date" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Order Date *
                    </Label>
                    <Input
                      id="order_date"
                      type="date"
                      value={formData.order_date}
                      onChange={(e) => handleInputChange("order_date", e.target.value)}
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delivery_date" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Delivery Date *
                    </Label>
                    <Input
                      id="delivery_date"
                      type="date"
                      value={formData.delivery_date}
                      onChange={(e) => handleInputChange("delivery_date", e.target.value)}
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="store_id" className="text-sm font-medium flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-muted-foreground" />
                      Destination Store
                    </Label>
                    <Popover open={storeSearchOpen} onOpenChange={setStoreSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={storeSearchOpen}
                          className="w-full h-10 justify-between font-normal"
                        >
                          {storeId
                            ? stores.find((store) => store.id === storeId)?.name
                            : "Select a store (optional)"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name, code, or city..." />
                          <CommandList>
                            <CommandEmpty>No stores available</CommandEmpty>
                            <CommandGroup>
                              {stores.map((store) => (
                                <CommandItem
                                  key={store.id}
                                  value={`${store.name} ${store.store_code || ""} ${store.city || ""}`}
                                  onSelect={() => {
                                    setStoreId(store.id)
                                    setStoreSearchOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      storeId === store.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {store.name} {store.store_code ? `(${store.store_code})` : ""}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shippingCost" className="text-sm font-medium">Shipping Cost (estimate)</Label>
                    <Input
                      id="shippingCost"
                      type="number"
                      step="0.01"
                      value={shippingCost}
                      onChange={e => setShippingCost(e.target.value)}
                      placeholder="0.00"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logisticsCost" className="text-sm font-medium">Logistics Cost (estimate)</Label>
                    <Input
                      id="logisticsCost"
                      type="number"
                      step="0.01"
                      value={logisticsCost}
                      onChange={e => setLogisticsCost(e.target.value)}
                      placeholder="0.00"
                      className="h-10"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="comments" className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      Comments
                    </Label>
                    <Input
                      id="comments"
                      value={comments}
                      onChange={e => setComments(e.target.value)}
                      placeholder="Add any additional notes or comments..."
                      className="h-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Items Card */}
            <Card className="border-0 shadow-sm bg-card/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-primary" />
                    Order Items
                  </CardTitle>
                  {itemCount > 0 && (
                    <Badge variant="secondary" className="font-normal">
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Add Item Row */}
                <div className="grid grid-cols-12 gap-3 items-end p-4 bg-muted/30 rounded-lg border border-dashed">
                  <div className={variantOptions.length > 0 ? "col-span-3" : "col-span-5"}>
                    <Label htmlFor="product" className="text-sm font-medium">Product *</Label>
                    <Popover
                      open={productSearchOpen}
                      onOpenChange={(isOpen) => {
                        setProductSearchOpen(isOpen)
                        if (isOpen && products.length === 0) {
                          fetchProducts()
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={productSearchOpen}
                          className="w-full h-10 mt-1.5 justify-between font-normal"
                        >
                          {newItem.product_id
                            ? products.find((product) => product.id === newItem.product_id)?.name
                            : "Select a product"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name, SKU, or description..." />
                          <CommandList>
                            {loadingProducts ? (
                              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading products...
                              </div>
                            ) : (
                              <>
                                <CommandEmpty>No products found</CommandEmpty>
                                <CommandGroup>
                                  {products.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={`${product.name} ${product.sku || ""} ${product.description || ""}`}
                                      onSelect={() => {
                                        handleProductSelect(product.id)
                                        setProductSearchOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          newItem.product_id === product.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {product.name} {product.sku ? `(${product.sku})` : ""}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {variantOptions.length > 0 && (
                    <div className="col-span-2">
                      <Label htmlFor="variant" className="text-sm font-medium">Variant *</Label>
                      <Select
                        value={newItem.variant_id || undefined}
                        onValueChange={handleVariantSelect}
                      >
                        <SelectTrigger id="variant" className="h-10 mt-1.5">
                          <SelectValue placeholder="Select variant" />
                        </SelectTrigger>
                        <SelectContent>
                          {variantOptions.map((variant) => (
                            <SelectItem key={variant.id} value={variant.id}>
                              {variant.name} - {formatCurrency(Number(variant.price) || 0)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="col-span-2">
                    <Label htmlFor="price" className="text-sm font-medium">Unit Price</Label>
                    <Input
                      id="price"
                      type="number"
                      value={isNaN(newItem.unit_price) ? "" : newItem.unit_price}
                      onChange={e => {
                        const val = parseFloat(e.target.value)
                        handleItemInputChange("unit_price", isNaN(val) ? 0 : val)
                      }}
                      disabled={variantOptions.length > 0 && !newItem.variant_id}
                      className="h-10 mt-1.5"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="order_quantity" className="text-sm font-medium">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={isNaN(newItem.quantity) ? "" : newItem.quantity}
                      onChange={e => {
                        const val = parseInt(e.target.value)
                        handleItemInputChange("quantity", isNaN(val) ? 0 : val)
                      }}
                      disabled={variantOptions.length > 0 && !newItem.variant_id}
                      className="h-10 mt-1.5"
                      placeholder="1"
                    />
                  </div>

                  <div className="col-span-3">
                    <Button 
                      type="button" 
                      onClick={handleAddItem} 
                      className="w-full h-10 mt-6"
                      disabled={
                        !newItem.product_id ||
                        (variantOptions.length > 0 && !newItem.variant_id) ||
                        !newItem.quantity ||
                        !newItem.unit_price ||
                        newItem.quantity <= 0 ||
                        newItem.unit_price <= 0
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>

                {/* Items Table */}
                {formData.items.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="min-w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left text-sm font-medium px-4 py-3">Product</th>
                          <th className="text-left text-sm font-medium px-4 py-3">Variant</th>
                          <th className="text-right text-sm font-medium px-4 py-3">Price</th>
                          <th className="text-right text-sm font-medium px-4 py-3">Qty</th>
                          <th className="text-right text-sm font-medium px-4 py-3">Total</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {formData.items.map((item, idx) => {
                          const product = products.find(p => p.id === item.product_id)
                          let variantName = "-"
                          if (item.variant_id && product && product.variants) {
                            const variant = product.variants.find((v: any) => v.id === item.variant_id)
                            if (variant) variantName = variant.name
                          }
                          return (
                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium">{product ? product.name : item.product_id}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{variantName}</td>
                              <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                              <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(item.unit_price * item.quantity)}</td>
                              <td className="px-4 py-3">
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveItem(idx)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-muted/50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-sm font-medium text-right">Order Total:</td>
                          <td className="px-4 py-3 text-sm font-bold text-right text-primary">{formatCurrency(orderTotal)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {formData.items.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No items added yet. Select a product above to get started.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sticky Footer */}
          <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {itemCount > 0 && (
                  <span>{itemCount} item{itemCount !== 1 ? 's' : ''} • Total: <span className="font-semibold text-foreground">{formatCurrency(orderTotal)}</span></span>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                  className="min-w-[100px]"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading || formData.items.length === 0}
                  className="min-w-[180px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Purchase Order
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* New Supplier Dialog */}
        <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Add New Supplier
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="new_supplier_name">Supplier Name *</Label>
                <Input
                  id="new_supplier_name"
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  placeholder="Enter supplier name"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_supplier_phone">Phone</Label>
                <Input
                  id="new_supplier_phone"
                  value={newSupplierPhone}
                  onChange={e => setNewSupplierPhone(e.target.value)}
                  placeholder="Enter phone number (optional)"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_supplier_email">Email</Label>
                <Input
                  id="new_supplier_email"
                  type="email"
                  value={newSupplierEmail}
                  onChange={e => setNewSupplierEmail(e.target.value)}
                  placeholder="Enter email (optional)"
                  className="h-10"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSupplierDialog(false)}
                disabled={isCreatingSupplier}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateSupplier}
                disabled={isCreatingSupplier || !newSupplierName.trim()}
              >
                {isCreatingSupplier ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Supplier
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
} 