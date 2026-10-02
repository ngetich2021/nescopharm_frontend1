"use client"

import type React from "react"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import { AdminSidebar } from "@/components/navigation/admin-sidebar"
import { hasPermission } from "@/lib/rbac"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { TopNav } from "@/components/navigation/top-nav" // Import TopNav

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userProfile, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !hasPermission(userProfile, "can_access_admin_portal")) {
      // Redirect to dashboard or a permission denied page if not authorized
      router.push("/dashboard")
    }
  }, [isLoading, userProfile, router])

  if (isLoading || !hasPermission(userProfile, "can_access_admin_portal")) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#E30040]" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav /> {/* Add TopNav here */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  )
}
