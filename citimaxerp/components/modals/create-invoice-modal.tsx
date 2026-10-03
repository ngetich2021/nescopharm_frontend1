"use client"

import { sizedName } from "@/lib/product-sizes"
import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Trash2, Plus, Search, Package, Wallet, CreditCard as CreditCardIcon } from "lucide-react"
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createInvoice, CreateInvoiceRequest, fetchSalesReps, SalesRep } from "@/lib/invoices"
import { getCustomers, createCustomer, fetchCustomerCreditTerms, CustomerCreditTerms, getCustomerDisplayName } from "@/lib/customers"
import { INSTANT_PAYMENT_METHODS } from "@/lib/payment-methods"
import { getProducts } from "@/lib/products"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { MappingValidationAlert } from "@/components/mapping-validation-alert"
import { CreditOveragePrompt } from "@/components/credit-overage-prompt"
import { getCreditOverage, coversOverage } from "@/lib/credit-overage"
import {
  INVOICE_TAX_OPTIONS,
  invoiceTaxCodeForProduct,
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
  due_date: z.string().optional(),
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
  generate_etims_receipt: z.boolean(),
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
).refine(
  (data) => !data.generate_etims_receipt || data.line_items.every((item) => Boolean(item.product_id)),
  {
    message: "Select a catalogue product or service for every eTIMS invoice line",
    path: ["line_items"],
  },
)

type InvoiceFormData = z.infer<typeof invoiceSchema>

interface CreateInvoiceModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateInvoiceModal({ open, onClose, onSuccess }: CreateInvoiceModalProps) {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
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
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [salesRepId, setSalesRepId] = useState<string>("")
  const [paymentOption, setPaymentOption] = useState<'instant' | 'credit'>('instant')
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [transactionRef, setTransactionRef] = useState("")
  const [creditTerms, setCreditTerms] = useState<CustomerCreditTerms | null>(null)
  const [isLoadingCreditTerms, setIsLoadingCreditTerms] = useState(false)
  const [downPaymentAmount, setDownPaymentAmount] = useState(0)
  const [downPaymentMethod, setDownPaymentMethod] = useState("")
  const [downPaymentTransactionRef, setDownPaymentTransactionRef] = useState("")
  const { toast } = useToast()
  const { companyId } = useAuth()

