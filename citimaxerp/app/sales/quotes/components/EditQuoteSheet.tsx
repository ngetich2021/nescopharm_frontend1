"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Trash2, Plus, Search, Package, ArrowLeft, Save } from "lucide-react"
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { updateQuote, Quote } from "@/lib/quotes"
import { getCustomers, createCustomer, getCustomerDisplayName } from "@/lib/customers"
import { getProducts } from "@/lib/products"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { formatPackagingForDisplay } from "@/lib/packaging-utils"
import { DEFAULT_PRICE_CODE, priceOptionsFor } from "@/lib/price-codes"

const lineItemSchema = z.object({
  product_id: z.string().min(1, "Please select a product"),
  variant_id: z.string().optional().nullable(),
  description: z.string().optional(), // Just for display, not sent to API
  quantity: z.number().min(0.01, "Quantity must be at least 0.01"),
  unit_price: z.number().min(0, "Unit price must be non-negative"),
  // Which named product price tier (e.g. "Hospital Price") this line's price
  // came from, or "Custom" if hand-typed - internal-only, never printed on
  // the customer-facing quote.
  price_label: z.string().optional().nullable(),
})

const quoteSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  valid_until: z.string().min(1, "Valid until date is required"),
  currency: z.string().min(1, "Currency is required"),
  notes: z.string().optional(),
  status: z.enum(["pending", "accepted", "rejected", "expired"]),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
})

type QuoteFormData = z.infer<typeof quoteSchema>

interface EditQuoteSheetProps {
  open: boolean
  onClose: () => void
  quote: Quote | null
  onSuccess?: () => void
}

