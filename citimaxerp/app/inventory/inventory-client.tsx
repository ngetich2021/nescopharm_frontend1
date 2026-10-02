"use client"

import type React from "react"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { CreateProductButton } from "./create-product-button"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { revalidateInventoryProducts } from "./revalidate-actions" // Import the new server action
import { PermissionGuard } from "@/components/PermissionGuard"

interface InventoryClientProps {
  children: React.ReactNode
}

export function InventoryClient({ children }: InventoryClientProps) {
  const router = useRouter()

  const handleProductActionSuccess = useCallback(() => {
    // This will trigger a revalidation of the current path,
    // causing the server component to re-fetch fresh data.
    revalidateInventoryProducts()
    router.refresh() // This will re-render the current route, picking up the revalidated data
  }, [router])

  return (
    <>
      {/* Header without Refresh and Add Product buttons */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage your products and stock levels</p>
        </div>
        {/* Removed Refresh and Add Product buttons as per UI update */}
      </div>

      {/* Children will now be re-rendered by router.refresh() after revalidation */}
      {children}
    </>
  )
}