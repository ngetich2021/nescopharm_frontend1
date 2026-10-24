import { CartProvider } from "./components/pos-interface"
import { TopNav } from "@/components/navigation/top-nav"

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {/* The top bar stays the width of the screen; anything wider in the till scrolls on its own. */}
      <div className="flex min-h-screen w-full flex-col overflow-x-clip">
        <TopNav />
        <div className="min-w-0 flex-1 overflow-x-auto">{children}</div>
      </div>
    </CartProvider>
  )
} 