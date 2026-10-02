"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { assignBatchToSerialNumber } from "@/lib/serial-numbers"
import type { SerialNumber } from "@/types/serial-numbers"
import { usePermissions } from "@/hooks/use-permissions"

interface AssignBatchSheetProps {
  serialNumber: SerialNumber
  open: boolean
  onOpenChange: (open: boolean) => void
  onBatchAssigned: () => void
}

export function AssignBatchSheet({ serialNumber, open, onOpenChange, onBatchAssigned }: AssignBatchSheetProps) {
  const [batchId, setBatchId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  // Initialize batch ID when serial number changes
  useEffect(() => {
    if (serialNumber) {
      setBatchId(serialNumber.batch_id || "")
    }
  }, [serialNumber])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      await assignBatchToSerialNumber(serialNumber.id, batchId)
      
      toast({
        title: "Success",
        description: "Batch assigned to serial number successfully",
      })
      
      onBatchAssigned()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign batch to serial number",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Assign Batch to Serial Number</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{serialNumber.serial_number}</p>
                {serialNumber.product && (
                  <p className="text-sm text-muted-foreground">{serialNumber.product.name}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="batch_id">Batch ID *</Label>
              <Input
                id="batch_id"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                required
                placeholder="Enter batch ID"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !hasPermission("can_assign_serial_numbers_to_batches")}>
              {isLoading ? "Assigning..." : "Assign Batch"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}