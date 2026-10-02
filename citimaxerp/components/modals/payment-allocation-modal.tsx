"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Plus, Trash2, FileText, DollarSign, AlertCircle } from "lucide-react"
import { getCustomerDisplayName } from "@/lib/customers"
import { 
  allocatePaymentToInvoices, 
  getPaymentAvailableAmount, 
  getInvoicesOutstandingBalances,
  PaymentAllocation, 
  BulkAllocationResponse,
  PaymentAvailabilityResponse,
  InvoiceBalanceResponse,
  fetchInvoices
} from "@/lib/invoices"
import { Payment } from "@/lib/payments"

interface PaymentAllocationModalProps {
  payment: Payment
  isOpen: boolean
  onClose: () => void
  onAllocationComplete?: (result: BulkAllocationResponse) => void
}

interface InvoiceOption {
  id: string
  invoice_number: string
  customer_name?: string
  total_amount: string
  outstanding_balance?: string
  due_date?: string
}

interface AllocationRow {
  id: string
  invoice_id: string
  amount: number
  invoice_details?: InvoiceOption
}

export function PaymentAllocationModal({ 
  payment, 
  isOpen, 
  onClose, 
  onAllocationComplete 
}: PaymentAllocationModalProps) {
  const [allocations, setAllocations] = useState<AllocationRow[]>([])
  const [availableAmount, setAvailableAmount] = useState<number>(0)
  const [totalAllocated, setTotalAllocated] = useState<number>(0)
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  useEffect(() => {
    if (isOpen && payment) {
      loadPaymentAvailability()
      loadInvoiceOptions()
    }
  }, [isOpen, payment])

  useEffect(() => {
    const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    setTotalAllocated(total)
  }, [allocations])

  const loadPaymentAvailability = async () => {
    try {
      setLoading(true)
      console.log('Loading payment availability for payment:', payment.id)
      const response = await getPaymentAvailableAmount(payment.id)
      console.log('Payment availability response:', response)
      setAvailableAmount(parseFloat(response.available_amount))
    } catch (error) {
      console.error('Error loading payment availability:', error)
      toast({
        title: "Warning",
        description: "Could not load payment allocation data. Using full payment amount.",
        variant: "destructive",
      })
      // Fall back to the full payment amount if API is not available
      setAvailableAmount(parseFloat(payment.amount_paid || "0"))
    } finally {
      setLoading(false)
    }
  }

  const loadInvoiceOptions = async () => {
    try {
      setLoadingInvoices(true)
      
      // Check if we have customer_id
      if (!payment.customer_id) {
        console.warn('Payment has no customer_id, loading all invoices with outstanding balances')
      }
      
      // Load invoices for the same customer or all invoices if no customer
      const invoicesResponse = await fetchInvoices({
        customer_id: payment.customer_id || undefined,
        per_page: 100
      })
      
      console.log('Invoices response:', invoicesResponse)
      
      // Filter invoices with outstanding balances
      const customerInvoices = invoicesResponse.data
        .filter((invoice: any) => {
          const balanceAmount = parseFloat(invoice.balance_amount || "0")
          const hasOutstanding = balanceAmount > 0
          const sameCustomer = !payment.customer_id || invoice.customer_id === payment.customer_id
          return hasOutstanding && sameCustomer
        })
        .map((invoice: any) => ({
          id: invoice.id,
          invoice_number: invoice.invoice_number || `INV-${invoice.id}`,
          customer_name: invoice.customer?.name,
          total_amount: invoice.total_amount?.toString() || "0",
          outstanding_balance: invoice.balance_amount?.toString() || "0",
          due_date: invoice.due_date
        }))

      console.log('Filtered customer invoices:', customerInvoices)
      setInvoiceOptions(customerInvoices)
      
      if (customerInvoices.length === 0) {
        toast({
          title: "No invoices found",
          description: payment.customer_id 
            ? "No outstanding invoices found for this customer."
            : "No outstanding invoices found.",
        })
      }
    } catch (error) {
      console.error('Error loading invoices:', error)
      toast({
        title: "Error",
        description: "Failed to load invoices. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingInvoices(false)
    }
  }

  const addAllocation = () => {
    const newAllocation: AllocationRow = {
      id: Date.now().toString(),
      invoice_id: '',
      amount: 0
    }
    setAllocations([...allocations, newAllocation])
  }

  const removeAllocation = (id: string) => {
    setAllocations(allocations.filter(allocation => allocation.id !== id))
  }

  const updateAllocation = (id: string, field: keyof AllocationRow, value: any) => {
    setAllocations(allocations.map(allocation => {
      if (allocation.id === id) {
        const updated = { ...allocation, [field]: value }
        
        // If invoice_id is being updated, find and attach invoice details
        if (field === 'invoice_id') {
          const invoiceDetails = invoiceOptions.find(inv => inv.id === value)
          updated.invoice_details = invoiceDetails
          
          // Auto-populate amount with outstanding balance if available
          if (invoiceDetails && !updated.amount) {
            updated.amount = Math.min(
              parseFloat(invoiceDetails.outstanding_balance || "0"),
              availableAmount - totalAllocated
            )
          }
        }
        
        return updated
      }
      return allocation
    }))
  }

  const handleSubmit = async () => {
    // Validate allocations
    const validAllocations = allocations.filter(allocation => 
      allocation.invoice_id && allocation.amount > 0
    )

    if (validAllocations.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one valid allocation.",
        variant: "destructive",
      })
      return
    }

    if (totalAllocated > availableAmount) {
      toast({
        title: "Error",
        description: `Total allocation (${totalAllocated.toFixed(2)}) exceeds available amount (${availableAmount.toFixed(2)}).`,
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)
      
      // Prepare payment allocations for the API
      const paymentAllocations: PaymentAllocation[] = validAllocations.map(allocation => ({
        invoice_id: allocation.invoice_id,
        amount: allocation.amount,
        notes: `Allocated from payment ${payment.id}`
      }))

      const result = await allocatePaymentToInvoices(payment.id, paymentAllocations)
      
      toast({
        title: "Success",
        description: `Successfully allocated payment to ${validAllocations.length} invoice(s).`,
      })

      onAllocationComplete?.(result)
      onClose()
      
    } catch (error) {
      console.error('Error allocating payment:', error)
      toast({
        title: "Error",
        description: "Failed to allocate payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const remainingAmount = availableAmount - totalAllocated

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Allocate Payment to Invoices
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Payment Amount</Label>
                  <p className="font-semibold">Ksh {parseFloat(payment.amount_paid || "0").toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Available Amount</Label>
                  <p className="font-semibold text-green-600">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin inline" />
                    ) : (
                      `Ksh ${availableAmount.toFixed(2)}`
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Total Allocated</Label>
                  <p className="font-semibold text-blue-600">Ksh {totalAllocated.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Remaining</Label>
                  <p className={`font-semibold ${remainingAmount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    Ksh {remainingAmount.toFixed(2)}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Customer</Label>
                  <p>{payment.customers ? getCustomerDisplayName(payment.customers) : 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Payment Method</Label>
                  <p>{payment.payment_method}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Allocations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Invoice Allocations</CardTitle>
              <Button onClick={addAllocation} size="sm" className="bg-[#1E2764] hover:bg-[#1E2764]/90">
                <Plus className="h-4 w-4 mr-1" />
                Add Allocation
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingInvoices && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading invoices...</span>
                </div>
              )}
              
              {!loadingInvoices && invoiceOptions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No outstanding invoices found.</p>
                  <p className="text-sm mt-2">
                    {payment.customer_id 
                      ? "This customer has no invoices with outstanding balances."
                      : "No invoices with outstanding balances found."
                    }
                  </p>
                </div>
              )}
              
              {allocations.length === 0 && invoiceOptions.length > 0 && !loadingInvoices ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No allocations added yet. Click "Add Allocation" to get started.</p>
                  <p className="text-sm mt-2">{invoiceOptions.length} invoice(s) available for allocation.</p>
                </div>
              ) : allocations.length > 0 ? (
                <div className="space-y-3">
                  {allocations.map((allocation, index) => (
                    <div key={allocation.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor={`invoice-${allocation.id}`} className="text-sm">
                            Invoice #{index + 1}
                          </Label>
                          <Select
                            value={allocation.invoice_id}
                            onValueChange={(value) => updateAllocation(allocation.id, 'invoice_id', value)}
                          >
                            <SelectTrigger id={`invoice-${allocation.id}`}>
                              <SelectValue placeholder="Select invoice..." />
                            </SelectTrigger>
                            <SelectContent>
                              {invoiceOptions.map((invoice) => (
                                <SelectItem key={invoice.id} value={invoice.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{invoice.invoice_number}</span>
                                    <span className="text-sm text-muted-foreground">
                                      Outstanding: Ksh {parseFloat(invoice.outstanding_balance || "0").toFixed(2)}
                                      {invoice.due_date && ` • Due: ${new Date(invoice.due_date).toLocaleDateString()}`}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor={`amount-${allocation.id}`} className="text-sm">
                            Allocation Amount
                          </Label>
                          <Input
                            id={`amount-${allocation.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            max={availableAmount}
                            value={allocation.amount || ''}
                            onChange={(e) => updateAllocation(allocation.id, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                        
                        <div className="flex items-end">
                          {allocation.invoice_details && (
                            <div className="text-sm text-muted-foreground mr-2">
                              <p>Outstanding: Ksh {parseFloat(allocation.invoice_details.outstanding_balance || "0").toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeAllocation(allocation.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Allocation Summary */}
          {allocations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Allocation Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allocations.map((allocation, index) => 
                    allocation.invoice_details && allocation.amount > 0 && (
                      <div key={allocation.id} className="flex justify-between items-center">
                        <span className="text-sm">
                          {allocation.invoice_details.invoice_number}
                        </span>
                        <span className="font-medium">
                          Ksh {allocation.amount.toFixed(2)}
                        </span>
                      </div>
                    )
                  )}
                  <Separator />
                  <div className="flex justify-between items-center font-semibold">
                    <span>Total Allocation</span>
                    <span>Ksh {totalAllocated.toFixed(2)}</span>
                  </div>
                  {remainingAmount < 0 && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      <span>Allocation exceeds available amount by Ksh {Math.abs(remainingAmount).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || allocations.length === 0 || totalAllocated === 0 || remainingAmount < 0}
            className="bg-primary hover:bg-primary/90"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Allocating...
              </>
            ) : (
              'Allocate Payment'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
