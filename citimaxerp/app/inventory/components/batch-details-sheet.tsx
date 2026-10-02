"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet"
import { 
  Package, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign,
  ShoppingCart
} from "lucide-react"
import { getBatchDetails, getInventoryMovements } from "@/lib/batches"
import type { Batch, BatchMovement } from "@/types/batches"

interface BatchDetailsSheetProps {
  productId: string
  batchId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BatchDetailsSheet({ productId, batchId, open, onOpenChange }: BatchDetailsSheetProps) {
  const [batch, setBatch] = useState<Batch | null>(null)
  const [movements, setMovements] = useState<BatchMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && productId && batchId) {
      fetchBatchDetails()
      fetchMovements()
    }
  }, [open, productId, batchId])

  const fetchBatchDetails = async () => {
    try {
      setLoading(true)
      const data = await getBatchDetails(productId, batchId)
      setBatch(data)
    } catch (err: any) {
      setError(err.message || "Failed to fetch batch details")
    } finally {
      setLoading(false)
    }
  }

  const fetchMovements = async () => {
    try {
      const result = await getInventoryMovements({
        batch_id: batchId
      })
      setMovements(result.data)
    } catch (err: any) {
      console.error("Failed to fetch movements:", err)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>
      case "expired":
        return <Badge variant="destructive">Expired</Badge>
      case "damaged":
        return <Badge variant="outline">Damaged</Badge>
      case "sold_out":
        return <Badge variant="secondary">Sold Out</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getMovementTypeIcon = (type: string) => {
    const iconClass = "h-4 w-4"
    switch (type) {
      case "receipt":
        return <Package className={`${iconClass} text-blue-500`} />
      case "sale":
        return <ShoppingCart className={`${iconClass} text-green-500`} />
      case "adjustment":
        return <Clock className={`${iconClass} text-purple-500`} />
      case "damage":
        return <AlertTriangle className={`${iconClass} text-orange-500`} />
      case "expiry":
        return <Calendar className={`${iconClass} text-red-500`} />
      default:
        return <Package className={`${iconClass} text-gray-500`} />
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Batch Details</SheetTitle>
        </SheetHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2">Loading batch details...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">
            Error: {error}
          </div>
        ) : batch ? (
          <div className="space-y-6 py-4">
            {/* Batch Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Batch Information
                </CardTitle>
                <CardDescription>
                  Details for batch {batch.batch_number}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Batch Number</div>
                  <div className="font-medium">{batch.batch_number}</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div>{getStatusBadge(batch.status)}</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Lot Number</div>
                  <div className="font-medium">{batch.lot_number || "N/A"}</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Serial Number</div>
                  <div className="font-medium">{batch.serial_number || "N/A"}</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Received Date</div>
                  <div className="font-medium">
                    {new Date(batch.received_date).toLocaleDateString()}
                  </div>
                </div>
                
                {batch.manufacture_date && (
                  <div>
                    <div className="text-sm text-muted-foreground">Manufacture Date</div>
                    <div className="font-medium">
                      {new Date(batch.manufacture_date).toLocaleDateString()}
                    </div>
                  </div>
                )}
                
                {batch.expiry_date && (
                  <div>
                    <div className="text-sm text-muted-foreground">Expiry Date</div>
                    <div className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(batch.expiry_date).toLocaleDateString()}
                    </div>
                  </div>
                )}
                
                <div>
                  <div className="text-sm text-muted-foreground">Supplier</div>
                  <div className="font-medium">
                    {typeof batch.supplier === 'string' 
                      ? batch.supplier 
                      : (batch.supplier && typeof batch.supplier === 'object' && 'name' in batch.supplier 
                        ? batch.supplier.name 
                        : "N/A")}
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <div className="text-sm text-muted-foreground">Notes</div>
                  <div className="font-medium">{batch.notes || "N/A"}</div>
                </div>
              </CardContent>
            </Card>
            
            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Information
                </CardTitle>
                <CardDescription>
                  Cost and pricing details
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Unit Cost</div>
                  <div className="font-medium">
                    {batch.unit_cost ? `KES ${parseFloat(batch.unit_cost.toString()).toLocaleString()}` : "N/A"}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Selling Price</div>
                  <div className="font-medium">
                    {batch.selling_price ? `KES ${parseFloat(batch.selling_price.toString()).toLocaleString()}` : "N/A"}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Total Value</div>
                  <div className="font-medium">
                    {batch.unit_cost && batch.quantity_received 
                      ? `KES ${(parseFloat(batch.unit_cost.toString()) * batch.quantity_received).toLocaleString()}` 
                      : "N/A"}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Quantity Tracking */}
            <Card>
              <CardHeader>
                <CardTitle>Quantity Tracking</CardTitle>
                <CardDescription>
                  Current batch quantities and allocations
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold">{batch.quantity_received}</div>
                  <div className="text-sm text-muted-foreground">Received</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold">{batch.quantity_available}</div>
                  <div className="text-sm text-muted-foreground">Available</div>
                </div>
                
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold">{batch.quantity_allocated}</div>
                  <div className="text-sm text-muted-foreground">Allocated</div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold">{batch.quantity_sold}</div>
                  <div className="text-sm text-muted-foreground">Sold</div>
                </div>
                
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold">{batch.quantity_damaged}</div>
                  <div className="text-sm text-muted-foreground">Damaged</div>
                </div>
                
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold">{batch.quantity_expired}</div>
                  <div className="text-sm text-muted-foreground">Expired</div>
                </div>
              </CardContent>
            </Card>
            
            {/* Movement History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Movement History
                </CardTitle>
                <CardDescription>
                  All movements for this batch
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No movement history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getMovementTypeIcon(movement.type)}
                              <span className="capitalize">{movement.type.replace('_', ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(movement.movement_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className={movement.quantity > 0 ? "text-green-600" : "text-red-600"}>
                              {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                            </span>
                          </TableCell>
                          <TableCell>
                            {movement.reference_number || "N/A"}
                          </TableCell>
                          <TableCell>
                            {movement.notes || "N/A"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No batch details available
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}