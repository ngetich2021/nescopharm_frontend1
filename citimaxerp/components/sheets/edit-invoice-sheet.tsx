"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Trash2, Plus, Search, Package, ArrowLeft, Save } from "lucide-react"
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { fetchInvoiceById, updateInvoice, Invoice, CreateInvoiceRequest } from "@/lib/invoices"
import { getCustomers, createCustomer, getCustomerDisplayName } from "@/lib/customers"
import { getProducts } from "@/lib/products"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import {
  INVOICE_TAX_OPTIONS,
  invoiceTaxCodeForProduct,
  invoiceTaxCodeFromRate,
  invoiceTaxRate,
  type InvoiceTaxCode,
} from "@/lib/invoice-tax"

const lineItemSchema = z.object({
  product_id: z.string().optional(),
  variant_id: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be at least 0.01"),
  unit: z.string().min(1, "Unit is required"),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
  unit_price: z.number().min(0, "Unit price must be non-negative"),
  etims_tax_type_code: z.enum(['A', 'B', 'C', 'D', 'E']),
})

const invoiceSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  type: z.enum(['sales', 'service', 'recurring']),
  invoice_date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().min(1, "Due date is required"),
  currency: z.string().min(1, "Currency is required"),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  terms_and_conditions: z.string().optional(),
  delivery_note_number: z.string().optional(),
  delivery_note_date: z.string().optional(),
  reference_number: z.string().optional(),
  reference_date: z.string().optional(),
  other_references: z.string().optional(),
  buyers_order_no: z.string().optional(),
  buyers_order_date: z.string().optional(),
  dispatch_doc_no: z.string().optional(),
  dispatched_through: z.string().optional(),
  destination: z.string().optional(),
  terms_of_delivery: z.string().optional(),
  mode_of_payment: z.string().optional(),
  discount_enabled: z.boolean(),
  discount_type: z.enum(['percentage', 'amount']),
  discount_value: z.number().min(0, "Discount must be non-negative"),
  line_items: z.array(lineItemSchema).min(1, "At least one line item is required"),
}).refine(
  (data) => {
    if (data.discount_enabled && data.discount_type === 'percentage') {
      return data.discount_value <= 100
    }
    return true // For amount type, we'll validate against subtotal in the calculation
  },
  {
    message: "Percentage discount cannot exceed 100%",
    path: ["discount_value"],
  }
)

type InvoiceFormData = z.infer<typeof invoiceSchema>

interface EditInvoiceSheetProps {
  open: boolean
  onClose: () => void
  invoiceId: string
  onSuccess?: () => void
}

