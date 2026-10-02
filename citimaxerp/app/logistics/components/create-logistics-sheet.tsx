"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { createLogistics, CreateLogisticsData } from "@/lib/logistics"
import { listOrderDispatches, OrderDispatch } from "@/lib/order-dispatches"
import { getDeliveryPersons, DeliveryPerson } from "@/lib/delivery-persons"
import { getCustomerDisplayName } from "@/lib/customers"

interface CreateLogisticsSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onLogisticsCreated: () => void
}

const DELIVERY_STATUSES = [
  { value: "dispatched", label: "Dispatched" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
]

const DELIVERY_METHODS = [
  { value: "courier", label: "Courier" },
  { value: "pickup", label: "Pickup" },
  { value: "standard", label: "Standard" },
  { value: "express", label: "Express" },
]

const VEHICLE_TYPES = [
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "bicycle", label: "Bicycle" },
  { value: "car", label: "Car" },
]

export function CreateLogisticsSheet({ isOpen, onOpenChange, onLogisticsCreated }: CreateLogisticsSheetProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  
  // Form State - only order_dispatch_id and delivery_status are required
  const [formData, setFormData] = useState<Partial<CreateLogisticsData>>({
    delivery_status: "dispatched",
  })

  const [dispatches, setDispatches] = useState<OrderDispatch[]>([])
  const [loadingDispatches, setLoadingDispatches] = useState(false)
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([])
  const [loadingDeliveryPersons, setLoadingDeliveryPersons] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const loadDispatches = async () => {
    setLoadingDispatches(true)
    try {
      const response = await listOrderDispatches({ status: "approved" })
      const availableDispatches = response.data.filter((d) => !d.logistic)
      setDispatches(availableDispatches)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load order dispatches.", variant: "destructive" })
    } finally {
      setLoadingDispatches(false)
    }
  }

  const loadDeliveryPersons = async () => {
    setLoadingDeliveryPersons(true)
    try {
      const persons = await getDeliveryPersons()
      setDeliveryPersons(persons)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load delivery persons.", variant: "destructive" })
    } finally {
      setLoadingDeliveryPersons(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (dispatches.length === 0) loadDispatches()
      if (deliveryPersons.length === 0) loadDeliveryPersons()
    }
  }, [isOpen])

  // Auto-fill recipient info when dispatch is selected
  useEffect(() => {
    if (formData.order_dispatch_id) {
      const selectedDispatch = dispatches.find((d) => d.id === formData.order_dispatch_id)
      if (selectedDispatch?.order?.customer) {
        const customer = selectedDispatch.order.customer
        setFormData((prev) => ({
          ...prev,
          recipient_name: customer.name || "",
          recipient_phone: customer.phone || "",
          delivery_address: selectedDispatch.delivery_location?.address || "",
        }))
      }
    }
  }, [formData.order_dispatch_id, dispatches])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Validate required fields
    if (!formData.order_dispatch_id) {
      toast({ title: "Error", description: "Please select an order dispatch.", variant: "destructive" })
      setLoading(false)
      return
    }

    const logisticsData: CreateLogisticsData = {
      order_dispatch_id: formData.order_dispatch_id,
      delivery_status: formData.delivery_status || "dispatched",
      // Optional fields
      delivery_person_id: formData.delivery_person_id,
      logistics_provider: formData.logistics_provider,
      delivery_method: formData.delivery_method,
      vehicle_type: formData.vehicle_type,
      vehicle_id: formData.vehicle_id,
      tracking_number: formData.tracking_number || `TRK-${Date.now()}`,
      recipient_name: formData.recipient_name,
      recipient_phone: formData.recipient_phone,
      delivery_address: formData.delivery_address,
      city: formData.city,
      estimated_delivery_time: formData.estimated_delivery_time,
      notes: formData.notes,
    }

    try {
      await createLogistics(logisticsData)
      toast({ title: "Success", description: "Logistics entry created successfully" })
      onLogisticsCreated()
      onOpenChange(false)
      // Reset form
      setFormData({ delivery_status: "dispatched" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create logistics entry", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md md:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Logistics</SheetTitle>
          <SheetDescription>Create a new logistics entry for an approved order dispatch.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          
          {/* REQUIRED FIELDS SECTION */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-3">Required Fields</h4>
            
            {/* Order Dispatch Selection - REQUIRED */}
            <div className="space-y-2">
              <Label htmlFor="order_dispatch_id">Order Dispatch *</Label>
              <Select
                value={formData.order_dispatch_id}
                onValueChange={(value) => handleSelectChange("order_dispatch_id", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingDispatches ? "Loading..." : "Select an order dispatch"} />
                </SelectTrigger>
                <SelectContent>
                  {loadingDispatches ? (
                    <SelectItem value="loading" disabled>Loading dispatches...</SelectItem>
                  ) : dispatches.length > 0 ? (
                    dispatches.map((dispatch) => (
                      <SelectItem key={dispatch.id} value={dispatch.id}>
                        {dispatch.dispatch_number} - {dispatch.order?.customer ? getCustomerDisplayName(dispatch.order.customer) : "Unknown Customer"}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No approved dispatches available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Delivery Status - REQUIRED */}
            <div className="space-y-2 mt-4">
              <Label htmlFor="delivery_status">Delivery Status *</Label>
              <Select
                value={formData.delivery_status}
                onValueChange={(value) => handleSelectChange("delivery_status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* OPTIONAL FIELDS SECTION */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Optional Fields</h4>

            {/* Delivery Person - OPTIONAL */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="delivery_person_id">
                Delivery Person <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </Label>
              <Select
                value={formData.delivery_person_id}
                onValueChange={(value) => handleSelectChange("delivery_person_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingDeliveryPersons ? "Loading..." : "Select delivery person"} />
                </SelectTrigger>
                <SelectContent>
                  {loadingDeliveryPersons ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : deliveryPersons.length > 0 ? (
                    deliveryPersons.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.full_name} ({person.phone_number})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No delivery persons found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Logistics Provider - OPTIONAL */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="logistics_provider">
                Logistics Provider <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="logistics_provider"
                name="logistics_provider"
                value={formData.logistics_provider || ""}
                onChange={handleChange}
                placeholder="e.g., DHL Express"
              />
            </div>

            {/* Delivery Method & Vehicle Type - OPTIONAL */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="delivery_method">
                  Delivery Method <span className="text-xs text-gray-400">(optional)</span>
                </Label>
                <Select value={formData.delivery_method} onValueChange={(value) => handleSelectChange("delivery_method", value)}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {DELIVERY_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_type">
                  Vehicle Type <span className="text-xs text-gray-400">(optional)</span>
                </Label>
                <Select value={formData.vehicle_type} onValueChange={(value) => handleSelectChange("vehicle_type", value)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vehicle ID & Tracking Number - OPTIONAL */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_id">
                  Vehicle ID <span className="text-xs text-gray-400">(optional)</span>
                </Label>
                <Input
                  id="vehicle_id"
                  name="vehicle_id"
                  value={formData.vehicle_id || ""}
                  onChange={handleChange}
                  placeholder="e.g., KAA 123B"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking_number">
                  Tracking Number <span className="text-xs text-gray-400">(optional)</span>
                </Label>
                <Input
                  id="tracking_number"
                  name="tracking_number"
                  value={formData.tracking_number || ""}
                  onChange={handleChange}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>

            {/* Recipient Info - OPTIONAL */}
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h5 className="text-sm font-medium text-gray-600 mb-3">
                Recipient Information <span className="text-xs text-gray-400 font-normal">(all optional)</span>
              </h5>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient_name">Recipient Name</Label>
                  <Input id="recipient_name" name="recipient_name" value={formData.recipient_name || ""} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient_phone">Recipient Phone</Label>
                  <Input id="recipient_phone" name="recipient_phone" value={formData.recipient_phone || ""} onChange={handleChange} placeholder="+254712345678" />
                </div>
              </div>
            </div>

            {/* Delivery Address - OPTIONAL */}
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h5 className="text-sm font-medium text-gray-600 mb-3">
                Delivery Address <span className="text-xs text-gray-400 font-normal">(all optional)</span>
              </h5>
              <div className="space-y-2 mb-3">
                <Label htmlFor="delivery_address">Address</Label>
                <Input id="delivery_address" name="delivery_address" value={formData.delivery_address || ""} onChange={handleChange} placeholder="123 Main Street, Suite 100" />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" value={formData.city || ""} onChange={handleChange} placeholder="Nairobi" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/County</Label>
                  <Input id="state" name="state" value={formData.state || ""} onChange={handleChange} placeholder="Nairobi County" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" value={formData.country || ""} onChange={handleChange} placeholder="Kenya" />
              </div>
            </div>

            {/* Estimated Delivery Time - OPTIONAL */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="estimated_delivery_time">
                Estimated Delivery Date/Time <span className="text-xs text-gray-400">(optional)</span>
              </Label>
              <Input
                id="estimated_delivery_time"
                name="estimated_delivery_time"
                type="datetime-local"
                value={formData.estimated_delivery_time || ""}
                onChange={handleChange}
              />
            </div>

            {/* Notes - OPTIONAL */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="notes">
                Notes <span className="text-xs text-gray-400">(optional)</span>
              </Label>
              <Textarea id="notes" name="notes" value={formData.notes || ""} onChange={handleChange} placeholder="Additional notes..." rows={3} />
            </div>


          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#1E2764] hover:bg-[#1E2764]/90" disabled={loading}>
              {loading ? "Creating..." : "Create Logistics"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
