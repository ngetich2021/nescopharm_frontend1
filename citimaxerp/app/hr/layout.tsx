import type React from "react"
import { AppLayout } from "@/components/layouts/app-layout"

export default function HRLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
