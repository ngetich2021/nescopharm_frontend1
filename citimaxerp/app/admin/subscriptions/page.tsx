"use client"

import { CardDescription } from "@/components/ui/card"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Edit, Trash2, PlusCircle, CreditCard, Check, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { hasPermission } from "@/lib/rbac"
import type { Company } from "@/app/types"
import { 
  getCompanies,
  getCompanySubscriptions,
  type CompanySubscription 
} from "@/lib/admin"
import { DataTable } from "@/components/ui/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { EditSubscriptionSheet } from "./components/edit-subscription-sheet"

type SubscriptionWithCompany = CompanySubscription & {
  company_name?: string
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithCompany[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionWithCompany | null>(null)
  const { toast } = useToast()
  const { userProfile } = useAuth()

  const canManageSubscriptionsAndPayments = hasPermission(
    userProfile ? {
      ...userProfile,
      role: userProfile.role ? {
        ...userProfile.role,
        permissions: userProfile.role.permissions ? Object.keys(userProfile.role.permissions) : undefined
      } : null
    } : null,
    "can_manage_subscriptions_and_payments"
  )

  useEffect(() => {
    loadSubscriptions()
  }, [])

  const loadSubscriptions = async () => {
    setLoading(true)
    try {
      // Load companies first
      const companiesResult = await getCompanies({ per_page: 1000 })
      const companiesData = companiesResult.data || []
      
      // Load subscriptions for all companies
      const allSubscriptions: SubscriptionWithCompany[] = []
      for (const company of companiesData) {
        try {
          const companySubscriptions = await getCompanySubscriptions(company.id)
          // Add company name to each subscription
          const subscriptionsWithCompany = companySubscriptions.map(sub => ({
            ...sub,
            company_name: company.name
          }))
          allSubscriptions.push(...subscriptionsWithCompany)
        } catch (error) {
          console.warn(`Failed to load subscriptions for company ${company.name}:`, error)
        }
      }
      
      setSubscriptions(allSubscriptions)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load subscription data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditSubscription = (subscription: SubscriptionWithCompany) => {
    setEditingSubscription(subscription)
    setIsSheetOpen(true)
  }

  const handleDeleteSubscription = async (subscriptionId: number) => {
    if (!confirm("Are you sure you want to delete this subscription? This action cannot be undone.")) {
      return
    }
    try {
      // TODO: Implement delete subscription in admin library
      toast({
        title: "Info",
        description: "Delete subscription functionality not yet implemented",
        variant: "default",
      })
      // await deleteSubscription(subscriptionId)
      // await loadSubscriptions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    }
  }

  const openCreateModal = () => {
    setEditingSubscription(null)
    setIsSheetOpen(true)
  }

  if (!canManageSubscriptionsAndPayments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-600">
        <h2 className="text-2xl font-semibold mb-4">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

  const columns: ColumnDef<SubscriptionWithCompany>[] = [
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ row }) => <div className="font-medium">{row.getValue("company_name") || "N/A"}</div>,
    },
    {
      accessorKey: "plan_name",
      header: "Plan Name",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.getValue("status") === "active"
              ? "bg-green-100 text-green-800"
              : row.getValue("status") === "trialing"
                ? "bg-blue-100 text-blue-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {String(row.getValue("status")).charAt(0).toUpperCase() + String(row.getValue("status")).slice(1)}
        </span>
      ),
    },
    {
      accessorKey: "payments",
      header: "Latest Payment",
      cell: ({ row }) => {
        const payments = row.original.payments || []
        const latestPayment = payments.length > 0 ? payments[0] : null
        return (
          <div>
            {latestPayment ? `${latestPayment.amount} ${latestPayment.currency}` : "No payments"}
          </div>
        )
      },
    },
    {
      accessorKey: "started_at",
      header: "Started",
      cell: ({ row }) => <div>{new Date(row.getValue("started_at")).toLocaleDateString()}</div>,
    },
    {
      accessorKey: "expires_at",
      header: "Expires",
      cell: ({ row }) => <div>{new Date(row.getValue("expires_at")).toLocaleDateString()}</div>,
    },
    {
      accessorKey: "auto_renew",
      header: "Auto Renew",
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs ${row.getValue("auto_renew") ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
          {row.getValue("auto_renew") ? "Yes" : "No"}
        </span>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleEditSubscription(row.original)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteSubscription(Number(row.original.id))}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const totalSubscriptions = Array.isArray(subscriptions) ? subscriptions.length : 0
  const activeSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter((s) => s.status === "active").length : 0
  const trialingSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter((s) => s.status === "trialing").length : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <Button size="sm" onClick={openCreateModal}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Subscription
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Overall count</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trialing Subscriptions</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trialingSubscriptions}</div>
            <p className="text-xs text-muted-foreground">In trial period</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription List</CardTitle>
          <CardDescription>Manage all active and inactive subscriptions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={Array.isArray(subscriptions) ? subscriptions : []}
              filterColumn="company_name"
              exportFileName="subscriptions"
            />
          )}
        </CardContent>
      </Card>
      
      <EditSubscriptionSheet
        subscription={editingSubscription}
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onSubscriptionUpdated={loadSubscriptions}
      />
    </div>
  )
}
