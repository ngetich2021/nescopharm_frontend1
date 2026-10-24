import type React from "react"
import { Metadata } from "next"
import { AppLayout } from "@/components/layouts/app-layout"

export const metadata: Metadata = {
  title: "Analytics | Citimax",
  description: "Business analytics dashboard",
}

// Like the other app sections: sidebar and top bar around the page.
export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
