"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Ban, CreditCard, Loader2, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { cancelCustomerReceipt, deleteCustomerReceipt, fetchCustomerReceipts, type CustomerReceipt } from "@/lib/customer-balance"

const kes = (v: number) => `KES ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Every payment received from the customer (cash, M-Pesa, bank, approved cheques). Cancelling or
// deleting one captured in error takes its money back off the invoices it paid; a cancelled one
// stays listed as cancelled.
export function CustomerReceipts({ customerId }: { customerId: string }) {
  const { toast } = useToast()
  const [receipts, setReceipts] = useState<CustomerReceipt[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setReceipts(await fetchCustomerReceipts(customerId))
    } catch (error: any) {
      setReceipts([])
      toast({ title: "Error", description: error?.message || "Could not load payments", variant: "destructive" })
    }
  }, [customerId, toast])

  useEffect(() => {
    load()
  }, [load])

  const act = async (r: CustomerReceipt, cancel: boolean) => {
    const verb = cancel ? "Cancel" : "Delete"
    const paid = r.applied.map((a) => `${kes(a.amount)} on ${a.invoice_number ?? "an invoice"}`).join(", ")
    const ok = window.confirm(
      `${verb} this ${paymentMethodLabel(r.payment_method)} payment of ${kes(r.amount)}?` +
        (paid ? `\n\nIt comes back off: ${paid}. Those invoices will owe it again.` : "") +
        (r.cheque_number ? `\n\nCheque ${r.cheque_number} will be ${cancel ? "cancelled" : "deleted"} too.` : "") +
        (cancel ? "\n\nIt stays in this list marked Cancelled." : "\n\nIt is removed for good.")
    )
    if (!ok) return

    setBusyId(r.id)
    try {
      const result = cancel ? await cancelCustomerReceipt(customerId, r.id) : await deleteCustomerReceipt(customerId, r.id)
      toast({ title: cancel ? "Payment cancelled" : "Payment deleted", description: result.message })
      await load()
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || `Could not ${verb.toLowerCase()} payment`, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const live = (receipts ?? []).filter((r) => r.status !== "cancelled")
  const total = live.reduce((sum, r) => sum + r.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payments Received
          </span>
          {live.length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              {live.length} payment{live.length === 1 ? "" : "s"} · {kes(total)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {receipts === null ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium border-b">S/No</th>
                  <th className="px-2 py-1.5 text-left font-medium border-b">Date</th>
                  <th className="px-2 py-1.5 text-left font-medium border-b">Method</th>
                  <th className="px-2 py-1.5 text-left font-medium border-b">Reference</th>
                  <th className="px-2 py-1.5 text-right font-medium border-b">Amount</th>
                  <th className="px-2 py-1.5 text-right font-medium border-b">Credit</th>
                  <th className="px-2 py-1.5 border-b" />
                </tr>
              </thead>
              <tbody>
                {receipts.map((r, i) => (
                  <tr key={r.id} className={`border-b last:border-b-0 align-top ${r.status === "cancelled" ? "text-gray-400" : ""}`}>
                    <td className="px-2 py-1.5">{i + 1}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {r.payment_date ? format(new Date(r.payment_date), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">{paymentMethodLabel(r.payment_method)}</Badge>
                        {r.status === "cancelled" && (
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">Cancelled</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      {r.cheque_number ? `Cheque ${r.cheque_number}` : r.reference || <span className="text-gray-400">—</span>}
                    </td>
                    <td className={`px-2 py-1.5 text-right whitespace-nowrap font-medium ${r.status === "cancelled" ? "line-through" : ""}`}>
                      {kes(r.amount)}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {r.credit > 0.005 ? kes(r.credit) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <PermissionGuard permissions={["can_delete_invoices", "can_manage_system", "can_manage_company"]} hideOnDenied>
                        {busyId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin inline-block text-gray-500" />
                        ) : (
                          <div className="inline-flex gap-1">
                            {r.status !== "cancelled" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                                disabled={busyId !== null}
                                onClick={() => act(r, true)}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                Cancel
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                              disabled={busyId !== null}
                              onClick={() => act(r, false)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </PermissionGuard>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
