"use client"

import { CardDescription } from "@/components/ui/card"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, DollarSign, Check, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { fetchAllPayments } from "./actions"
import { useAuth } from "@/lib/auth-context"
import { hasPermission } from "@/lib/rbac"
import type { Database } from "@/lib/database.types"
import { DataTable } from "@/components/ui/data-table"
import type { ColumnDef } from "@tanstack/react-table"

type PaymentData = Database["public"]["Tables"]["payments"]["Row"] & {
  company: Database["public"]["Tables"]["companies"]["Row"] | null
  subscription: Database["public"]["Tables"]["subscriptions"]["Row"] | null
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { userProfile } = useAuth()

  const canManageSubscriptionsAndPayments = hasPermission(userProfile, "can_manage_subscriptions_and_payments")

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const data = await fetchAllPayments()
      setPayments(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load payment data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!canManageSubscriptionsAndPayments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-600">
        <h2 className="text-2xl font-semibold mb-4">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

  const columns: ColumnDef<PaymentData>[] = [
    {
      accessorKey: "company.name",
      header: "Company",
      cell: ({ row }) => <div className="font-medium">{row.original.company?.name || "N/A"}</div>,
    },
    {
      accessorKey: "subscription.plan_type",
      header: "Subscription Plan",
      cell: ({ row }) => <div>{row.original.subscription?.plan_type || "N/A"}</div>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <div>
          {row.original.amount} {row.original.currency}
        </div>
      ),
    },
    {
      accessorKey: "payment_method",
      header: "Method",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.getValue("status") === "succeeded"
              ? "bg-green-100 text-green-800"
              : row.getValue("status") === "pending"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {String(row.getValue("status")).charAt(0).toUpperCase() + String(row.getValue("status")).slice(1)}
        </span>
      ),
    },
    {
      accessorKey: "transaction_id",
      header: "Transaction ID",
      cell: ({ row }) => <div>{row.getValue("transaction_id") || "-"}</div>,
    },
    {
      accessorKey: "paid_at",
      header: "Paid At",
      cell: ({ row }) => <div>{new Date(row.getValue("paid_at")).toLocaleDateString()}</div>,
    },
  ]

  const totalPayments = payments.length
  const successfulPayments = payments.filter((p) => p.status === "succeeded").length
  const pendingPayments = payments.filter((p) => p.status === "pending").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Payment History</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPayments}</div>
            <p className="text-xs text-muted-foreground">Overall count</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful Payments</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successfulPayments}</div>
            <p className="text-xs text-muted-foreground">Payments completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayments}</div>
            <p className="text-xs text-muted-foreground">Payments awaiting confirmation</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Transactions</CardTitle>
          <CardDescription>Detailed list of all payment transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <DataTable columns={columns} data={payments} filterColumn="company.name" exportFileName="payments" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
