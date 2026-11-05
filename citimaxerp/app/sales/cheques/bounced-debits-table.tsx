"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TablePager, usePaged } from "@/components/ui/table-pager"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { toast } from "@/components/ui/use-toast"
import { Cheque, fetchCheques } from "@/lib/cheques"
import { getCustomerDisplayName } from "@/lib/customers"
import { formatCurrency, formatDate, matchesDocNumber } from "@/lib/utils"

const num = (value: string | number | null | undefined) => Number(value) || 0

// DEB-012 is 12. A bounced cheque with no debit goes last.
const debitOrder = (cheque: Cheque) => {
  const match = cheque.bounce_charge_invoice?.invoice_number?.match(/(\d+)$/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function debitStatus(cheque: Cheque): { label: string; className: string } {
  const debit = cheque.bounce_charge_invoice
  if (!debit) return { label: "No debit", className: "bg-gray-100 text-gray-800" }
  if (num(debit.balance_amount) <= 0.005) return { label: "Paid", className: "bg-green-100 text-green-800" }
  if (num(debit.amount_paid) > 0.005) return { label: "Part Paid", className: "bg-yellow-100 text-yellow-800" }
  return { label: "Unpaid", className: "bg-red-100 text-red-800" }
}

// Every bounced customer cheque with its KES 2,000 debit, from DEB-001 to date.
export function BouncedDebitsTable() {
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchCheques({ status: "bounced", direction: "received" })
      .then((rows) => setCheques([...rows].sort((a, b) => debitOrder(a) - debitOrder(b))))
      .catch((error: any) =>
        toast({ title: "Error", description: error?.message || "Failed to load bounced cheques", variant: "destructive" })
      )
      .finally(() => setIsLoading(false))
  }, [])

  const customerOf = (cheque: Cheque) => (cheque.customer ? getCustomerDisplayName(cheque.customer) : "-")

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    if (!term) return cheques
    return cheques.filter(
      (c) =>
        matchesDocNumber(c.bounce_charge_invoice?.invoice_number, term) ||
        c.cheque_number.toLowerCase().includes(term) ||
        c.bank_name.toLowerCase().includes(term) ||
        customerOf(c).toLowerCase().includes(term)
    )
  }, [cheques, searchQuery])

  const { pageRows, start, pager } = usePaged(filtered, 20, searchQuery)

  const totals = useMemo(
    () => ({
      cheques: filtered.reduce((sum, c) => sum + num(c.amount), 0),
      debit: filtered.reduce((sum, c) => sum + num(c.bounce_charge_invoice?.total_amount), 0),
      paid: filtered.reduce((sum, c) => sum + num(c.bounce_charge_invoice?.amount_paid), 0),
      balance: filtered.reduce((sum, c) => sum + num(c.bounce_charge_invoice?.balance_amount), 0),
    }),
    [filtered]
  )

  const onExport = useTableExport(() => ({
    fileName: "Bounced Cheque Debit",
    title: "Bounced Cheque Debit",
    headers: ["S/No", "Debit No.", "Date", "Customer", "Cheque No.", "Bank", "Cheque Amount", "Debit", "Paid", "Balance", "Status"],
    moneyColumns: [6, 7, 8, 9],
    rows: filtered.map((c, i) => [
      i + 1,
      c.bounce_charge_invoice?.invoice_number ?? "-",
      c.bounce_charge_invoice ? formatDate(c.bounce_charge_invoice.invoice_date) : "-",
      customerOf(c),
      c.cheque_number,
      c.bank_name,
      num(c.amount),
      num(c.bounce_charge_invoice?.total_amount),
      num(c.bounce_charge_invoice?.amount_paid),
      num(c.bounce_charge_invoice?.balance_amount),
      debitStatus(c).label,
    ]),
    footer: [["", "", "", "", "", "Total", totals.cheques, totals.debit, totals.paid, totals.balance, ""]],
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
          <Input
            className="pl-8 max-w-sm sm:w-80"
            placeholder="Search DEB no., cheque #, bank, customer..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <ExportMenu onExport={onExport} className="w-fit" disabled={filtered.length === 0} />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold w-12">S/No</TableHead>
              <TableHead className="font-semibold">Debit No.</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">Cheque No.</TableHead>
              <TableHead className="font-semibold">Bank</TableHead>
              <TableHead className="font-semibold text-right">Cheque Amount</TableHead>
              <TableHead className="font-semibold text-right">Debit</TableHead>
              <TableHead className="font-semibold text-right">Paid</TableHead>
              <TableHead className="font-semibold text-right">Balance</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading bounced cheques...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No bounced cheques found</p>
                    <p className="text-sm">A customer cheque marked as bounced gets its debit here</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((cheque, i) => {
                const debit = cheque.bounce_charge_invoice
                const status = debitStatus(cheque)
                return (
                  <TableRow key={cheque.id} className="hover:bg-gray-50">
                    <TableCell>{start + i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {debit ? (
                        <Link href={`/sales/invoices/${debit.id}/document`} className="text-primary hover:underline">
                          {debit.invoice_number}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{debit ? formatDate(debit.invoice_date) : "-"}</TableCell>
                    <TableCell>{customerOf(cheque)}</TableCell>
                    <TableCell>{cheque.cheque_number}</TableCell>
                    <TableCell>{cheque.bank_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cheque.amount)}</TableCell>
                    <TableCell className="text-right">{debit ? formatCurrency(debit.total_amount) : "-"}</TableCell>
                    <TableCell className="text-right">{debit ? formatCurrency(debit.amount_paid) : "-"}</TableCell>
                    <TableCell className="text-right font-medium">{debit ? formatCurrency(debit.balance_amount) : "-"}</TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow className="font-semibold">
                <TableCell colSpan={6} className="text-right">Total</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.cheques)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.debit)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.paid)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.balance)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      <TablePager {...pager} />
    </div>
  )
}
