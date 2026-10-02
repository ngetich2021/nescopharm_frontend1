"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import apiCall from "@/lib/api"

interface DeliveryLocation {
  id: string
  customer_id: string
  house_number: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  country: string
  postal_code: string
  is_default: boolean
  location_note: string
  created_at: string
  updated_at: string
}

interface DeliveryLocationPopupProps {
  isOpen: boolean
  onClose: () => void
  deliveryLocations: DeliveryLocation[]
  customerId: string
  onLocationSelected: (locationId: string) => void
  onLocationAdded: (newLocation: DeliveryLocation) => void
  onLocationUpdated: (updatedLocation: DeliveryLocation) => void
}

export function DeliveryLocationPopup({
  isOpen,
  onClose,
  deliveryLocations,
  customerId,
  onLocationSelected,
  onLocationAdded,
  onLocationUpdated,
}: DeliveryLocationPopupProps) {
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingLocation, setEditingLocation] = useState<DeliveryLocation | null>(null)
  const [newLocation, setNewLocation] = useState<Partial<DeliveryLocation>>({
    customer_id: customerId,
    house_number: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    is_default: false,
    location_note: "",
  })

  const handleAddNewLocation = async () => {
    try {
      const data = await apiCall<DeliveryLocation>("/delivery-locations", "POST", newLocation)
      onLocationAdded(data)
      setIsAddingNew(false)
      setNewLocation({
        customer_id: customerId,
        house_number: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        country: "",
        postal_code: "",
        is_default: false,
        location_note: "",
      })
    } catch (error) {
      //
    }
  }

  const handleUpdateLocation = async () => {
    if (!editingLocation) return

    try {
      const data = await apiCall<DeliveryLocation>(`/delivery-locations/${editingLocation.id}`, "PUT", editingLocation)
      onLocationUpdated(data)
      setEditingLocation(null)
    } catch (error) {
      //
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Delivery Location</DialogTitle>
        </DialogHeader>
        {deliveryLocations.length > 0 ? (
          <div className="space-y-4">
            {deliveryLocations.map((location) => (
              <div key={location.id} className="flex justify-between items-center">
                <div>
                  <p>{location.address_line1}</p>
                  <p>
                    {location.city}, {location.state} {location.postal_code}
                  </p>
                </div>
                <div>
                  <Button onClick={() => onLocationSelected(location.id)}>Select</Button>
                  <Button variant="outline" onClick={() => setEditingLocation(location)}>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No delivery locations found.</p>
        )}
        {!isAddingNew && !editingLocation && <Button onClick={() => setIsAddingNew(true)}>Add New Location</Button>}
        {isAddingNew && (
          <div className="space-y-4">
            <Label htmlFor="house_number">House Number</Label>
            <Input
              id="house_number"
              value={newLocation.house_number}
              onChange={(e) => setNewLocation({ ...newLocation, house_number: e.target.value })}
            />
            <Label htmlFor="address_line1">Address Line 1</Label>
            <Input
              id="address_line1"
              value={newLocation.address_line1}
              onChange={(e) => setNewLocation({ ...newLocation, address_line1: e.target.value })}
            />
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={newLocation.city}
              onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
            />
            <Label htmlFor="postal_code">Postal Code</Label>
            <Input
              id="postal_code"
              value={newLocation.postal_code}
              onChange={(e) => setNewLocation({ ...newLocation, postal_code: e.target.value })}
            />
            <Button onClick={handleAddNewLocation}>Save New Location</Button>
          </div>
        )}
        {editingLocation && (
          <div className="space-y-4">
            <Label htmlFor="edit_house_number">House Number</Label>
            <Input
              id="edit_house_number"
              value={editingLocation.house_number}
              onChange={(e) => setEditingLocation({ ...editingLocation, house_number: e.target.value })}
            />
            <Label htmlFor="edit_address_line1">Address Line 1</Label>
            <Input
              id="edit_address_line1"
              value={editingLocation.address_line1}
              onChange={(e) => setEditingLocation({ ...editingLocation, address_line1: e.target.value })}
            />
            <Label htmlFor="edit_city">City</Label>
            <Input
              id="edit_city"
              value={editingLocation.city}
              onChange={(e) => setEditingLocation({ ...editingLocation, city: e.target.value })}
            />
            <Label htmlFor="edit_postal_code">Postal Code</Label>
            <Input
              id="edit_postal_code"
              value={editingLocation.postal_code}
              onChange={(e) => setEditingLocation({ ...editingLocation, postal_code: e.target.value })}
            />
            <Button onClick={handleUpdateLocation}>Update Location</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
