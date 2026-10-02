
"use client"

import { useState, useEffect, createContext, useContext } from "react"
import type { Customer } from "@/lib/customers"
import { Card } from "@/components/ui/card"
import { ProductSearch } from "./product-search"
import { ShoppingCart } from "./shopping-cart"
import { CustomerSelector } from "./customer-selector"
import { PaymentModal } from "./payment-modal"
import { MyActivityPanel } from "./my-activity-panel"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export interface CartItem {
  id: string
  productId: string // NEW: actual product id
  name: string
  price: number
  quantity: number
  variantId?: string // Add variantId for backend
  variant?: string
  sku: string
  image?: string
  stock: number
}

// Cart Context
interface CartContextType {
  cartItems: CartItem[]
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>
  selectedCustomer: Customer | null
  setSelectedCustomer: React.Dispatch<React.SetStateAction<Customer | null>>
  taxEnabled: boolean
  setTaxEnabled: React.Dispatch<React.SetStateAction<boolean>>
  taxRate: number
  setTaxRate: React.Dispatch<React.SetStateAction<number>>
  clearCart: () => void
  // Bumped whenever something My Activity cares about happens elsewhere in
  // POS (a quote submitted, a customer created) - MyActivityPanel watches
  // this to refresh immediately instead of only on mount.
  activityVersion: number
  bumpActivityVersion: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRate, setTaxRate] = useState(8)
  const [activityVersion, setActivityVersion] = useState(0)

  const clearCart = () => {
    setCartItems([])
    setSelectedCustomer(null)
  }

  const bumpActivityVersion = () => setActivityVersion((v) => v + 1)

  return (
    <CartContext.Provider value={{ cartItems, setCartItems, selectedCustomer, setSelectedCustomer, taxEnabled, setTaxEnabled, taxRate, setTaxRate, clearCart, activityVersion, bumpActivityVersion }}>
      {children}
    </CartContext.Provider>
  )
}

export function POSInterface() {
  const { cartItems, setCartItems, selectedCustomer, setSelectedCustomer, taxEnabled, setTaxEnabled, taxRate, setTaxRate, clearCart } = useCart()
  const { toast } = useToast()
  const [showStickyCheckout, setShowStickyCheckout] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const router = useRouter()

  // Force showPaymentModal to false on every mount (diagnostic)
  useEffect(() => {
    setShowPaymentModal(false)
  }, [])

  // Also forcibly close modal if cart is empty (diagnostic)
  useEffect(() => {
    if (!cartItems || cartItems.length === 0) {
      setShowPaymentModal(false)
    }
  }, [cartItems])

  // --- DO NOT ADD ANY AUTO-OPEN LOGIC FOR showPaymentModal BELOW ---
  // The modal should only open via handleCheckout (Proceed to Checkout button)

  // Calculate cart totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = taxEnabled ? subtotal * (taxRate / 100) : 0
  const total = subtotal + tax

  // Show sticky checkout button on mobile if cart has items
  useEffect(() => {
    const handleScroll = () => {
      // Show sticky button if scrolled past 400px (cart likely not visible)
      setShowStickyCheckout(window.innerWidth < 1024 && cartItems.length > 0 && window.scrollY > 400)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [cartItems.length])

  const addToCart = (product: any, variant?: any) => {
    const cartItem: CartItem = {
      id: variant ? `${product.id}-${variant.id}` : product.id,
      productId: product.id, // NEW: always set productId
      name: product.name,
      price: variant ? variant.price : product.price,
      quantity: 1,
      variantId: variant?.id, // Add variantId
      variant: variant?.name,
      sku: variant ? variant.sku : product.sku,
      image: product.image,
      stock: variant ? variant.stock_quantity : product.stock_quantity,
    }

    setCartItems((prev) => {
      const existingItem = prev.find((item) => item.id === cartItem.id)
      if (existingItem) {
        // Remove stock limit check: allow adding beyond stock
        return prev.map((item) => (item.id === cartItem.id ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [...prev, cartItem]
    })

    toast({
      title: "Added to cart",
      description: `${product.name}${variant ? ` (${variant.name})` : ""} added to cart`,
    })
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
      return
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (quantity > item.stock) {
            toast({
              title: "Stock limit reached",
              description: `Only ${item.stock} items available`,
              variant: "destructive",
            })
            return item
          }
          return { ...item, quantity }
        }
        return item
      }),
    )
  }

  const updatePrice = (id: string, price: number) => {
    if (price < 0) {
      toast({
        title: "Invalid price",
        description: "Price cannot be negative",
        variant: "destructive",
      })
      return
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, price }
        }
        return item
      }),
    )

    toast({
      title: "Price updated",
      description: "Item price has been updated",
    })
  }

  const removeFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id))
    toast({
      title: "Removed from cart",
      description: "Item removed from cart",
    })
  }

  const handleCheckout = () => {
    // Guard: Never open modal if cart is empty
    if (!cartItems || cartItems.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Add items to cart before checkout",
        variant: "destructive",
      })
      setShowPaymentModal(false)
      return
    }
    setShowPaymentModal(true)
  }

  const handleOrderComplete = () => {
    setShowPaymentModal(false)
    clearCart()
    router.push("/POS")
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Search - Takes up 2 columns on large screens */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6">
          <ProductSearch onAddToCart={addToCart} />
        </Card>
      </div>

      {/* Cart and Customer - Takes up 1 column */}
      <div className="space-y-6">
        {/* Shown first (when there's anything active) so a rep tracking a
            pending approval/confirmation sees it before Customer/Cart. */}
        <MyActivityPanel />

        <Card className="p-6">
          <CustomerSelector selectedCustomer={selectedCustomer} onCustomerSelect={setSelectedCustomer} />
        </Card>

        <Card className="p-6">
          <ShoppingCart
            items={cartItems}
            onUpdateQuantity={updateQuantity}
            onUpdatePrice={updatePrice}
            onRemoveItem={removeFromCart}
            onCheckout={handleCheckout}
            onClearCart={clearCart}
            taxEnabled={taxEnabled}
            setTaxEnabled={setTaxEnabled}
            taxRate={taxRate}
            setTaxRate={setTaxRate}
          />
        </Card>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        cartItems={cartItems}
        customer={selectedCustomer}
        onPaymentComplete={handleOrderComplete}
        subtotal={subtotal}
        tax={tax}
        taxEnabled={taxEnabled}
        taxRate={taxRate}
        total={total}
      />
    </div>
  )
}
