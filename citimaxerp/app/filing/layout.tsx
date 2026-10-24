import type React from "react"
import { AppLayout } from "@/components/layouts/app-layout"

export default function FilingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
