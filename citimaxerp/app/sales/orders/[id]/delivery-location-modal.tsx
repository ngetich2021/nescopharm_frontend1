import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Edit, Trash } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { 
  DeliveryLocation as ApiDeliveryLocation, 
  getDeliveryLocations, 
  createDeliveryLocation as apiCreateDeliveryLocation, 
  updateDeliveryLocation as apiUpdateDeliveryLocation,
  deleteDeliveryLocation,
  CreateDeliveryLocationData,
  // Remove CreateDeliveryLocationData import
} from "@/lib/delivery-locations"

// Define the correct input type for creating a delivery location
type CreateDeliveryLocationInput = {
  company_id: string
  customer_id: string
  house_number: string
  estate: string
  city: string
  state?: string | null
  country: string
  postal_code?: string | null
  is_default?: boolean
  location_note?: string | null
  landmark?: string
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDeliveryPersons, DeliveryPerson } from "@/lib/delivery-persons"

// Use the API types instead of database types
// Only use house_number, estate, landmark, city in DeliveryLocation
interface DeliveryLocation {
  id: string;
  customer_id: string;
  house_number: string;
  estate: string | null;
  city: string;
  landmark: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  company_id: string;
}

interface DeliveryLocationModalProps {
  isOpen: boolean
  onClose: () => void
  deliveryLocations: DeliveryLocation[]
  customerId: string
  onLocationSelected: (locationId: string) => void
  onLocationAdded: (newLocation: DeliveryLocation) => void
  onLocationUpdated: (updatedLocation: DeliveryLocation) => void
  onDispatchInitiated: (locationId: string, deliveryPersonId: string, deliveryMethod: string) => void
  companyId: string // Add companyId prop
  orderId?: string // Add orderId prop
}

