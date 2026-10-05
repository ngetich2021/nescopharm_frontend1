"use client"

import { sizedName } from "@/lib/product-sizes"
import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Search, ArrowLeft, Save } from "lucide-react"
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { updateQuote, deleteEmptiedQuote, Quote } from "@/lib/quotes"
import { getCustomers, createCustomer, getCustomerDisplayName } from "@/lib/customers"
import { getProducts } from "@/lib/products"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { QuoteLineItemsTable } from "./QuoteLineItemsTable"

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
  // Unit of measure of the chosen price, e.g. "Box of 100".
  price_unit: z.string().optional().nullable(),
})

const quoteSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  valid_until: z.string().min(1, "Valid until date is required"),
  currency: z.string().min(1, "Currency is required"),
  notes: z.string().optional(),
  status: z.enum(["pending", "accepted", "rejected", "expired"]),
  // Saving with no items deletes the quote (see onSubmit).
  items: z.array(lineItemSchema),
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
      items: [{ product_id: '', description: '', quantity: 1, unit_price: 0, price_label: null, price_unit: null }],
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
          description: item.product ? sizedName(item.product?.name, (item as any).variant?.name || (item as any).variant_name) : "Unknown Product",
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          price_label: item.price_label || null,
          price_unit: item.price_unit || null,
        })) || [{ product_id: '', description: '', quantity: 1, unit_price: 0, price_label: null, price_unit: null }],
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

  const addLineItem = () => {
    append({
      product_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      price_label: null,
      price_unit: null,
    })
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
        const label = quote.quote_number || "This quote"
        if (!window.confirm(`${label} has no items left. Saving will delete the quote. Continue?`)) {
          return
        }
        await deleteEmptiedQuote(quote.id)
        toast({ title: "Quote deleted", description: `${label} had no items and was deleted.` })
        onSuccess?.()
        onClose()
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
          price_unit: item.price_unit || null,
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
                    // useFieldArray keeps array-level errors (e.g. "at least one item") under .root
                    const itemsMessage = field === 'items' ? error?.message || error?.root?.message : null
                    if (itemsMessage) {
                      return <li key={field}>• {itemsMessage}</li>
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
                <QuoteLineItemsTable form={form} fields={fields} remove={remove} products={products} />

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