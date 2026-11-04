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
    amount_paid: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "mpesa",
    transaction_id: "",
    status: "completed",
  })

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("");

  // Load customers and invoices when the sheet is opened
  useEffect(() => {
    if (isOpen) {
      fetchCustomers()
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

  const openInvoices: OpenInvoiceOption[] = customerInvoices ?? []

  // A customer's payment always pays their oldest unpaid invoices first.
  const receivingOnAccount = !!formData.customer_id && formData.status === "completed"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let message = "Payment recorded successfully"
      if (receivingOnAccount) {
        const result = await receiveOnAccount(formData.customer_id, {
          amount: Number(formData.amount_paid),
          payment_method: formData.payment_method,
          payment_date: formData.payment_date,
          transaction_id: formData.transaction_id || undefined,
        })
        message = result.message || message
      } else {
        // No customer, or not yet received - a standalone payment not tied to anything specific
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
        description: message,
      })

      onPaymentCreated()
      onOpenChange(false)

      // Reset form
      setFormData({
    customer_id: "",
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
              onValueChange={(value) => setFormData((prev) => ({ ...prev, customer_id: value }))}
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

          {formData.customer_id && (
            <p className="text-xs text-muted-foreground">
              {loadingInvoices
                ? "Loading what this customer owes..."
                : openInvoices.length > 0
                  ? `Owes ${formatCurrency(openInvoices.reduce((sum, inv) => sum + inv.balance, 0))} on ${openInvoices.length} invoice${openInvoices.length === 1 ? "" : "s"}, paid oldest first${openInvoices[0] ? ` (next: #${openInvoices[0].invoice_number})` : ""}.`
                  : "This customer has no unpaid invoices: the payment is kept as their credit."}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount_paid">Amount</Label>
              <Input
                id="amount_paid"
                name="amount_paid"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount_paid}
                onChange={handleChange}
                required
              />
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
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Paying by cheque? Record it from the customer's Account tab or an invoice's "Record Payment" instead — cheques stay pending until they clear.
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

          {receivingOnAccount && (
            <p className="text-xs text-muted-foreground">
              The payment pays this customer's oldest unpaid invoices first, and anything over what they owe is kept as their credit.
            </p>
          )}
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
