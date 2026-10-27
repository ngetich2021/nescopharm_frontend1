"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ChevronsUpDown, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"


import { createOrderDispatch, submitDispatchForApproval, type CreateOrderDispatchRequest } from "@/lib/order-dispatches"
import { getUsers, type UserData } from "@/lib/users"
import { getDeliveryRates } from "@/lib/delivery-rates"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OrderDetail } from "@/lib/orders"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const LOCAL_RIDERS = "Local Riders"

interface CreateDispatchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: OrderDetail
  onSuccess?: () => void
}

export function CreateDispatchModal({
  open,
  onOpenChange,
  order,
  onSuccess,
}: CreateDispatchModalProps) {

  const [loading, setLoading] = useState(false)
  // A past (pre-go-live) sale is recorded as already delivered, with no approval round.
  const isPastSale = !!order.is_historical
  const [notes, setNotes] = useState("")
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("")
  const [specialInstructions, setSpecialInstructions] = useState("")
  const [items, setItems] = useState<Array<{ order_item_id: string; product_id: string; quantity_to_dispatch: number; quantity_available: number }>>([])
  
  // State for approvers
  const [potentialApprovers, setPotentialApprovers] = useState<UserData[]>([])
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([])
  const [loadingApprovers, setLoadingApprovers] = useState(false)
  const [openApprovers, setOpenApprovers] = useState(false)

  // Transporter (from approved delivery rates) and destination: they fill the invoice's dispatch
  // fields straight away and are handed on to whoever records the delivery.
  const [transporters, setTransporters] = useState<string[]>([])
  const [dispatchedThrough, setDispatchedThrough] = useState("")
  const [destination, setDestination] = useState("")
  const customerTown = order.delivery_location?.city || order.customer?.city || order.customer?.county || ""

  useEffect(() => {
    if (!open) return
    getDeliveryRates({ active_only: true })
      .then((rates) => {
        const names = Array.from(new Set(rates.filter((r) => r.status === "approved").map((r) => r.transporter_name.trim())))
          .filter((n) => n.toLowerCase() !== LOCAL_RIDERS.toLowerCase())
        // Local riders are always offered; the warehouse manager adds their rates.
        setTransporters([...names.sort(), LOCAL_RIDERS])
      })
      .catch((error) => {
        console.error("Failed to load transporters:", error)
        setTransporters([LOCAL_RIDERS])
      })
  }, [open])

  // Fetch approvers on mount
  useEffect(() => {
    const fetchApprovers = async () => {
      setLoadingApprovers(true)
      try {
        // Only Directors, the GM and the Warehouse Manager approve dispatches.
        const users = await getUsers({ role_scope: "dispatch_approver" })
        if (Array.isArray(users)) {
          setPotentialApprovers(users)
        }
      } catch (error) {
        console.error("Failed to fetch approvers:", error)
        // We don't block the UI, just can't select approvers
      } finally {
        setLoadingApprovers(false)
      }
    }

    if (open) {
      fetchApprovers()
    }
  }, [open])

  useEffect(() => {
    if (open && order.order_items) {
      // Initialize items with available quantities
      const itemsData = order.order_items.map((item: any) => ({
        order_item_id: item.id,
        product_id: item.product_id,
        quantity_to_dispatch: item.quantity - (item.quantity_dispatched || 0),
        quantity_available: item.quantity - (item.quantity_dispatched || 0),
      }))
      setItems(itemsData)
      // Reset form
      setNotes("")
      setEstimatedDeliveryDate("")
      setSpecialInstructions("")
      setSelectedApprovers([])
      setDispatchedThrough("")
      setDestination(order.delivery_location?.city || order.customer?.city || order.customer?.county || "")
    }
  }, [open, order])

  const handleQuantityChange = (orderItemId: string, value: string) => {
    const numValue = parseInt(value) || 0
    setItems((prev) =>
      prev.map((item) =>
        item.order_item_id === orderItemId
          ? { ...item, quantity_to_dispatch: Math.min(numValue, item.quantity_available) }
          : item
      )
    )
  }

  const handleApproverToggle = (approverId: string) => {
    setSelectedApprovers(prev => 
      prev.includes(approverId) 
        ? prev.filter(id => id !== approverId)
        : [...prev, approverId]
    )
  }

  const handleSubmit = async (shouldSubmit: boolean = false) => {
    try {
      // Validate at least one item with quantity > 0
      const validItems = items.filter((item) => item.quantity_to_dispatch > 0)
      if (validItems.length === 0) {
        toast.error("Please specify at least one item to dispatch")
        return
      }

      if (!isPastSale && selectedApprovers.length === 0) {
        toast.error("Please select at least one approver")
        return
      }

      if (!isPastSale && !dispatchedThrough) {
        toast.error("Please choose who the order is dispatched through")
        return
      }

      setLoading(true)

      const payload: CreateOrderDispatchRequest = {
        order_id: order.id,
        // Optional based on new interface, keeping if available
        delivery_location_id: order.delivery_location_id || undefined, 
        notes,
        estimated_delivery_date: estimatedDeliveryDate || undefined,
        special_instructions: specialInstructions || undefined,
        dispatched_through: dispatchedThrough || undefined,
        destination: destination.trim() || undefined,
        items: validItems.map((item) => ({
          order_item_id: item.order_item_id,
          product_id: item.product_id,
          quantity_dispatched: item.quantity_to_dispatch,
        })),
        approvers: isPastSale ? undefined : selectedApprovers,
      }

      const response = await createOrderDispatch(payload)

      if (isPastSale) {
        toast.success(`Dispatch ${response.data.dispatch_number} recorded as delivered`)
      } else if (shouldSubmit && response.data?.id) {
        await submitDispatchForApproval(response.data.id)
        toast.success(`Dispatch ${response.data.dispatch_number} created and submitted for approval`)
      } else {
        toast.success(`Dispatch ${response.data.dispatch_number} created as draft`)
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Error creating dispatch:", error)
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to create dispatch";
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getOrderItem = (orderItemId: string) => {
    return order.order_items?.find((item) => item.id === orderItemId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Dispatch from Order</DialogTitle>
          <DialogDescription>
            Create a dispatch for order #{order.order_number}. You can dispatch full or partial quantities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Dispatch Items Section */}


          {isPastSale && (
            <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Past sale: this dispatch is recorded as already delivered on the sale date. No approvals are needed and
              stock does not change.
            </p>
          )}

          {/* Details Section */}
          <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", isPastSale && "hidden")}>
            {/* Approvers Section - Moved here */}
            {/* Approvers Section - Dropdown with Search */}
            <div className="space-y-2 flex flex-col">
              <Label>Select Approvers</Label>
              <Popover open={openApprovers} onOpenChange={setOpenApprovers}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openApprovers}
                    className="justify-between font-normal"
                  >
                    {selectedApprovers.length > 0
                      ? `${selectedApprovers.length} selected`
                      : "Select approvers..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search approvers..." />
                    <CommandList>
                      <CommandEmpty>No approver found.</CommandEmpty>
                      <CommandGroup>
                        {potentialApprovers.map((approver) => (
                          <CommandItem
                            key={approver.id}
                            value={approver.first_name + " " + approver.last_name}
                            onSelect={() => {
                              handleApproverToggle(approver.id)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedApprovers.includes(approver.id)
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {approver.first_name} {approver.last_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {// Optional: Show selected names below as badges or text if needed, but "X selected" might be enough for compact row. 
               // User asked for "same raw", so concise is better.
              }
              {selectedApprovers.length > 0 && (
                <div className="text-xs text-muted-foreground">
                   {selectedApprovers.map(id => {
                     const user = potentialApprovers.find(u => u.id === id);
                     return user ? `${user.first_name} ${user.last_name}` : id;
                   }).join(", ")}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_date">Estimated Delivery Date (Optional)</Label>
              <Input
                id="estimated_date"
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dispatched_through">Dispatch Through{isPastSale ? " (Optional)" : " *"}</Label>
              <Select value={dispatchedThrough} onValueChange={setDispatchedThrough}>
                <SelectTrigger id="dispatched_through">
                  <SelectValue placeholder="Select transporter" />
                </SelectTrigger>
                <SelectContent>
                  {transporters.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">From the approved delivery rates, or local riders.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                placeholder="Customer's town"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {customerTown && destination.trim() !== customerTown
                  ? `Customer's town is ${customerTown}.`
                  : "The customer's town; change it if the goods go elsewhere."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any internal notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="special_instructions">Special Instructions (Optional)</Label>
              <Textarea
                id="special_instructions"
                placeholder="Handle with care, etc."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={3}
              />
            </div>
          </div>




        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          {isPastSale ? (
            <Button onClick={() => handleSubmit(false)} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Dispatch
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleSubmit(false)} disabled={loading}>
                Save Draft
              </Button>
              <Button onClick={() => handleSubmit(true)} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create & Submit
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
