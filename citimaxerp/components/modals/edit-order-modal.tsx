"use client"

import { sizedName } from "@/lib/product-sizes"
import { SameCodeSizeSelect } from "@/components/same-code-size-select"
import { LineItemEditDialog, type LineEditResult } from "@/components/line-item-edit-dialog"
import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Search, ShoppingCart, Trash2, X, Pencil, Edit, Wallet, CreditCard as CreditCardIcon } from "lucide-react"
import { DEFAULT_UNIT, defaultPriceOption, describeOption, findByPriceCode, priceCodeHits, priceOptionsFor, type PriceOption } from "@/lib/price-codes"
import { StockHint, stockCheck } from "@/components/stock-hint"
import { getCreditOverage, coversOverage } from "@/lib/credit-overage"
import { createPayment } from "@/lib/payments"
import { CreditOveragePrompt } from "@/components/credit-overage-prompt"
import { InstantPaymentPrompt } from "@/components/instant-payment-prompt"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import apiCall from "@/lib/api"
import { Product, ProductVariant, getProducts, getProductById } from "@/lib/products"
import { getCustomers, Customer as LibCustomer, fetchCustomerCreditTerms, CustomerCreditTerms, getCustomerDisplayName } from "@/lib/customers"
import { OrderDetail } from "@/lib/orders"
import { orderTotals, vatRateForProduct } from "@/lib/invoice-tax"
import { OrderVatSelect } from "@/components/order-vat-select"

type Customer = LibCustomer

// The API's allowed values. Older orders carry values outside this set
// (e.g. "pending", null), which the update endpoint rejects, so anything
// unrecognized is re-derived from what's actually been paid.
const ORDER_STATUSES = ["pending", "processing", "completed", "cancelled"]
const PAYMENT_STATUSES = ["unpaid", "partial", "paid"]

function normalizePaymentStatus(
  stored: string | null | undefined,
  amountPaid: string | null | undefined,
  finalAmount: string | null | undefined,
): string {
  if (stored && PAYMENT_STATUSES.includes(stored)) return stored
  const paid = parseFloat(amountPaid || "0")
  const total = parseFloat(finalAmount || "0")
  if (paid <= 0) return "unpaid"
  return total > 0 && paid >= total ? "paid" : "partial"
}

type OrderItem = {
  id?: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  tax_rate: number
  variant_id?: string
  variant_name?: string | null
  // Which named product price tier (e.g. "Hospital Price") this line's price
  // came from, or "Custom" if hand-typed - internal-only, never printed on
  // a customer-facing order document.
  price_label?: string | null
  price_unit?: string | null
}

type Company = { id: string; name: string }

// Go-live date; matches Order::HISTORICAL_CUTOFF on the backend.
const HISTORICAL_CUTOFF = "2026-10-17"

// Local (not UTC) date, so late-evening orders don't land on tomorrow.
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const formatCutoff = () => HISTORICAL_CUTOFF.split("-").reverse().join("-")

type ProductWithVariants = Product & { variants?: ProductVariant[] }

interface EditOrderModalProps {
  order: OrderDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrderUpdated: () => void
}