export function EditQuoteSheet({ open, onClose, quote, onSuccess }: EditQuoteSheetProps) {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [productsError, setProductsError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [productSearchResults, setProductSearchResults] = useState<any[] | null>(null)
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState<number | null>(null)
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerEmail, setNewCustomerEmail] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const { toast } = useToast()
  const { user } = useAuth()

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    mode: 'onChange',
    defaultValues: {
      customer_id: '',
      valid_until: '',
      currency: 'KES',
      notes: '',
      status: 'pending',
      items: [{ product_id: '', description: '', quantity: 1, unit_price: 0, price_label: null }],
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  })

  // Load customers and products when sheet opens
  useEffect(() => {
    if (open && user) {
      loadCustomers()
      loadProducts()
    }
  }, [open, user])

  // Populate form when quote changes
  useEffect(() => {
    if (open && quote) {
      const formData: QuoteFormData = {
        customer_id: quote.customer_id,
        valid_until: quote.valid_until.split('T')[0], // Convert to date string
        currency: quote.currency || 'KES',
        notes: quote.notes || '',
        status: quote.status as "pending" | "accepted" | "rejected" | "expired",
        items: quote.quote_items?.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          description: item.product?.name || "Unknown Product",
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          price_label: item.price_label || null,
        })) || [{ product_id: '', description: '', quantity: 1, unit_price: 0, price_label: null }],
      }
      
      form.reset(formData)
    }
  }, [open, quote, form])

  const loadCustomers = async () => {
    try {
      const customersData = await getCustomers()
      setCustomers(customersData || [])
    } catch (error: any) {
      // Silently handle customer loading errors
    }
  }

  const loadProducts = async () => {
    setProductsError(null)
    try {
      const productsData = await getProducts(1, 200)
      setProducts(productsData?.data || [])
    } catch (error: any) {
      // Surfaced instead of silently leaving an empty product list - a
      // blank/failed fetch here otherwise looks identical to "no products
      // to pick from," including no price-tier dropdown ever showing up.
      setProducts([])
      setProductsError(error?.message || "Failed to load products.")
      toast({
        title: "Couldn't load products",
        description: (error?.message || "Failed to load products.") + " Product search and price tiers won't work until this is retried.",
        variant: "destructive",
      })
    }
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(customerSearchTerm.toLowerCase())
  )

  // Search products server-side for 2+ chars; single char uses client-side filter.
  // Increase limit from 50 to 100 for better search coverage.
  useEffect(() => {
    if (!open) return
    const term = productSearchTerm.trim()
    if (term.length < 1) {
      setProductSearchResults(null)
      return
    }
    // For single-character searches, use client-side filter only
    if (term.length === 1) {
      setProductSearchResults(null)
      return
    }
    setIsSearchingProducts(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await getProducts(1, 100, { search: term })
        setProductSearchResults(data || [])
      } catch (error) {
        console.error('Product search failed:', error)
        setProductSearchResults([])
      } finally {
        setIsSearchingProducts(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearchTerm, open])

  // Fuzzy matching: checks if search term characters appear in sequence (case-insensitive)
  const fuzzyMatch = (text: string | null | undefined, query: string) => {
    if (!text) return false
    const t = text.toLowerCase()
    const q = query.toLowerCase()
    let tIndex = 0
    for (let i = 0; i < q.length; i++) {
      tIndex = t.indexOf(q[i], tIndex)
      if (tIndex === -1) return false
      tIndex++
    }
    return true
  }

  const filteredProducts = productSearchResults !== null ? productSearchResults : products.filter(product => {
    const searchTerm = productSearchTerm.toLowerCase().trim()
    if (!searchTerm) return true
    return (
      fuzzyMatch(product.name, searchTerm) ||
      fuzzyMatch(product.sku, searchTerm) ||
      fuzzyMatch(product.description, searchTerm)
    )
  })

  const addLineItem = () => {
    append({
      product_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      price_label: null,
    })
  }

  const addProductToLineItem = (index: number, product: any, variant?: any) => {
    const item = variant || product
    const productId = product.id
    const variantId = variant?.id || null
    
    // Check if this product/variant combination already exists in the quote
    const existingIndex = fields.findIndex((field, idx) => {
      const existingProductId = form.getValues(`items.${idx}.product_id`)
      const existingVariantId = form.getValues(`items.${idx}.variant_id`)
      return existingProductId === productId && existingVariantId === variantId
    })
    
    if (existingIndex !== -1) {
      // Product/variant already exists, update quantity
      const currentQuantity = Number(form.getValues(`items.${existingIndex}.quantity`)) || 1
      form.setValue(`items.${existingIndex}.quantity`, currentQuantity + 1)
      toast({
        title: "Quantity Updated",
        description: `Increased quantity of ${item.name || product.name} to ${currentQuantity + 1}`,
      })
    } else {
      // New product/variant, add to current line item
      form.setValue(`items.${index}.product_id`, product.id)
      if (variant) {
        form.setValue(`items.${index}.variant_id`, variant.id)
        form.setValue(`items.${index}.description`, `${product.name} - ${variant.name}`)
      } else {
        form.setValue(`items.${index}.description`, product.name)
      }
      form.setValue(`items.${index}.unit_price`, parseFloat(item.price || "0"))
      form.setValue(`items.${index}.price_label`, DEFAULT_PRICE_CODE)
    }

    setShowProductSearch(null)
    setProductSearchTerm("")
  }

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      toast({
        title: "Error",
        description: "Customer name is required",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      const customerData = {
        name: newCustomerName.trim(),
        email: newCustomerEmail.trim() || null,
        phone: newCustomerPhone.trim() || null,
        address: null,
        city: null,
        state: null,
        country: null,
        postal_code: null,
        customer_type: 'individual',
        company: null,
        preferred_communication_channel: null,
        last_contact_date: null,
        first_name: newCustomerName.split(" ")[0] || "",
        last_name: newCustomerName.split(" ").slice(1).join(" ") || "",
        tags: [],
      };

      const newCustomer = await createCustomer(customerData as any)

      setCustomers(prev => [...prev, newCustomer])
      form.setValue('customer_id', newCustomer.id)
      setShowCreateCustomer(false)
      setNewCustomerName("")
      setNewCustomerEmail("")
      setNewCustomerPhone("")
      
      toast({
        title: "Success",
        description: "Customer created successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate totals
  const quoteTotals = {
    subtotal: fields.reduce((sum, _, index) => {
      const quantity = Number(form.watch(`items.${index}.quantity`)) || 0
      const unitPrice = Number(form.watch(`items.${index}.unit_price`)) || 0
      return sum + (quantity * unitPrice)
    }, 0)
  }

  const onSubmit: SubmitHandler<QuoteFormData> = async (data) => {
    if (!quote) {
      toast({
        title: "Error",
        description: "No quote selected for editing",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      
      // Filter out items without product_id and transform form data to API format
      const validItems = data.items.filter(item => item.product_id && item.product_id.trim() !== '')
      
      if (validItems.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one product to the quote",
          variant: "destructive",
        })
        setIsSaving(false)
        return
      }
      
      const updateData = {
        customer_id: data.customer_id,
        notes: data.notes || "",
        valid_until: data.valid_until,
        status: data.status,
        currency: data.currency,
        items: validItems.map(item => ({
          product_id: item.product_id!,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          unit_price: item.unit_price.toString(),
          price_label: item.price_label || null,
        }))
      }
      
      const updatedQuote = await updateQuote(quote.id, updateData)
      
      toast({
        title: "Success",
        description: `Quote ${updatedQuote.quote_number || updatedQuote.id} updated successfully`,
      })
      
      onSuccess?.()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update quote",
        variant: "destructive",  
      })
    } finally {
      setIsSaving(false)
    }
  }

  const onInvalidSubmit = (errors: any) => {
    toast({
      title: "Validation Error",
      description: "Please fix the form errors before submitting",
      variant: "destructive",
    })
  }

  if (!quote) return null

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="!w-[55vw] !min-w-[55vw] !max-w-[55vw] overflow-y-auto flex flex-col h-full">
        <SheetHeader className="flex-shrink-0 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            Edit Quote {quote.quote_number}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto py-4 pb-20 space-y-6">
            {/* Form validation errors */}
            {Object.keys(form.formState.errors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {Object.entries(form.formState.errors).map(([field, error]: [string, any]) => {
                    if (field === 'items' && error?.message) {
                      return <li key={field}>• {error.message}</li>
                    }
                    if (field === 'items' && Array.isArray(error)) {
                      return null // Item-specific errors are shown inline
                    }
                    return (
                      <li key={field}>
                        • {field.replace('_', ' ')}: {error?.message || 'Invalid value'}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            
            {/* Basic Quote Information */}
            <Card>
              <CardHeader>
                <CardTitle>Quote Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer and Currency Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer_id">Customer</Label>
                    <div className="relative">
                      <Popover open={showCustomerSearch} onOpenChange={setShowCustomerSearch}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={showCustomerSearch}
                            className="w-full justify-between"
                          >
                            {form.watch('customer_id')
                              ? (() => {
                                  const selected = customers.find(customer => customer.id === form.watch('customer_id'))
                                  return selected ? getCustomerDisplayName(selected) : "Select or search customer"
                                })()
                              : "Select or search customer"}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <div className="flex items-center border-b px-3 py-2">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input
                              placeholder="Search customers by name, email, or phone..."
                              value={customerSearchTerm}
                              onChange={(e) => setCustomerSearchTerm(e.target.value)}
                              className="border-0 focus-visible:ring-0 p-0"
                            />
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            <div className="p-1">
                              <div
                                className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 rounded text-blue-600 font-medium"
                                onClick={() => {
                                  setShowCustomerSearch(false)
                                  setShowCreateCustomer(true)
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                Create New Customer
                              </div>
                              {filteredCustomers.length === 0 && customerSearchTerm ? (
                                <div className="px-2 py-4 text-sm text-gray-500 text-center">
                                  No customers found
                                </div>
                              ) : (
                                filteredCustomers.map((customer) => (
                                  <div
                                    key={customer.id}
                                    className="flex flex-col gap-1 px-2 py-2 cursor-pointer hover:bg-gray-100 rounded"
                                    onClick={() => {
                                      form.setValue('customer_id', customer.id)
                                      setShowCustomerSearch(false)
                                      setCustomerSearchTerm("")
                                    }}
                                  >
                                    <span className="font-medium text-sm">{getCustomerDisplayName(customer)}</span>
                                    <div className="text-xs text-gray-500">
                                      {customer.email && <div>{customer.email}</div>}
                                      {customer.phone && <div>{customer.phone}</div>}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Create Customer Modal */}
                      {showCreateCustomer && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Create New Customer</h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setShowCreateCustomer(false)
                                  setNewCustomerName("")
                                  setNewCustomerEmail("")
                                  setNewCustomerPhone("")
                                }}
                                className="px-2"
                              >
                                ✕
                              </Button>
                            </div>
                            <Input
                              placeholder="Customer name *"
                              value={newCustomerName}
                              onChange={(e) => setNewCustomerName(e.target.value)}
                            />
                            <Input
                              placeholder="Email (optional)"
                              type="email"
                              value={newCustomerEmail}
                              onChange={(e) => setNewCustomerEmail(e.target.value)}
                            />
                            <Input
                              placeholder="Phone (optional)"
                              value={newCustomerPhone}
                              onChange={(e) => setNewCustomerPhone(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowCreateCustomer(false)
                                  setNewCustomerName("")
                                  setNewCustomerEmail("")
                                  setNewCustomerPhone("")
                                }}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleCreateCustomer}
                                disabled={!newCustomerName.trim() || isSaving}
                                className="flex-1"
                              >
                                {isSaving ? "Creating..." : "Create"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {form.formState.errors.customer_id && (
                      <p className="text-sm text-red-600">{form.formState.errors.customer_id.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select 
                      value={form.watch('currency')} 
                      onValueChange={(value) => form.setValue('currency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="valid_until">Valid Until</Label>
                      <Input
                        type="date"
                        {...form.register('valid_until')}
                      />
                      {form.formState.errors.valid_until && (
                        <p className="text-sm text-red-600">{form.formState.errors.valid_until.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={form.watch('status')} 
                        onValueChange={(value) => form.setValue('status', value as "pending" | "accepted" | "rejected" | "expired")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-xl font-semibold">Quote Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {productsError && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <span>Products failed to load ({productsError}) - product search and price-tier dropdowns won't work until this succeeds.</span>
                    <Button type="button" size="sm" variant="outline" onClick={loadProducts}>
                      Retry
                    </Button>
                  </div>
                )}
                {/* Column Headers */}
                <div className="grid grid-cols-12 gap-4 pb-2 border-b">
                  <div className="col-span-5">
                    <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Description</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Qty</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Price</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Total</Label>
                  </div>
                  <div className="col-span-1"></div>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    {/* Single row layout for line item */}
                    <div className="grid grid-cols-12 gap-4 items-start">
                      {/* Description column */}
                      <div className="col-span-5">
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Click search to select a product or enter description..."
                              {...form.register(`items.${index}.description`)}
                              className={cn(
                                "flex-1 min-h-[80px] text-sm resize-none border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary",
                                form.formState.errors.items?.[index]?.product_id && !form.watch(`items.${index}.product_id`) && "border-red-500 focus:border-red-500"
                              )}
                              rows={3}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setShowProductSearch(showProductSearch === index ? null : index)}
                              className={cn(
                                "h-10 w-10 flex-shrink-0 border-gray-300 hover:border-primary hover:bg-primary/5",
                                form.watch(`items.${index}.product_id`) && "border-primary bg-primary/10"
                              )}
                              tabIndex={0}
                              aria-label="Search product"
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                          </div>
                          {/* Hidden field for product_id */}
                          <input type="hidden" {...form.register(`items.${index}.product_id`)} />
                          {form.formState.errors.items?.[index]?.product_id && !form.watch(`items.${index}.product_id`) && (
                            <p className="text-xs text-red-600 font-medium">{form.formState.errors.items[index]?.product_id?.message}</p>
                          )}
                          {form.formState.errors.items?.[index]?.description && (
                            <p className="text-xs text-red-600">{form.formState.errors.items[index]?.description?.message}</p>
                          )}
                          
                          {/* Product Search Dropdown */}
                          {showProductSearch === index && (
                            <div className="relative z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-auto">
                              <div className="p-3 border-b flex items-center gap-2">
                                <Input
                                  placeholder="Search products..."
                                  value={productSearchTerm}
                                  onChange={(e) => setProductSearchTerm(e.target.value)}
                                  className="flex-1"
                                  autoFocus
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowProductSearch(null)}
                                  className="px-2"
                                >
                                  ✕
                                </Button>
                              </div>
                              <div className="max-h-60 overflow-y-auto">
                                {isSearchingProducts ? (
                                  <div className="p-3 text-sm text-gray-500 text-center">Searching...</div>
                                ) : filteredProducts.length === 0 ? (
                                  <div className="p-3 text-sm text-gray-500 text-center">
                                    {productSearchTerm ? 'No products found' : 'No products available'}
                                  </div>
                                ) : (
                                  filteredProducts.map((product) => (
                                    <div key={product.id}>
                                      {/* Main Product */}
                                      <div
                                        className={cn(
                                          "p-3 hover:bg-gray-50 cursor-pointer border-b",
                                          product.variants && product.variants.length > 0 
                                            ? "bg-blue-50/50" 
                                            : ""
                                        )}
                                        onClick={() => {
                                          if (!product.variants || product.variants.length === 0) {
                                            addProductToLineItem(index, product)
                                          }
                                        }}
                                      >
                                        <div className="flex items-start gap-3">
                                          <Package className="h-5 w-5 text-gray-400 mt-0.5" />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <div className="font-medium text-sm">{product.name}</div>
                                              {product.variants && product.variants.length > 0 && (
                                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                  {product.variants.length} variant{product.variants.length > 1 ? 's' : ''}
                                                </span>
                                              )}
                                            </div>
                                            {product.description && (
                                              <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                                {product.description}
                                              </div>
                                            )}
                                            <div className="text-xs text-gray-500 mt-1">
                                              SKU: {product.sku || 'N/A'} | Price: {formatCurrency(product.price || 0)}
                                              {product.variants && product.variants.length > 0 && (
                                                <span className="ml-2 text-blue-600">• Click variants below to select</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Product Variants */}
                                      {product.variants && product.variants.length > 0 && (
                                        <div className="ml-8 border-l-2 border-blue-200 bg-blue-50/30">
                                          {product.variants.map((variant: any) => (
                                            <div
                                              key={variant.id}
                                              className="p-3 hover:bg-blue-100/50 cursor-pointer text-sm border-b border-blue-100 transition-colors"
                                              onClick={() => addProductToLineItem(index, product, variant)}
                                            >
                                              <div className="flex items-start gap-2">
                                                <div className="w-3 h-3 bg-blue-400 rounded-full mt-1"></div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="font-medium text-blue-900">{variant.name}</div>
                                                  {variant.description && (
                                                    <div className="text-xs text-gray-700 mt-1">
                                                      {variant.description}
                                                    </div>
                                                  )}
                                                  <div className="text-xs text-gray-600 mt-1">
                                                    SKU: {variant.sku || 'N/A'} | Price: {formatCurrency(variant.price || 0)}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Quantity */}
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0"
                          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                          className="h-10 text-sm border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        {form.formState.errors.items?.[index]?.quantity && (
                          <p className="text-xs text-red-600 mt-1">{form.formState.errors.items[index]?.quantity?.message}</p>
                        )}
                        {/* Packaging Breakdown Display */}
                        {(() => {
                          const productId = form.watch(`items.${index}.product_id`)
                          const quantity = form.watch(`items.${index}.quantity`) || 0
                          const product = products.find(p => p.id === productId)
                          
                          if (product && product.has_packaging && product.packaging_units && quantity > 0) {
                            const packagingDisplay = formatPackagingForDisplay(quantity, product.packaging_units)
                            if (packagingDisplay.hasPackaging && packagingDisplay.shortText) {
                              return (
                                <div className="mt-1.5 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-1.5 rounded border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center gap-1.5">
                                    <Package className="h-3 w-3 flex-shrink-0" />
                                    <span className="font-medium">{packagingDisplay.shortText}</span>
                                  </div>
                                </div>
                              )
                            }
                          }
                          return null
                        })()}
                      </div>
                      
                      {/* Unit Price */}
                      <div className="col-span-2">
                        {(() => {
                          const productId = form.watch(`items.${index}.product_id`)
                          const product = products.find(p => p.id === productId)
                          const variantId = form.watch(`items.${index}.variant_id`)
                          const variant = (product as any)?.variants?.find((v: any) => v.id === variantId)
                          const options = priceOptionsFor(product, variant)
                          if (options.length === 0) return null
                          return (
                            <Select
                              value={form.watch(`items.${index}.price_label`) || ""}
                              onValueChange={(code) => {
                                const option = options.find(o => o.code === code)
                                if (!option) return
                                form.setValue(`items.${index}.unit_price`, option.price)
                                form.setValue(`items.${index}.price_label`, code)
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs mb-1 px-2">
                                <SelectValue placeholder="Select price..." />
                              </SelectTrigger>
                              <SelectContent>
                                {options.map((o) => (
                                  <SelectItem key={o.code} value={o.code} className="text-xs">
                                    {o.code} — {o.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        })()}
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...form.register(`items.${index}.unit_price`, {
                            valueAsNumber: true,
                            onChange: (e) => {
                              const productId = form.getValues(`items.${index}.product_id`)
                              const product = products.find(p => p.id === productId)
                              const variantId = form.getValues(`items.${index}.variant_id`)
                              const variant = (product as any)?.variants?.find((v: any) => v.id === variantId)
                              const label = form.getValues(`items.${index}.price_label`)
                              const option = priceOptionsFor(product, variant).find(o => o.code === label)
                              const typed = parseFloat(e.target.value)
                              if (!option || option.price !== typed) {
                                form.setValue(`items.${index}.price_label`, "Custom")
                              }
                            },
                          })}
                          className="h-10 text-sm border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        {form.formState.errors.items?.[index]?.unit_price && (
                          <p className="text-xs text-red-600 mt-1">{form.formState.errors.items[index]?.unit_price?.message}</p>
                        )}
                      </div>
                      
                      {/* Total */}
                      <div className="col-span-2">
                        <div className="flex items-center justify-end h-10 px-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                          <span className="text-base font-bold text-gray-900">{
                            (((Number(form.watch(`items.${index}.quantity`)) || 0) * (Number(form.watch(`items.${index}.unit_price`)) || 0))
                              .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            )
                          }</span>
                        </div>
                      </div>
                      
                      {/* Remove button */}
                      <div className="col-span-1 flex justify-center items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            remove(index)
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-10 w-10 rounded-lg transition-all"
                          tabIndex={0}
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {fields.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No items added yet. Click "Add Item" to get started.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quote Total */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex justify-end">
                  <div className="space-y-2 w-80">
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(quoteTotals.subtotal)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                placeholder="Additional notes or terms"
                {...form.register('notes')}
                rows={3}
              />
            </div>
          </div>
          
          {/* Sticky Footer */}
          <div className="flex-shrink-0 border-t bg-white p-4 pb-12">
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Updating..." : "Update Quote"}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export default EditQuoteSheet