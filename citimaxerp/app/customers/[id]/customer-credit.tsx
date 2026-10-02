"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  fetchCustomerCreditTerms,
  fetchCustomerCreditTermsHistory,
  CustomerCreditTerms,
  CreditTermsChange,
} from "@/lib/customers"

interface CustomerCreditProps {
  customerId: string
}

function formatKES(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return "—"
  return `KES ${Number(amount).toLocaleString()}`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function statusColor(status: string): string {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800"
    case "rejected":
      return "bg-red-100 text-red-800"
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function fullName(person: { first_name: string; last_name: string } | null): string {
  if (!person) return "—"
  return `${person.first_name} ${person.last_name}`.trim() || "—"
}

export function CustomerCredit({ customerId }: CustomerCreditProps) {
  const [terms, setTerms] = useState<CustomerCreditTerms | null>(null)
  const [history, setHistory] = useState<CreditTermsChange[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const creditTerms = await fetchCustomerCreditTerms(customerId)
        if (cancelled) return
        setTerms(creditTerms)

        if (creditTerms.customer_account_id) {
          try {
            const changes = await fetchCustomerCreditTermsHistory(creditTerms.customer_account_id)
            if (!cancelled) setHistory(changes)
          } catch {
            // Staff without can_view_account_approvals just won't see history; not a hard error.
            if (!cancelled) setHistory([])
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load credit terms")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (customerId) load()
    return () => { cancelled = true }
  }, [customerId])

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading credit terms...</div>
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>
  }

  const isCreditCustomer = terms?.payment_method === "credit"

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Credit Terms</CardTitle>
        </CardHeader>
        <CardContent>
          {!isCreditCustomer ? (
            <p className="text-sm text-muted-foreground">
              This customer is registered for instant payment, not credit.
            </p>
          ) : terms?.credit_days ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Approved Terms</p>
                <p className="font-medium">Net {terms.credit_days} ({terms.credit_days} days)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credit Limit</p>
                <p className="font-medium">{formatKES(terms.credit_required)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Currently Used</p>
                <p className="font-medium">{formatKES(terms.credit_used)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Available Credit</p>
                <p className="font-semibold text-primary">{formatKES(terms.available_credit)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              No GM-approved credit terms on file yet.
            </p>
          )}
          {terms?.has_pending_change && (
            <p className="text-sm text-amber-700 mt-3">
              A terms change is pending GM approval and not yet in effect — the terms above are still the ones in use.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credit Terms History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No credit terms changes on record.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Limit Change</TableHead>
                  <TableHead>Terms Change</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell className="text-sm">{formatDate(change.approved_at || change.created_at)}</TableCell>
                    <TableCell className="text-sm">
                      {change.previous_credit_limit != null || change.new_credit_limit != null
                        ? `${formatKES(change.previous_credit_limit)} → ${formatKES(change.new_credit_limit)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {change.previous_credit_days != null || change.new_credit_days != null
                        ? `Net ${change.previous_credit_days ?? "—"} → Net ${change.new_credit_days ?? "—"}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{fullName(change.created_by)}</TableCell>
                    <TableCell className="text-sm">{fullName(change.approver)}</TableCell>
                    <TableCell>
                      <Badge className={statusColor(change.status)}>{change.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
