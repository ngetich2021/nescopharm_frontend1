"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/sidebar/sidebar"

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Skip auth check for public routes
    const publicRoutes = ["/", "/sign-in", "/sign-up", "/pricing", "/contact"]
    if (publicRoutes.includes(pathname)) {
      return
    }

    // Redirect to sign-in if not authenticated and not loading
    if (!isLoading && !user) {
      router.push("/sign-in")
    }
  }, [user, isLoading, router, pathname])

  // Show loading state
  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // For public routes, just render children without the sidebar
  const publicRoutes = ["/", "/sign-in", "/sign-up", "/pricing", "/contact"]
  if (publicRoutes.includes(pathname)) {
    return <>{children}</>
  }

  // If not authenticated, don't render anything (will redirect)
  if (!user) {
    return null
  }

  // Render authenticated layout with sidebar
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
    </div>
  )
}
