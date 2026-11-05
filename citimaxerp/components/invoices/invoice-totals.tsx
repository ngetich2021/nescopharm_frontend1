"use client"

import { CheckCircle2, Clock, Hash, Wallet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

interface InvoiceTotalsProps {
  count: number
  total: number
  paid: number
  unpaid: number
  loading?: boolean
  // Under the unpaid figure, e.g. why paid and unpaid don't add up to the total.
  unpaidNote?: string
}

/** Total value, paid, unpaid and number of what the list is showing now: they follow its search and filters. */
export function InvoiceTotals({ count, total, paid, unpaid, loading, unpaidNote }: InvoiceTotalsProps) {
  const cards = [
    { title: "Total Value", value: formatCurrency(total), icon: Wallet, color: "text-blue-500", note: undefined },
    { title: "Paid", value: formatCurrency(paid), icon: CheckCircle2, color: "text-green-600", note: undefined },
    { title: "Unpaid", value: formatCurrency(unpaid), icon: Clock, color: "text-amber-600", note: unpaidNote },
    { title: "Number of Invoices", value: count.toLocaleString(), icon: Hash, color: "text-gray-500", note: undefined },
  ]

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map(({ title, value, icon: Icon, color, note }) => (
        <Card key={title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={`h-4 w-4 ${color}`} />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{value}</div>
                {note && <p className="text-xs text-muted-foreground">{note}</p>}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
