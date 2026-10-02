"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SupplierPayment } from "@/lib/supplier-payments"
import {
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Hash,
  MessageSquare,
} from "lucide-react"

interface SupplierPaymentDetailsSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  payment: SupplierPayment | null
}

export default function SupplierPaymentDetailsSheet({
  isOpen,
  onOpenChange,
  payment,
}: SupplierPaymentDetailsSheetProps) {
  if (!payment) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount
    return `KES ${num.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Payment Details</span>
            {getStatusBadge(payment.status)}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Amount Section */}
          <div className="text-center py-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Amount Paid</p>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(payment.amount)}
            </p>
          </div>

          <Separator />

          {/* Supplier Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Supplier Information
            </h3>
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{payment.supplier?.name || "N/A"}</p>
                {payment.supplier?.email && (
                  <p className="text-sm text-muted-foreground">
                    {payment.supplier.email}
                  </p>
                )}
                {payment.supplier?.phone && (
                  <p className="text-sm text-muted-foreground">
                    {payment.supplier.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Payment Details
            </h3>

            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Payment Date</p>
                  <p className="font-medium">{formatDate(payment.payment_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium capitalize">
                    {payment.payment_method?.replace("_", " ")}
                  </p>
                </div>
              </div>

              {payment.transaction_reference && (
                <div className="flex items-center gap-3">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Transaction Reference
                    </p>
                    <p className="font-medium">{payment.transaction_reference}</p>
                  </div>
                </div>
              )}

              {payment.purchase_order && (
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Purchase Order
                    </p>
                    <p className="font-medium">
                      {payment.purchase_order.order_number}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {payment.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Notes
                  </h3>
                </div>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {payment.notes}
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Created: {formatDate(payment.created_at)}</p>
            {payment.updated_at && payment.updated_at !== payment.created_at && (
              <p>Updated: {formatDate(payment.updated_at)}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
