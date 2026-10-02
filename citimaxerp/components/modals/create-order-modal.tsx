"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Plus, Search, ShoppingCart, Trash2, X, Wallet, CreditCard as CreditCardIcon } from "lucide-react"
import { DEFAULT_PRICE_CODE, priceOptionsFor } from "@/lib/price-codes"
import { getCreditOverage, coversOverage } from "@/lib/credit-overage"
import { createPayment } from "@/lib/payments"
import { orderTotals, vatRateForProduct } from "@/lib/invoice-tax"
import { CreditOveragePrompt } from "@/components/credit-overage-prompt"
import { InstantPaymentPrompt } from "@/components/instant-payment-prompt"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import apiCall from "@/lib/api"
import { Product, ProductVariant, getProducts } from "@/lib/products"
import { getCustomers, Customer as LibCustomer, createCustomer, fetchCustomerCreditTerms, CustomerCreditTerms, getCustomerDisplayName } from "@/lib/customers"
import { formatPackagingForDisplay } from "@/lib/packaging-utils"
import { fetchSalesReps, SalesRep } from "@/lib/invoices"

type Customer = LibCustomer

type OrderItem = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  variant_id?: string
  tax_rate: number
  tax_amount: number
  // Which named product price tier (e.g. "Hospital Price") this line's price
  // came from, or "Custom" if hand-typed - internal-only, never printed on
  // a customer-facing order document.
  price_label?: string | null
}

type Company = { id: string; name: string }

type ProductWithVariants = Product & { variants?: ProductVariant[] }

