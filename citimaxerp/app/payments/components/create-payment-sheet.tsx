"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createPayment } from "@/lib/payments"
import { fetchInvoices, recordInvoicePayment, type Invoice } from "@/lib/invoices"
import { getCustomers, Customer, getCustomerDisplayName } from "@/lib/customers"
import { formatCurrency } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { INSTANT_PAYMENT_METHODS } from "@/lib/payment-methods"
import { fetchCustomerAccountBalance, receiveOnAccount } from "@/lib/customer-balance"

// An invoice that still owes money, whichever list it came from.
interface OpenInvoiceOption {
  id: string
  invoice_number: string
  customer_id: string
  due_date: string | null
  balance: number
  overdue?: boolean
}

interface CreatePaymentSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onPaymentCreated: () => void
}

export function CreatePaymentSheet({ isOpen, onOpenChange, onPaymentCreated }: CreatePaymentSheetProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    customer_id: "",
    invoice_id: "",
    amount_paid: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "mpesa",
    transaction_id: "",
    status: "completed",
  })

  const [customers, setCustomers] = useState<Customer[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("");

  // Load customers and invoices when the sheet is opened
  useEffect(() => {
    if (isOpen) {
      fetchCustomers()
      fetchOutstandingInvoices()
    }
  }, [isOpen])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const fetchCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const data = await getCustomers()
      console.log('Fetched customers for payments:', data)
      setCustomers(data || [])
    } catch (error: any) {
      console.error('Error fetching customers for payments:', error)
      toast({
        title: "Error",
        description: `Failed to load customers: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      })
      // Set empty array on error to prevent undefined issues
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }

  const fetchOutstandingInvoices = async () => {
    setLoadingInvoices(true)
    try {
      const { data } = await fetchInvoices()
      // Only invoices that still owe something are worth paying against here
      setInvoices((data || []).filter(inv => parseFloat(String(inv.balance_amount ?? 0)) > 0))
    } catch (error: any) {
      console.error('Error fetching invoices for payments:', error)
      toast({
        title: "Error",
        description: `Failed to load invoices: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      })
      setInvoices([])
    } finally {
      setLoadingInvoices(false)
    }
  }

  // Once a customer is picked, their unpaid invoices come from their account, oldest first:
  // the order they should be paid in.
  const [customerInvoices, setCustomerInvoices] = useState<OpenInvoiceOption[] | null>(null)
  useEffect(() => {
    if (!formData.customer_id) {
      setCustomerInvoices(null)
      return
    }
    let cancelled = false
    setLoadingInvoices(true)
    fetchCustomerAccountBalance(formData.customer_id)
      .then((account) => {
        if (cancelled) return
        setCustomerInvoices(account.open_invoices.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          customer_id: formData.customer_id,
          due_date: inv.due_date,
          balance: inv.balance,
          overdue: inv.overdue,
        })))
      })
      .catch((error: any) => {
        if (cancelled) return
        console.error('Error fetching customer invoices:', error)
        setCustomerInvoices([])
      })
      .finally(() => {
        if (!cancelled) setLoadingInvoices(false)
      })
    return () => {
      cancelled = true
    }
  }, [formData.customer_id])

  const filteredInvoices: OpenInvoiceOption[] = customerInvoices ?? invoices.map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    customer_id: inv.customer_id,
    due_date: inv.due_date ?? null,
    balance: parseFloat(String(inv.balance_amount)),
  }))

  const selectedInvoice = filteredInvoices.find((inv) => inv.id === formData.invoice_id)
  const selectedInvoiceBalance = selectedInvoice ? selectedInvoice.balance : null
  // A customer's payment with no invoice picked is applied to their oldest unpaid invoices first.
  const receivingOnAccount = !formData.invoice_id && !!formData.customer_id && formData.status === "completed"

  // Never let the field itself hold more than what's owed - clamp as they type
  // rather than only catching it at submit time.
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    if (selectedInvoiceBalance !== null && value !== "" && parseFloat(value) > selectedInvoiceBalance) {
      value = String(selectedInvoiceBalance)
    }
    setFormData((prev) => ({ ...prev, amount_paid: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (selectedInvoiceBalance !== null && Number(formData.amount_paid) > selectedInvoiceBalance) {
      toast({
        title: "Error",
        description: `Payment amount cannot exceed the balance owed of ${formatCurrency(selectedInvoiceBalance)} on this invoice`,
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    try {
      if (formData.invoice_id) {
        // Settling a specific invoice - reuse the same path the invoice's own
        // "Record Payment" uses, so balance/status tracking stays consistent.
        await recordInvoicePayment(formData.invoice_id, {
          amount: Number(formData.amount_paid),
          payment_method: formData.payment_method,
          payment_date: formData.payment_date,
          transaction_id: formData.transaction_id || undefined,
        })
      } else if (receivingOnAccount) {
        await receiveOnAccount(formData.customer_id, {
          amount: Number(formData.amount_paid),
          payment_method: formData.payment_method,
          payment_date: formData.payment_date,
          transaction_id: formData.transaction_id || undefined,
        })
      } else {
        // No invoice selected - a standalone payment not tied to anything specific
        const payloadData: any = {
          amount_paid: Number(formData.amount_paid),
          payment_method: formData.payment_method,
          payment_date: formData.payment_date,
          status: formData.status,
        }
        if (formData.customer_id) {
          payloadData.customer_id = formData.customer_id
        }
        if (formData.transaction_id) {
          payloadData.transaction_id = formData.transaction_id
        }
        await createPayment(payloadData)
      }

      toast({
        title: "Success",
        description: "Payment recorded successfully",
      })

      onPaymentCreated()
      onOpenChange(false)

      // Reset form
      setFormData({
        customer_id: "",
        invoice_id: "",
        amount_paid: "",
        payment_date: new Date().toISOString().split("T")[0],
        payment_method: "mpesa",
        transaction_id: "",
        status: "completed",
      })
    } catch (error: any) {
      console.error('Payment creation error:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Receive Payment</SheetTitle>
          <SheetDescription>Record a new payment transaction. Fill in the details below.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customer_id">Customer (Optional)</Label>
            <Select
              value={formData.customer_id}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, customer_id: value, invoice_id: "" }))}
              onOpenChange={(open) => {
                if (open && customers.length === 0 && !loadingCustomers) {
                  console.log('Customer select opened, fetching customers...')
                  fetchCustomers()
                }
                setCustomerSearch("");
              }}
              required={false}
            >
              <SelectTrigger>
                <SelectValue placeholder="Search or select a customer (optional)" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-2">
                  <Input
                    placeholder="Type to search by name, email, or phone"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {loadingCustomers ? (
                  <SelectItem value="loading" disabled>
                    Loading customers...
                  </SelectItem>
                ) : customers.length > 0 ? (
                  customers
                    .filter((customer) => {
                      const search = customerSearch.toLowerCase();
                      return (
                        (customer.name?.toLowerCase() || "").includes(search) ||
                        (customer.email?.toLowerCase() || "").includes(search) ||
                        (customer.phone?.toLowerCase() || "").includes(search)
                      );
                    })
                    .map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {getCustomerDisplayName(customer)} {customer.phone ? `(${customer.phone})` : ""} {customer.email ? `- ${customer.email}` : ""}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="none" disabled>
                    No customers found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice_id">Invoice (Optional)</Label>
            <Select
              value={formData.invoice_id}
              onValueChange={(value) => {
                const picked = filteredInvoices.find((inv) => inv.id === value)
                setFormData((prev) => ({
                  ...prev,
                  invoice_id: value,
                  customer_id: prev.customer_id || picked?.customer_id || prev.customer_id,
                  amount_paid: prev.amount_paid || (picked ? String(picked.balance) : prev.amount_paid),
                }))
              }}
              onOpenChange={(open) => {
                if (open && invoices.length === 0 && !loadingInvoices) {
                  fetchOutstandingInvoices()
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an invoice to settle" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {loadingInvoices ? (
                  <SelectItem value="loading" disabled>
                    Loading invoices...
                  </SelectItem>
                ) : filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      #{invoice.invoice_number} — {formatCurrency(invoice.balance)} owed
                      {invoice.due_date ? ` · due ${new Date(invoice.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                      {invoice.overdue ? " · overdue" : ""}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    {formData.customer_id ? "This customer has no unpaid invoices" : "No outstanding invoices"}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {formData.customer_id && !loadingInvoices && filteredInvoices.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {filteredInvoices.length} unpaid invoice{filteredInvoices.length === 1 ? "" : "s"}, oldest first
                ({formatCurrency(filteredInvoices.reduce((sum, inv) => sum + inv.balance, 0))} owed in total).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount_paid">Amount</Label>
              <Input
                id="amount_paid"
                name="amount_paid"
                type="number"
                step="0.01"
                min="0.01"
                max={selectedInvoiceBalance ?? undefined}
                value={formData.amount_paid}
                onChange={handleAmountChange}
                required
              />
              {selectedInvoiceBalance !== null && (
                <p className="text-xs text-muted-foreground">
                  Balance owed on this invoice: {formatCurrency(selectedInvoiceBalance)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                name="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => handleSelectChange("payment_method", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {INSTANT_PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
                <SelectItem value="Credit Card">Credit Card</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Paying by cheque? Record it from the invoice's "Record Payment" instead — cheques stay pending until they clear.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction_id">Transaction ID / Reference (Optional)</Label>
            <Input
              id="transaction_id"
              name="transaction_id"
              type="text"
              value={formData.transaction_id}
              onChange={handleChange}
              placeholder="Enter transaction ID or reference number"
            />
          </div>

          {formData.invoice_id && (
            <p className="text-xs text-muted-foreground">
              This payment will be applied to the selected invoice's balance immediately.
            </p>
          )}
          {receivingOnAccount && (
            <p className="text-xs text-muted-foreground">
              No invoice picked: the payment pays this customer's oldest unpaid invoices first, and anything over what they owe is kept as their credit.
            </p>
          )}
          {!formData.invoice_id && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#E30040] hover:bg-[#E30040]/90" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Receive Payment"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
