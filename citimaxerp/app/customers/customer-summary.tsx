"use client"

import { useEffect, useState, useCallback } from "react"
import { getCustomers, type Customer } from "@/lib/customers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserPlus, Repeat2, RefreshCw, TrendingUp } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

// Helper function to detect PDO errors
const isPdoError = (error: any): boolean => {
  if (!error) return false;
  const errorMsg = typeof error === 'string' 
    ? error.toLowerCase() 
    : typeof error.message === 'string' 
      ? error.message.toLowerCase() 
      : '';
  
  return errorMsg.includes('prepared statement') || 
         errorMsg.includes('pdo_stmt') ||
         errorMsg.includes('database error');
}

// This component is exported as a default export.
export default function CustomerSummary() {
  const { isLoading: isAuthLoading } = useAuth()
  const { toast } = useToast()

  const [totalCustomers, setTotalCustomers] = useState<number>(0)
  const [activeCustomers, setActiveCustomers] = useState<number>(0)
  const [newCustomers, setNewCustomers] = useState<number>(0)
  const [repeatPurchaseRate, setRepeatPurchaseRate] = useState<number>(0)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    // Check if auth is still loading
    if (isAuthLoading) {
      setIsLoading(true)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      // Add a small delay to ensure auth is loaded (helps with race conditions)
      if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // No need to pass companyId anymore
      const customers: Customer[] = await getCustomers() 

      const total = customers.length
      setTotalCustomers(total)

      // Count active customers
      const activeCount = customers.filter((customer) => 
        customer?.status === 'active'
      ).length
      setActiveCustomers(activeCount)

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Add null checks before accessing customer properties
      const newCustomersCount = customers.filter((customer) => 
        customer?.created_at && new Date(customer.created_at) > thirtyDaysAgo
      ).length
      setNewCustomers(newCustomersCount)

      // Add null checks before accessing customer properties
      const repeatCustomers = customers.filter((customer) => 
        customer?.total_orders && customer.total_orders > 1
      ).length
      const calculatedRepeatRate = total > 0 ? (repeatCustomers / total) * 100 : 0
      setRepeatPurchaseRate(Number.parseFloat(calculatedRepeatRate.toFixed(1)))
      
      // Reset retry count on success
      setRetryCount(0)
      // Update last refresh time
      setLastRefreshTime(new Date())
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.")
      
      // If it's a company_id on null error, show a specific message
      if (e.message && e.message.includes("company_id") && e.message.includes("null")) {
        setError("Authentication error. Please refresh the page.");
        toast({
          title: "Authentication issue",
          description: "Please sign out and sign back in to fix this issue.",
          variant: "destructive",
        });
        return;
      }
      
      // If it's a PDO error and we haven't retried too many times, schedule a retry
      if (isPdoError(e) && retryCount < 3) {
        const nextRetry = retryCount + 1;
        setRetryCount(nextRetry);
        
        // Exponential backoff: 1s, 2s, 4s
        const retryDelay = 1000 * Math.pow(2, retryCount);
        
        setTimeout(() => {
          fetchData();
        }, retryDelay);
        
        // Show a toast for the retry attempt
        toast({
          title: "Database connection issue",
          description: "Retrying automatically...",
        });
      } else if (retryCount >= 3) {
        // If we've already retried several times, show a different message
        setError("Having trouble connecting to the database. Try refreshing.")
        toast({
          title: "Connection issues",
          description: "Please try again in a moment or contact support if this persists.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false)
    }
  }, [isAuthLoading, retryCount, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData]) // Now depends on fetchData which includes retryCount

  const handleManualRefresh = () => {
    setRetryCount(0) // Reset retry count on manual refresh
    fetchData()
  }

  const displayLoading = isLoading || isAuthLoading

  // Skeleton loader for loading state
  if (displayLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {/* Total Customers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          <Users className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCustomers}</div>
          <p className="text-xs text-muted-foreground">
            {activeCustomers} active customers
          </p>
        </CardContent>
      </Card>

      {/* New Customers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">New Customers</CardTitle>
          <UserPlus className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{newCustomers}</div>
          <p className="text-xs text-muted-foreground">Added in last 30 days</p>
        </CardContent>
      </Card>

      {/* Active Customers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeCustomers}</div>
          <p className="text-xs text-muted-foreground">Currently active</p>
        </CardContent>
      </Card>

      {/* Repeat Purchase Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Repeat Purchase Rate</CardTitle>
          <Repeat2 className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{repeatPurchaseRate}%</div>
          <p className="text-xs text-muted-foreground">Customer retention</p>
        </CardContent>
      </Card>
    </div>
  )
}
