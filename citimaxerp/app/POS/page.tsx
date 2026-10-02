"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { POSInterface } from "./components/pos-interface"
import { OrderHistory } from "./components/order-history"
import { ShoppingCart, History, BarChart3 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { hasPermission } from "@/lib/rbac"
import { Loader2 } from "lucide-react"

export default function POSPage() {
  const { userProfile, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState("pos")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (!(hasPermission(userProfile as any, "can_view_pos"))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-gray-500">You do not have permission to access the Point of Sale.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-sm sm:text-base text-gray-600">Process sales and manage transactions</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1">
            <TabsTrigger value="pos" className="flex flex-col xs:flex-row items-center gap-1 xs:gap-2 text-xs sm:text-sm py-2">
              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">POS</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex flex-col xs:flex-row items-center gap-1 xs:gap-2 text-xs sm:text-sm py-2">
              <History className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex flex-col xs:flex-row items-center gap-1 xs:gap-2 text-xs sm:text-sm py-2">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="space-y-4 sm:space-y-6">
            <POSInterface />
          </TabsContent>

          <TabsContent value="orders" className="space-y-4 sm:space-y-6">
            <Card className="p-3 sm:p-6">
              <OrderHistory />
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
            <Card className="p-3 sm:p-6">
              <div className="text-center py-8 sm:py-12">
                <BarChart3 className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Sales Analytics</h3>
                <p className="text-sm sm:text-base text-gray-600">Analytics dashboard coming soon...</p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}