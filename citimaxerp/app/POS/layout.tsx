import { CartProvider } from "./components/pos-interface"
import { AppLayout } from "@/components/layouts/app-layout"

// The till sits in the app layout like every other section: sidebar and top bar, with wide
// content scrolling inside the page area rather than pushing the top bar off screen.
export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <AppLayout>{children}</AppLayout>
    </CartProvider>
  )
}
