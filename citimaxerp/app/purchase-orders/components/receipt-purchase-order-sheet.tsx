"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Package, Building2, Calendar, Store, CheckCircle, AlertCircle } from "lucide-react"
import { receiptPurchaseOrder, PurchaseOrder } from "@/lib/purchaseorders"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"

interface ReceiptPurchaseOrderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: PurchaseOrder | null
  onPurchaseOrderReceipted: () => void
}

interface ReceiptItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  received_quantity: number
  variant_id: string | null
  product?: any
  variant?: any
  already_received: number
}

export function ReceiptPurchaseOrderSheet({ open, onOpenChange, order, onPurchaseOrderReceipted }: ReceiptPurchaseOrderSheetProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([])
  const [shippingCost, setShippingCost] = useState("")
  const [logisticsCost, setLogisticsCost] = useState("")

  useEffect(() => {
    if (order && order.items) {
      setReceiptItems(order.items.map(item => ({
        id: item.id || "",
        product_id: item.product_id || "",
        quantity: item.quantity,
        unit_price: typeof item.unit_price === 'string' ? parseFloat(item.unit_price) : item.unit_price,
        received_quantity: 0,
        variant_id: item.variant_id || null,
        product: item.product,
        variant: item.variant,
        already_received: item.received_quantity || 0
      })))
      setShippingCost("")
      setLogisticsCost("")
    }
  }, [order])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (!order) return
      const result = await receiptPurchaseOrder(order.id, {
        items: receiptItems.map(item => ({
          id: item.id,
          received_quantity: item.received_quantity
        })),
        shipping_cost: shippingCost ? parseFloat(shippingCost) : 0,
        logistics_cost: logisticsCost ? parseFloat(logisticsCost) : 0,
      })
      toast({ title: "Success", description: "Purchase order receipted successfully." })
      if (result.pricing_warnings && result.pricing_warnings.length > 0) {
        toast({
          title: "Pricing needs review",
          description: result.pricing_warnings.join(" "),
          variant: "destructive",
        })
      }
      onPurchaseOrderReceipted()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to receipt purchase order",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuantityChange = (index: number, value: number) => {
    setReceiptItems(prev => prev.map((item, i) => 
      i === index ? { ...item, received_quantity: value } : item
    ))
  }

  const getTotalReceiving = () => receiptItems.reduce((sum, item) => sum + item.received_quantity, 0)
  const getTotalOrdered = () => receiptItems.reduce((sum, item) => sum + item.quantity, 0)
  const getTotalPending = () => receiptItems.reduce((sum, item) => sum + (item.quantity - item.already_received), 0)
  const getReceivingValue = () => receiptItems.reduce((sum, item) => sum + (item.received_quantity * item.unit_price), 0)

  const isPartialReceipt = () => {
    const totalReceiving = getTotalReceiving()
    const totalPending = getTotalPending()
    return totalReceiving > 0 && totalReceiving < totalPending
  }

  const isFullReceipt = () => {
    const totalReceiving = getTotalReceiving()
    const totalPending = getTotalPending()
    return totalReceiving > 0 && totalReceiving >= totalPending
  }

  if (!order) return null

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
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="block">Receipt Purchase Order</span>
                <span className="text-sm font-normal text-muted-foreground">{order.order_number}</span>
              </div>
              <Badge variant={order.status === 'received' ? 'default' : 'outline'} className="ml-auto capitalize">
                {order.status?.replace('_', ' ') || 'pending'}
              </Badge>
            </SheetTitle>
          </SheetHeader>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Order Information Card */}
            <Card className="border-0 shadow-sm bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" />
                  Order Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Supplier
                    </Label>
                    <p className="text-sm font-medium">{order.supplier?.name || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Order Date
                    </Label>
                    <p className="text-sm font-medium">{formatDate(order.order_date)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Delivery Date
                    </Label>
                    <p className="text-sm font-medium">{order.delivery_date ? formatDate(order.delivery_date) : '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      Store
                    </Label>
                    <p className="text-sm font-medium">{order.store?.name || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Landed Cost Card - actual shipping/logistics cost for THIS shipment,
                distributed across the products being received to update their
                cost basis (unit_cost, shipping_cost, logistics_cost). */}
            <Card className="border-0 shadow-sm bg-card/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Shipping Cost (this shipment)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Logistics Cost (this shipment)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={logisticsCost}
                      onChange={(e) => setLogisticsCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Distributed across the products received below to update their landed cost basis.
                </p>
              </CardContent>
            </Card>

            {/* Receipt Items Card */}
            <Card className="border-0 shadow-sm bg-card/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-primary" />
                    Receipt Items
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="font-normal">
                      Ordered: {getTotalOrdered()}
                    </Badge>
                    <Badge variant="secondary" className="font-normal">
                      Pending: {getTotalPending()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left text-sm font-medium px-4 py-3">Product</th>
                        <th className="text-right text-sm font-medium px-4 py-3">Price</th>
                        <th className="text-right text-sm font-medium px-4 py-3">Ordered</th>
                        <th className="text-right text-sm font-medium px-4 py-3">Received</th>
                        <th className="text-right text-sm font-medium px-4 py-3">Pending</th>
                        <th className="text-center text-sm font-medium px-4 py-3">Receive Qty</th>
                        <th className="text-right text-sm font-medium px-4 py-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {receiptItems.map((item, index) => {
                        const pending = item.quantity - item.already_received
                        return (
                          <tr key={index} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium">{item.product?.name || '-'}</div>
                              {item.variant?.name && (
                                <div className="text-xs text-muted-foreground">{item.variant.name}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={item.already_received > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                                {item.already_received}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={pending > 0 ? 'text-orange-600' : 'text-green-600'}>
                                {pending}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                max={pending}
                                value={item.received_quantity}
                                onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                                className="h-9 w-24 mx-auto text-center"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium">
                              {formatCurrency(item.received_quantity * item.unit_price)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-muted/50">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-sm font-medium text-right">
                          Receiving Total:
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-center">
                          {getTotalReceiving()}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right text-primary">
                          {formatCurrency(getReceivingValue())}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Receipt Status Indicator */}
                <div className="mt-4 p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getTotalReceiving() === 0 && (
                      <>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Enter quantities to receive</span>
                      </>
                    )}
                    {isPartialReceipt() && (
                      <>
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm text-orange-600 font-medium">Partial Receipt - A new PO will be created for remaining items</span>
                      </>
                    )}
                    {isFullReceipt() && (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">Full Receipt - All pending items will be received</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sticky Footer */}
          <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {getTotalReceiving() > 0 && (
                  <span>Receiving {getTotalReceiving()} item{getTotalReceiving() !== 1 ? 's' : ''} • Value: <span className="font-semibold text-foreground">{formatCurrency(getReceivingValue())}</span></span>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="min-w-[100px]">
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading || getTotalReceiving() === 0} className="min-w-[180px]">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 mr-2" />
                      {isFullReceipt() ? "Complete Receipt" : "Partial Receipt"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}