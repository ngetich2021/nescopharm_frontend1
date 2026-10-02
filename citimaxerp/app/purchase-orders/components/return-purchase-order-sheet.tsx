"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, RotateCcw, Building2, Calendar, Store, AlertCircle, MessageSquare } from "lucide-react"
import { returnPurchaseOrder, PurchaseOrder } from "@/lib/purchaseorders"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"

interface ReturnPurchaseOrderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: PurchaseOrder | null
  onPurchaseOrderReturned: () => void
}

interface ReturnItem {
  id: string
  product_id: string
  variant_id: string | null
  received_quantity: number
  returned_quantity: number
  price: number
  product?: any
  variant?: any
}

export function ReturnPurchaseOrderSheet({ open, onOpenChange, order, onPurchaseOrderReturned }: ReturnPurchaseOrderSheetProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [returnReason, setReturnReason] = useState("")

  useEffect(() => {
    if (order && order.items) {
      setReturnItems(order.items.map(item => ({
        id: item.id || "",
        product_id: item.product_id || "",
        variant_id: item.variant_id || null,
        received_quantity: item.received_quantity || 0,
        returned_quantity: 0,
        price: typeof item.unit_price === 'string' ? parseFloat(item.unit_price) : item.unit_price,
        product: item.product,
        variant: item.variant
      })))
      setReturnReason("")
    }
  }, [order])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (!order) return
      
      await returnPurchaseOrder(order.id, {
        items: returnItems.filter(item => item.returned_quantity > 0).map(item => ({
          id: item.id,
          returned_quantity: item.returned_quantity
        })),
        reason: returnReason
      })
      
      toast({ title: "Success", description: "Purchase order return processed successfully." })
      onPurchaseOrderReturned()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process return",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuantityChange = (index: number, value: number) => {
    setReturnItems(prev => prev.map((item, i) => 
      i === index ? { ...item, returned_quantity: value } : item
    ))
  }

  const getTotalReturning = () => returnItems.reduce((sum, item) => sum + item.returned_quantity, 0)
  const getTotalReceived = () => returnItems.reduce((sum, item) => sum + item.received_quantity, 0)
  const getReturnValue = () => returnItems.reduce((sum, item) => sum + (item.returned_quantity * item.price), 0)

  if (!order) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-[850px] max-w-[850px] !w-[850px] !max-w-[850px] flex flex-col p-0"
        style={{ width: 850, maxWidth: 850 }}
      >
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent border-b px-6 py-5">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <RotateCcw className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <span className="block">Return Purchase Order</span>
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

            {/* Return Items Card */}
            <Card className="border-0 shadow-sm bg-card/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RotateCcw className="h-4 w-4 text-destructive" />
                    Return Items
                  </CardTitle>
                  <Badge variant="outline" className="font-normal">
                    Total Received: {getTotalReceived()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left text-sm font-medium px-4 py-3">Product</th>
                        <th className="text-right text-sm font-medium px-4 py-3">Price</th>
                        <th className="text-right text-sm font-medium px-4 py-3">Received</th>
                        <th className="text-center text-sm font-medium px-4 py-3">Return Qty</th>
                        <th className="text-right text-sm font-medium px-4 py-3">Return Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {returnItems.map((item, index) => (
                        <tr key={index} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium">{item.product?.name || '-'}</div>
                            {item.variant?.name && (
                              <div className="text-xs text-muted-foreground">{item.variant.name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.price)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className={item.received_quantity > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                              {item.received_quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min="0"
                              max={item.received_quantity}
                              value={item.returned_quantity}
                              onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                              className="h-9 w-24 mx-auto text-center"
                              disabled={item.received_quantity === 0}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-destructive">
                            {item.returned_quantity > 0 ? formatCurrency(item.returned_quantity * item.price) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/50">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-sm font-medium text-right">
                          Total Return:
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-center">
                          {getTotalReturning()}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right text-destructive">
                          {formatCurrency(getReturnValue())}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Return Status Indicator */}
                {getTotalReturning() === 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/30 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Enter quantities to return</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Return Reason Card */}
            <Card className="border-0 shadow-sm bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Return Reason
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter the reason for the return (required)..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sticky Footer */}
          <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {getTotalReturning() > 0 && (
                  <span>Returning {getTotalReturning()} item{getTotalReturning() !== 1 ? 's' : ''} • Value: <span className="font-semibold text-destructive">{formatCurrency(getReturnValue())}</span></span>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="min-w-[100px]">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="destructive"
                  disabled={isLoading || getTotalReturning() === 0 || !returnReason.trim()} 
                  className="min-w-[180px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Process Return
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