"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createProductSerialNumbers } from "@/lib/serial-numbers"
import { getProducts } from "@/lib/products"
import { getBatches } from "@/lib/batches"
import { getStores } from "@/lib/stores"
import { getPurchaseOrders, PurchaseOrder } from "@/lib/purchaseorders"
import type { SerialNumber } from "@/types/serial-numbers"
import type { Product } from "@/lib/products"
import type { Batch } from "@/types/batches"
import type { Store } from "@/lib/stores"
import { usePermissions } from "@/hooks/use-permissions"

interface AddSerialNumberSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSerialNumberAdded: () => void
}

export function AddSerialNumberSheet({ open, onOpenChange, onSerialNumberAdded }: AddSerialNumberSheetProps) {
  const [formData, setFormData] = useState({
    product_id: "",
    store_id: "__none__",
    batch_id: "__none__",
    serial_numbers: "",
    purchase_reference: "__none__",
    notes: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [productSearch, setProductSearch] = useState("")
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  // Load dropdown data when sheet opens
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    setIsDataLoading(true)
    try {
      const [productsData, storesData, purchaseOrdersData] = await Promise.all([
        getProducts(1, 100, { status: "active" }),
        getStores(),
        getPurchaseOrders()
      ])
      
      setProducts(productsData.data)
      setStores(storesData)
      setPurchaseOrders(purchaseOrdersData)
      
      // Set default store if only one exists
      if (storesData.length === 1) {
        setFormData(prev => ({
          ...prev,
          store_id: storesData[0].id
        }))
      } else {
        // Reset to "__none__" if there are multiple stores or none
        setFormData(prev => ({
          ...prev,
          store_id: "__none__"
        }))
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load dropdown data",
        variant: "destructive",
      })
    } finally {
      setIsDataLoading(false)
    }
  }

  const loadBatches = async (productId: string) => {
    try {
      const batchesData = await getBatches({ product_id: productId })
      setBatches(batchesData.data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load batches",
        variant: "destructive",
      })
    }
  }

  const handleInputChange = (field: string, value: string) => {
    // Convert "__none__" back to empty string for API submission
    const apiValue = value === "__none__" ? "" : value;
    setFormData(prev => ({ ...prev, [field]: apiValue }))
    
    // Load batches when product is selected
    if (field === "product_id" && apiValue) {
      loadBatches(apiValue)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.product_id) {
      toast({
        title: "Error",
        description: "Please select a product",
        variant: "destructive",
      })
      return
    }
    
    if (!formData.serial_numbers.trim()) {
      toast({
        title: "Error",
        description: "Please enter at least one serial number",
        variant: "destructive",
      })
      return
    }
    
    setIsLoading(true)
    
    try {
      // Split serial numbers by new lines and commas, then trim and filter empty values
      const serialNumbers = formData.serial_numbers
        .split(/[\n,]+/)
        .map(sn => sn.trim())
        .filter(sn => sn.length > 0)
      
      await createProductSerialNumbers(formData.product_id, {
        store_id: formData.store_id && formData.store_id !== "__none__" ? formData.store_id : undefined,
        batch_id: formData.batch_id && formData.batch_id !== "__none__" ? formData.batch_id : undefined,
        serial_numbers: serialNumbers,
        purchase_reference: formData.purchase_reference && formData.purchase_reference !== "__none__" ? formData.purchase_reference : undefined,
        notes: formData.notes || undefined,
      })
      
      toast({
        title: "Success",
        description: `${serialNumbers.length} serial number(s) created successfully`,
      })
      
      // Reset form
      setFormData({
        product_id: "",
        store_id: "__none__",
        batch_id: "__none__",
        serial_numbers: "",
        purchase_reference: "__none__",
        notes: "",
      })
      
      onSerialNumberAdded()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create serial numbers",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset form
    setFormData({
      product_id: "",
      store_id: "__none__",
      batch_id: "__none__",
      serial_numbers: "",
      purchase_reference: "__none__",
      notes: "",
    })
    onOpenChange(false)
  }

  // Filter products based on search term
  const filteredProducts = products.filter(product => {
    if (!productSearch) return true
    const search = productSearch.toLowerCase()
    return (
      product.name.toLowerCase().includes(search) ||
      product.sku?.toLowerCase().includes(search) ||
      product.id.toLowerCase().includes(search)
    )
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-[800px] max-w-[800px] !w-[800px] !max-w-[800px] overflow-y-auto"
        style={{ width: 800, maxWidth: 800 }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Serial Numbers
          </SheetTitle>
        </SheetHeader>
        
        {isDataLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6 flex flex-col flex-grow">
            <div className="flex-grow space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="product_id">Product *</Label>
                    <Select
                      value={formData.product_id}
                      onValueChange={(value) => handleInputChange("product_id", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Search or select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-2">
                          <Input
                            placeholder="Type to search by name, SKU, or ID"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            autoFocus
                          />
                        </div>
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {product.sku ? `SKU: ${product.sku}` : `ID: ${product.id}`}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__no_product__" disabled>
                            No products found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="store_id">Store</Label>
                      <Select
                        value={formData.store_id === "" ? "__none__" : formData.store_id}
                        onValueChange={(value) => handleInputChange("store_id", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a store (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="batch_id">Batch</Label>
                      <Select
                        value={formData.batch_id === "" ? "__none__" : formData.batch_id}
                        onValueChange={(value) => handleInputChange("batch_id", value)}
                        disabled={!formData.product_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a batch (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {batches.map((batch) => (
                            <SelectItem key={batch.id} value={batch.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{batch.batch_number}</span>
                                <span className="text-xs text-muted-foreground">
                                  Available: {batch.quantity_available}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Serial Numbers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="serial_numbers">Serial Numbers *</Label>
                    <Textarea
                      id="serial_numbers"
                      value={formData.serial_numbers}
                      onChange={(e) => handleInputChange("serial_numbers", e.target.value)}
                      placeholder="Enter serial numbers, one per line or separated by commas&#10;Example:&#10;SN-001&#10;SN-002&#10;SN-003"
                      rows={6}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter one serial number per line or separate multiple with commas
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchase_reference">Purchase Order</Label>
                    <Select
                      value={formData.purchase_reference === "" ? "__none__" : formData.purchase_reference}
                      onValueChange={(value) => handleInputChange("purchase_reference", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a purchase order (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {purchaseOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{order.order_number}</span>
                              <span className="text-xs text-muted-foreground">
                                {order.supplier?.name || 'Unknown Supplier'}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      placeholder="Enter any additional notes (optional)"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Sticky footer */}
            <div className="sticky bottom-0 bg-background border-t p-4 -mx-6 -mb-6">
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCancel} type="button" disabled={isLoading}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading || !hasPermission("can_create_serial_numbers")}
                >
                  {isLoading ? "Creating..." : "Create Serial Numbers"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}