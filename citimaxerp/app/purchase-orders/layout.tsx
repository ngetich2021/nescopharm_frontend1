import type React from "react"
import { AppLayout } from "@/components/layouts/app-layout"

export default function PurchaseOrdersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
} 