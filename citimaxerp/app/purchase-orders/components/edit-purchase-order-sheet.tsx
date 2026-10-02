"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Loader2, Edit, Plus, Package, Building2, Calendar, Store, MessageSquare, Trash2, Check, ChevronsUpDown } from "lucide-react"
import { updatePurchaseOrder, PurchaseOrder, PurchaseOrderItem, UpdatePurchaseOrderPayload } from "@/lib/purchaseorders"
import { useToast } from "@/hooks/use-toast"
import { getSuppliers, Supplier } from "@/lib/suppliers"
import { getStores, Store as StoreType } from "@/lib/stores"
import { getProducts, Product as ProductType } from "@/lib/products"
import { formatCurrency, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ProductWithVariants extends ProductType {
  variants?: any[]
}

interface EditPurchaseOrderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: PurchaseOrder | null
  onPurchaseOrderUpdated: () => void
}

export function EditPurchaseOrderSheet({ open, onOpenChange, order, onPurchaseOrderUpdated }: EditPurchaseOrderSheetProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<{
    id: string
    order_number: string
    supplier_id: string
    discount: number
    order_date: string
    delivery_date: string
    currency_code: string
    status: string
    items: PurchaseOrderItem[]
  } | null>(null)
  const [newItem, setNewItem] = useState({
    product_id: '',
    variant_id: null as string | null,
    quantity: 1,
    unit_price: 0,
    store_id: ''
  })
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stores, setStores] = useState<StoreType[]>([])
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [storeId, setStoreId] = useState("")
  const [comments, setComments] = useState("")
  const [shippingCost, setShippingCost] = useState("")
  const [logisticsCost, setLogisticsCost] = useState("")
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false)
  const [storeSearchOpen, setStoreSearchOpen] = useState(false)
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [variantOptions, setVariantOptions] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariants | null>(null)

  useEffect(() => {
    if (open && order) {
      // Format dates properly for date input
      const formatDateForInput = (dateStr: string) => {
        if (!dateStr) return ""
        const date = new Date(dateStr)
        return date.toISOString().split('T')[0]
      }
      
      setFormData({
        id: order.id,
        order_number: order.order_number,
        supplier_id: order.supplier_id,
        discount: order.discount ?? 0,
        order_date: formatDateForInput(order.order_date),
        delivery_date: formatDateForInput(order.delivery_date),
        currency_code: order.currency_code ?? 'KES',
        status: order.status,
        items: order.items || [],
      })
      setComments(order.comments || "")
      setShippingCost(order.shipping_cost !== undefined && order.shipping_cost !== null ? String(order.shipping_cost) : "")
      setLogisticsCost(order.logistics_cost !== undefined && order.logistics_cost !== null ? String(order.logistics_cost) : "")
      setStoreId(order.store_id || "")
      fetchSuppliers()
      fetchStores()
      fetchProducts()
    }
  }, [open, order])

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const data = await getSuppliers()
      setSuppliers(data)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load suppliers.", variant: "destructive" })
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const fetchStores = async () => {
    try {
      const data = await getStores()
      setStores(data)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load stores.", variant: "destructive" })
    }
  }

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const { data } = await getProducts(1, 100, { status: "active" })
      setProducts(data)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load products.", variant: "destructive" })
    } finally {
      setLoadingProducts(false)
    }
  }

  if (!formData || !order) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const payload: UpdatePurchaseOrderPayload = {
        supplier_id: formData.supplier_id,
        order_date: formData.order_date,
        delivery_date: formData.delivery_date,
        store_id: storeId,
        status: formData.status,
        comments,
        shipping_cost: shippingCost ? parseFloat(shippingCost) : 0,
        logistics_cost: logisticsCost ? parseFloat(logisticsCost) : 0,
        items: (formData.items || []).map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          unit_price: typeof item.unit_price === 'string' ? parseFloat(item.unit_price) : item.unit_price,
          store_id: storeId,
        })),
      }
      await updatePurchaseOrder(formData.id, payload)
      toast({ title: "Success", description: "Purchase order updated successfully." })
      onPurchaseOrderUpdated()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update purchase order",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => prev ? ({ ...prev, [field]: value }) : null)
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

  const handleAddItem = () => {
    if (!newItem.product_id || (variantOptions.length > 0 && !newItem.variant_id) || newItem.quantity <= 0 || newItem.unit_price <= 0) {
      toast({ title: "Error", description: "Please select a product and enter valid quantity and price.", variant: "destructive" })
      return
    }
    setFormData(prev => prev ? ({
      ...prev,
      items: [...(prev.items || []), {
        product_id: newItem.product_id,
        variant_id: newItem.variant_id,
        quantity: newItem.quantity,
        unit_price: newItem.unit_price,
        store_id: storeId,
        received_quantity: 0,
        product: selectedProduct,
        variant: variantOptions.find(v => v.id === newItem.variant_id)
      }]
    }) : null)
    setNewItem({ product_id: '', variant_id: null, quantity: 1, unit_price: 0, store_id: storeId })
    setVariantOptions([])
    setSelectedProduct(null)
  }

  const handleRemoveItem = (index: number) => {
    setFormData(prev => prev ? ({ ...prev, items: (prev.items || []).filter((_, i) => i !== index) }) : null)
  }

  const orderTotal = formData.items.reduce((sum, item) => {
    const price = typeof item.unit_price === 'string' ? parseFloat(item.unit_price) : item.unit_price
    return sum + (price * item.quantity)
  }, 0)
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
                <Edit className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="block">Edit Purchase Order</span>
                <span className="text-sm font-normal text-muted-foreground">{order.order_number}</span>
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
                  {/* Supplier */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Supplier *</Label>
                    <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={supplierSearchOpen}
                          className="w-full h-10 justify-between font-normal"
                        >
                          {formData.supplier_id
                            ? suppliers.find((supplier) => supplier.id === formData.supplier_id)?.name
                            : "Select a supplier"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search suppliers..." />
                          <CommandList>
                            {loadingSuppliers ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
                            ) : (
                              <>
                                <CommandEmpty>No suppliers found.</CommandEmpty>
                                <CommandGroup>
                                  {suppliers.map((supplier) => (
                                    <CommandItem
                                      key={supplier.id}
                                      value={supplier.name}
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
                                      {supplier.name}
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

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Order Date *
                    </Label>
                    <Input
                      type="date"
                      value={formData.order_date}
                      onChange={(e) => handleInputChange("order_date", e.target.value)}
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Delivery Date *
                    </Label>
                    <Input
                      type="date"
                      value={formData.delivery_date}
                      onChange={(e) => handleInputChange("delivery_date", e.target.value)}
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
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
                            : "Select a store"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search stores..." />
                          <CommandList>
                            <CommandEmpty>No stores found.</CommandEmpty>
                            <CommandGroup>
                              {stores.map((store) => (
                                <CommandItem
                                  key={store.id}
                                  value={store.name}
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
                                  {store.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Shipping Cost (estimate)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={shippingCost}
                      onChange={e => setShippingCost(e.target.value)}
                      placeholder="0.00"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Logistics Cost (estimate)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={logisticsCost}
                      onChange={e => setLogisticsCost(e.target.value)}
                      placeholder="0.00"
                      className="h-10"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      Comments
                    </Label>
                    <Input
                      value={comments}
                      onChange={e => setComments(e.target.value)}
                      placeholder="Add any additional notes..."
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
                  <div className="col-span-5">
                    <Label className="text-sm font-medium">Product *</Label>
                    <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
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
                          <CommandInput placeholder="Search products..." />
                          <CommandList>
                            {loadingProducts ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
                            ) : (
                              <>
                                <CommandEmpty>No products found.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={`${product.name} ${product.sku || ""}`}
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
                      <Label className="text-sm font-medium">Variant</Label>
                      <Select value={newItem.variant_id || ""} onValueChange={(v) => setNewItem(prev => ({ ...prev, variant_id: v }))}>
                        <SelectTrigger className="h-10 mt-1.5">
                          <SelectValue placeholder="Select variant" />
                        </SelectTrigger>
                        <SelectContent>
                          {variantOptions.map(variant => (
                            <SelectItem key={variant.id} value={variant.id}>{variant.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className={variantOptions.length > 0 ? "col-span-1" : "col-span-2"}>
                    <Label className="text-sm font-medium">Price</Label>
                    <Input
                      type="number"
                      value={newItem.unit_price || ""}
                      onChange={e => setNewItem(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                      className="h-10 mt-1.5"
                      placeholder="0.00"
                    />
                  </div>

                  <div className={variantOptions.length > 0 ? "col-span-1" : "col-span-2"}>
                    <Label className="text-sm font-medium">Qty</Label>
                    <Input
                      type="number"
                      value={newItem.quantity || ""}
                      onChange={e => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                      className="h-10 mt-1.5"
                      placeholder="1"
                    />
                  </div>

                  <div className="col-span-3">
                    <Button type="button" onClick={handleAddItem} className="w-full h-10 mt-6">
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
                          const product = item.product || products.find(p => p.id === item.product_id)
                          const price = typeof item.unit_price === 'string' ? parseFloat(item.unit_price) : item.unit_price
                          return (
                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium">{product?.name || item.product_id}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{item.variant?.name || '-'}</td>
                              <td className="px-4 py-3 text-sm text-right">{formatCurrency(price)}</td>
                              <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(price * item.quantity)}</td>
                              <td className="px-4 py-3">
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(idx)}>
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
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="min-w-[100px]">
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading || formData.items.length === 0} className="min-w-[180px]">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Update Purchase Order
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
} 