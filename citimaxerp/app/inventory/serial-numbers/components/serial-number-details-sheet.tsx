"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Package, Calendar, User, Tag, DollarSign, Barcode } from "lucide-react"
import { getSerialNumberDetails } from "@/lib/serial-numbers"
import type { SerialNumber } from "@/types/serial-numbers"
import { useToast } from "@/hooks/use-toast"

interface SerialNumberDetailsSheetProps {
  serialId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSerialNumberUpdated: () => void
}

export function SerialNumberDetailsSheet({ 
  serialId, 
  open, 
  onOpenChange,
  onSerialNumberUpdated
}: SerialNumberDetailsSheetProps) {
  const [serialNumber, setSerialNumber] = useState<SerialNumber | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Fetch serial number details when sheet opens
  useEffect(() => {
    if (open && serialId) {
      fetchSerialNumberDetails()
    }
  }, [open, serialId])

  const fetchSerialNumberDetails = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const data = await getSerialNumberDetails(serialId)
      setSerialNumber(data)
    } catch (err: any) {
      setError(err.message || "Failed to fetch serial number details")
      toast({
        title: "Error",
        description: err.message || "Failed to fetch serial number details",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      active: { label: "Active", className: "bg-green-100 text-green-800" },
      inactive: { label: "Inactive", className: "bg-gray-100 text-gray-800" },
      sold: { label: "Sold", className: "bg-purple-100 text-purple-800" },
      returned: { label: "Returned", className: "bg-yellow-100 text-yellow-800" },
      damaged: { label: "Damaged", className: "bg-red-100 text-red-800" },
      expired: { label: "Expired", className: "bg-gray-100 text-gray-800" },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: "bg-gray-100 text-gray-800" }
    
    return <Badge className={config.className}>{config.label}</Badge>
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Serial Number Details</SheetTitle>
        </SheetHeader>
        
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">
            {error}
          </div>
        ) : serialNumber ? (
          <div className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{serialNumber.serial_number}</h3>
                <StatusBadge status={serialNumber.status} />
              </div>
              
              {serialNumber.product && (
                <div className="text-sm text-muted-foreground">
                  {serialNumber.product.name} ({serialNumber.product.sku})
                </div>
              )}
              
              <Separator />
              
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Product</span>
                  <span className="font-medium">
                    {serialNumber.product?.name || serialNumber.product_id || "-"}
                  </span>
                </div>
                
                {serialNumber.batch && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Batch</span>
                    <span className="font-medium">
                      {serialNumber.batch.batch_number || "-"}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusBadge status={serialNumber.status} />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unit Cost</span>
                  <span className="font-medium">
                    {serialNumber.unit_cost ? `KES ${parseFloat(serialNumber.unit_cost).toLocaleString()}` : "-"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unit Price</span>
                  <span className="font-medium">
                    {serialNumber.unit_price ? `KES ${parseFloat(serialNumber.unit_price).toLocaleString()}` : "-"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Received Date</span>
                  <span className="font-medium">
                    {serialNumber.received_date ? new Date(serialNumber.received_date).toLocaleDateString() : "-"}
                  </span>
                </div>
                
                {serialNumber.warranty_expiry_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Warranty Expiry</span>
                    <span className="font-medium">
                      {new Date(serialNumber.warranty_expiry_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {serialNumber.purchase_reference && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Purchase Reference</span>
                    <span className="font-medium">{serialNumber.purchase_reference}</span>
                  </div>
                )}
                
                {serialNumber.sale_reference && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Sale Reference</span>
                    <span className="font-medium">{serialNumber.sale_reference}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created At</span>
                  <span className="font-medium">
                    {new Date(serialNumber.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Updated</span>
                  <span className="font-medium">
                    {new Date(serialNumber.updated_at).toLocaleDateString()}
                  </span>
                </div>
                
                {serialNumber.notes && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground">Notes</span>
                    <span className="font-medium text-right">{serialNumber.notes}</span>
                  </div>
                )}
              </div>
            </div>
            
            <Separator />
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No serial number details found
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}