"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import { PAYMENT_METHODS } from "@/lib/payment-methods"
import { formatCurrency, formatDate } from "@/lib/utils"
import { AccountOpenInvoice, receiveOnAccount, recordChequeOnAccount } from "@/lib/customer-balance"

interface ReceiveOnAccountModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string
  customerName: string
  openInvoices: AccountOpenInvoice[]
  onRecorded?: () => void
}

const today = () => new Date().toISOString().split("T")[0]
const round2 = (n: number) => Math.round(n * 100) / 100

// Oldest invoice first, as far as the amount goes (open invoices arrive oldest first).
function oldestFirst(invoices: AccountOpenInvoice[], amount: number): Record<string, number> {
  let left = amount
  const split: Record<string, number> = {}
  for (const inv of invoices) {
    const put = round2(Math.max(0, Math.min(inv.balance, left)))
    split[inv.id] = put
    left = round2(left - put)
  }
  return split
}

/**
 * One payment or PD cheque from a customer, spread over several of their invoices. The split
 * starts oldest invoice first and can be changed line by line; anything not placed on an
 * invoice stays with the customer as credit.
 */
export function ReceiveOnAccountModal({ isOpen, onClose, customerId, customerName, openInvoices, onRecorded }: ReceiveOnAccountModalProps) {
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState("")
  const [paymentDate, setPaymentDate] = useState(today())
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [chequeNumber, setChequeNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [maturityDate, setMaturityDate] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [split, setSplit] = useState<Record<string, number>>({})
  const [manualSplit, setManualSplit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCheque = method === "cheque"
  const owed = useMemo(() => round2(openInvoices.reduce((s, i) => s + i.balance, 0)), [openInvoices])

  useEffect(() => {
    if (isOpen) {
      setAmount(owed)
      setMethod("")
      setPaymentDate(today())
      setReference("")
      setNotes("")
      setChequeNumber("")
      setBankName("")
      setMaturityDate("")
      setAttachment(null)
      setManualSplit(false)
      setSplit(oldestFirst(openInvoices, owed))
    }
  }, [isOpen, openInvoices, owed])

  useEffect(() => {
    if (!manualSplit) setSplit(oldestFirst(openInvoices, amount))
  }, [amount, manualSplit, openInvoices])

  const applied = round2(Object.values(split).reduce((s, v) => s + (v || 0), 0))
  const leftAsCredit = round2(amount - applied)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fail = (description: string) => toast({ title: "Error", description, variant: "destructive" })

    if (!method) return fail("Please select a payment method")
    if (amount <= 0) return fail("Amount must be greater than zero")
    if (leftAsCredit < -0.005) return fail("The split adds up to more than the amount received")
    const over = openInvoices.find((i) => (split[i.id] || 0) > i.balance + 0.005)
    if (over) return fail(`Invoice ${over.invoice_number} only owes ${formatCurrency(over.balance)}`)
    if (isCheque && (!chequeNumber || !bankName || !maturityDate)) return fail("Please provide the cheque number, bank name, and maturity date")

    const allocations = openInvoices
      .filter((i) => (split[i.id] || 0) > 0)
      .map((i) => ({ invoice_id: i.id, amount: round2(split[i.id]) }))

    setIsSubmitting(true)
    try {
      const result = isCheque
        ? await recordChequeOnAccount({
            customer_id: customerId,
            cheque_number: chequeNumber,
            bank_name: bankName,
            amount,
            issue_date: paymentDate,
            maturity_date: maturityDate,
            notes: notes || undefined,
            attachment,
            allocations,
          })
        : await receiveOnAccount(customerId, {
            amount,
            payment_method: method,
            payment_date: paymentDate,
            transaction_id: reference || undefined,
            notes: notes || undefined,
            allocations,
          })
      toast({ title: isCheque ? "Cheque recorded" : "Payment recorded", description: result.message })
      onRecorded?.()
      onClose()
    } catch (error: any) {
      fail(error.message || "Failed to record payment")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Payment</DialogTitle>
          <div className="text-sm text-muted-foreground">
            {customerName} • Owes {formatCurrency(owed)} on {openInvoices.length} invoice{openInvoices.length === 1 ? "" : "s"}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acc_amount">Amount Received *</Label>
              <Input
                id="acc_amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc_method">Payment Method *</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="acc_method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc_date">{isCheque ? "Cheque Date *" : "Payment Date *"}</Label>
              <Input id="acc_date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
            </div>
          </div>

          {isCheque ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-md border p-3 bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="acc_cheque_no">Cheque Number *</Label>
                <Input id="acc_cheque_no" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="e.g. 000123" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc_bank">Bank Name *</Label>
                <Input id="acc_bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Equity Bank" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc_maturity">Maturity Date *</Label>
                <Input id="acc_maturity" type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="acc_attachment">Cheque Image / PDF (optional)</Label>
                <Input id="acc_attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                <p className="text-xs text-muted-foreground">
                  The cheque stays pending and changes no invoice until it matures and is approved (Sales &gt; Cheques). If it bounces, nothing is applied.
                  Its maturity must fall within the customer&apos;s PD cheque credit period for every invoice it pays.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="acc_ref">Transaction Reference</Label>
              <Input id="acc_ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="M-Pesa code, bank reference..." />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Apply to invoices</Label>
              {manualSplit && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setManualSplit(false)}>
                  Reset to oldest first
                </Button>
              )}
            </div>
            {openInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border p-3">
                No open invoices. The whole amount will be kept as the customer&apos;s credit.
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">S/No</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right w-40">Apply</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openInvoices.map((inv, idx) => (
                      <TableRow key={inv.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">
                          {inv.invoice_number}
                          {inv.overdue && <span className="ml-2 text-xs text-red-600">overdue</span>}
                        </TableCell>
                        <TableCell>{inv.invoice_date ? formatDate(inv.invoice_date) : "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.balance)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={inv.balance}
                            className="h-8 text-right"
                            value={split[inv.id] ?? 0}
                            onChange={(e) => {
                              setManualSplit(true)
                              setSplit((prev) => ({ ...prev, [inv.id]: parseFloat(e.target.value) || 0 }))
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
              <span>Applied: <strong>{formatCurrency(applied)}</strong></span>
              <span className={leftAsCredit < -0.005 ? "text-red-600" : ""}>
                {leftAsCredit < -0.005 ? "Over by" : "Kept as customer credit"}: <strong>{formatCurrency(Math.abs(leftAsCredit))}</strong>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc_notes">Notes</Label>
            <Textarea id="acc_notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCheque ? "Record Cheque" : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