export function EditInvoiceSheet({ open, onClose, invoiceId, onSuccess }: EditInvoiceSheetProps) {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [productSearchResults, setProductSearchResults] = useState<any[] | null>(null)
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState<number | null>(null)
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash')
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerEmail, setNewCustomerEmail] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const { toast } = useToast()
  const { companyId, isLoading: authLoading, user } = useAuth()
  const router = useRouter()

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    mode: 'onChange',
    defaultValues: {
      customer_id: '',
      type: 'sales',
      invoice_date: '',
      due_date: '',
      currency: 'KES',
      payment_terms: 'Net 30',
      notes: '',
      terms_and_conditions: 'Standard terms and conditions apply',
      delivery_note_number: '',
      delivery_note_date: '',
      reference_number: '',
      reference_date: '',
      other_references: '',
      buyers_order_no: '',
      buyers_order_date: '',
      dispatch_doc_no: '',
      dispatched_through: '',
      destination: '',
      terms_of_delivery: '',
      mode_of_payment: '',
      line_items: [],
      discount_enabled: false,
      discount_type: 'percentage',
      discount_value: 0,
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items"
  })

  // Load invoice data when sheet opens
  useEffect(() => {
    if (open && invoiceId && !authLoading && user) {
      // Add a small delay to ensure auth is fully ready
      setTimeout(() => {
        loadInvoice()
        loadCustomers()
        loadProducts()
      }, 100)
    }
  }, [open, invoiceId, authLoading, user])

  const loadInvoice = async () => {
    try {
      // Ensure user exists before proceeding
      if (!user) {
        throw new Error('User authentication required. Please sign in.')
      }
      
      setIsLoading(true)
      const invoiceData = await fetchInvoiceById(invoiceId)
      setInvoice(invoiceData)
      setPaymentType(invoiceData.payment_type === 'credit' ? 'credit' : 'cash')

      // Check if invoice can be edited (only draft invoices)
      if (invoiceData.status !== 'draft') {
        toast({
          title: "Cannot Edit Invoice",
          description: "Only draft invoices can be edited. This invoice has already been sent.",
          variant: "destructive",
        })
        onClose()
        return
      }

      // Populate form with invoice data
      const formData: InvoiceFormData = {
        customer_id: invoiceData.customer_id,
        type: invoiceData.type as 'sales' | 'service' | 'recurring',
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date,
        currency: invoiceData.currency,
        payment_terms: invoiceData.payment_terms || 'Net 30',
        notes: invoiceData.notes || '',
        terms_and_conditions: invoiceData.terms_and_conditions || '',
        delivery_note_number: invoiceData.delivery_note_number || '',
        delivery_note_date: invoiceData.delivery_note_date || '',
        reference_number: invoiceData.reference_number || '',
        reference_date: invoiceData.reference_date || '',
        other_references: invoiceData.other_references || '',
        buyers_order_no: invoiceData.buyers_order_no || '',
        buyers_order_date: invoiceData.buyers_order_date || '',
        dispatch_doc_no: invoiceData.dispatch_doc_no || '',
        dispatched_through: invoiceData.dispatched_through || '',
        destination: invoiceData.destination || '',
        terms_of_delivery: invoiceData.terms_of_delivery || '',
        mode_of_payment: invoiceData.mode_of_payment || '',
        line_items: invoiceData.line_items?.map(item => ({
          product_id: item.product_id || '',
          variant_id: item.variant_id || '',
          description: item.description,
          quantity: Number(item.quantity),
          unit: item.unit,
          batch_number: item.batch_number || '',
          expiry_date: item.expiry_date || '',
          unit_price: Number(item.unit_price),
          etims_tax_type_code: item.etims_tax_type_code
            ?? item.metadata?.etims_tax_type_code
            ?? invoiceTaxCodeFromRate(item.tax_rate),
        })) || [],
        discount_enabled: Number(invoiceData.discount_amount || 0) > 0,
        discount_type: 'amount' as 'percentage' | 'amount', // Default to amount since we have the exact discount
        discount_value: Number(invoiceData.discount_amount || 0),
      }

      form.reset(formData)
    } catch (error: any) {
      let errorMessage = "Failed to load invoice"
      
      if (error.message?.includes('not logged in') || error.message?.includes('Unauthorized')) {
        errorMessage = "Please sign in to access this page."
        return
      } else if (error.message?.includes('404') || error.message?.includes('not found')) {
        errorMessage = "Invoice not found or you don't have permission to view it."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  const loadCustomers = async () => {
    try {
      const customersData = await getCustomers()
      setCustomers(customersData || [])
    } catch (error: any) {
      // Silently handle customer loading errors
    }
  }

  const loadProducts = async () => {
    try {
      const productsData = await getProducts(1, 200)
      setProducts(productsData?.data || [])
    } catch (error: any) {
      // Silently handle product loading errors
    }
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(customerSearchTerm.toLowerCase())
  )

  // Search products server-side once the query is long enough, so results aren't
  // limited to whatever happened to load in the initial page of products.
  useEffect(() => {
    if (!open) return
    const term = productSearchTerm.trim()
    if (term.length < 2) {
      setProductSearchResults(null)
      return
    }
    setIsSearchingProducts(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await getProducts(1, 50, { search: term })
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

  // Below the search threshold, fall back to filtering the initially loaded page.
  const filteredProducts = productSearchResults !== null
    ? productSearchResults
    : products.filter(product =>
        product.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(productSearchTerm.toLowerCase())
      )

  const addLineItem = () => {
    append({
      description: '',
      quantity: 1,
      unit: 'pcs',
      batch_number: '',
      expiry_date: '',
      unit_price: 0,
      etims_tax_type_code: 'D',
    })
  }

  const addProductToLineItem = (index: number, product: any, variant?: any) => {
    const item = variant || product
    form.setValue(`line_items.${index}.product_id`, product.id)
    if (variant) {
      form.setValue(`line_items.${index}.variant_id`, variant.id)
      form.setValue(`line_items.${index}.description`, `${product.name} - ${variant.name}`)
    } else {
      form.setValue(`line_items.${index}.description`, product.name)
    }
    form.setValue(`line_items.${index}.unit_price`, parseFloat(item.price || "0"))
    form.setValue(`line_items.${index}.etims_tax_type_code`, invoiceTaxCodeForProduct(product))
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
      setIsLoading(true)
      // Prepare customer data without company_id - it will be handled by the backend
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
        // These fields are no longer collected via form, assuming backend handles defaults or they are not required
        first_name: newCustomerName.split(" ")[0] || "", // Derive first_name from name
        last_name: newCustomerName.split(" ").slice(1).join(" ") || "", // Derive last_name from name
        tags: [],
        // company_id is intentionally omitted - will be handled by the backend
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
      setIsLoading(false)
    }
  }

  // Calculate totals
  const invoiceTotals = {
    subtotal: fields.reduce((sum, _, index) => {
      const quantity = Number(form.watch(`line_items.${index}.quantity`)) || 0
      const unitPrice = Number(form.watch(`line_items.${index}.unit_price`)) || 0
      return sum + (quantity * unitPrice)
    }, 0)
  }

  const discountEnabled = form.watch('discount_enabled')
  const discountType = form.watch('discount_type')
  const discountValue = form.watch('discount_value') || 0

  const discountAmount = discountEnabled
    ? (discountType === 'percentage' 
        ? (discountValue / 100) * invoiceTotals.subtotal 
        : Math.min(discountValue, invoiceTotals.subtotal))
    : 0
  
  const subtotalAfterDiscount = invoiceTotals.subtotal - discountAmount
  const taxAmount = fields.reduce((sum, _, index) => {
    const item = form.watch(`line_items.${index}`)
    const lineSubtotal = (Number(item?.quantity) || 0) * (Number(item?.unit_price) || 0)
    const lineDiscount = invoiceTotals.subtotal > 0
      ? (lineSubtotal / invoiceTotals.subtotal) * discountAmount
      : 0
    const taxableAmount = Math.max(0, lineSubtotal - lineDiscount)
    return sum + taxableAmount * (invoiceTaxRate(item?.etims_tax_type_code) / 100)
  }, 0)
  const total = subtotalAfterDiscount + taxAmount

  const onSubmit: SubmitHandler<InvoiceFormData> = async (data) => {
    if (!invoice) {
      toast({
        title: "Error",
        description: "No invoice data available for update",
        variant: "destructive",
      })
      return
    }
    
    try {
      setIsSaving(true)
      
      // Calculate proportional discount for each line item (same logic as create modal)
      const subtotal = data.line_items.reduce((sum, item) => {
        return sum + (Number(item.quantity) * Number(item.unit_price))
      }, 0)
      
      // Calculate total discount amount
      const totalDiscountAmount = data.discount_enabled 
        ? (data.discount_type === 'percentage' 
            ? (data.discount_value / 100) * subtotal
            : Math.min(data.discount_value, subtotal))
        : 0
      
      // Transform form data to API format
      const updateData: Partial<CreateInvoiceRequest> = {
        customer_id: data.customer_id,
        type: data.type,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        currency: data.currency,
        payment_terms: data.payment_terms,
        payment_type: paymentType,
        notes: data.notes,
        terms_and_conditions: data.terms_and_conditions,
        delivery_note_number: data.delivery_note_number || undefined,
        delivery_note_date: data.delivery_note_date || undefined,
        reference_number: data.reference_number || undefined,
        reference_date: data.reference_date || undefined,
        other_references: data.other_references || undefined,
        buyers_order_no: data.buyers_order_no || undefined,
        buyers_order_date: data.buyers_order_date || undefined,
        dispatch_doc_no: data.dispatch_doc_no || undefined,
        dispatched_through: data.dispatched_through || undefined,
        destination: data.destination || undefined,
        terms_of_delivery: data.terms_of_delivery || undefined,
        mode_of_payment: data.mode_of_payment || undefined,
        line_items: data.line_items.map(item => {
          const lineSubtotal = Number(item.quantity) * Number(item.unit_price)
          
          // Calculate proportional discount for this line item
          const lineDiscountAmount = subtotal > 0 
            ? (lineSubtotal / subtotal) * totalDiscountAmount 
            : 0
          
          return {
            product_id: item.product_id || undefined,
            variant_id: item.variant_id || undefined,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            batch_number: item.batch_number || undefined,
            expiry_date: item.expiry_date || undefined,
            unit_price: item.unit_price,
            discount_amount: lineDiscountAmount,
            tax_rate: invoiceTaxRate(item.etims_tax_type_code),
            etims_tax_type_code: item.etims_tax_type_code,
          }
        })
      }
      
      const updatedInvoice = await updateInvoice(invoice.id, updateData)
      
      toast({
        title: "Success",
        description: "Invoice updated successfully",
      })
      
      // Trigger cache invalidation for invoices using event system
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('invoice-updated', { 
          detail: { invoiceId: invoice.id, timestamp: Date.now() } 
        }))
      }
      
      // Also invalidate the invoices cache directly
      const { invalidateCacheKey } = await import('@/lib/data-cache')
      invalidateCacheKey('invoices')
      
      onSuccess?.()
      onClose()
      router.push(`/sales/invoices/${invoice.id}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice",
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

  // Guard against rendering when user is not authenticated
  if (authLoading) {
    return (
      <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="!w-[60vw] !min-w-[60vw] !max-w-[60vw] overflow-y-auto flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading authentication...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  if (!user) {
    return (
      <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="!w-[60vw] !min-w-[60vw] !max-w-[60vw] overflow-y-auto flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p>Authentication required. Please sign in.</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="!w-[60vw] !min-w-[60vw] !max-w-[60vw] overflow-y-auto flex flex-col h-full">
        <SheetHeader className="flex-shrink-0 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            Edit Invoice {invoice?.invoice_number}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading invoice...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto py-4 pb-20 space-y-6">
              {/* Form validation errors */}
              {Object.keys(form.formState.errors).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {Object.entries(form.formState.errors).map(([field, error]) => (
                      <li key={field}>
                        • {field.replace('_', ' ')}: {error?.message || 'Invalid value'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Basic Invoice Information */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-4">
                  {/* Customer and Payment Terms Row */}
                  <div className="grid grid-cols-2 gap-3">
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
                                  disabled={!newCustomerName.trim() || isLoading}
                                  className="flex-1"
                                >
                                  {isLoading ? "Creating..." : "Create"}
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
                      <Label htmlFor="payment_terms">Payment Terms</Label>
                      <Select 
                        value={form.watch('payment_terms') || ''}
                        onValueChange={(value) => form.setValue('payment_terms', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment terms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 45">Net 45</SelectItem>
                          <SelectItem value="Net 60">Net 60</SelectItem>
                          <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                          <SelectItem value="Due end of the month">Due end of the month</SelectItem>
                          <SelectItem value="Due end of next month">Due end of next month</SelectItem>
                          <SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentType('cash')}
                        className={`flex items-center justify-center gap-2 rounded-md border p-2 text-sm font-medium transition-colors ${
                          paymentType === 'cash'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType('credit')}
                        className={`flex items-center justify-center gap-2 rounded-md border p-2 text-sm font-medium transition-colors ${
                          paymentType === 'credit'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Credit
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="type">Invoice Type</Label>
                      <Select 
                        value={form.watch('type')} 
                        onValueChange={(value: 'sales' | 'service' | 'recurring') => form.setValue('type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                          <SelectItem value="recurring">Recurring</SelectItem>
                        </SelectContent>
                      </Select>
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
                        <Label htmlFor="invoice_date">Invoice Date</Label>
                        <Input
                          type="date"
                          {...form.register('invoice_date')}
                        />
                        {form.formState.errors.invoice_date && (
                          <p className="text-sm text-red-600">{form.formState.errors.invoice_date.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="due_date">Due Date</Label>
                        <Input
                          type="date"
                          {...form.register('due_date')}
                        />
                        {form.formState.errors.due_date && (
                          <p className="text-sm text-red-600">{form.formState.errors.due_date.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reference & Dispatch Details - all optional, printed on the invoice document */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Reference &amp; Dispatch Details (optional)</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Delivery Note No.</Label>
                    <Input {...form.register('delivery_note_number')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Delivery Note Date</Label>
                    <Input type="date" {...form.register('delivery_note_date')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Mode/Terms of Payment</Label>
                    <Input {...form.register('mode_of_payment')} placeholder="e.g. Cash On Delivery" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Reference No.</Label>
                    <Input {...form.register('reference_number')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Reference Date</Label>
                    <Input type="date" {...form.register('reference_date')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Other References</Label>
                    <Input {...form.register('other_references')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Buyer's Order No.</Label>
                    <Input {...form.register('buyers_order_no')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Buyer's Order Date</Label>
                    <Input type="date" {...form.register('buyers_order_date')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Dispatch Doc No.</Label>
                    <Input {...form.register('dispatch_doc_no')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Dispatched Through</Label>
                    <Input {...form.register('dispatched_through')} placeholder="e.g. Local Riders" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Destination</Label>
                    <Input {...form.register('destination')} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Terms of Delivery</Label>
                    <Input {...form.register('terms_of_delivery')} className="h-8 text-sm" />
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle>Line Items</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-3 space-y-3">
                      {/* Single row layout for line item */}
                      <div className="grid grid-cols-12 gap-3 items-start">
                        {/* Description column - takes more space */}
                        <div className="col-span-5">
                          <Label className="text-xs font-medium">Description</Label>
                          <div className="space-y-2 mt-1">
                            <div className="flex gap-2">
                              <Textarea
                                placeholder="Item description"
                                {...form.register(`line_items.${index}.description`)}
                                className="flex-1 min-h-[60px] text-sm"
                                rows={2}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowProductSearch(showProductSearch === index ? null : index)}
                                className="h-auto px-2"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                            {form.formState.errors.line_items?.[index]?.description && (
                              <p className="text-xs text-red-600">{form.formState.errors.line_items[index]?.description?.message}</p>
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
                                        <div
                                          className="p-3 hover:bg-gray-50 cursor-pointer border-b"
                                          onClick={() => addProductToLineItem(index, product)}
                                        >
                                          <div className="flex items-start gap-3">
                                            <Package className="h-5 w-5 text-gray-400 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-sm">{product.name}</div>
                                              {product.description && (
                                                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                                  {product.description}
                                                </div>
                                              )}
                                              <div className="text-xs text-gray-500 mt-1">
                                                SKU: {product.sku || 'N/A'} | Price: {formatCurrency(product.price || 0)}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Product Variants */}
                                        {product.variants && product.variants.length > 0 && (
                                          <div className="ml-8 border-l-2 border-gray-100">
                                            {product.variants.map((variant: any) => (
                                              <div
                                                key={variant.id}
                                                className="p-2 hover:bg-gray-50 cursor-pointer text-sm border-b"
                                                onClick={() => addProductToLineItem(index, product, variant)}
                                              >
                                                <div className="flex items-start gap-2">
                                                  <div className="w-3 h-3 bg-gray-300 rounded-full mt-1"></div>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-medium">{variant.name}</div>
                                                    {variant.description && (
                                                      <div className="text-xs text-gray-600 mt-1">
                                                        {variant.description}
                                                      </div>
                                                    )}
                                                    <div className="text-xs text-gray-500 mt-1">
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
                        <div className="col-span-1">
                          <Label className="text-xs font-medium">Qty</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            {...form.register(`line_items.${index}.quantity`, { valueAsNumber: true })}
                            className="h-8 text-sm mt-1"
                          />
                          {form.formState.errors.line_items?.[index]?.quantity && (
                            <p className="text-xs text-red-600 mt-1">{form.formState.errors.line_items[index]?.quantity?.message}</p>
                          )}
                        </div>
                        
                        {/* Unit */}
                        <div className="col-span-1">
                          <Label className="text-xs font-medium">Unit</Label>
                          <Input
                            placeholder="pcs"
                            {...form.register(`line_items.${index}.unit`)}
                            className="h-8 text-sm mt-1"
                          />
                          {form.formState.errors.line_items?.[index]?.unit && (
                            <p className="text-xs text-red-600 mt-1">{form.formState.errors.line_items[index]?.unit?.message}</p>
                          )}
                        </div>
                        
                        {/* Unit Price */}
                        <div className="col-span-2">
                          <Label className="text-xs font-medium">Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...form.register(`line_items.${index}.unit_price`, { valueAsNumber: true })}
                            className="h-8 text-sm mt-1"
                          />
                          {form.formState.errors.line_items?.[index]?.unit_price && (
                            <p className="text-xs text-red-600 mt-1">{form.formState.errors.line_items[index]?.unit_price?.message}</p>
                          )}
                        </div>
                        
                        {/* Line subtotal */}
                        <div className="col-span-2">
                          <Label className="text-xs font-medium">Subtotal</Label>
                          <div className="h-8 px-2 bg-gray-50 rounded text-xs font-medium flex items-center mt-1">
                            {formatCurrency(
                              (Number(form.watch(`line_items.${index}.quantity`)) || 0) * 
                              (Number(form.watch(`line_items.${index}.unit_price`)) || 0)
                            )}
                          </div>
                        </div>
                        
                        {/* Remove button */}
                        <div className="col-span-1 flex justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                            className="text-red-600 hover:text-red-700 h-8 w-8 p-0 mt-5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-3">
                          <Label className="text-xs font-medium">Batch No.</Label>
                          <Input
                            placeholder="Optional"
                            {...form.register(`line_items.${index}.batch_number`)}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs font-medium">Expiry Date</Label>
                          <Input
                            type="date"
                            {...form.register(`line_items.${index}.expiry_date`)}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-5">
                          <Label className="text-xs font-medium">Tax</Label>
                          <Select
                            value={form.watch(`line_items.${index}.etims_tax_type_code`) ?? "D"}
                            onValueChange={(value) => form.setValue(
                              `line_items.${index}.etims_tax_type_code`,
                              value as InvoiceTaxCode,
                              { shouldValidate: true },
                            )}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INVOICE_TAX_OPTIONS.map((option) => (
                                <SelectItem key={option.code} value={option.code}>
                                  {option.code} — {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="col-span-7 text-xs text-muted-foreground">
                          This is the only tax applied to this item and is also used for eTIMS.
                        </p>
                      </div>
                    </div>
                  ))}

                  {fields.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No line items added yet. Click "Add Item" to get started.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Totals */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Discount controls */}
                    <div className="space-y-6">
                      {/* Discount Settings */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={form.watch("discount_enabled") || false}
                              onCheckedChange={(checked) => {
                                form.setValue("discount_enabled", checked)
                                if (!checked) {
                                  form.setValue("discount_value", 0)
                                }
                              }}
                            />
                            <Label htmlFor="discount_enabled">Apply Discount</Label>
                          </div>
                        </div>

                        {/* Discount Controls - Only show when discount is enabled */}
                        {form.watch("discount_enabled") && (
                          <div className="grid grid-cols-1 gap-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="discount_type" className="text-sm">Discount Type</Label>
                                <Select 
                                  value={form.watch("discount_type") || "percentage"}
                                  onValueChange={(value) => form.setValue("discount_type", value as 'percentage' | 'amount')}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                                    <SelectItem value="amount">Fixed Amount</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="discount_value" className="text-sm">
                                  {discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount'}
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={discountType === 'percentage' ? "100" : undefined}
                                  {...form.register("discount_value", { valueAsNumber: true })}
                                  className="mt-1"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                            {form.formState.errors.discount_value && (
                              <p className="text-sm text-red-600">{form.formState.errors.discount_value.message}</p>
                            )}
                            <div className="text-sm text-gray-600">
                              Discount Amount: <span className="font-medium text-green-600">-{formatCurrency(discountAmount)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column - Summary */}
                    <div className="flex justify-end">
                      <div className="space-y-2 w-80">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(invoiceTotals.subtotal)}</span>
                        </div>
                        {form.watch("discount_enabled") && discountAmount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>
                              Discount {discountType === 'percentage' ? `(${discountValue}%)` : ''}:
                            </span>
                            <span>-{formatCurrency(discountAmount)}</span>
                          </div>
                        )}
                        {taxAmount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Tax:</span>
                            <span>{formatCurrency(taxAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                          <span>Total:</span>
                          <span>{formatCurrency(total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes and Terms */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    placeholder="Payment instructions or additional notes"
                    {...form.register('notes')}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms_and_conditions">Terms & Conditions</Label>
                  <Textarea
                    placeholder="Terms and conditions"
                    {...form.register('terms_and_conditions')}
                    rows={3}
                  />
                </div>
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
                  {isSaving ? "Saving..." : "Update Invoice"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