export function DeliveryLocationModal({
  isOpen,
  onClose,
  deliveryLocations: initialDeliveryLocations,
  customerId,
  onLocationSelected,
  onLocationAdded,
  onLocationUpdated,
  onDispatchInitiated,
  companyId, // Accept companyId
  orderId, // Accept orderId
}: DeliveryLocationModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [newLocation, setNewLocation] = useState<Partial<DeliveryLocation>>({
    house_number: "",
    estate: "",
    landmark: "",
    city: "",
    is_default: false,
  })
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([])
  const [selectedDeliveryPerson, setSelectedDeliveryPerson] = useState<string>("")
  const [deliveryMethod, setDeliveryMethod] = useState<string>("in-house") // Default to in-house
  const [scheduledDeliveryDate, setScheduledDeliveryDate] = useState<string>("")
  const [deliveryNotes, setDeliveryNotes] = useState<string>("")

  useEffect(() => {
    if (isOpen && companyId) {
      if (initialDeliveryLocations.length > 0) {
        const defaultLoc = initialDeliveryLocations.find((loc) => loc.is_default) || initialDeliveryLocations[0]
        setSelectedLocationId(defaultLoc.id)
      }
      setSelectedDeliveryPerson("")
      fetchDeliveryPersons()
    }
  }, [isOpen, initialDeliveryLocations, companyId])

  async function fetchDeliveryPersons() {
    setLoading(true)
    try {
      const persons = await getDeliveryPersons(companyId)
      if (persons && persons.length > 0) {
        setDeliveryPersons(persons)
      } else {
        setDeliveryPersons([])
        toast({
          title: "No Delivery Persons",
          description: "No delivery persons found.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      setDeliveryPersons([])
      toast({
        title: "Error",
        description: error.message || "Failed to load delivery persons.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddNewLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!newLocation.house_number || !newLocation.estate || !newLocation.city) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields for the new location.",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    try {
      const locationData = {
        company_id: companyId,
        customer_id: customerId,
        house_number: newLocation.house_number as string,
        estate: newLocation.estate as string,
        city: newLocation.city as string,
        landmark: newLocation.landmark || null,
        is_default: newLocation.is_default || false,
      }
      const response = await fetch(`/delivery-locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locationData)
      });
      const data = await response.json();
      const createdLocation = data.delivery_location;
      if (data.status === "success" && createdLocation) {
        onLocationAdded(createdLocation)
        setSelectedLocationId(createdLocation.id)
        setIsAddingNew(false)
        setNewLocation({
          house_number: "",
          estate: "",
          landmark: "",
          city: "",
          is_default: false,
        })
        toast({
          title: "Success",
          description: "New delivery location added.",
        })
      } else {
        throw new Error(data.message || "Failed to add new location.")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add new location.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!selectedLocationId) {
      toast({
        title: "Error",
        description: "No location selected for update.",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    if (!newLocation.house_number || !newLocation.estate || !newLocation.city) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields for the location.",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    try {
      const updateData = {
        house_number: newLocation.house_number as string,
        estate: newLocation.estate as string,
        city: newLocation.city as string,
        landmark: newLocation.landmark || null,
        is_default: newLocation.is_default || false,
      }
      const updatedLocation = await apiUpdateDeliveryLocation(selectedLocationId, updateData);
      if (updatedLocation) {
        onLocationUpdated(updatedLocation)
        setIsEditingLocation(false)
        toast({
          title: "Success",
          description: "Delivery location updated.",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update location.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLocation = async (locationId: string) => {
    if (!locationId) return
    if (initialDeliveryLocations.length <= 1) {
      toast({
        title: "Error",
        description: "Cannot delete the only location. Please add a new one first.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Use deleteDeliveryLocation API function
      const success = await deleteDeliveryLocation(locationId);

      if (success) {
        toast({
          title: "Success",
          description: "Delivery location deleted.",
        });
        
        // Fetch updated locations
        const updatedLocations = await getDeliveryLocations(customerId);
        
        // Update parent component state and UI
        if (updatedLocations && updatedLocations.length > 0) {
          // Update parent state with the first location
          onLocationAdded(updatedLocations[0]); 
          setSelectedLocationId(updatedLocations[0].id);
        } else {
          setSelectedLocationId("");
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete location.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Update handleDispatch to use /delivery-details endpoint
  const handleDispatch = async () => {
    if (!selectedLocationId || !selectedDeliveryPerson || !deliveryMethod) {
      toast({
        title: "Validation Error",
        description: "Please select a location, delivery person, and method.",
        variant: "destructive",
      })
      return
    }
    if (!scheduledDeliveryDate) {
      toast({
        title: "Validation Error",
        description: "Please select a scheduled delivery date.",
        variant: "destructive",
      })
      return
    }
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      // You must have order_id available in the modal props
      const payload = {
        company_id: companyId,
        customer_id: customerId,
        order_id: (typeof orderId !== 'undefined' ? orderId : ""), // You must pass orderId as a prop
        delivery_person_id: selectedDeliveryPerson,
        delivery_location_id: selectedLocationId,
        scheduled_delivery_date: scheduledDeliveryDate,
        delivery_method: deliveryMethod,
        delivery_status: "Dispatched",
        notes: deliveryNotes,
      }
      const response = await fetch("/delivery-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (data.status === "success") {
        toast({
          title: "Success",
          description: data.message || "Delivery detail created successfully.",
        })
        onDispatchInitiated(selectedLocationId, selectedDeliveryPerson, deliveryMethod)
        onClose()
      } else {
        throw new Error(data.message || "Failed to create delivery detail.")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create delivery detail.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const currentEditingLocation = initialDeliveryLocations.find((loc) => loc.id === selectedLocationId)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dispatch Order</DialogTitle>
          <DialogDescription>Select a delivery location and assign a delivery person.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Existing Locations */}
          <div className="space-y-2">
            <Label htmlFor="deliveryLocation">Delivery Location</Label>
            {initialDeliveryLocations.length > 0 && !isAddingNew ? (
              <div className="flex items-center gap-2">
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger id="deliveryLocation">
                    <SelectValue placeholder="Select an existing location" />
                  </SelectTrigger>
                  <SelectContent>
                    {initialDeliveryLocations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.house_number}, {loc.estate}, {loc.city}
                        {loc.is_default && " (Default)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setIsEditingLocation(true)
                    setNewLocation(currentEditingLocation || {})
                  }}
                  disabled={!selectedLocationId}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDeleteLocation(selectedLocationId)}
                  disabled={!selectedLocationId || loading}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No existing locations. Add a new one below.</p>
            )}
            <Button variant="outline" onClick={() => setIsAddingNew(!isAddingNew)} className="w-full mt-2">
              {isAddingNew ? "Cancel Add New" : "Add New Location"}
            </Button>
          </div>

          {/* Add/Edit New Location Form */}
          {(isAddingNew || isEditingLocation) && (
            <Card className="p-4 border-dashed">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg">
                  {isAddingNew ? "New Delivery Location" : "Edit Delivery Location"}
                </CardTitle>
                <CardDescription>
                  {isAddingNew ? "Enter details for a new delivery address." : "Update the selected delivery address."}
                </CardDescription>
              </CardHeader>
              <form onSubmit={isAddingNew ? handleAddNewLocation : handleUpdateLocation} className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="house_number">House/Apt No.</Label>
                    <Input
                      id="house_number"
                      value={newLocation.house_number || ""}
                      onChange={(e) => setNewLocation({ ...newLocation, house_number: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estate">Estate</Label>
                    <Input
                      id="estate"
                      value={newLocation.estate || ""}
                      onChange={(e) => setNewLocation({ ...newLocation, estate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={newLocation.city || ""}
                      onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="landmark">Landmark</Label>
                    <Input
                      id="landmark"
                      value={newLocation.landmark || ""}
                      onChange={(e) => setNewLocation({ ...newLocation, landmark: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_default"
                    checked={newLocation.is_default || false}
                    onCheckedChange={(checked) => setNewLocation({ ...newLocation, is_default: checked })}
                  />
                  <Label htmlFor="is_default">Set as default location</Label>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isAddingNew ? "Adding..." : "Updating..."}
                    </>
                  ) : (
                    <>{isAddingNew ? "Add Location" : "Update Location"}</>
                  )}
                </Button>
              </form>
            </Card>
          )}

          {/* Delivery Person and Method */}
          <div className="space-y-2">
            <Label htmlFor="deliveryPerson">Assign Delivery Person</Label>
            <Select
              value={selectedDeliveryPerson}
              onValueChange={setSelectedDeliveryPerson}
              // disabled={!selectedLocationId || deliveryPersons.length === 0}
            >
              <SelectTrigger id="deliveryPerson">
                <SelectValue placeholder={deliveryPersons.length === 0 ? "No delivery persons found" : "Select a delivery person"} />
              </SelectTrigger>
              <SelectContent>
                {deliveryPersons.length === 0 ? (
                  <div className="px-4 py-2 text-muted-foreground text-sm">No delivery persons found</div>
                ) : (
                  deliveryPersons.map((person: any) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.full_name || person.name}
                      {person.phone_number || person.phone ? ` (${person.phone_number || person.phone})` : ""}
                      {person.availability_status ? ` - ${person.availability_status.replace('_', ' ')} ` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          
            {/* If deliveryPersons is empty but API returned something unexpected, show a warning */}
            {deliveryPersons.length === 0 && !loading && (
              <div className="text-xs text-primary mt-1">
                No delivery persons found or data shape mismatch. Check console for API response.
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryMethod">Delivery Method</Label>
            <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
              <SelectTrigger id="deliveryMethod">
                <SelectValue placeholder="Select delivery method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-house">In-house Delivery</SelectItem>
                <SelectItem value="third-party">Third-Party Courier</SelectItem>
                <SelectItem value="customer-pickup">Customer Pickup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scheduled Delivery Date and Notes */}
          <div className="space-y-2">
            <Label htmlFor="scheduledDeliveryDate">Scheduled Delivery Date</Label>
            <Input
              id="scheduledDeliveryDate"
              type="date"
              value={scheduledDeliveryDate}
              onChange={e => setScheduledDeliveryDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryNotes">Notes</Label>
            <Input
              id="deliveryNotes"
              value={deliveryNotes}
              onChange={e => setDeliveryNotes(e.target.value)}
              placeholder="Enter any delivery notes (optional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleDispatch} disabled={loading || !selectedLocationId || !selectedDeliveryPerson}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Dispatching...
              </>
            ) : (
              "Dispatch Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
