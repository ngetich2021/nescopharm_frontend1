"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Wallet, RefreshCw } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { paymentMethodLabel } from "@/lib/payment-methods"
import { refundPaymentOverpayment } from "@/lib/invoices"
import { refundCreditNote } from "@/lib/credit-notes"
import { applyCustomerCredit, CustomerAccountBalance, fetchCustomerAccountBalance } from "@/lib/customer-balance"
import { ReceiveOnAccountModal } from "@/components/modals/receive-on-account-modal"
import { CustomerLedgerEntries } from "./customer-ledger-entries"

interface CustomerAccountProps {
  customerId: string
  customerName: string
}

type RefundSource = { kind: "payment" | "credit_note"; id: string; label: string; available: number }

const showDate = (d: string | null) => (d ? formatDate(d) : "—")

/**
 * The customer's running account on their CRM account: what they owe on every invoice (past
 * sales included), the money of theirs not yet on an invoice (overpayments, payments on
 * account, unused credit notes) and PD cheques waiting to mature - with Receive Payment,
 * Apply Credit and refunds.
 */
export function CustomerAccount({ customerId, customerName }: CustomerAccountProps) {
  const [data, setData] = useState<CustomerAccountBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [refundSource, setRefundSource] = useState<RefundSource | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await fetchCustomerAccountBalance(customerId))
    } catch (err: any) {
      setError(err.message || "Failed to load the customer's account")
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    if (customerId) load()
  }, [customerId, load])

  const handleApplyCredit = async () => {
    setApplying(true)
    try {
      const result = await applyCustomerCredit(customerId)
      toast({ title: "Credit applied", description: result.message })
      await load()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to apply credit", variant: "destructive" })
    } finally {
      setApplying(false)
    }
  }

  if (isLoading && !data) return <div className="p-6 text-sm text-muted-foreground">Loading account...</div>
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>
  if (!data) return null

  const t = data.totals
  const net = t.net_balance
  const canApply = t.credit_available > 0.005 && t.outstanding > 0.005

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Account {data.account?.account_number ? `• ${data.account.account_number}` : ""}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            {canApply && (
              <Button variant="outline" size="sm" onClick={handleApplyCredit} disabled={applying}>
                {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Apply Credit to Invoices
              </Button>
            )}
            <Button size="sm" onClick={() => setReceiveOpen(true)}>Receive Payment</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Figure label="Total Invoiced" value={t.invoiced} />
            <Figure label="Paid" value={t.paid} />
            <Figure label="Credited (credit notes)" value={t.credited} />
            <Figure label="Outstanding" value={t.outstanding} hint={t.overdue > 0 ? `${formatCurrency(t.overdue)} overdue` : undefined} hintClass="text-red-600" />
            <Figure label="Credit Available" value={t.credit_available} valueClass="text-green-700" hint="Customer's money not yet on an invoice" />
            <Figure label="PD Cheques Pending" value={t.pending_cheques} hint="Not counted until approved" />
            {t.deposits_on_uninvoiced_orders > 0 && (
              <Figure label="Deposits (not invoiced)" value={t.deposits_on_uninvoiced_orders} hint="Applied when the order is invoiced" />
            )}
            <div>
              <p className="text-xs text-muted-foreground">Net Balance</p>
              <p className={`text-lg font-semibold ${net > 0.005 ? "text-red-700" : net < -0.005 ? "text-green-700" : ""}`}>
                {formatCurrency(Math.abs(net))}
              </p>
              <p className="text-xs text-muted-foreground">
                {net > 0.005 ? "Customer owes" : net < -0.005 ? "In customer's favour" : "Settled"}
              </p>
            </div>
            {data.account?.credit_limit != null && (
              <Figure label="Credit Limit Left" value={t.available_credit_limit ?? 0} hint={`Limit ${formatCurrency(data.account.credit_limit)}`} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open Invoices (oldest first)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.open_invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S/No</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Credited</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.open_invoices.map((inv, idx) => (
                    <TableRow key={inv.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{showDate(inv.invoice_date)}</TableCell>
                      <TableCell className={inv.overdue ? "text-red-600" : ""}>{showDate(inv.due_date)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.total_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.amount_paid)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.amount_credited)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(inv.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Credit</CardTitle>
        </CardHeader>
        <CardContent>
          {data.unapplied_payments.length === 0 && data.unapplied_credit_notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unused payments or credit notes.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S/No</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...data.unapplied_payments.map((p) => ({
                      key: p.id,
                      source: `Payment - ${paymentMethodLabel(p.payment_method)}`,
                      reference: p.reference || p.id.slice(0, 8),
                      date: p.payment_date,
                      original: p.amount_paid,
                      available: p.available,
                      refund: { kind: "payment" as const, id: p.id, label: p.reference || p.id.slice(0, 8), available: p.available },
                    })),
                    ...data.unapplied_credit_notes.map((n) => ({
                      key: n.id,
                      source: "Credit Note",
                      reference: n.credit_note_number,
                      date: n.credit_note_date,
                      original: n.total_amount,
                      available: n.available,
                      refund: { kind: "credit_note" as const, id: n.id, label: n.credit_note_number, available: n.available },
                    })),
                  ].map((row, idx) => (
                    <TableRow key={row.key}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{row.source}</TableCell>
                      <TableCell className="font-medium">{row.reference}</TableCell>
                      <TableCell>{showDate(row.date)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.original)}</TableCell>
                      <TableCell className="text-right font-medium text-green-700">{formatCurrency(row.available)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setRefundSource(row.refund)}>Refund</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {canApply && (
            <p className="text-xs text-muted-foreground mt-2">
              &quot;Apply Credit to Invoices&quot; uses this credit on the open invoices, oldest first.
            </p>
          )}
        </CardContent>
      </Card>

      {data.pending_cheques.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PD Cheques Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S/No</TableHead>
                    <TableHead>Cheque #</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Matures</TableHead>
                    <TableHead>Pays</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pending_cheques.map((c, idx) => (
                    <TableRow key={c.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{c.cheque_number}</TableCell>
                      <TableCell>{c.bank_name}</TableCell>
                      <TableCell>{showDate(c.maturity_date)}</TableCell>
                      <TableCell className="text-sm">
                        {c.invoice_number
                          ?? (c.allocation_plan?.length
                            ? c.allocation_plan.map((l) => `${l.invoice_number} (${formatCurrency(l.amount)})`).join(", ")
                            : "Customer credit")}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(c.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Approve or bounce these from Sales &gt; Cheques once they mature. Until then no invoice changes.
            </p>
          </CardContent>
        </Card>
      )}

      <CustomerLedgerEntries customerId={customerId} />

      <ReceiveOnAccountModal
        isOpen={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        customerId={customerId}
        customerName={customerName}
        openInvoices={data.open_invoices}
        onRecorded={load}
      />

      <RefundCreditModal source={refundSource} onClose={() => setRefundSource(null)} onDone={load} />
    </div>
  )
}

function Figure({ label, value, hint, valueClass = "", hintClass = "text-muted-foreground" }: {
  label: string
  value: number
  hint?: string
  valueClass?: string
  hintClass?: string
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${valueClass}`}>{formatCurrency(value)}</p>
      {hint && <p className={`text-xs ${hintClass}`}>{hint}</p>}
    </div>
  )
}

// Hand the customer back money of theirs: an overpayment (can be by cheque, tracked till it
// clears) or an unused credit note.
function RefundCreditModal({ source, onClose, onDone }: { source: RefundSource | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState("cash")
  const [reason, setReason] = useState("")
  const [reference, setReference] = useState("")
  const [refundDate, setRefundDate] = useState(new Date().toISOString().split("T")[0])
  const [chequeNumber, setChequeNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [maturityDate, setMaturityDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (source) {
      setAmount(source.available)
      setMethod("cash")
      setReason("")
      setReference("")
      setChequeNumber("")
      setBankName("")
      setMaturityDate("")
    }
  }, [source])

  if (!source) return null
  const allowCheque = source.kind === "payment"
  const isCheque = method === "cheque"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fail = (description: string) => toast({ title: "Error", description, variant: "destructive" })
    if (amount <= 0 || amount > source.available + 0.005) return fail(`Amount must be between 0 and ${formatCurrency(source.available)}`)
    if (!reason.trim()) return fail("Please give a reason for the refund")
    if (isCheque && (!chequeNumber || !bankName || !maturityDate)) return fail("Please provide the cheque number, bank name, and maturity date")

    setIsSubmitting(true)
    try {
      const result = source.kind === "payment"
        ? await refundPaymentOverpayment(source.id, {
            amount,
            // The overpayment refund form calls M-Pesa "mobile_money".
            refund_method: method === "mpesa" ? "mobile_money" : (method as "cash" | "bank_transfer" | "cheque"),
            reason,
            reference: reference || undefined,
            refund_date: refundDate,
            ...(isCheque ? { cheque_number: chequeNumber, bank_name: bankName, maturity_date: maturityDate } : {}),
          })
        : await refundCreditNote(source.id, {
            amount,
            refund_reason: reason,
            refund_method: method,
            reference: reference || undefined,
            refund_date: refundDate,
          })
      toast({ title: "Refund recorded", description: result.message })
      onDone()
      onClose()
    } catch (err: any) {
      fail(err.message || "Failed to record refund")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={!!source} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund to Customer</DialogTitle>
          <div className="text-sm text-muted-foreground">
            {source.kind === "payment" ? "Overpayment" : "Credit note"} {source.label} • Available {formatCurrency(source.available)}
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rf_amount">Amount *</Label>
              <Input id="rf_amount" type="number" step="0.01" min="0.01" max={source.available} value={amount || ""} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rf_date">Refund Date *</Label>
              <Input id="rf_date" type="date" value={refundDate} onChange={(e) => setRefundDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rf_method">Paid Back By *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="rf_method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                {allowCheque && <SelectItem value="cheque">Cheque</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {isCheque && (
            <div className="grid grid-cols-3 gap-3 rounded-md border p-3 bg-muted/30">
              <Input placeholder="Cheque #" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
              <Input placeholder="Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
              <p className="col-span-3 text-xs text-muted-foreground">The refund stays pending until the cheque clears.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="rf_reason">Reason *</Label>
            <Input id="rf_reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer asked for the credit in cash" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rf_ref">Reference</Label>
            <Input id="rf_ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="M-Pesa code, bank ref..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Refund
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
