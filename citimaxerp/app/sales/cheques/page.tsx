"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle, Clock, Landmark } from "lucide-react"
import { useDataCache } from "@/lib/data-cache"
import { Cheque, fetchCheques } from "@/lib/cheques"
import { formatCurrency } from "@/lib/utils"
import { PermissionGuard } from "@/components/PermissionGuard"
import { ChequesTable } from "./cheques-table"

export default function ChequesPage() {
  const { data } = useDataCache<Cheque[]>(
    "cheques",
    () => fetchCheques(),
    { expirationMs: 5 * 60 * 1000 }
  )
  const cheques = data ?? []

  const now = new Date(new Date().toDateString())
  const pendingCheques = cheques.filter((c) => c.status === "pending")
  const overdueCheques = pendingCheques.filter((c) => new Date(c.maturity_date) < now)

  const summary = {
    pendingCount: pendingCheques.length,
    pendingValue: pendingCheques.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0),
    overdueCount: overdueCheques.length,
    approvedValue: cheques
      .filter((c) => c.status === "approved")
      .reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0),
  }

  return (
    <PermissionGuard permissions={["can_view_sales_menu", "can_manage_system", "can_manage_company"]}>
      <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Cheques</h1>
            <p className="text-sm text-muted-foreground">
              Post-dated cheques received from customers and issued to suppliers. The MD and GM are alerted a
              week before any pending cheque matures.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending Cheques</CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{summary.pendingCount}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Awaiting maturity/approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending Value</CardTitle>
              <Landmark className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{formatCurrency(summary.pendingValue)}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Not yet a receivable</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Matured, Unapproved</CardTitle>
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{summary.overdueCount}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Past maturity date, needs action</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Approved Value</CardTitle>
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{formatCurrency(summary.approvedValue)}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Applied to invoices as receivables</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <ChequesTable initialCheques={cheques} />
        </div>
      </div>
    </PermissionGuard>
  )
}