export function EditOrderModal({ order, open, onOpenChange, onOrderUpdated }: EditOrderModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [notes, setNotes] = useState("")
  const [orderDate, setOrderDate] = useState(todayIso())
  // Moving the date before go-live turns the order into a past sale: sales and accounts
  // only, no stock. Moving it back on or after go-live makes it a normal sale again.
  const isPastSale = orderDate < HISTORICAL_CUTOFF
  const [searchQuery, setSearchQuery] = useState("")
  const [productSearchQuery, setProductSearchQuery] = useState("")
  const [openProductDropdown, setOpenProductDropdown] = useState(false)


  // Order specific fields
  const [trackingNumber, setTrackingNumber] = useState("")
  const [status, setStatus] = useState("pending")
  const [paymentStatus, setPaymentStatus] = useState("unpaid")
  const [amountPaid, setAmountPaid] = useState(0)
  // What the order already had paid when this modal opened, so editing an
  // already-settled order doesn't demand a fresh payment method for money
  // that was recorded previously - only for whatever's newly added here.
  const [initialAmountPaid, setInitialAmountPaid] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [paymentOption, setPaymentOption] = useState<'instant' | 'credit'>('instant')
  const [creditTerms, setCreditTerms] = useState<CustomerCreditTerms | null>(null)
  const [isLoadingCreditTerms, setIsLoadingCreditTerms] = useState(false)
  const [downPaymentAmount, setDownPaymentAmount] = useState(0)
  const [downPaymentMethod, setDownPaymentMethod] = useState("")
  const [downPaymentTransactionRef, setDownPaymentTransactionRef] = useState("")
  const [instantPaymentMethod, setInstantPaymentMethod] = useState("")
  const [instantPaymentReference, setInstantPaymentReference] = useState("")

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
      .then((terms) => setCreditTerms(terms))
      .catch(() => setCreditTerms(null))
      .finally(() => setIsLoadingCreditTerms(false))
  }, [selectedCustomer?.id])

  const withVariants = (p: Product): ProductWithVariants => ({
    ...p,
    variants: Array.isArray(p.variants) ? p.variants as ProductVariant[] : [],
  })
  const mergeProducts = (list: ProductWithVariants[]) =>
    setProducts(prev => {
      const map = new Map(prev.map(p => [p.id, p]))
      for (const prod of list) map.set(prod.id, prod)
      return Array.from(map.values())
    })

  // The order's own lines need full product details (sizes, edit dialog); load exactly those.
  // Only the first page of the catalog used to load, so most lines and searches came up empty.
  useEffect(() => {
    if (!open || !order) {
      setProducts([])
      return
    }
    let cancelled = false
    const ids = Array.from(new Set(order.order_items.map(i => i.product_id).filter(Boolean)))
    Promise.all(ids.map(id => getProductById(id).catch(() => null)))
      .then(list => { if (!cancelled) mergeProducts(list.filter(Boolean).map(withVariants)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id])

  // Adding products searches the whole catalog on the server, the same as creating an order.
  const [searchResults, setSearchResults] = useState<ProductWithVariants[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  useEffect(() => {
    let cancelled = false
    const q = productSearchQuery.trim()
    const timer = setTimeout(async () => {
      if (!open) return
      if (q.length < 2) {
        setSearchResults([])
        setSearchLoading(false)
        return
      }
      setSearchLoading(true)
      try {
        const { data } = await getProducts(1, 100, { search: q })
        if (cancelled) return
        const results = Array.isArray(data) ? data.map(withVariants) : []
        setSearchResults(results)
        mergeProducts(results)
      } catch (err) {
        console.warn("Product search failed", err)
        setSearchResults([])
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearchQuery, open])

  // Initialize form with order data when order changes
  useEffect(() => {
    if (order && open) {
      // Set customer
      if (order.customer) {
        setSelectedCustomer({
          id: order.customer.id,
          name: order.customer.name,
          email: order.customer.email || "",
          phone: order.customer.phone || "",
          // Add default values for other required fields
          address: "",
          city: "",
          state: "",
          country: "",
          postal_code: "",
          company_id: "",
          created_at: "",
          updated_at: "",
          total_orders: 0,
          total_spend: "0",
          status: "active",
          notes: null,
          company: null,
          tags: [],
          preferred_communication_channel: null,
          last_contact_date: null,
          customer_type: (order.customer.customer_type as Customer["customer_type"]) || null,
          business_name: order.customer.business_name || null,
          loyalty_points: 0,
          first_name: "",
          last_name: "",
        })
      }
      
      // Set order items
      const items: OrderItem[] = order.order_items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product ? sizedName(item.product.name, (item as any).variant?.name || item.variant_name) : "Unknown Product",
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.total_price),
        // The VAT the order was saved with (it may have been changed from the product's).
        tax_rate: (item as any).tax_rate != null ? Number((item as any).tax_rate) : vatRateForProduct(item.product as any),
        variant_id: item.variant_id || undefined,
        variant_name: item.variant_name || undefined,
        price_label: item.price_label ?? null,
        price_unit: item.price_unit ?? null,
      }))
      setOrderItems(items)

      // Stored discount is a Ksh amount; the form edits it as a percentage.
      const itemsSubtotal = items.reduce((sum, item) => sum + item.total_price, 0)
      const storedDiscount = parseFloat(order.discount || "0")
      setNotes(order.notes || "")
      setOrderDate((order.order_date || order.created_at || "").slice(0, 10) || todayIso())
      setDiscount(itemsSubtotal > 0 ? (storedDiscount / itemsSubtotal) * 100 : 0)
      setTrackingNumber(order.tracking_number || "")
      setStatus(ORDER_STATUSES.includes(order.status) ? order.status : "pending")
      setPaymentStatus(normalizePaymentStatus(order.payment_status, order.amount_paid, order.final_amount))
      setPaymentOption(order.payment_type === 'credit' ? 'credit' : 'instant')
      setAmountPaid(parseFloat(order.amount_paid || "0"))
      setInitialAmountPaid(parseFloat(order.amount_paid || "0"))
      setInstantPaymentMethod("")
      setInstantPaymentReference("")
    }
  }, [order, open])

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
          (customer?.business_name && customer.business_name.toLowerCase().includes(query))
        )
      })
    : []

  const filteredProducts: ProductWithVariants[] = productSearchQuery.trim().length >= 2 ? searchResults : []

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setSearchQuery("")
  }

  // Change selectedVariants to use a unique key per order item
  const getOrderItemKey = (item: OrderItem) => `${item.product_id}_${item.variant_id || ''}`
  const [selectedVariants, setSelectedVariants] = useState<{ [key: string]: string }>({})
  const [pendingProduct, setPendingProduct] = useState<ProductWithVariants | null>(null)
  const [pendingVariant, setPendingVariant] = useState<string>("")

  // Typing a full code such as "NSPD 001" picks that item straight away - no list to choose from.
  useEffect(() => {
    if (!openProductDropdown || searchLoading) return
    const hit = findByPriceCode(filteredProducts, productSearchQuery)
    if (hit) handleAddProduct(hit.product, undefined, hit.option)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearchQuery, searchResults, searchLoading, openProductDropdown])

  const handleAddProduct = (product: ProductWithVariants, variantId?: string, option?: PriceOption) => {
    const hasVariants = product.variants && product.variants.length > 0;
    // Sizes share the item's price code, so the price always comes from the item.
    const chosen = option ?? defaultPriceOption(product)
    const existingItemIndex = orderItems.findIndex((item) => item.product_id === product.id && (!hasVariants || item.variant_id === variantId) && (item.price_label || null) === (chosen?.code ?? null))

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...orderItems]
      updatedItems[existingItemIndex].quantity += 1
      updatedItems[existingItemIndex].total_price =
        updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unit_price
      setOrderItems(updatedItems)
    } else {
      const unitPrice = chosen?.price ?? 0
      const newItem = {
        product_id: product.id,
        product_name: sizedName(product.name, product.variants?.find((v: any) => v.id === variantId)?.name),
        quantity: 1,
        unit_price: unitPrice,
        price_label: chosen?.code ?? null,
        price_unit: chosen?.unit ?? null,
        total_price: unitPrice,
        tax_rate: vatRateForProduct(product),
        ...(variantId ? { variant_id: variantId } : {}),
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
    const product = products.find((p) => p.id === productId)
    const variant = product?.variants?.find((v) => v.id.toString() === variantId)
    setOrderItems((items) =>
      items.map((item, idx) =>
        idx === orderItemIndex
          ? { ...item, variant_id: variantId, variant_name: variant?.name || item.variant_name, product_name: sizedName(product?.name ?? item.product_name, variant?.name || item.variant_name) }
          : item
      )
    )
    setSelectedVariants((prev) => {
      const item = orderItems[orderItemIndex]
      return { ...prev, [getOrderItemKey({ ...item, variant_id: variantId })]: variantId }
    })
  }

  // A code shared by several sizes keeps its code and price; only the size (product) changes.
  const handleSwapSize = (index: number, product: ProductWithVariants) => {
    setProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, { ...product, variants: Array.isArray(product.variants) ? product.variants : [] }]))
    setOrderItems((items) =>
      items.map((item, idx) =>
        idx === index
          ? { ...item, product_id: product.id, product_name: product.name, variant_id: undefined, variant_name: undefined, tax_rate: vatRateForProduct(product) }
          : item
      )
    )
  }

  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return

    const updatedItems = [...orderItems]
    updatedItems[index].quantity = quantity
    updatedItems[index].total_price = quantity * updatedItems[index].unit_price
    setOrderItems(updatedItems)
  }

  const handleUpdatePrice = (index: number, value: string) => {
    const price = Number.parseFloat(value)
    if (isNaN(price) || price < 0) return

    const updatedItems = [...orderItems]
    updatedItems[index].unit_price = price
    updatedItems[index].total_price = updatedItems[index].quantity * price
    setOrderItems(updatedItems)
  }

  const handleUpdateTaxRate = (index: number, rate: number) => {
    setOrderItems((prev) => prev.map((item, i) => (i === index ? { ...item, tax_rate: rate } : item)))
  }

  // The pen edits the item itself, so every line using it takes the new name, and lines priced
  // with the same code take the new price and unit.
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const handleItemEdited = ({ product: fresh, unitPrice, priceUnit }: LineEditResult) => {
    if (editingIndex === null) return
    const code = orderItems[editingIndex]?.price_label
    setProducts((prev) => prev.map((p) => (p.id === fresh.id ? { ...p, ...fresh } : p)))
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.product_id !== fresh.id) return item
        const size = item.variant_id ? (fresh.variants ?? []).find((v: any) => v.id === item.variant_id) : undefined
        const renamed = { ...item, product_name: size ? sizedName(fresh.name, size.name) : fresh.name }
        if (!code || item.price_label !== code) return renamed
        return {
          ...renamed,
          unit_price: unitPrice,
          price_unit: priceUnit,
          total_price: item.quantity * unitPrice,
        }
      }),
    )
  }

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const totals = orderTotals(orderItems, discount)
  const calculateTotal = () => totals.total

  // Pieces available for a line. If this order's stock was already taken, the server puts it
  // back before re-checking, so this order's original pieces of the same item count as available.
  const availableFor = (item: OrderItem): number | null => {
    const product = products.find((p) => p.id === item.product_id)
    if (!product) return null
    let available: number
    if (item.variant_id) {
      const variant = product.variants?.find((v) => String(v.id) === String(item.variant_id))
      if (!variant) return null
      available = Number(variant.stock_quantity ?? 0)
    } else {
      available = Number(product.stock_quantity ?? 0)
    }
    if ((order as any)?.stock_deducted_at) {
      available += (order?.order_items ?? [])
        .filter((o) => o.product_id === item.product_id && String(o.variant_id ?? "") === String(item.variant_id ?? ""))
        .reduce((sum, o) => sum + stockCheck(Number(o.quantity), o.price_unit, 0).needed, 0)
    }
    return available
  }
  // A past sale's goods left before the opening stock was taken, so there is nothing to check.
  const shortLines = isPastSale ? [] : orderItems.filter((item) => stockCheck(item.quantity, item.price_unit, availableFor(item)).short)

  const creditOverage = paymentOption === 'credit' && creditTerms?.credit_days
    ? getCreditOverage(calculateTotal(), creditTerms.available_credit)
    : 0

  // Only the newly-added portion needs a payment method - money already
  // recorded on this order before the modal opened doesn't need re-justifying.
  const newInstantPaymentAmount = paymentOption === 'instant'
    ? Math.max(0, amountPaid - initialAmountPaid)
    : 0

  const handleUpdateOrder = async () => {
    // Validation
    if (!selectedCustomer) {
      toast.error("Please select a customer")
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

    if (paymentOption === 'instant' && amountPaid < calculateTotal()) {
      toast.error("An instant sale needs to be paid in full - enter the full amount paid.")
      return
    }

    if (newInstantPaymentAmount > 0 && !instantPaymentMethod) {
      toast.error("Say how the newly added payment was made.")
      return
    }

    setLoading(true)

    try {
      // Use the first company as store_id (adjust if you have a separate store selector)
      const storeId = companies.length > 0 ? companies[0].id : null
      
      // Prepare the payload for updating the order
      const payload = {
        customer_id: selectedCustomer.id,
        store_id: storeId,
        status,
        payment_status: paymentStatus,
        payment_type: paymentOption === 'credit' ? 'credit' : 'cash',
        amount_paid: amountPaid || undefined,
        discount: totals.discount,
        tax: totals.tax,
        currency: "KES",
        notes,
        order_date: orderDate,
        items: orderItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          price_label: item.price_label || null,
          price_unit: item.price_unit || null,
          tax_rate: item.tax_rate,
          ...(item.variant_id ? { variant_id: item.variant_id } : {}),
        })),
      }

      // Make the API call to update the order
      await apiCall(`/orders/${order?.id}`, "PUT", payload)

      // Record a real payment against the order for the portion covering the
      // credit overage, so it shows up in payment history rather than just
      // being a number written into the order's amount_paid field.
      if (creditOverage > 0 && order?.id) {
        await createPayment({
          order_id: order.id,
          payment_method: downPaymentMethod,
          amount_paid: downPaymentAmount,
          transaction_id: downPaymentTransactionRef || undefined,
          status: 'completed',
        })
      }

      // Same idea for an instant sale - only the newly-added amount needs a
      // fresh Payment record; money already on the order was recorded before.
      if (newInstantPaymentAmount > 0 && order?.id) {
        await createPayment({
          order_id: order.id,
          payment_method: instantPaymentMethod,
          amount_paid: newInstantPaymentAmount,
          transaction_id: instantPaymentReference || undefined,
          status: 'completed',
        })
      }

      toast.success("Order updated successfully!", { position: "bottom-left" })
      onOpenChange(false)
      onOrderUpdated()
      router.refresh()
    } catch (error: any) {
      let errorMessage = "Error updating order: "
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



  // Sits under the last line so long orders don't need a scroll back up.
  const addProductPicker = (
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
                <PopoverContent className="w-[300px] p-0" align="start">
                  {pendingProduct && pendingProduct.variants && pendingProduct.variants.length > 0 ? (
                    <div className="p-4 space-y-2">
                      <div className="font-medium mb-2">Pick size</div>
                      <Select
                        value={pendingVariant}
                        onValueChange={(value) => setPendingVariant(value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={`${pendingProduct.name} - pick size`} />
                        </SelectTrigger>
                        <SelectContent>
                          {pendingProduct.variants?.map((variant: ProductVariant) => (
                            <SelectItem key={variant.id} value={variant.id.toString()}>
                              {sizedName(pendingProduct.name, variant.name)}
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
                        placeholder="Search by description, item no. or code (e.g. NSPD 001)..."
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
                        {priceCodeHits(filteredProducts, productSearchQuery).length > 0 && (
                          <CommandGroup heading="Price codes">
                            {priceCodeHits(filteredProducts, productSearchQuery).map(({ product, option }) => (
                              <CommandItem key={`code-${product.id}-${option.code}`} onSelect={() => handleAddProduct(product, undefined, option)}>
                                <div className="flex flex-col">
                                  <span className="font-semibold">{option.code}</span>
                                  <span className="text-sm text-gray-500">{product.name} | {describeOption(option)}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
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
                                  No. {product.item_number ?? '-'} | NSPV Ksh. {parseFloat(product.price || '0').toFixed(2)}
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
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center">
            <Edit className="mr-2 h-5 w-5" />
            Edit Order
          </SheetTitle>
          <SheetDescription>
            Edit order details. Update products, quantities, and order information.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Customer Information</h3>
            <div className="space-y-4 pt-4">
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
                            <div className="font-medium">{getCustomerDisplayName(customer)}</div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                            <div className="text-sm text-gray-500">{customer.phone}</div>
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {selectedCustomer ? (
                    <div className="mt-4 p-4 border rounded-md bg-gray-50">
                      <div className="flex justify-between items-start">
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
                    onClick={() => router.push('/customers')}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Customer
                  </Button>
                </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Order Items</h3>

            {orderItems.length === 0 ? (
              <div className="text-center p-6 border border-dashed rounded-md">
                <p className="text-gray-500">No items added yet. Click "Add Product" below to add items to this order.</p>
                <div className="mt-3 flex justify-center">{addProductPicker}</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-md overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          S/No
                        </th>
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
                          VAT
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orderItems.map((item, index) => {
                        const product = products.find((p) => p.id === item.product_id)
                        const variants = product?.variants || []
                        const itemKey = getOrderItemKey(item)
                        return (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 max-w-[240px]">
                              {variants.length > 0 ? (
                                <Select
                                  value={String(selectedVariants[itemKey] || item.variant_id || "")}
                                  onValueChange={(value) => handleSelectVariant(item.product_id, value, index)}
                                >
                                  <SelectTrigger className={`h-auto min-h-8 text-left text-sm font-medium whitespace-normal ${item.variant_id ? "" : "border-red-500"}`}>
                                    <SelectValue placeholder={`${product?.name} - pick size`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {variants.map((variant: ProductVariant) => (
                                      <SelectItem key={variant.id} value={variant.id.toString()}>
                                        {sizedName(product?.name, variant.name)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <>
                                  <div className="text-sm font-medium text-gray-900 break-words">{item.product_name}</div>
                                  <SameCodeSizeSelect code={item.price_label} productId={item.product_id} onPick={(p) => handleSwapSize(index, p)} />
                                </>
                              )}
                              <div className="text-xs text-gray-500">{[item.price_label, item.price_unit || DEFAULT_UNIT].filter(Boolean).join(" | ")}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {/* Defaults to the price-list price; can be negotiated per order. */}
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) => handleUpdatePrice(index, e.target.value)}
                                className="h-8 w-28 text-right"
                                aria-label={`Price for row ${index + 1}`}
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
                                  className={`h-8 w-20 text-center ${!isPastSale && stockCheck(item.quantity, item.price_unit, availableFor(item)).short ? "border-red-500" : ""}`}
                                />
                              </div>
                              {!isPastSale && <StockHint quantity={item.quantity} priceUnit={item.price_unit} available={availableFor(item)} />}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <OrderVatSelect value={item.tax_rate} onChange={(rate) => handleUpdateTaxRate(index, rate)} label={`VAT for row ${index + 1}`} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900">Ksh. {item.total_price.toFixed(2)}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              {product && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingIndex(index)}
                                  aria-label={`Edit item on row ${index + 1}`}
                                  title="Edit name, description, unit, price and expiry"
                                >
                                  <Pencil className="h-4 w-4 text-gray-500" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <LineItemEditDialog
                    open={editingIndex !== null && !!products.find((p) => p.id === orderItems[editingIndex]?.product_id)}
                    onOpenChange={(open) => !open && setEditingIndex(null)}
                    product={editingIndex !== null ? products.find((p) => p.id === orderItems[editingIndex]?.product_id) : undefined}
                    variantId={editingIndex !== null ? orderItems[editingIndex]?.variant_id ?? null : null}
                    priceCode={editingIndex !== null ? orderItems[editingIndex]?.price_label ?? null : null}
                    onSaved={handleItemEdited}
                  />
                </div>

                <div>{addProductPicker}</div>

                <div className="border rounded-md p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Subtotal (excl. VAT):</span>
                    <span className="font-medium">Ksh. {totals.subtotal.toFixed(2)}</span>
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

                  <div className="flex justify-between items-center">
                    <span className="text-sm">
                      VAT
                      <span className="text-xs text-gray-500 ml-1">
                        ({orderItems.some(i => i.tax_rate > 0) ? "on VATable items only" : "no VATable items"})
                      </span>
                    </span>
                    <span className="font-medium">Ksh. {totals.tax.toFixed(2)}</span>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total (incl. VAT):</span>
                      <span className="text-lg font-bold">Ksh. {totals.total.toFixed(2)}</span>
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
                  switch to instant payment, before this order can be saved.
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

            <div className="space-y-2">
              <Label htmlFor="order-date">Order Date</Label>
              <Input
                id="order-date"
                type="date"
                max={todayIso()}
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value || todayIso())}
                className="md:w-1/2"
              />
              {isPastSale && (
                <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Past sale (before {formatCutoff()}): it counts in sales, invoices and the customer&apos;s balance,
                  but stock will not change - those goods left before your opening stock was taken.
                </p>
              )}
            </div>

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
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            {shortLines.length > 0 && (
              <p className="text-sm text-red-600 self-center mr-auto">
                Not enough stock for {shortLines.length === 1 ? "1 item" : `${shortLines.length} items`}. Lower the quantity to continue.
              </p>
            )}
            <Button
              onClick={handleUpdateOrder}
              disabled={
                loading ||
                shortLines.length > 0 ||
                (paymentOption === 'credit' && !creditTerms?.credit_days) ||
                (creditOverage > 0 && (!coversOverage(downPaymentAmount, creditOverage) || !downPaymentMethod)) ||
                (paymentOption === 'instant' && amountPaid < calculateTotal()) ||
                (newInstantPaymentAmount > 0 && !instantPaymentMethod)
              }
            >
              {loading && <Edit className="mr-2 h-4 w-4 animate-spin" />}
              Update Order
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}