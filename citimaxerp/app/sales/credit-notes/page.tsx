"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock, DollarSign, FileText } from "lucide-react"
import { useDataCache } from "@/lib/data-cache"
import { CreditNote, fetchCreditNotes, parseCreditNoteAmount } from "@/lib/credit-notes"
import { formatCurrency } from "@/lib/utils"
import { PermissionGuard } from "@/components/PermissionGuard"
import { CreditNotesTable } from "./credit-notes-table"

export default function CreditNotesPage() {
  const {
    data: creditNotesResponse,
  } = useDataCache<{ data: CreditNote[]; meta?: any }>(
    "credit-notes",
    () => fetchCreditNotes({ per_page: 1000 }),
    {
      expirationMs: 5 * 60 * 1000,
    }
  )

  const creditNotes = creditNotesResponse?.data || []

  const creditNotesSummary = {
    totalCreditNotes: creditNotes.length,
    issuedCreditNotes: creditNotes.filter((item) => item.status?.toLowerCase() === "issued").length,
    refundedCreditNotes: creditNotes.filter((item) => item.status?.toLowerCase() === "refunded").length,
    totalCreditValue: creditNotes.reduce((sum, item) => sum + parseCreditNoteAmount(item.total_amount), 0),
  }

  return (
    <PermissionGuard permissions={["can_view_sales_menu", "can_manage_system", "can_manage_company"]}>
      <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Credit Notes</h1>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Credit Notes</CardTitle>
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{creditNotesSummary.totalCreditNotes}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">All created credit notes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Issued Credit Notes</CardTitle>
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{creditNotesSummary.issuedCreditNotes}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Ready to apply to invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Refunded Credit Notes</CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{creditNotesSummary.refundedCreditNotes}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Converted to customer refunds</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Credit Value</CardTitle>
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{formatCurrency(creditNotesSummary.totalCreditValue)}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Sum of all credit notes</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <h3 className="text-xl font-semibold">Recent Credit Notes</h3>
          <CreditNotesTable initialCreditNotes={creditNotes} />
        </div>
      </div>
    </PermissionGuard>
  )
}
