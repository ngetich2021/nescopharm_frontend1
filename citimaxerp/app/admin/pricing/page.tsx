"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Check, FileText, Loader2 } from "lucide-react"
import { PricingTable } from "./components/pricing-table"
import { CreatePricingButton } from "./components/create-pricing-button"
import { toast } from "@/hooks/use-toast"
import { getSubscriptionPlans, type SubscriptionPlan } from "@/lib/admin"

export default function AdminPricingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPricingPlans()
  }, [])

  const loadPricingPlans = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getSubscriptionPlans(false) // Only active plans by default
      setPlans(data || [])
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load pricing plans"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const totalPlans = plans?.length || 0
  const activePlans = plans?.filter(p => p.is_active)?.length || 0
  const draftPlans = plans?.filter(p => !p.is_active)?.length || 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#E30040]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pricing Plans</h1>
        <CreatePricingButton />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlans}</div>
            <p className="text-xs text-muted-foreground">Overall count</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePlans}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Plans</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftPlans}</div>
            <p className="text-xs text-muted-foreground">Plans not yet active</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-red-500 mb-4">Error loading pricing plans: {error}</div>
              <p className="text-sm text-muted-foreground">
                This error indicates that the admin API endpoints are not yet implemented on the backend server.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Manage Subscription Plans</CardTitle>
            <CardDescription>
              View, add, edit, and delete the subscription plans available to your customers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PricingTable plans={plans || []} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