  useEffect(() => {
    if (open) {
      fetchSalesReps().then(setSalesReps).catch(() => setSalesReps([]))
    }
  }, [open])

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    mode: 'onChange',
    defaultValues: {
      customer_id: '',
      type: 'sales',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '', // left blank = auto-calculated from the customer's credit terms
      currency: 'KES',
      payment_terms: '',
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
      line_items: [
        {
          description: '',
          quantity: 1,
          unit: 'pcs',
          batch_number: '',
          expiry_date: '',
          unit_price: 0,
          etims_tax_type_code: 'D',
        }
      ],
      discount_enabled: false,
      discount_type: 'percentage',
      discount_value: 0,
      generate_etims_receipt: true,
    }
  })

  const watchedCustomerId = form.watch('customer_id')

  useEffect(() => {
    setDownPaymentAmount(0)
    setDownPaymentMethod("")
    setDownPaymentTransactionRef("")
    if (!watchedCustomerId) {
      setCreditTerms(null)
      return
    }
    setIsLoadingCreditTerms(true)
    fetchCustomerCreditTerms(watchedCustomerId)
      .then((terms) => {
        setCreditTerms(terms)
        // Default the payment option to whatever this customer is registered as,
        // but the user can still switch it for a one-off exception.
        setPaymentOption(terms.payment_method === 'credit' ? 'credit' : 'instant')
      })
      .catch(() => setCreditTerms(null))
      .finally(() => setIsLoadingCreditTerms(false))
  }, [watchedCustomerId])

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items"
  })

  // Load customers and products
  useEffect(() => {
    if (open) {
      loadCustomers()
      loadProducts()
    }
  }, [open])

  const loadCustomers = async () => {
    try {
      const customersData = await getCustomers()
      setCustomers(customersData || [])
    } catch (error) {
      console.error('Failed to load customers:', error)
    }
  }

  const loadProducts = async () => {
    try {
      const productsData = await getProducts(1, 200)
      setProducts(productsData.data || [])
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customerSearchTerm === "" ||
      customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(customerSearchTerm.toLowerCase())

    return matchesSearch
  })

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
    : products.filter(product => {
        const matchesSearch = productSearchTerm === "" ||
          product.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          product.sku?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          product.description?.toLowerCase().includes(productSearchTerm.toLowerCase())

        return matchesSearch
      })

  // Calculate line totals and invoice totals
  const watchedLineItems = form.watch('line_items')
  
  const calculateLineTotal = (item: any) => {
    if (!item) return 0
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unit_price) || 0
    return quantity * unitPrice
  }

  const discountEnabled = form.watch('discount_enabled') || false
  const discountType = form.watch('discount_type') || 'percentage'
  const discountValue = form.watch('discount_value') || 0
  
  const invoiceTotals = watchedLineItems.reduce((acc, item) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unit_price) || 0
    const lineSubtotal = quantity * unitPrice
    
    return {
      subtotal: acc.subtotal + Math.max(0, lineSubtotal),
    }
  }, { subtotal: 0 })

  // Calculate discount amount based on type - only if discount is enabled
  const discountAmount = discountEnabled 
    ? (discountType === 'percentage' 
        ? (discountValue / 100) * invoiceTotals.subtotal
        : Math.min(discountValue, invoiceTotals.subtotal)) // Don't allow discount to exceed subtotal
    : 0
  
  const subtotalAfterDiscount = invoiceTotals.subtotal - discountAmount
  
  // Tax is selected once per line and calculated after that line's share of
  // the invoice discount. This mirrors the backend InvoiceLineItem calculation.
  const taxAmount = watchedLineItems.reduce((sum, item) => {
    const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
    const lineDiscount = invoiceTotals.subtotal > 0
      ? (lineSubtotal / invoiceTotals.subtotal) * discountAmount
      : 0
    const taxableAmount = Math.max(0, lineSubtotal - lineDiscount)
    return sum + taxableAmount * (invoiceTaxRate(item.etims_tax_type_code) / 100)
  }, 0)
  const finalTotal = subtotalAfterDiscount + taxAmount

  const finalInvoiceTotals = {
    subtotal: invoiceTotals.subtotal,
    discountAmount: discountAmount,
    taxAmount: taxAmount,
    total: finalTotal,
  }

  const creditOverage = paymentOption === 'credit' && creditTerms?.credit_days
    ? getCreditOverage(finalInvoiceTotals.total, creditTerms.available_credit)
    : 0

  const onSubmit: SubmitHandler<InvoiceFormData> = async (data) => {
    if (paymentOption === 'instant' && !paymentMethod) {
      toast({
        title: "Error",
        description: "Select how the payment was received (cash, M-Pesa, bank, etc.)",
        variant: "destructive",
      })
      return
    }

    if (paymentOption === 'credit' && !creditTerms?.credit_days) {
      toast({
        title: "Error",
        description: "This customer has no GM-approved credit terms. Get credit terms approved, or switch to instant payment.",
        variant: "destructive",
      })
      return
    }

    if (creditOverage > 0 && (!coversOverage(downPaymentAmount, creditOverage) || !downPaymentMethod)) {
      toast({
        title: "Error",
        description: `This exceeds available credit by KES ${creditOverage.toLocaleString()}. Enter how that amount will be paid now to proceed.`,
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)

      // Calculate proportional discount for each line item
      const subtotal = data.line_items.reduce((sum, item) => {
        return sum + (Number(item.quantity) * Number(item.unit_price))
      }, 0)
      
      // Calculate total discount amount
      const totalDiscountAmount = data.discount_enabled 
        ? (data.discount_type === 'percentage' 
            ? (data.discount_value / 100) * subtotal
            : Math.min(data.discount_value, subtotal))
        : 0
      
      // Add tax rate and proportional discount amount to each line item
      const lineItemsWithCalculations = data.line_items.map(item => {
        const lineSubtotal = Number(item.quantity) * Number(item.unit_price)
        
        // Calculate proportional discount for this line item
        const lineDiscountAmount = subtotal > 0 
          ? (lineSubtotal / subtotal) * totalDiscountAmount 
          : 0
        
        return {
          ...item,
          tax_rate: invoiceTaxRate(item.etims_tax_type_code),
          etims_tax_type_code: item.etims_tax_type_code ?? 'D',
          discount_amount: lineDiscountAmount
        }
      })
      
      const invoiceData = {
        customer_id: data.customer_id,
        sales_rep_id: salesRepId || undefined,
        payment_option: paymentOption,
        payment_method: paymentOption === 'instant' ? paymentMethod : undefined,
        transaction_id: paymentOption === 'instant' ? (transactionRef || undefined) : undefined,
        down_payment_amount: paymentOption === 'credit' && creditOverage > 0 ? downPaymentAmount : undefined,
        down_payment_method: paymentOption === 'credit' && creditOverage > 0 ? downPaymentMethod : undefined,
        down_payment_transaction_id: paymentOption === 'credit' && creditOverage > 0 ? (downPaymentTransactionRef || undefined) : undefined,
        type: data.type,
        invoice_date: data.invoice_date,
        // Left blank: the backend auto-calculates due_date from the customer's credit terms
        due_date: paymentOption === 'credit' ? (data.due_date || undefined) : undefined,
        currency: data.currency,
        payment_terms: paymentOption === 'credit' ? (data.payment_terms || undefined) : undefined,
        notes: data.notes,
        terms_and_conditions: data.terms_and_conditions,
        generate_etims_receipt: data.generate_etims_receipt,
        line_items: lineItemsWithCalculations
      }
      
      const newInvoice = await createInvoice(invoiceData as CreateInvoiceRequest)
      
      toast({
        title: "Success",
        description: "Invoice created successfully",
      })
      
      // Dispatch event for automatic cache refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('invoice-created', { 
          detail: { invoiceId: newInvoice?.id, timestamp: Date.now() } 
        }))
      }
      
      // Also invalidate the invoices cache directly
      const { invalidateCacheKey } = await import('@/lib/data-cache')
      invalidateCacheKey('invoices')
      
      form.reset()
      setSalesRepId("")
      setPaymentOption('instant')
      setPaymentMethod("")
      setTransactionRef("")
      setCreditTerms(null)
      setDownPaymentAmount(0)
      setDownPaymentMethod("")
      setDownPaymentTransactionRef("")
      onSuccess()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

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

  const removeLineItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const addProductToLineItem = (index: number, product: any, variant?: any) => {
    const currentItem = form.getValues(`line_items.${index}`)
    
    // Create description with product name and description if it exists
    let description = product.name
    if (variant) {
      description = sizedName(product.name, variant.name)
      if (product.description) {
        description += `\n${product.description}`
      }
    } else if (product.description) {
      description += `\n${product.description}`
    }
    
    form.setValue(`line_items.${index}`, {
      ...currentItem,
      product_id: product.id,
      variant_id: variant?.id,
      description: description,
      // Sizes share the item's price.
      unit_price: parseFloat(product.price || "0"),
      unit: product.unit || 'pcs',
      etims_tax_type_code: invoiceTaxCodeForProduct(product),
    })
    setShowProductSearch(null)
    setProductSearchTerm("")
  }

  // Create new customer
  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim() || !companyId) {
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
        notes: null,
        // company_id is intentionally omitted - will be handled by the backend
      };

      const newCustomer = await createCustomer(customerData as any)

      // Refresh customers list
      await loadCustomers()
      
      // Select the new customer
      form.setValue('customer_id', newCustomer.id)
      
      // Reset create customer form
      setNewCustomerName("")
      setNewCustomerEmail("")
      setNewCustomerPhone("")
      setShowCreateCustomer(false)
      setShowCustomerSearch(false)
      setCustomerSearchTerm("")

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

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="!w-[60vw] !min-w-[60vw] !max-w-[60vw] overflow-y-auto flex flex-col h-full">
        <SheetHeader className="flex-shrink-0 pb-4 border-b">
          <SheetTitle>Create New Invoice</SheetTitle>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit as any)} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto py-4 pb-20 space-y-6">
            {/* Mapping Validation Alert */}
            <MappingValidationAlert companyId={companyId ?? undefined} />
            
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
                  <Label htmlFor="sales_rep_id">Sales Rep</Label>
                  <Select
                    value={salesRepId || "none"}
                    onValueChange={(value) => setSalesRepId(value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {salesReps.map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>
                          {rep.full_name || `${rep.first_name} ${rep.last_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* How is this being paid? */}
              <div className="space-y-3 rounded-lg border p-4">
                <Label>How is this being paid? *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentOption('instant')}
                    className={`flex items-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors ${
                      paymentOption === 'instant'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Wallet className="h-4 w-4" />
                    Instant Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentOption('credit')}
                    className={`flex items-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors ${
                      paymentOption === 'credit'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCardIcon className="h-4 w-4" />
                    Credit
                  </button>
                </div>

                {paymentOption === 'instant' ? (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-2">
                      <Label htmlFor="payment_method">Payment Method *</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue placeholder="How was it paid?" />
                        </SelectTrigger>
                        <SelectContent>
                          {INSTANT_PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transaction_ref">Reference (optional)</Label>
                      <Input
                        id="transaction_ref"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        placeholder="M-Pesa code, bank ref, etc."
                      />
                    </div>
                    <p className="col-span-2 text-xs text-muted-foreground">
                      The invoice will be created and marked paid immediately. Paying by cheque?
                      Create it on credit instead, then record the cheque from the invoice — it stays pending until it clears.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {isLoadingCreditTerms ? (
                      <p className="text-sm text-muted-foreground">Loading customer's credit terms...</p>
                    ) : !watchedCustomerId ? (
                      <p className="text-sm text-muted-foreground">Select a customer to see their credit terms.</p>
                    ) : creditTerms?.credit_days ? (
                      <div className="rounded-md bg-purple-50 border border-purple-200 p-3 text-sm">
                        <p className="font-medium text-purple-900">
                          Approved terms: Net {creditTerms.credit_days} ({creditTerms.credit_days} days)
                        </p>
                        {creditTerms.available_credit != null && (
                          <p className="text-purple-700">Available credit: KES {Number(creditTerms.available_credit).toLocaleString()}</p>
                        )}
                        {creditTerms.has_pending_change && (
                          <p className="text-amber-700 mt-1">Note: a terms change is pending GM approval and not yet in effect.</p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                        No GM-approved credit terms on file for this customer. Get credit terms approved, or
                        switch to instant payment, before this invoice can be created.
                      </div>
                    )}

                    {creditOverage > 0 && (
                      <CreditOveragePrompt
                        overage={creditOverage}
                        downPaymentAmount={downPaymentAmount}
                        onDownPaymentAmountChange={setDownPaymentAmount}
                        downPaymentMethod={downPaymentMethod}
                        onDownPaymentMethodChange={setDownPaymentMethod}
                        downPaymentTransactionRef={downPaymentTransactionRef}
                        onDownPaymentTransactionRefChange={setDownPaymentTransactionRef}
                      />
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="due_date">Due Date Override</Label>
                        <Input type="date" {...form.register('due_date')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment_terms">Payment Terms Override</Label>
                        <Input
                          {...form.register('payment_terms')}
                          placeholder={creditTerms?.credit_days ? `Net ${creditTerms.credit_days}` : "Net 30"}
                        />
                      </div>
                    </div>
                  </div>
                )}
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
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Reference &amp; dispatch details (delivery note, dispatch doc, destination, etc.) are filled automatically by the system.
          </p>

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
                                                <div className="font-medium">{sizedName(product.name, variant.name)}</div>
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
                    </div>
                    
                    {/* Unit */}
                    <div className="col-span-1">
                      <Label className="text-xs font-medium">Unit</Label>
                      <Input
                        placeholder="pcs"
                        {...form.register(`line_items.${index}.unit`)}
                        className="h-8 text-sm mt-1"
                      />
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
                    </div>
                    
                    {/* Line subtotal */}
                    <div className="col-span-2">
                      <Label className="text-xs font-medium">Subtotal</Label>
                      <div className="h-8 px-2 bg-gray-50 rounded text-xs font-medium flex items-center mt-1">
                        {formatCurrency(calculateLineTotal(form.watch(`line_items.${index}`)))}
                      </div>
                    </div>
                    
                    {/* Remove button */}
                    <div className="col-span-1 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLineItem(index)}
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
            </CardContent>
          </Card>

          {/* Invoice Totals */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - eTIMS and discount controls */}
                <div className="space-y-6">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Label htmlFor="generate_etims_receipt">Generate eTIMS receipt</Label>
                        <p className="mt-1 text-xs text-emerald-900/70">
                          Submit through DigiTax when the invoice is sent. Every line must use a catalogue item.
                        </p>
                      </div>
                      <Switch
                        id="generate_etims_receipt"
                        checked={form.watch("generate_etims_receipt")}
                        onCheckedChange={(checked) => form.setValue("generate_etims_receipt", checked, { shouldValidate: true })}
                      />
                    </div>
                  </div>

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
                          Discount Amount: <span className="font-medium text-green-600">-{formatCurrency(finalInvoiceTotals.discountAmount)}</span>
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
                      <span>{formatCurrency(finalInvoiceTotals.subtotal)}</span>
                    </div>
                    {form.watch("discount_enabled") && finalInvoiceTotals.discountAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>
                          Discount {discountType === 'percentage' ? `(${discountValue}%)` : ''}:
                        </span>
                        <span>-{formatCurrency(finalInvoiceTotals.discountAmount)}</span>
                      </div>
                    )}
                    {finalInvoiceTotals.taxAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Tax:</span>
                        <span>{formatCurrency(finalInvoiceTotals.taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(finalInvoiceTotals.total)}</span>
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
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  (paymentOption === 'credit' && !creditTerms?.credit_days) ||
                  (creditOverage > 0 && (!coversOverage(downPaymentAmount, creditOverage) || !downPaymentMethod))
                }
              >
                {isLoading ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
