import type React from "react"
import { Metadata } from "next"
import { AppLayout } from "@/components/layouts/app-layout"

export const metadata: Metadata = {
  title: "eTIMS | Citimax",
  description: "KRA eTIMS compliance and supplier receipts",
}

// The eTIMS pages had no layout, so they opened without the sidebar and top bar.
export default function EtimsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
