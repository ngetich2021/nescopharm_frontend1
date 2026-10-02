"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, CreditCard, User, Phone, Mail, FileText, CalendarIcon as CalendarIconLucide } from "lucide-react"
import type { Debt, DebtPayment } from "@/types/debts"
import { getDebtPayments, recordPayment } from "@/lib/debts"
import { toast } from "sonner"

interface DebtDetailsSheetProps {
  debt: Debt | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPaymentRecorded?: (updatedDebt: Debt) => void
}

export function DebtDetailsSheet({ debt, open, onOpenChange, onPaymentRecorded }: DebtDetailsSheetProps) {
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentDate, setPaymentDate] = useState<Date>(new Date())

  useEffect(() => {
    if (debt && open) {
      loadPayments()
    }
  }, [debt, open])

  const loadPayments = async () => {
    if (!debt) return

    setIsLoadingPayments(true)
    try {
      const debtPayments = await getDebtPayments(debt.id)
      setPayments(debtPayments)
    } catch (error) {
      toast.error("Failed to load payment history")
    } finally {
      setIsLoadingPayments(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!debt || !paymentAmount || !paymentMethod) {
      toast.error("Please fill in all required fields")
      return
    }

    const amount = Number.parseFloat(paymentAmount)
    if (amount <= 0 || amount > debt.outstandingAmount) {
      toast.error("Invalid payment amount")
      return
    }

    setIsRecordingPayment(true)
    try {
      await recordPayment({
        debtId: debt.id,
        amount,
        paymentMethod: paymentMethod as any,
        reference: paymentReference,
        notes: paymentNotes,
        paymentDate: format(paymentDate, "yyyy-MM-dd"),
      })

      // Update debt object
      const updatedDebt: Debt = {
        ...debt,
        paidAmount: debt.paidAmount + amount,
        outstandingAmount: debt.outstandingAmount - amount,
        status: debt.outstandingAmount - amount === 0 ? "paid" : "partial",
        lastPaymentDate: format(paymentDate, "yyyy-MM-dd"),
        updatedAt: new Date().toISOString(),
      }

      onPaymentRecorded?.(updatedDebt)

      // Reset form
      setPaymentAmount("")
      setPaymentMethod("")
      setPaymentReference("")
      setPaymentNotes("")
      setPaymentDate(new Date())

      // Reload payments
      await loadPayments()

      toast.success("Payment recorded successfully")
    } catch (error) {
      toast.error("Failed to record payment")
    } finally {
      setIsRecordingPayment(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount).replace('KES', 'Ksh.')
  }

  const getStatusBadge = (status: Debt["status"]) => {
    const variants = {
      pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
      partial: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      paid: "bg-green-100 text-green-800 hover:bg-green-100",
      overdue: "bg-red-100 text-red-800 hover:bg-red-100",
    }

    const labels = {
      pending: "Pending",
      partial: "Partial",
      paid: "Paid",
      overdue: "Overdue",
    }

    return (
      <Badge variant="secondary" className={variants[status]}>
        {labels[status]}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: Debt["priority"]) => {
    const variants = {
      low: "bg-gray-100 text-gray-800 hover:bg-gray-100",
      medium: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
      high: "bg-orange-100 text-orange-800 hover:bg-orange-100",
      urgent: "bg-red-100 text-red-800 hover:bg-red-100",
    }

    const labels = {
      low: "Low",
      medium: "Medium",
      high: "High",
      urgent: "Urgent",
    }

    return (
      <Badge variant="secondary" className={variants[priority]}>
        {labels[priority]}
      </Badge>
    )
  }

  if (!debt) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Debt Details - {debt.reference}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="record-payment">Record Payment</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm text-muted-foreground">{debt.customerName}</p>
                </div>
                {debt.customerEmail && (
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email
                    </Label>
                    <p className="text-sm text-muted-foreground">{debt.customerEmail}</p>
                  </div>
                )}
                {debt.customerPhone && (
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Phone
                    </Label>
                    <p className="text-sm text-muted-foreground">{debt.customerPhone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Debt Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Debt Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Reference</Label>
                    <p className="text-sm text-muted-foreground">{debt.reference}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <div className="mt-1">{getStatusBadge(debt.status)}</div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground">{debt.description}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Total Amount</Label>
                    <p className="text-lg font-semibold">{formatCurrency(debt.amount)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Paid Amount</Label>
                    <p className="text-lg font-semibold text-green-600">{formatCurrency(debt.paidAmount)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Outstanding</Label>
                    <p className="text-lg font-semibold text-red-600">{formatCurrency(debt.outstandingAmount)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Priority</Label>
                    <div className="mt-1">{getPriorityBadge(debt.priority)}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Category</Label>
                    <p className="text-sm text-muted-foreground">
                      {debt.category.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1">
                      <CalendarIconLucide className="h-3 w-3" />
                      Due Date
                    </Label>
                    <p className="text-sm text-muted-foreground">{new Date(debt.dueDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Created Date</Label>
                    <p className="text-sm text-muted-foreground">{new Date(debt.createdDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {debt.lastPaymentDate && (
                  <div>
                    <Label className="text-sm font-medium">Last Payment</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(debt.lastPaymentDate).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {debt.notes && (
                  <div>
                    <Label className="text-sm font-medium">Notes</Label>
                    <p className="text-sm text-muted-foreground">{debt.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingPayments ? (
                  <div className="text-center py-4">Loading payments...</div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No payments recorded yet</div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{formatCurrency(payment.amount)}</div>
                          <div className="text-sm text-muted-foreground">
                            {payment.paymentMethod.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                            {payment.reference && ` • ${payment.reference}`}
                          </div>
                          {payment.notes && <div className="text-sm text-muted-foreground mt-1">{payment.notes}</div>}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {new Date(payment.paymentDate).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(payment.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="record-payment" className="space-y-4">
            {debt.status === "paid" ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    This debt has been fully paid. No additional payments can be recorded.
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Record New Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="payment-amount">Payment Amount *</Label>
                    <Input
                      id="payment-amount"
                      type="number"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      max={debt.outstandingAmount}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum: {formatCurrency(debt.outstandingAmount)}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="payment-method">Payment Method *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="payment-reference">Reference Number</Label>
                    <Input
                      id="payment-reference"
                      placeholder="Transaction reference (optional)"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Payment Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(paymentDate, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={paymentDate}
                          onSelect={(date) => date && setPaymentDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="payment-notes">Notes</Label>
                    <Textarea
                      id="payment-notes"
                      placeholder="Additional notes (optional)"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                  </div>

                  <Button onClick={handleRecordPayment} disabled={isRecordingPayment} className="w-full">
                    {isRecordingPayment ? "Recording Payment..." : "Record Payment"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
