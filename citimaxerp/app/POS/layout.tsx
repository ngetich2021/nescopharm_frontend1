import { CartProvider } from "./components/pos-interface"
import { TopNav } from "@/components/navigation/top-nav"

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <TopNav />
      {children}
    </CartProvider>
  )
} 