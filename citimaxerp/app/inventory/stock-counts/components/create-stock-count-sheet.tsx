"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Search, Check, ChevronsUpDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getProducts } from "@/lib/products"
import { createStockCount } from "@/lib/stock-counts"
import { getUsers } from "@/lib/users"
import { getStores } from "@/lib/stores"
import { cn } from "@/lib/utils"
import type { StockCount } from "@/app/types"
import type { Product, ProductVariant } from "@/lib/products"
import type { UserData } from "@/lib/users"
import type { Store } from "@/lib/stores"

interface CreateStockCountSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onStockCountCreated: (newCount: StockCount) => void
}

// A single countable line in the sheet. Non-variant products produce exactly
// one line. A product with has_variations produces one line per variant
// (never one combined line for the whole product), so expected_quantity can
// reflect each variant's own stock_quantity instead of the parent product's.
interface CountLine {
  key: string // product.id, or `${product.id}:${variant.id}` for a variant line
  product: Product
  variant: ProductVariant | null
  label: string
  sku: string | null
  stockQuantity: number
  categoryName: string | null
}

export function CreateStockCountSheet({ isOpen, onOpenChange, onStockCountCreated }: CreateStockCountSheetProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [selectedLineKeys, setSelectedLineKeys] = useState<string[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingStores, setLoadingStores] = useState(false)
  const [productSelectionMode, setProductSelectionMode] = useState<"all" | "category" | "manual">("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [storeSearchOpen, setStoreSearchOpen] = useState(false)
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [categorySearchOpen, setCategorySearchOpen] = useState(false)
  const [formState, setFormState] = useState({
    name: "",
    count_type: "cycle_count" as "cycle_count" | "full_count",
    location: "",
    scheduled_date: "",
    notes: "",
    assigned_to: "",
  })

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoadingProducts(true)
        // Fetch the ENTIRE catalog, not just the first page. getProducts()
        // defaults to page=1/pageSize=20, which silently capped this sheet at
        // 20 products company-wide. Mirror the pagination loop used in
        // app/inventory/products/page.tsx: fetch page 1 at page size 100, read
        // pagination.last_page, then fetch and concat the remaining pages.
        const first = await getProducts(1, 100)
        let allProducts = Array.isArray(first.data) ? first.data : []
        const lastPage = first.pagination?.last_page || 1
        if (lastPage > 1) {
          for (let page = 2; page <= lastPage; page++) {
            const resp = await getProducts(page, 100)
            if (Array.isArray(resp.data)) {
              allProducts = allProducts.concat(resp.data)
            }
          }
        }
        setProducts(allProducts)
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load products for selection. " + (error.message || "Please try again."),
          variant: "destructive",
        })
      } finally {
        setLoadingProducts(false)
      }
    }

    async function fetchUsers() {
      try {
        setLoadingUsers(true)
        // Only warehouse in-charge users should be assignable to a stock count.
        const usersList = await getUsers({ role_scope: "warehouse_incharge" })
        setUsers(usersList || [])
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load users. " + (error.message || "Please try again."),
          variant: "destructive",
        })
      } finally {
        setLoadingUsers(false)
      }
    }

    async function fetchStores() {
      try {
        setLoadingStores(true)
        const storesList = await getStores()
        setStores(storesList || [])
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load stores. " + (error.message || "Please try again."),
          variant: "destructive",
        })
      } finally {
        setLoadingStores(false)
      }
    }

    if (isOpen) {
      fetchProducts()
      fetchUsers()
      fetchStores()
      // Reset form when opening
      setFormState({
        name: "",
        count_type: "cycle_count",
        location: "",
        scheduled_date: "",
        notes: "",
        assigned_to: "",
      })
      setSelectedLineKeys([])
      setProductSelectionMode("all")
      setSelectedCategory("")
      setSearchTerm("")
    }
  }, [isOpen, toast])

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleLineSelection = (lineKey: string, isChecked: boolean) => {
    setSelectedLineKeys((prev) => (isChecked ? [...prev, lineKey] : prev.filter((key) => key !== lineKey)))
  }

  // Expand products into countable lines: one line per variant for
  // has_variations products (so each variant gets its own expected_quantity
  // from variant.stock_quantity), one line for everything else. Also apply
  // the store filter here so the picker only offers items whose store_id is
  // null (unassigned - available to any store) or equals the selected store,
  // matching the same null-tolerant rule the backend now enforces.
  const countLines = useMemo<CountLine[]>(() => {
    const selectedStoreId = formState.location
    const lines: CountLine[] = []

    for (const product of products) {
      const productStoreOk = !selectedStoreId || !product.store_id || product.store_id === selectedStoreId
      if (!productStoreOk) continue

      const categoryName = product.category?.name ?? null

      if (product.has_variations && Array.isArray(product.variants) && product.variants.length > 0) {
        for (const variant of product.variants) {
          const variantStoreOk = !selectedStoreId || !variant.store_id || variant.store_id === selectedStoreId
          if (!variantStoreOk) continue

          lines.push({
            key: `${product.id}:${variant.id}`,
            product,
            variant,
            label: `${product.name} - ${variant.name}`,
            sku: variant.sku || product.sku || null,
            // Clamp to 0 - some imported records have a negative stock_quantity
            // (a data-entry artifact), and the backend rejects a negative
            // expected_quantity outright, which would otherwise silently block
            // creating a stock count for the whole catalog.
            stockQuantity: Math.max(0, variant.stock_quantity || 0),
            categoryName,
          })
        }
      } else {
        lines.push({
          key: product.id,
          product,
          variant: null,
          label: product.name,
          sku: product.sku || null,
          stockQuantity: Math.max(0, product.stock_quantity || 0),
          categoryName,
        })
      }
    }

    return lines
  }, [products, formState.location])

  // Get unique categories from the countable lines (not raw products), so a
  // category only appears when it has at least one line countable at the
  // selected store.
  const categories = Array.from(new Set(countLines.map((l) => l.categoryName).filter(Boolean))) as string[]

  // Filter lines based on search and mode
  const filteredLines = countLines.filter((line) => {
    const matchesSearch =
      searchTerm === "" ||
      line.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (line.sku && line.sku.toLowerCase().includes(searchTerm.toLowerCase()))

    if (productSelectionMode === "category" && selectedCategory) {
      return matchesSearch && line.categoryName === selectedCategory
    }
    return matchesSearch
  })

  // The lines that are actually in scope for the current selection mode.
  const linesInScope = (): CountLine[] => {
    if (productSelectionMode === "all") {
      return countLines
    } else if (productSelectionMode === "category" && selectedCategory) {
      return countLines.filter((l) => l.categoryName === selectedCategory)
    } else {
      return countLines.filter((l) => selectedLineKeys.includes(l.key))
    }
  }

  // Calculate items/products to count based on mode. A "product" here means
  // a distinct product id - a variation-bearing product with 3 variants
  // contributes 3 items but only 1 product, so the two counts can now differ.
  const getCountSummary = () => {
    const lines = linesInScope()
    const itemCount = lines.length
    const productCount = new Set(lines.map((l) => l.product.id)).size
    return { itemCount, productCount }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)

    const { name, count_type, location, notes, assigned_to } = formState

    // Validation based on selection mode
    if (!name || !location) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      setSaving(false)
      return
    }

    if (productSelectionMode === "manual" && selectedLineKeys.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one item for manual selection mode.",
        variant: "destructive",
      })
      setSaving(false)
      return
    }

    if (productSelectionMode === "category" && !selectedCategory) {
      toast({
        title: "Validation Error",
        description: "Please select a category.",
        variant: "destructive",
      })
      setSaving(false)
      return
    }

    try {
      // Get the selected store
      const selectedStore = stores.find((s) => s.id === location)
      if (!selectedStore) throw new Error("Selected store not found")

      // Build submission items from the in-scope lines. A variant line sends
      // both product_id and variant_id; a simple product line sends only
      // product_id (no variant_id), matching what the backend now expects.
      const linesToSubmit = linesInScope()
      const items = linesToSubmit.map((line) => ({
        product_id: line.product.id,
        ...(line.variant ? { variant_id: String(line.variant.id) } : {}),
        expected_quantity: line.stockQuantity || 0,
        counted_quantity: null,
        notes: "",
      }))

      // Create stock count via API
      const payload = {
        company_id: selectedStore.company_id,
        store_id: selectedStore.id,
        name,
        description: notes || undefined,
        count_type,
        status: "draft" as const,
        location: selectedStore.name,
        assigned_to: assigned_to || undefined,
        items,
      }

      console.log("Creating stock count with payload:", JSON.stringify(payload, null, 2))

      const newStockCount = await createStockCount(payload)

      if (!newStockCount) throw new Error("Failed to create stock count")

      toast({
        title: "Success",
        description: `Stock count created successfully with ${items.length} item${items.length !== 1 ? "s" : ""}!`,
      })
      onStockCountCreated(newStockCount)
      onOpenChange(false)
      // Reset form state
      setFormState({
        name: "",
        count_type: "cycle_count",
        location: "",
        scheduled_date: "",
        notes: "",
        assigned_to: "",
      })
      setSelectedLineKeys([])
      setProductSelectionMode("all")
      setSelectedCategory("")
      setSearchTerm("")
    } catch (error: any) {
      console.error("Stock count creation error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create stock count.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const { itemCount: summaryItemCount, productCount: summaryProductCount } = getCountSummary()

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Create New Stock Count</SheetTitle>
          <SheetDescription>Define the details for your new stock count.</SheetDescription>
        </SheetHeader>
        <form id="create-stock-count-form" onSubmit={handleSubmit} className="grid gap-4 py-4 flex-grow overflow-y-auto">
          {/* Basic Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
              <CardDescription>Enter the basic details for this stock count</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Count Name *</Label>
                <Input id="name" name="name" value={formState.name} onChange={handleFormChange} required placeholder="e.g., Monthly Inventory Count" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="count_type">Count Type *</Label>
                  <Select
                    name="count_type"
                    value={formState.count_type}
                    onValueChange={(value) => setFormState((prev) => ({ ...prev, count_type: value as "cycle_count" | "full_count" }))}
                    required
                  >
                    <SelectTrigger id="count_type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_count">Full Count</SelectItem>
                      <SelectItem value="cycle_count">Cycle Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Store/Location *</Label>
                  <Popover open={storeSearchOpen} onOpenChange={setStoreSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={storeSearchOpen}
                        className="w-full justify-between font-normal"
                        disabled={loadingStores}
                      >
                        {loadingStores
                          ? "Loading stores..."
                          : formState.location
                            ? stores.find((store) => store.id === formState.location)?.name
                            : "Select store"}
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
                                  setFormState((prev) => ({ ...prev, location: store.id }))
                                  setStoreSearchOpen(false)
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formState.location === store.id ? "opacity-100" : "opacity-0")} />
                                {store.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_date">Scheduled Date *</Label>
                  <Input
                    id="scheduled_date"
                    name="scheduled_date"
                    type="date"
                    value={formState.scheduled_date}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assign To</Label>
                  <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={userSearchOpen}
                        className="w-full justify-between font-normal"
                        disabled={loadingUsers}
                      >
                        {loadingUsers
                          ? "Loading users..."
                          : formState.assigned_to
                            ? (() => {
                                const user = users.find((u) => u.email === formState.assigned_to)
                                return user
                                  ? (user.first_name && user.last_name
                                      ? `${user.first_name} ${user.last_name} (${user.email})`
                                      : user.email)
                                  : formState.assigned_to
                              })()
                            : "Select user (optional)"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search users..." />
                        <CommandList>
                          <CommandEmpty>
                            {loadingUsers ? "Loading users..." : "No warehouse in-charge users available."}
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="unassigned"
                              onSelect={() => {
                                setFormState((prev) => ({ ...prev, assigned_to: "" }))
                                setUserSearchOpen(false)
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", !formState.assigned_to ? "opacity-100" : "opacity-0")} />
                              Unassigned
                            </CommandItem>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.first_name && user.last_name
                                  ? `${user.first_name} ${user.last_name} ${user.email}`
                                  : user.email}
                                onSelect={() => {
                                  setFormState((prev) => ({ ...prev, assigned_to: user.email }))
                                  setUserSearchOpen(false)
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formState.assigned_to === user.email ? "opacity-100" : "opacity-0")} />
                                {user.first_name && user.last_name
                                  ? `${user.first_name} ${user.last_name} (${user.email})`
                                  : user.email}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Details</CardTitle>
              <CardDescription>Add any additional notes or instructions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formState.notes}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Add any special instructions or notes..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Products Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Products to Count *</CardTitle>
              <CardDescription>
                {summaryItemCount > 0
                  ? summaryItemCount === summaryProductCount
                    ? `${summaryItemCount} product${summaryItemCount !== 1 ? "s" : ""} will be counted`
                    : `${summaryItemCount} item${summaryItemCount !== 1 ? "s" : ""} across ${summaryProductCount} product${summaryProductCount !== 1 ? "s" : ""} will be counted`
                  : "Select which products to include in this count"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selection Mode */}
              <div className="space-y-2">
                <Label>Selection Mode</Label>
                <Select value={productSelectionMode} onValueChange={(value: any) => setProductSelectionMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products (Full Inventory Count)</SelectItem>
                    <SelectItem value="category">By Category (Cycle Count)</SelectItem>
                    <SelectItem value="manual">Manual Selection (Specific Products)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Selection - shown when mode is "category" */}
              {productSelectionMode === "category" && (
                <div className="space-y-2">
                  <Label htmlFor="category">Select Category *</Label>
                  <Popover open={categorySearchOpen} onOpenChange={setCategorySearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categorySearchOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedCategory
                          ? `${selectedCategory} (${countLines.filter((l) => l.categoryName === selectedCategory).length} items)`
                          : "Choose a category"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search categories..." />
                        <CommandList>
                          <CommandEmpty>No categories available.</CommandEmpty>
                          <CommandGroup>
                            {categories.map((category) => (
                              <CommandItem
                                key={category}
                                value={category}
                                onSelect={() => {
                                  setSelectedCategory(category)
                                  setCategorySearchOpen(false)
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedCategory === category ? "opacity-100" : "opacity-0")} />
                                {category} ({countLines.filter((l) => l.categoryName === category).length} items)
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Manual Selection - shown when mode is "manual" */}
              {productSelectionMode === "manual" && (
                <div className="space-y-2">
                  <Label htmlFor="product-search">Search Products</Label>
                  <Input
                    id="product-search"
                    placeholder="Search by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border rounded-md p-4 bg-muted/20">
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading products...</span>
                      </div>
                    ) : filteredLines.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        {searchTerm ? "No products match your search" : "No products available"}
                      </p>
                    ) : (
                      filteredLines.map((line) => (
                        <div key={line.key} className="flex items-start space-x-2 p-2 rounded hover:bg-muted/50 transition-colors">
                          <input
                            type="checkbox"
                            id={`line-${line.key}`}
                            checked={selectedLineKeys.includes(line.key)}
                            onChange={(e) => handleLineSelection(line.key, e.target.checked)}
                            className="mt-0.5 h-4 w-4 text-[#1E2764] border-gray-300 rounded focus:ring-[#1E2764]"
                          />
                          <label
                            htmlFor={`line-${line.key}`}
                            className="text-sm leading-tight cursor-pointer flex-1"
                          >
                            <div className="font-medium">{line.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {line.sku || "No SKU"} • Stock: {line.stockQuantity}
                            </div>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedLineKeys.length > 0 && (
                    <div className="flex items-center justify-between pt-2 text-sm">
                      <span className="text-muted-foreground">{selectedLineKeys.length} item{selectedLineKeys.length !== 1 ? "s" : ""} selected</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLineKeys([])}
                      >
                        Clear selection
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Summary for All/Category modes */}
              {productSelectionMode !== "manual" && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {productSelectionMode === "all" ? (
                      <>
                        <strong>Full inventory count:</strong> All {summaryProductCount} product{summaryProductCount !== 1 ? "s" : ""} in your inventory
                        {summaryItemCount !== summaryProductCount ? ` (${summaryItemCount} items, including per-variant lines)` : ""} will be included in this count.
                      </>
                    ) : selectedCategory ? (
                      <>
                        <strong>Category count:</strong> All items in the "{selectedCategory}" category will be included ({countLines.filter((l) => l.categoryName === selectedCategory).length} items).
                      </>
                    ) : (
                      "Select a category to see how many items will be counted."
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </form>
        <SheetFooter className="mt-auto pt-4 border-t bg-background dark:bg-gray-950">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="create-stock-count-form" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Stock Count"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
