"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Landmark } from "lucide-react"
import { Cheque, getChequeStatusColor } from "@/lib/cheques"
import { formatCurrency, formatDate } from "@/lib/utils"

interface CustomerChequesProps {
  customerId: string
  initialCheques: Cheque[]
}

/**
 * Post-dated cheques received from this customer, recorded here as its own
 * "PD Cheque Received" section - separate from the ordinary payment
 * history, since a pending cheque isn't yet a receivable. The tab this
 * lives in only renders when initialCheques is non-empty, so there's no
 * loading/empty state to handle here.
 */
export function CustomerCheques({ initialCheques }: CustomerChequesProps) {
  const cheques = initialCheques

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4" />
          PD Cheques Received
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead>Cheque #</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Maturity Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cheques.map((cheque) => (
                <TableRow key={cheque.id}>
                  <TableCell className="text-sm font-medium text-blue-700">PD Cheque Received</TableCell>
                  <TableCell>{cheque.cheque_number}</TableCell>
                  <TableCell>{cheque.bank_name}</TableCell>
                  <TableCell>{cheque.invoice?.invoice_number || "-"}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(cheque.amount)}</TableCell>
                  <TableCell>{formatDate(cheque.issue_date)}</TableCell>
                  <TableCell>{formatDate(cheque.maturity_date)}</TableCell>
                  <TableCell>
                    <Badge className={getChequeStatusColor(cheque.status)}>
                      {cheque.status.charAt(0).toUpperCase() + cheque.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