export function CreateOrderModal({ 
  children, 
  onOrderCreated 
}: { 
  children: React.ReactNode
  onOrderCreated?: () => void 
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("existing")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [searchResults, setSearchResults] = useState<ProductWithVariants[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [notes, setNotes] = useState("")
  // Global tax state removed in favor of per-product tax
  // const [includeTax, setIncludeTax] = useState(true)
  // const [taxRate, setTaxRate] = useState(16)
  const [searchQuery, setSearchQuery] = useState("")
  const [productSearchQuery, setProductSearchQuery] = useState("")
  const [openProductDropdown, setOpenProductDropdown] = useState(false)

  // New customer form state
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerEmail, setNewCustomerEmail] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerAddress, setNewCustomerAddress] = useState("")

  // Order specific fields
  const [trackingNumber, setTrackingNumber] = useState("")
  const [status, setStatus] = useState("pending")
  const [paymentStatus, setPaymentStatus] = useState("unpaid")
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [salesRepId, setSalesRepId] = useState<string>("")
  const [amountPaid, setAmountPaid] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [paymentOption, setPaymentOption] = useState<'instant' | 'credit'>('instant')
  const [creditTerms, setCreditTerms] = useState<CustomerCreditTerms | null>(null)
  const [isLoadingCreditTerms, setIsLoadingCreditTerms] = useState(false)
  const [downPaymentAmount, setDownPaymentAmount] = useState(0)
  const [downPaymentMethod, setDownPaymentMethod] = useState("")
  const [downPaymentTransactionRef, setDownPaymentTransactionRef] = useState("")
  const [instantPaymentMethod, setInstantPaymentMethod] = useState("")
  const [instantPaymentReference, setInstantPaymentReference] = useState("")

  // Default the payment option to whatever this customer is registered as (cash
  // vs GM-approved credit terms), but the user can still switch it for this order.
  useEffect(() => {
    const customerId = selectedCustomer?.id
    setDownPaymentAmount(0)
    setDownPaymentMethod("")
    setDownPaymentTransactionRef("")
    if (!customerId) {
      setCreditTerms(null)
      return
    }
    setIsLoadingCreditTerms(true)
    fetchCustomerCreditTerms(customerId)
      .then((terms) => {
        setCreditTerms(terms)
        setPaymentOption(terms.payment_method === 'credit' ? 'credit' : 'instant')
      })
      .catch(() => setCreditTerms(null))
      .finally(() => setIsLoadingCreditTerms(false))
  }, [selectedCustomer?.id])

  useEffect(() => {
    if (open) {
      fetchSalesReps().then(setSalesReps).catch(() => setSalesReps([]))
    }
  }, [open])

  // Products are searched server-side only; the catalog is never bulk-loaded, because each
  // products page is slow and bulk-loading queued in front of the user's search.
  useEffect(() => {
    let cancelled = false
    const q = productSearchQuery.trim()

    // Debounced server search: always use server when user types, for complete results
    const timer = setTimeout(async () => {
      if (!open) return
      if (q.length >= 2) {
        setSearchLoading(true)
        try {
          const { data } = await getProducts(1, 100, { search: q })
          if (cancelled) return
          const results: ProductWithVariants[] = Array.isArray(data)
            ? data.map(p => ({ ...p, variants: Array.isArray(p.variants) ? p.variants as ProductVariant[] : [] }))
            : []
          setSearchResults(results)
          // Order lines read product details from `products`, so keep every searched product there
          setProducts(prev => {
            const map = new Map(prev.map(p => [p.id, p]))
            for (const prod of results) map.set(prod.id, prod)
            return Array.from(map.values())
          })
        } catch (err) {
          console.warn("Product search failed", err)
          setSearchResults([])
        } finally {
          setSearchLoading(false)
        }
      } else {
        setSearchResults([])
        setSearchLoading(false)
      }
    }, 300)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [productSearchQuery, open])

  const [customersLoaded, setCustomersLoaded] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(false)

  // Only fetch customers when user starts searching
  useEffect(() => {
    async function fetchCustomersOnSearch() {
      setCustomersLoading(true)
      try {
        const allCustomers = await getCustomers()
        setCustomers(
          Array.isArray(allCustomers)
            ? allCustomers.map((c) => ({
                ...c,
                email: c.email || "",
                phone: c.phone || "",
                address: c.address || "",
              }))
            : []
        )
        setCustomersLoaded(true)
      } catch (error) {
        setCustomers([])
        toast.error("Failed to load customers")
      } finally {
        setCustomersLoading(false)
      }
    }
    if (searchQuery.trim() && !customersLoaded && !customersLoading) {
      fetchCustomersOnSearch()
    }
  }, [searchQuery, customersLoaded, customersLoading])

  // Filter customers in memory
  const filteredCustomers = Array.isArray(customers)
    ? customers.filter((customer) => {
        const query = searchQuery.toLowerCase().trim()
        if (!query) return false // Don't show any until search
        return (
          (customer?.name && customer.name.toLowerCase().includes(query)) ||
          (customer?.email && customer.email.toLowerCase().includes(query)) ||
          (customer?.phone && customer.phone.toLowerCase().includes(query)) ||
          (customer?.company && customer.company.toLowerCase().includes(query)) ||
          (customer?.business_name && customer.business_name.toLowerCase().includes(query))
        )
      })
    : []

  const q = productSearchQuery.trim()
  const filteredProducts: ProductWithVariants[] = q.length >= 2 ? searchResults : []

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setSearchQuery("")
  }

  // Change selectedVariants to use a unique key per order item
  const getOrderItemKey = (item: OrderItem) => `${item.product_id}_${item.variant_id || ''}`
  const [selectedVariants, setSelectedVariants] = useState<{ [key: string]: string }>({})
  const [pendingProduct, setPendingProduct] = useState<ProductWithVariants | null>(null)
  const [pendingVariant, setPendingVariant] = useState<string>("")

  const handleAddProduct = (product: ProductWithVariants, variantId?: string) => {
    const hasVariants = product.variants && product.variants.length > 0;
    const existingItemIndex = orderItems.findIndex((item) => item.product_id === product.id && (!hasVariants || item.variant_id === variantId))

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...orderItems]
      updatedItems[existingItemIndex].quantity += 1
      updatedItems[existingItemIndex].total_price =
        updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unit_price
      setOrderItems(updatedItems)
    } else {
      // Add new item
      const unitPrice = products.find(p => p.id === product.id)?.price || 0
      let finalUnitPrice = 0;
      if (typeof product.price === 'number') {
        finalUnitPrice = product.price;
      } else if (typeof product.price === 'string') {
        finalUnitPrice = parseFloat(product.price);
      } else {
        finalUnitPrice = 0;
      }

      if (hasVariants && variantId) {
        const variant = product.variants?.find((v: any) => v.id === variantId);
        if (variant && variant.price) {
          finalUnitPrice = parseFloat(typeof variant.price === 'number' ? variant.price.toString() : variant.price);
        }
      }

      // Calculate tax
      const taxRate = vatRateForProduct(product)
      const quantity = 1
      const taxAmount = finalUnitPrice * quantity * (taxRate / 100)

      const newItem: OrderItem = {
        product_id: product.id,
        product_name: product.name,
        quantity: quantity,
        unit_price: finalUnitPrice,
        total_price: finalUnitPrice * quantity,
        variant_id: variantId,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        price_label: DEFAULT_PRICE_CODE,
      }
      setOrderItems([
        ...orderItems,
        newItem,
      ])
      setSelectedVariants((prev) => ({ ...prev, [getOrderItemKey(newItem)]: variantId || "" }))
    }
    setOpenProductDropdown(false)
    setProductSearchQuery("")
    setPendingProduct(null)
    setPendingVariant("")
  }

  const handleSelectVariant = (productId: string, variantId: string, orderItemIndex: number) => {
    setOrderItems((items) =>
      items.map((item, idx) =>
        idx === orderItemIndex ? { ...item, variant_id: variantId } : item
      )
    )
    setSelectedVariants((prev) => {
      const item = orderItems[orderItemIndex]
      return { ...prev, [getOrderItemKey({ ...item, variant_id: variantId })]: variantId }
    })
  }

  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return

    const updatedItems = [...orderItems]
    const item = updatedItems[index]
    updatedItems[index].quantity = quantity
    updatedItems[index].total_price = quantity * item.unit_price
    updatedItems[index].tax_amount = item.unit_price * quantity * (item.tax_rate / 100)
    setOrderItems(updatedItems)
  }

  const handleUpdatePrice = (index: number, price: number, label: string | null = "Custom") => {
    if (price < 0) return

    const updatedItems = [...orderItems]
    const item = updatedItems[index]
    updatedItems[index].unit_price = price
    updatedItems[index].price_label = label
    updatedItems[index].total_price = item.quantity * price
    updatedItems[index].tax_amount = price * item.quantity * (item.tax_rate / 100)
    setOrderItems(updatedItems)
  }

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const totals = orderTotals(orderItems, discount)
  const calculateSubtotal = () => totals.subtotal
  const calculateTax = () => totals.tax
  const calculateTotal = () => totals.total

  const creditOverage = paymentOption === 'credit' && creditTerms?.credit_days
    ? getCreditOverage(calculateTotal(), creditTerms.available_credit)
    : 0

  const handleCreateOrder = async () => {
    // Validation
    if (!selectedCustomer && activeTab === "existing") {
      toast.error("Please select a customer")
      return
    }

    if (activeTab === "new" && !newCustomerName) {
      toast.error("Please enter customer name")
      return
    }

    if (orderItems.length === 0) {
      toast.error("Please add at least one product")
      return
    }

    if (paymentOption === 'credit' && !creditTerms?.credit_days) {
      toast.error("This customer has no GM-approved credit terms. Get credit terms approved, or switch to instant payment.")
      return
    }

    if (creditOverage > 0 && (!coversOverage(downPaymentAmount, creditOverage) || !downPaymentMethod)) {
      toast.error(`This exceeds available credit by KES ${creditOverage.toLocaleString()}. Enter how that amount will be paid now to proceed.`)
      return
    }

    if (paymentOption === 'instant' && (amountPaid < calculateTotal() || !instantPaymentMethod)) {
      toast.error("An instant sale needs to be paid in full - enter the amount paid and how it was paid.")
      return
    }

    setLoading(true)

    try {
      let customerId = selectedCustomer?.id

      // Create new customer if needed
      if (activeTab === "new") {
        // Create customer via API
        const newCustomer = await apiCall<Customer>("/customers", "POST", {
          name: newCustomerName,
          email: newCustomerEmail,
          phone: newCustomerPhone,
          address: newCustomerAddress,
          company_id: null, // Set to null if not needed
        })
        customerId = newCustomer.id
      }

      // Use the first company as store_id (adjust if you have a separate store selector)
      const storeId = companies.length > 0 ? companies[0].id : null
      
      // Calculate tax amount
      const taxAmount = calculateTax()
      
      // TODO: Add UI for delivery_location_id, delivery_person_id, estimated_delivery if needed
      const payload = {
        customer_id: customerId,
        sales_rep_id: salesRepId || undefined,
        store_id: storeId,
        status,
        payment_status: paymentStatus,
        payment_option: paymentOption,
        amount_paid: amountPaid || undefined,
        // delivery_location_id: ..., // TODO: Add from UI
        // delivery_person_id: ...,
        // estimated_delivery: ...,
        discount: totals.discount,
        tax: taxAmount,
        currency: "KES",
        notes,
        items: orderItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          price_label: item.price_label || null,
          tax_rate: item.tax_rate,
          tax_amount: item.tax_amount,
          ...(item.variant_id ? { variant_id: item.variant_id } : {}),
        })),
      }
      const orderResponse = await apiCall<{ order: { id: string } }>("/orders", "POST", payload)

      // Record a real payment against the order for the portion covering the
      // credit overage, so it shows up in payment history rather than just
      // being a number written into the order's amount_paid field.
      if (creditOverage > 0 && orderResponse?.order?.id) {
        await createPayment({
          order_id: orderResponse.order.id,
          payment_method: downPaymentMethod,
          amount_paid: downPaymentAmount,
          transaction_id: downPaymentTransactionRef || undefined,
          status: 'completed',
        })
      }

      // Same as the credit-overage down payment - record a real Payment for
      // an instant sale rather than just writing a number into amount_paid.
      if (paymentOption === 'instant' && amountPaid > 0 && orderResponse?.order?.id) {
        await createPayment({
          order_id: orderResponse.order.id,
          payment_method: instantPaymentMethod,
          amount_paid: amountPaid,
          transaction_id: instantPaymentReference || undefined,
          status: 'completed',
        })
      }

      toast.success("Order created successfully!", { position: "bottom-left" })
      setOpen(false)
      resetForm()
      if (onOrderCreated) {
        onOrderCreated()
      }
      router.refresh()
    } catch (error: any) {
      let errorMessage = "Error creating order: "
      if (error?.message) {
        errorMessage += error.message
      } else if (typeof error === 'string') {
        errorMessage += error
      } else if (error?.response?.data?.message) {
        errorMessage += error.response.data.message
      } else if (error?.response?.data?.error) {
        errorMessage += error.response.data.error
      } else {
        errorMessage += "Unknown error"
      }
      toast.error(errorMessage, { position: "bottom-left" })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNewCustomer = async () => {
    if (!newCustomerName) {
      toast.error("Please enter customer name")
      return
    }
    try {
      // Use the updated createCustomer function instead of direct API call
      const customerData = {
        name: newCustomerName,
        email: newCustomerEmail || null,
        phone: newCustomerPhone || null,
        address: newCustomerAddress || null,
        city: null,
        state: null,
        country: null,
        postal_code: null,
        company: null,
        notes: null,
        tags: [],
        customer_type: null,
        preferred_communication_channel: null,
        last_contact_date: null,
      };

      const newCustomer = await createCustomer(customerData as any);
      setCustomers((prev) => [newCustomer, ...prev])
      setSelectedCustomer(newCustomer)
      setActiveTab("existing")
      toast.success("Customer created successfully!")
    } catch (error) {
      toast.error("Failed to create customer")
    }
  }

  const resetForm = () => {
    setSelectedCustomer(null)
    setOrderItems([])
    setNotes("")
    setNotes("")
    // setIncludeTax(true)
    // setTaxRate(16)
    setSearchQuery("")
    setProductSearchQuery("")
    setActiveTab("existing")
    setNewCustomerName("")
    setNewCustomerEmail("")
    setNewCustomerPhone("")
    setNewCustomerAddress("")
    setTrackingNumber("")
    setStatus("Pending")
    setPaymentStatus("Unpaid")
    setPaymentOption("instant")
    setCreditTerms(null)
    setAmountPaid(0)
    setDownPaymentAmount(0)
    setDownPaymentMethod("")
    setDownPaymentTransactionRef("")
    setInstantPaymentMethod("")
    setInstantPaymentReference("")
    setDiscount(0)
    setSalesRepId("")
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Create New Order
          </SheetTitle>
          <SheetDescription>
            Create a new order for a customer. Add products, set quantities, and specify order details.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Customer Information</h3>
            <Tabs defaultValue="existing" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Existing Customer</TabsTrigger>
                <TabsTrigger value="new">New Customer</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-search">Search Customers</Label>
                  <div className="space-y-1">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        id="customer-search"
                        placeholder="Search by name, email (e.g., john@example.com) or phone (e.g., 0712345678)..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-gray-500">Examples: "John Doe", "john@example.com", "0712345678"</p>
                  </div>

                  {customersLoading ? (
                    <div className="p-4 text-center text-gray-500">Loading customers...</div>
                  ) : filteredCustomers.length === 0 && searchQuery.trim() ? (
                    <div className="p-4 text-center text-gray-500">No customers found matching "{searchQuery}"</div>
                  ) : (
                    // Only show the list if no customer is selected
                    !selectedCustomer && filteredCustomers.length > 0 && (
                      <div className="divide-y max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                        {filteredCustomers.map((customer: Customer) => (
                          <div
                            key={customer.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <div className="font-medium">
                              {getCustomerDisplayName(customer)}
                              {customer.business_name?.trim() && customer.name && (
                                <span className="ml-2 text-xs text-gray-400 font-normal">
                                  (Contact: {customer.name})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                            <div className="text-sm text-gray-500">{customer.phone}</div>
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {selectedCustomer ? (
                    <div className="mt-4 p-4 border rounded-md bg-gray-50">
                      <div className="flex justify-between iteppms-start">
                        <div>
                          <div className="font-medium">{getCustomerDisplayName(selectedCustomer)}</div>
                          <div className="text-sm text-gray-500">{selectedCustomer.email}</div>
                          <div className="text-sm text-gray-500">{selectedCustomer.phone}</div>
                          <div className="text-sm text-gray-500">{selectedCustomer.address}</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveTab("new")
                      setSearchQuery("")
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Customer
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="new" className="space-y-4 pt-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Customer name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="customer@example.com"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="+254 712 345 678"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      placeholder="Customer address"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                    />
                  </div>
                  <Button className="mt-2 w-full" onClick={handleCreateNewCustomer}>
                    Create Customer
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Order Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Order Items</h3>
              <Popover open={openProductDropdown} onOpenChange={(open) => {
  setOpenProductDropdown(open)
  if (!open) {
    setPendingProduct(null)
    setPendingVariant("")
  }
}}>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm">
      <Plus className="mr-2 h-4 w-4" />
      Add Product
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[300px] p-0" align="end">
    {pendingProduct && pendingProduct.variants && pendingProduct.variants.length > 0 ? (
      <div className="p-4 space-y-2">
        <div className="font-medium mb-2">Select Variant for {pendingProduct.name}</div>
        <Select
          value={pendingVariant}
          onValueChange={(value) => setPendingVariant(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select variant" />
          </SelectTrigger>
          <SelectContent>
            {pendingProduct.variants?.map((variant: ProductVariant) => (
              <SelectItem key={variant.id} value={String(variant.id)}>
                {variant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="w-full mt-2"
          disabled={!pendingVariant}
          onClick={() => handleAddProduct(pendingProduct, pendingVariant)}
        >
          Add to Order
        </Button>
        <Button
          className="w-full mt-2"
          variant="outline"
          onClick={() => {
            setPendingProduct(null)
            setPendingVariant("")
          }}
        >
          Cancel
        </Button>
      </div>
    ) : (
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search products by name, SKU or description..."
          value={productSearchQuery}
          onValueChange={setProductSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {productSearchQuery.trim().length < 2
              ? "Type at least 2 characters to search products"
              : searchLoading
              ? "Searching..."
              : "No products found"}
          </CommandEmpty>
          <CommandGroup>
            {filteredProducts.map((product) => (
              <CommandItem
                key={product.id}
                onSelect={() => {
                  if (product.variants && product.variants.length > 0) {
                    setPendingProduct(product)
                    setPendingVariant("")
                  } else {
                    handleAddProduct(product)
                  }
                }}
              >
                <div className="flex flex-col">
                  <span>{product.name}</span>
                  <span className="text-sm text-gray-500">
                    {product.sku} - Ksh. {parseFloat(product.price || '0').toFixed(2)}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    )}
  </PopoverContent>
</Popover>
            </div>

            {orderItems.length === 0 ? (
              <div className="text-center p-6 border border-dashed rounded-md">
                <p className="text-gray-500">No items added yet. Click "Add Product" to add items to this order.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-md overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-full sm:w-auto">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tax
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                        {/* Variation column header, only if any product has variations */}
                        {orderItems.some(item => {
                          const product = products.find((p) => p.id === item.product_id)
                          return product && Array.isArray(product.variants) && product.variants.length > 0
                        }) && (
                          <th className="sticky right-0 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 z-10">Variation</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orderItems.map((item, index) => {
                        const product = products.find((p) => p.id === item.product_id)
                        const variants = product?.variants || []
                        const itemKey = getOrderItemKey(item)
                        return (
                          <tr key={index}>
                            <td className="px-4 py-3 max-w-[240px]">
                              <div className="text-sm font-medium text-gray-900 break-words">{item.product_name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {(() => {
                                const variant = (product as any)?.variants?.find((v: any) => v.id === item.variant_id)
                                const options = priceOptionsFor(product, variant)
                                if (options.length === 0) return null
                                return (
                                  <Select
                                    value={item.price_label || ""}
                                    onValueChange={(code) => {
                                      const option = options.find(o => o.code === code)
                                      if (option) handleUpdatePrice(index, option.price, code)
                                    }}
                                  >
                                    <SelectTrigger className="h-7 w-24 text-xs mb-1 px-2">
                                      <SelectValue placeholder="Price..." />
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
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) => handleUpdatePrice(index, Number.parseFloat(e.target.value) || 0)}
                                className="h-8 w-24 text-sm"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const value = Number.parseInt(e.target.value)
                                    if (!isNaN(value) && value >= 1) {
                                      handleUpdateQuantity(index, value)
                                    }
                                  }}
                                  className="h-8 w-20 text-center"
                                />
                              </div>
                              {/* Packaging Breakdown Display */}
                              {(() => {
                                const product = products.find((p) => p.id === item.product_id)
                                if (product && product.has_packaging && product.packaging_units && item.quantity > 0) {
                                  const packagingDisplay = formatPackagingForDisplay(item.quantity, product.packaging_units)
                                  if (packagingDisplay.hasPackaging && packagingDisplay.shortText) {
                                    return (
                                      <div className="mt-1.5 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-center gap-1">
                                          <ShoppingCart className="h-3 w-3 flex-shrink-0" />
                                          <span className="font-medium">{packagingDisplay.shortText}</span>
                                        </div>
                                      </div>
                                    )
                                  }
                                }
                                return null
                              })()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {item.tax_rate}%
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900">Ksh. {(item.total_price + item.tax_amount).toFixed(2)}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                            {variants.length > 0 && (() => {
                              const currentVariantId = selectedVariants[itemKey] || item.variant_id || ""
                              const currentVariant = variants.find((v) => String(v.id) === String(currentVariantId))
                              const displayName = currentVariant?.name || "No variant selected"
                              return (
                                <td className="sticky right-0 px-4 py-3 bg-white z-10 align-top">
                                  <div className="mb-1 max-w-[220px] whitespace-normal break-words text-sm font-medium text-gray-900">
                                    {displayName}
                                  </div>
                                  <Select
                                    value={currentVariantId}
                                    onValueChange={(value) => handleSelectVariant(item.product_id, value, index)}
                                  >
                                    <SelectTrigger className="w-full max-w-[200px]">
                                      <SelectValue placeholder="Select variant" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {variants.map((variant: ProductVariant) => (
                                        <SelectItem key={variant.id} value={String(variant.id)}>
                                          {variant.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                              )
                            })()}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border rounded-md p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Subtotal (excl. VAT):</span>
                    <span className="font-medium">Ksh. {calculateSubtotal().toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">VAT (VATable items only):</span>
                    <span className="font-medium">Ksh. {calculateTax().toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="discount">Discount (%):</Label>
                      <Input
                        id="discount"
                        type="number"
                        min="0"
                        max="100"
                        value={discount}
                        onChange={(e) => setDiscount(Number.parseFloat(e.target.value) || 0)}
                        className="w-[80px]"
                      />
                    </div>
                    <span className="font-medium">-Ksh. {totals.discount.toFixed(2)}</span>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total:</span>
                      <span className="text-lg font-bold">Ksh. {calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                Cash / Instant
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

            {paymentOption === 'credit' && (
              isLoadingCreditTerms ? (
                <p className="text-sm text-muted-foreground">Loading customer's credit terms...</p>
              ) : !selectedCustomer ? (
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
                  switch to instant payment, before this order can be created.
                </div>
              )
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
            {paymentOption === 'instant' && (
              <InstantPaymentPrompt
                total={calculateTotal()}
                amountPaid={amountPaid}
                paymentMethod={instantPaymentMethod}
                onPaymentMethodChange={setInstantPaymentMethod}
                transactionRef={instantPaymentReference}
                onTransactionRefChange={setInstantPaymentReference}
              />
            )}
          </div>

          {/* Order Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Order Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-status">Payment Status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger id="payment-status">
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partially Paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-rep">Sales Rep</Label>
                <Select value={salesRepId || "none"} onValueChange={(v) => setSalesRepId(v === "none" ? "" : v)}>
                  <SelectTrigger id="sales-rep">
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

              <div className="space-y-2">
                <Label htmlFor="amount-paid">Amount Paid</Label>
                <Input
                  id="amount-paid"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number.parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tracking-number">Tracking Number</Label>
                <Input
                  id="tracking-number"
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes or special instructions for this order"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </div>
        
        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 mt-auto">
          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={
                loading ||
                (paymentOption === 'credit' && !creditTerms?.credit_days) ||
                (creditOverage > 0 && (!coversOverage(downPaymentAmount, creditOverage) || !downPaymentMethod)) ||
                (paymentOption === 'instant' && (amountPaid < calculateTotal() || !instantPaymentMethod))
              }
            >
              {loading && <Plus className="mr-2 h-4 w-4 animate-spin" />}
              Create Order
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
