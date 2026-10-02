"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, ChevronsUpDown, Plus, Trash2, Package, TrendingUp, TrendingDown, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createBulkStockAdjustmentAction } from "../actions"
import type { BulkStockAdjustmentItem } from "../actions"
import { getProducts } from "@/lib/products"
import { getStores } from "@/lib/stores"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/products"
import type { Store } from "@/lib/stores"

interface CreateStockAdjustmentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface AdjustmentLine {
  id: string
  product_id: string
  variant_id: string
  quantity_adjusted: string
}

export function CreateStockAdjustmentSheet({
  open,
  onOpenChange,
  onSuccess,
}: CreateStockAdjustmentSheetProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [productSearchOpen, setProductSearchOpen] = useState<{ [key: string]: boolean }>({})
  const [storeSearchOpen, setStoreSearchOpen] = useState(false)

  // Global settings (applied to all lines)
  const [storeId, setStoreId] = useState("")
  const [adjustmentType, setAdjustmentType] = useState<"increase" | "decrease" | "set">("decrease")
  const [reasonType, setReasonType] = useState("damage")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<"draft" | "pending">("draft")

  // Simplified lines (just product, variant, quantity)
  const [lines, setLines] = useState<AdjustmentLine[]>([
    { id: crypto.randomUUID(), product_id: "", variant_id: "", quantity_adjusted: "" }
  ])

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const retryFetch = async <T,>(
    fetchFn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000,
    name: string = "data"
  ): Promise<T> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fetchFn()
      } catch (error) {
        if (attempt === retries - 1) throw error
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(1.5, attempt)))
      }
    }
    throw new Error(`Failed to fetch ${name} after ${retries} attempts`)
  }

  const loadData = async () => {
    setLoadingData(true)
    const errors: string[] = []
    
    try {
      const [productsResult, storesResult] = await Promise.allSettled([
        retryFetch(() => getProducts(1, 1000, {}), 3, 1000, "products").catch(err => {
          errors.push("products")
          return { data: [], count: 0 }
        }),
        retryFetch(() => getStores(), 3, 1000, "stores").catch(err => {
          errors.push("stores")
          return []
        })
      ])
      
      const productsData = productsResult.status === 'fulfilled' ? productsResult.value : { data: [], count: 0 }
      const storesData = storesResult.status === 'fulfilled' ? storesResult.value : []
      
      setProducts(productsData.data)
      setStores(storesData)
      
      if (storesData.length === 1) {
        setStoreId(storesData[0].id)
      }
      
      if (errors.length === 2) {
        toast({ title: "Error", description: "Failed to load form data.", variant: "destructive" })
      } else if (errors.length > 0) {
        toast({ title: "Warning", description: `Could not load: ${errors.join(", ")}.`, variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load form data", variant: "destructive" })
    } finally {
      setLoadingData(false)
    }
  }

  const addLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), product_id: "", variant_id: "", quantity_adjusted: "" }])
  }

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter(l => l.id !== id))
    }
  }

  const updateLine = (id: string, field: keyof AdjustmentLine, value: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value, ...(field === "product_id" ? { variant_id: "" } : {}) } : l))
  }

  const getProductStock = (productId: string, variantId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return null
    if (variantId && product.variants) {
      const variant = product.variants.find(v => String(v.id) === variantId)
      return variant ? variant.stock_quantity : null
    }
    return product.stock_quantity
  }

  // Calculate summary
  const validLines = lines.filter(l => l.product_id && l.quantity_adjusted && !isNaN(parseInt(l.quantity_adjusted)))
  const totalItems = validLines.length
  const totalQuantity = validLines.reduce((sum, l) => {
    const qty = parseInt(l.quantity_adjusted) || 0
    return sum + (adjustmentType === "decrease" ? -Math.abs(qty) : Math.abs(qty))
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      if (validLines.length === 0) {
        throw new Error("Please add at least one valid adjustment line.")
      }
      if (!reason.trim()) {
        throw new Error("Please provide a reason for the adjustment.")
      }
      if (!storeId) {
        throw new Error("Please select a store.")
      }

      // Build the bulk adjustment items
      const items: BulkStockAdjustmentItem[] = validLines.map(line => {
        const quantity = parseInt(line.quantity_adjusted)
        const selectedProduct = products.find(p => p.id === line.product_id)
        const selectedVariant = selectedProduct?.variants?.find(v => String(v.id) === line.variant_id)
        
        return {
          product_id: line.product_id,
          variant_id: line.variant_id || undefined,
          adjustment_type: adjustmentType,
          quantity_adjusted: quantity, // The API handles the sign based on adjustment_type
          notes: selectedVariant ? `Variant: ${selectedVariant.name}` : undefined,
        }
      })

      // Call the bulk endpoint
      const result = await createBulkStockAdjustmentAction({
        store_id: storeId,
        reason_type: reasonType as any,
        reason,
        notes: notes || undefined,
        status,
        items,
      })

      if (result.success) {
        const { summary } = result
        if (result.hasPartialFailure) {
          toast({ 
            title: "Partial Success", 
            description: `${summary?.successful_items || 0} of ${summary?.total_items_submitted || 0} items adjusted. ${summary?.failed_items || 0} failed.`,
            variant: "default"
          })
        } else {
          toast({ 
            title: "Success", 
            description: result.message || `Stock adjustment created with ${summary?.successful_items || validLines.length} items` 
          })
        }
        onOpenChange(false)
        onSuccess()
        resetForm()
      } else {
        toast({ title: "Error", description: result.message || "Failed to create adjustment", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create stock adjustment", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setLines([{ id: crypto.randomUUID(), product_id: "", variant_id: "", quantity_adjusted: "" }])
    setStoreId("")
    setAdjustmentType("decrease")
    setReasonType("damage")
    setReason("")
    setNotes("")
    setStatus("draft")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[900px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b bg-muted/30">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Stock Adjustment
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            
            {/* Global Settings Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  Adjustment Settings
                </CardTitle>
                <CardDescription>These settings apply to all products below</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Store */}
                  <div className="space-y-2">
                    <Label>Store</Label>
                    <Popover open={storeSearchOpen} onOpenChange={setStoreSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between text-left font-normal">
                          {storeId ? stores.find(s => s.id === storeId)?.name : "All stores"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Search stores..." />
                          <CommandList>
                            <CommandEmpty>No store found.</CommandEmpty>
                            <CommandGroup>
                              {stores.map(store => (
                                <CommandItem key={store.id} value={store.name} onSelect={() => { setStoreId(store.id); setStoreSearchOpen(false) }}>
                                  <Check className={cn("mr-2 h-4 w-4", storeId === store.id ? "opacity-100" : "opacity-0")} />
                                  {store.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Adjustment Type */}
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select value={adjustmentType} onValueChange={v => setAdjustmentType(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="decrease">
                          <span className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /> Decrease</span>
                        </SelectItem>
                        <SelectItem value="increase">
                          <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> Increase</span>
                        </SelectItem>
                        <SelectItem value="set">
                          <span className="flex items-center gap-2">Set Quantity</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reason Type */}
                  <div className="space-y-2">
                    <Label>Reason Type *</Label>
                    <Select value={reasonType} onValueChange={setReasonType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="damage">Damage</SelectItem>
                        <SelectItem value="expiry">Expiry</SelectItem>
                        <SelectItem value="theft">Theft</SelectItem>
                        <SelectItem value="loss">Loss</SelectItem>
                        <SelectItem value="found">Found</SelectItem>
                        <SelectItem value="recount">Recount</SelectItem>
                        <SelectItem value="correction">Correction</SelectItem>
                        <SelectItem value="return">Return</SelectItem>
                        <SelectItem value="donation">Donation</SelectItem>
                        <SelectItem value="sample">Sample</SelectItem>
                        <SelectItem value="write_off">Write-off</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <Select value={status} onValueChange={v => setStatus(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Save as Draft</SelectItem>
                        <SelectItem value="pending">Submit for Approval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Products to Adjust</CardTitle>
                    <CardDescription>Select products and enter quantities</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 mr-1" /> Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lines.map((line) => {
                  const selectedProduct = products.find(p => p.id === line.product_id)
                  const variants = selectedProduct?.variants || []
                  const currentStock = getProductStock(line.product_id, line.variant_id)
                  const qty = parseInt(line.quantity_adjusted) || 0
                  const newStock = currentStock !== null 
                    ? (adjustmentType === "set" ? qty : adjustmentType === "decrease" ? currentStock - qty : currentStock + qty)
                    : null

                  return (
                    <div key={line.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/20">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                        {/* Product Selection */}
                        <div className="md:col-span-5 space-y-1">
                          <Label className="text-xs text-muted-foreground">Product</Label>
                          <Popover 
                            open={productSearchOpen[line.id]} 
                            onOpenChange={open => setProductSearchOpen({ ...productSearchOpen, [line.id]: open })}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="w-full justify-between text-left font-normal h-9">
                                {line.product_id ? (
                                  <span className="truncate">{selectedProduct?.name}</span>
                                ) : (
                                  <span className="text-muted-foreground">Select product...</span>
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search products..." />
                                <CommandList>
                                  <CommandEmpty>No product found.</CommandEmpty>
                                  <CommandGroup>
                                    {products.map(product => (
                                      <CommandItem
                                        key={product.id}
                                        value={`${product.name} ${product.sku || ""} ${product.product_code || ""}`}
                                        onSelect={() => {
                                          updateLine(line.id, "product_id", product.id)
                                          setProductSearchOpen({ ...productSearchOpen, [line.id]: false })
                                        }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", line.product_id === product.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex-1 flex items-center justify-between">
                                          <div>
                                            <div className="font-medium">{product.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                              SKU: {product.sku || "N/A"}
                                              {product.has_variations && <Badge variant="secondary" className="ml-2 text-[10px]">Has Variants</Badge>}
                                            </div>
                                          </div>
                                          <Badge variant={product.stock_quantity <= (product.low_stock_threshold || 0) ? "destructive" : "secondary"}>
                                            {product.stock_quantity}
                                          </Badge>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Variant Selection */}
                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs text-muted-foreground">Variant</Label>
                          {selectedProduct?.has_variations && variants.length > 0 ? (
                            <Select value={line.variant_id} onValueChange={v => updateLine(line.id, "variant_id", v)}>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select variant" />
                              </SelectTrigger>
                              <SelectContent>
                                {variants.map(variant => (
                                  <SelectItem key={variant.id} value={String(variant.id)}>
                                    {variant.name} ({variant.stock_quantity})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input disabled placeholder="No variants" className="h-9 bg-muted" />
                          )}
                        </div>

                        {/* Quantity Input */}
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={line.quantity_adjusted}
                            onChange={e => updateLine(line.id, "quantity_adjusted", e.target.value)}
                            placeholder="0"
                            className="h-9"
                          />
                        </div>

                        {/* Stock Info */}
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Stock</Label>
                          {currentStock !== null ? (
                            <div className="flex items-center gap-1 h-9 text-sm">
                              <span className="text-muted-foreground">{currentStock}</span>
                              {qty > 0 && (
                                <>
                                  <span className="text-muted-foreground">→</span>
                                  <span className={cn(
                                    "font-medium",
                                    newStock !== null && newStock < 0 ? "text-red-600" : 
                                    adjustmentType === "decrease" ? "text-orange-600" : "text-green-600"
                                  )}>
                                    {newStock}
                                  </span>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="h-9 flex items-center text-sm text-muted-foreground">—</div>
                          )}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Reason Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Reason & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Provide a detailed reason for this adjustment (e.g., 'Items damaged during transit on Nov 25')"
                    rows={2}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Any additional information (optional)"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Summary Card */}
            {validLines.length > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Adjustment Summary</p>
                      <p className="text-xs text-muted-foreground">
                        {validLines.length} product{validLines.length !== 1 ? "s" : ""} will be adjusted
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        {adjustmentType === "decrease" ? (
                          <TrendingDown className="h-5 w-5 text-red-500" />
                        ) : adjustmentType === "increase" ? (
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        ) : null}
                        <span className={cn(
                          "text-2xl font-bold",
                          adjustmentType === "decrease" ? "text-red-600" : 
                          adjustmentType === "increase" ? "text-green-600" : "text-primary"
                        )}>
                          {adjustmentType === "decrease" ? "-" : adjustmentType === "increase" ? "+" : ""}
                          {Math.abs(totalQuantity)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {adjustmentType === "set" ? "units to set" : "units total"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <SheetFooter className="px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <Button type="button" variant="ghost" onClick={resetForm} disabled={isSubmitting}>
                Reset
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || loadingData || validLines.length === 0}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create {validLines.length > 0 ? `${validLines.length} Adjustment${validLines.length !== 1 ? "s" : ""}` : "Adjustment"}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
