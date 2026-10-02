"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { 
  ReceiptText, 
  Edit, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  Building2, 
  Calendar, 
  Store, 
  Package, 
  Coins,
  X
} from "lucide-react"
import { getPurchaseOrder, approvePurchaseOrder, PurchaseOrder } from "@/lib/purchaseorders"
import { useToast } from "@/hooks/use-toast"
import { getSuppliers, Supplier } from "@/lib/suppliers"
import { getStores, Store as StoreType, getStoreById } from "@/lib/stores"
import { getProducts, Product as ProductType, getProductById } from "@/lib/products"
import { formatDate, formatCurrency } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PermissionGuard } from "@/components/PermissionGuard"

interface PurchaseOrderDetailsSheetProps {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrderUpdated?: () => void
  onEdit?: (order: PurchaseOrder) => void
}

export function PurchaseOrderDetailsSheet({ orderId, open, onOpenChange, onOrderUpdated, onEdit }: PurchaseOrderDetailsSheetProps) {
  const { toast } = useToast()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  useEffect(() => {
    if (open && orderId) {
      fetchOrderDetails()
    } else {
      setOrder(null)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId])

  async function fetchOrderDetails() {
    if (!orderId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await getPurchaseOrder(orderId)
      setOrder(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch purchase order details'))
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to fetch purchase order details',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveConfirm = async () => {
    if (!order) return
    setIsApproving(true)
    try {
      await approvePurchaseOrder(order.id)
      toast({
        title: "Success",
        description: `Purchase order ${order.order_number} has been approved.`
      })
      fetchOrderDetails()
      if (onOrderUpdated) onOrderUpdated()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve purchase order",
        variant: "destructive"
      })
    } finally {
      setIsApproving(false)
      setIsApproveDialogOpen(false)
    }
  }

  // Calculate totals
  const orderTotal = order?.items?.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) || 0
  const itemCount = order?.items?.length || 0
  const totalReceived = order?.items?.reduce((sum, item) => sum + (item.received_quantity || 0), 0) || 0

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default'
      case 'pending': return 'secondary'
      case 'draft': return 'outline'
      case 'rejected': return 'destructive'
      case 'received': return 'default'
      case 'partially_received': return 'secondary'
      case 'cancelled': return 'destructive'
      default: return 'secondary'
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-[850px] max-w-[850px] !w-[850px] !max-w-[850px] flex flex-col p-0"
        style={{ width: 850, maxWidth: 850 }}
      >
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b px-6 py-5">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ReceiptText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="block">{order?.order_number || 'Purchase Order Details'}</span>
                  {order && (
                    <Badge variant={getStatusBadgeVariant(order.status)} className="capitalize">
                      {order.status.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-normal text-muted-foreground">
                  {order ? `Created ${formatDate(order.order_date)}` : 'Loading order details...'}
                </span>
              </div>
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            </div>
          ) : order ? (
            <>
              {/* Order Information Card */}
              <Card className="border-0 shadow-sm bg-card/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-primary" />
                    Order Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        Supplier
                      </div>
                      <div className="font-medium text-base">{order.supplier?.name || '-'}</div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Order Date
                      </div>
                      <div className="font-medium text-base">{formatDate(order.order_date)}</div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Expected Delivery
                      </div>
                      <div className="font-medium text-base">{formatDate(order.delivery_date)}</div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Store className="h-3.5 w-3.5" />
                        Destination Store
                      </div>
                      <div className="font-medium text-base">{order.store?.name || '-'}</div>
                    </div>

                    {order.currency_code && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Coins className="h-3.5 w-3.5" />
                          Currency
                        </div>
                        <div className="font-medium text-base">{order.currency_code}</div>
                      </div>
                    )}

                    {order.discount && order.discount > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Coins className="h-3.5 w-3.5" />
                          Discount
                        </div>
                        <div className="font-medium text-base">{order.discount}%</div>
                      </div>
                    )}
                  </div>

                  {order.comments && (
                    <div className="pt-4 border-t">
                      <div className="text-sm text-muted-foreground mb-1">Comments</div>
                      <div className="text-sm bg-muted/30 rounded-lg p-3">{order.comments}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Items Card */}
              <Card className="border-0 shadow-sm bg-card/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Package className="h-4 w-4 text-primary" />
                      Order Items
                    </CardTitle>
                    <Badge variant="secondary" className="font-normal">
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="min-w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left text-sm font-medium px-4 py-3">Product</th>
                          <th className="text-left text-sm font-medium px-4 py-3">Variant</th>
                          <th className="text-right text-sm font-medium px-4 py-3">Unit Price</th>
                          <th className="text-right text-sm font-medium px-4 py-3">Ordered</th>
                          <th className="text-right text-sm font-medium px-4 py-3">Received</th>
                          <th className="text-right text-sm font-medium px-4 py-3">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {order.items.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium">{item.product?.name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.variant?.name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={item.received_quantity === item.quantity ? 'text-green-600' : item.received_quantity ? 'text-amber-600' : ''}>
                                {item.received_quantity ?? 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(item.unit_price * item.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/50">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-sm font-medium">Totals</td>
                          <td className="px-4 py-3 text-sm font-medium text-right">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-right">{totalReceived}</td>
                          <td className="px-4 py-3 text-sm font-bold text-right text-primary">{formatCurrency(orderTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Landed Cost - captured at creation, previously never shown here */}
              {(Number(order.shipping_cost) > 0 || Number(order.logistics_cost) > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      Landed Cost
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Items Subtotal</span>
                      <span>{formatCurrency(orderTotal)}</span>
                    </div>
                    {Number(order.shipping_cost) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping Cost</span>
                        <span>{formatCurrency(order.shipping_cost || 0)}</span>
                      </div>
                    )}
                    {Number(order.logistics_cost) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Logistics Cost</span>
                        <span>{formatCurrency(order.logistics_cost || 0)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-sm font-bold text-primary">
                      <span>Landed Total</span>
                      <span>{formatCurrency(orderTotal + Number(order.shipping_cost || 0) + Number(order.logistics_cost || 0))}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>

        {/* Sticky Footer */}
        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {order && (
                <span>
                  {itemCount} item{itemCount !== 1 ? 's' : ''} • Total: <span className="font-semibold text-foreground">{formatCurrency(orderTotal)}</span>
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-w-[100px]"
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
              
              <PermissionGuard permissions={["can_update_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (order && onEdit) {
                      onOpenChange(false)
                      onEdit(order)
                    }
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </PermissionGuard>

              {order && (order.approval_status === 'pending' || !order.approval_status) && (
                <PermissionGuard permissions={["can_approve_purchase_orders", "can_manage_system", "can_manage_company"]} hideOnDenied>
                  <Button 
                    onClick={() => setIsApproveDialogOpen(true)}
                    className="min-w-[120px]"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </PermissionGuard>
              )}
            </div>
          </div>
        </div>

        {/* Approve Confirmation Dialog */}
        <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Approve Purchase Order
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to approve purchase order <strong>{order?.order_number}</strong>?
                This action will change the status to approved and allow the order to proceed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleApproveConfirm} disabled={isApproving}>
                {isApproving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
} 