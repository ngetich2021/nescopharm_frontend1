"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Truck, User, Phone, MapPin, Package, Wallet } from "lucide-react";
import { OrderDispatch } from "@/lib/order-dispatches";
import { createLogistics, CreateLogisticsData } from "@/lib/logistics";
import { getDeliveryPersons, createDeliveryPerson, DeliveryPerson } from "@/lib/delivery-persons";
import { getDeliveryRates, DeliveryRate, DeliveryZone } from "@/lib/delivery-rates";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { KENYA_REGIONS, getCountiesForRegion } from "@/lib/kenya-locations";

interface CreateLogisticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: OrderDispatch;
  onSuccess?: () => void;
}

const DELIVERY_STATUSES = [
  { value: "dispatched", label: "Dispatched" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
];

const DELIVERY_METHODS = [
  { value: "courier", label: "Courier" },
  { value: "pickup", label: "Pickup" },
  { value: "standard", label: "Standard" },
  { value: "express", label: "Express" },
];

const VEHICLE_TYPES = [
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "bicycle", label: "Bicycle" },
  { value: "car", label: "Car" },
];

export function CreateLogisticsModal({
  open,
  onOpenChange,
  dispatch,
  onSuccess
}: CreateLogisticsModalProps) {
  const { toast } = useToast();
  const { companyId, userProfile } = useAuth();
  const roleName = ((userProfile as any)?.role?.name || "").toLowerCase();
  const canAddDeliveryPerson = roleName === "gm" || roleName === "director" || roleName === "warehouse manager";
  const [loading, setLoading] = useState(false);
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [fetchingDeliveryPersons, setFetchingDeliveryPersons] = useState(false);
  const [deliveryRates, setDeliveryRates] = useState<DeliveryRate[]>([]);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | "">("");
  const [selectedRateId, setSelectedRateId] = useState<string>("");

  // Form State - only order_dispatch_id and delivery_status are required
  const [formData, setFormData] = useState<CreateLogisticsData>({
    order_dispatch_id: dispatch.id,
    delivery_status: "dispatched",
  });

  // State for Add Delivery Person Modal
  const [showAddDeliveryPerson, setShowAddDeliveryPerson] = useState(false);
  const [newDeliveryPersonName, setNewDeliveryPersonName] = useState("");
  const [newDeliveryPersonPhone, setNewDeliveryPersonPhone] = useState("");
  const [creatingDeliveryPerson, setCreatingDeliveryPerson] = useState(false);

  // State to control Select dropdown open state
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  // Pre-fill data from dispatch when modal opens
  useEffect(() => {
    if (open) {
      loadDeliveryPersons();
      loadDeliveryRates();
      setSelectedZone("");
      setSelectedRateId("");

      // Pre-fill with dispatch data - all fields remain editable.
      // delivery_locations has no single "address"/"name" column, so we
      // assemble one from its parts; region/state/county only exist on the
      // customer record, not on delivery_locations.
      const customer = dispatch.order?.customer;
      const location = dispatch.delivery_location;

      const addressParts = [
        location?.house_number,
        location?.street,
        location?.estate,
        location?.landmark,
      ].filter(Boolean);
      const assembledAddress = addressParts.length > 0 ? addressParts.join(", ") : (customer?.address || "");

      setFormData({
        order_dispatch_id: dispatch.id,
        delivery_status: "dispatched",
        tracking_number: `TRK-${Date.now()}`,
        // Recipient info from customer
        recipient_name: customer?.name || "",
        recipient_phone: customer?.phone || "",
        // Delivery address: prefer the dispatch's delivery_location, fall back to the customer's address
        delivery_address: assembledAddress,
        delivery_location: location?.estate || location?.landmark || "",
        city: location?.city || customer?.city || "",
        state: customer?.county || customer?.state || "",
        region: customer?.region || "",
        country: location?.country || customer?.country || "",
        notes: dispatch.special_instructions || "",
      });
    }
  }, [open, dispatch]);

  const loadDeliveryPersons = async () => {
    if (!companyId) return;

    setFetchingDeliveryPersons(true);
    try {
      const data = await getDeliveryPersons(companyId);
      setDeliveryPersons(data);
    } catch (error) {
      console.error("Failed to load delivery persons", error);
    } finally {
      setFetchingDeliveryPersons(false);
    }
  };

  const loadDeliveryRates = async () => {
    setFetchingRates(true);
    try {
      const data = await getDeliveryRates({ active_only: true });
      setDeliveryRates(data);
    } catch (error) {
      console.error("Failed to load delivery rates", error);
    } finally {
      setFetchingRates(false);
    }
  };

  const ratesForZone = deliveryRates.filter((r) => r.zone === selectedZone);
  const selectedRate = deliveryRates.find((r) => r.id === selectedRateId);
  const cartons = Number(formData.number_of_cartons) || 0;
  const calculatedTotal = selectedRate ? Number(selectedRate.rate_per_carton) * cartons : 0;

  const handleAddDeliveryPerson = async () => {
    if (!companyId) return;

    if (!newDeliveryPersonName.trim()) {
      toast({ title: "Missing Information", description: "Full name is required.", variant: "destructive" });
      return;
    }

    if (!newDeliveryPersonPhone.trim()) {
      toast({ title: "Missing Information", description: "Phone number is required.", variant: "destructive" });
      return;
    }

    setCreatingDeliveryPerson(true);
    try {
      const newPerson = await createDeliveryPerson(companyId, {
        full_name: newDeliveryPersonName.trim(),
        phone_number: newDeliveryPersonPhone.trim(),
      });

      setDeliveryPersons(prev => [...prev, newPerson]);
      setFormData(prev => ({ ...prev, delivery_person_id: newPerson.id }));

      setShowAddDeliveryPerson(false);
      setNewDeliveryPersonName("");
      setNewDeliveryPersonPhone("");

      toast({ title: "Success", description: "Delivery person added successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create delivery person.", variant: "destructive" });
    } finally {
      setCreatingDeliveryPerson(false);
    }
  };

  const handleChange = (field: keyof CreateLogisticsData, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    if (!selectedRateId) {
      toast({ title: "Missing Information", description: "Please select a zone and transporter.", variant: "destructive" });
      return;
    }
    if (!cartons || cartons < 1) {
      toast({ title: "Missing Information", description: "Please enter the number of cartons.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await createLogistics({ ...formData, delivery_rate_id: selectedRateId, number_of_cartons: cartons });
      toast({
        title: "Success",
        description: `Logistics created. A delivery invoice of KES ${calculatedTotal.toLocaleString()} has been sent to accounting.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create logistics entry.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const selectedDeliveryPerson = deliveryPersons.find(p => p.id === formData.delivery_person_id);

  return (
    <>
      {/* Add Delivery Person Modal */}
      <Dialog open={showAddDeliveryPerson} onOpenChange={setShowAddDeliveryPerson}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Delivery Person</DialogTitle>
            <DialogDescription>Enter the details of the new delivery person.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newDeliveryPersonName">Full Name</Label>
              <Input
                id="newDeliveryPersonName"
                placeholder="Enter full name"
                value={newDeliveryPersonName}
                onChange={(e) => setNewDeliveryPersonName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newDeliveryPersonPhone">Phone Number</Label>
              <Input
                id="newDeliveryPersonPhone"
                placeholder="e.g. 0712345678"
                value={newDeliveryPersonPhone}
                onChange={(e) => setNewDeliveryPersonPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDeliveryPerson(false)}>Cancel</Button>
            <Button onClick={handleAddDeliveryPerson} disabled={creatingDeliveryPerson}>
              {creatingDeliveryPerson && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Delivery Person
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              Create Logistics
            </DialogTitle>
            <DialogDescription>
              Create logistics entry for dispatch <strong>#{dispatch.dispatch_number}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
            <div className="grid gap-5">
              
              {/* REQUIRED FIELDS SECTION */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  Required Fields
                </h4>
                
                {/* Delivery Status - REQUIRED */}
                <div className="grid gap-2">
                  <Label htmlFor="delivery_status">Delivery Status *</Label>
                  <Select 
                    value={formData.delivery_status} 
                    onValueChange={(value) => handleChange("delivery_status", value)}
                  >
                    <SelectTrigger id="delivery_status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* OPTIONAL FIELDS SECTION */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Optional Fields</h4>
                
                {/* Delivery Person - OPTIONAL */}
                <div className="grid gap-2 mb-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="delivery_person_id" className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      Delivery Person
                      <span className="text-xs text-gray-400 font-normal">(optional)</span>
                    </Label>
                    {canAddDeliveryPerson && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => { setIsSelectOpen(false); setShowAddDeliveryPerson(true); }}
                      >
                        <Plus className="h-4 w-4" />
                        Add New
                      </Button>
                    )}
                  </div>
                  <Select
                    value={formData.delivery_person_id}
                    onValueChange={(value) => handleChange("delivery_person_id", value)}
                    open={isSelectOpen}
                    onOpenChange={setIsSelectOpen}
                  >
                    <SelectTrigger id="delivery_person_id">
                      <SelectValue placeholder={fetchingDeliveryPersons ? "Loading..." : "Select delivery person"} />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryPersons.length === 0 && !fetchingDeliveryPersons ? (
                        <div className="p-2 text-center text-sm text-muted-foreground">
                          No delivery persons available.<br />
                          {canAddDeliveryPerson ? (
                            <button type="button" className="text-blue-600 hover:underline mt-1" onClick={() => { setIsSelectOpen(false); setShowAddDeliveryPerson(true); }}>
                              Add one now
                            </button>
                          ) : (
                            <span className="text-xs">Only GM, Director or Warehouse Manager can add one.</span>
                          )}
                        </div>
                      ) : (
                        deliveryPersons.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            <div className="flex flex-col">
                              <span>{person.full_name || person.name}</span>
                              <span className="text-xs text-muted-foreground">{person.phone_number || person.phone}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Logistics Provider - OPTIONAL */}
                <div className="grid gap-2 mb-4">
                  <Label htmlFor="logistics_provider" className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    Logistics Provider
                    <span className="text-xs text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="logistics_provider"
                    placeholder="e.g., DHL Express, FedEx"
                    value={formData.logistics_provider || ""}
                    onChange={(e) => handleChange("logistics_provider", e.target.value)}
                  />
                </div>

                {/* Delivery Method & Vehicle Type - OPTIONAL */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="grid gap-2">
                    <Label htmlFor="delivery_method">Delivery Method <span className="text-xs text-gray-400">(optional)</span></Label>
                    <Select value={formData.delivery_method} onValueChange={(value) => handleChange("delivery_method", value)}>
                      <SelectTrigger id="delivery_method">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vehicle_type">Vehicle Type <span className="text-xs text-gray-400">(optional)</span></Label>
                    <Select value={formData.vehicle_type} onValueChange={(value) => handleChange("vehicle_type", value)}>
                      <SelectTrigger id="vehicle_type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
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
                  <div className="grid gap-2">
                    <Label htmlFor="vehicle_id">Vehicle ID <span className="text-xs text-gray-400">(optional)</span></Label>
                    <Input
                      id="vehicle_id"
                      placeholder="e.g., KAA 123B"
                      value={formData.vehicle_id || ""}
                      onChange={(e) => handleChange("vehicle_id", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tracking_number">Tracking Number <span className="text-xs text-gray-400">(optional)</span></Label>
                    <Input
                      id="tracking_number"
                      placeholder="TRK-123456789"
                      value={formData.tracking_number || ""}
                      onChange={(e) => handleChange("tracking_number", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-2 mb-4">
                  <Label htmlFor="transporter_invoice_number">Transporter Invoice <span className="text-xs text-gray-400">(optional)</span></Label>
                  <Input
                    id="transporter_invoice_number"
                    placeholder="Invoice no. on the transporter's receipt"
                    value={formData.transporter_invoice_number || ""}
                    onChange={(e) => handleChange("transporter_invoice_number", e.target.value)}
                  />
                </div>

                {/* Recipient Information - OPTIONAL */}
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <h5 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    Recipient Information
                    <span className="text-xs text-gray-400 font-normal">(all optional)</span>
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="recipient_name">Recipient Name</Label>
                      <Input
                        id="recipient_name"
                        placeholder="John Doe"
                        value={formData.recipient_name || ""}
                        onChange={(e) => handleChange("recipient_name", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="recipient_phone" className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        Recipient Phone
                      </Label>
                      <Input
                        id="recipient_phone"
                        placeholder="+254712345678"
                        value={formData.recipient_phone || ""}
                        onChange={(e) => handleChange("recipient_phone", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Address & Destination - OPTIONAL */}
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <h5 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Delivery Address
                    <span className="text-xs text-gray-400 font-normal">(all optional)</span>
                  </h5>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="delivery_address">Address</Label>
                      <Input
                        id="delivery_address"
                        placeholder="123 Main Street, Suite 100"
                        value={formData.delivery_address || ""}
                        onChange={(e) => handleChange("delivery_address", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="delivery_location">Destination</Label>
                      <Input
                        id="delivery_location"
                        placeholder="e.g. ABC Supermarket, Westlands"
                        value={formData.delivery_location || ""}
                        onChange={(e) => handleChange("delivery_location", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="city">City/Town</Label>
                        <Input id="city" placeholder="Nairobi" value={formData.city || ""} onChange={(e) => handleChange("city", e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="region">Region</Label>
                        <Select
                          value={formData.region || ""}
                          onValueChange={(value) => {
                            handleChange("region", value);
                            // Reset the county whenever the region changes since
                            // the previous selection may no longer be valid.
                            handleChange("state", "");
                          }}
                        >
                          <SelectTrigger id="region">
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent>
                            {KENYA_REGIONS.map((region) => (
                              <SelectItem key={region.name} value={region.name}>{region.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="state">County</Label>
                        <Select
                          value={formData.state || ""}
                          onValueChange={(value) => handleChange("state", value)}
                          disabled={!formData.region}
                        >
                          <SelectTrigger id="state">
                            <SelectValue placeholder={formData.region ? "Select county" : "Select a region first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {getCountiesForRegion(formData.region || "").map((county) => (
                              <SelectItem key={county} value={county}>{county}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="country">Country</Label>
                        <Input id="country" value="Kenya" disabled readOnly />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Cost - transporter + zone rate, warehouse manager
                    only enters carton count. The app calculates the total and
                    raises a Delivery Invoice for accounting to pay before this
                    dispatch can proceed. No manual money entry here. */}
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <h5 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" />
                    Delivery Cost
                    <span className="text-xs text-gray-400 font-normal">(auto-calculated)</span>
                  </h5>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="zone">Zone</Label>
                        <Select
                          value={selectedZone}
                          onValueChange={(value) => {
                            setSelectedZone(value as DeliveryZone);
                            setSelectedRateId("");
                          }}
                        >
                          <SelectTrigger id="zone">
                            <SelectValue placeholder="Select zone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nairobi">Nairobi</SelectItem>
                            <SelectItem value="upcountry">Upcountry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="transporter">Transporter</Label>
                        <Select
                          value={selectedRateId}
                          onValueChange={(value) => {
                            setSelectedRateId(value);
                            handleChange("delivery_rate_id", value);
                          }}
                          disabled={!selectedZone}
                        >
                          <SelectTrigger id="transporter">
                            <SelectValue placeholder={
                              fetchingRates ? "Loading..." : selectedZone ? "Select transporter" : "Select a zone first"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {ratesForZone.length === 0 && !fetchingRates ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">
                                No approved rates for this zone yet.
                              </div>
                            ) : (
                              ratesForZone.map((rate) => (
                                <SelectItem key={rate.id} value={rate.id}>
                                  {rate.transporter_name} — KES {Number(rate.rate_per_carton).toLocaleString()}/carton
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="number_of_cartons">Number of Cartons</Label>
                        <Input
                          id="number_of_cartons"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 10"
                          value={formData.number_of_cartons ?? ""}
                          onChange={(e) => handleChange("number_of_cartons", e.target.value === "" ? "" : Number(e.target.value))}
                          disabled={!selectedRateId}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Total Delivery Cost</Label>
                        <div className="h-10 flex items-center px-3 rounded-md border border-gray-200 bg-gray-50 font-semibold text-gray-800">
                          KES {calculatedTotal.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {selectedRate && cartons > 0 && (
                      <p className="text-xs text-gray-500">
                        This will raise a Delivery Invoice of <strong>KES {calculatedTotal.toLocaleString()}</strong> for
                        accounting to pay before the dispatch proceeds.
                      </p>
                    )}
                  </div>
                </div>

                {/* Estimated Delivery Time - OPTIONAL */}
                <div className="grid gap-2 mb-4">
                  <Label htmlFor="estimated_delivery_time">Estimated Delivery Date/Time <span className="text-xs text-gray-400">(optional)</span></Label>
                  <Input
                    id="estimated_delivery_time"
                    type="datetime-local"
                    value={formData.estimated_delivery_time || ""}
                    onChange={(e) => handleChange("estimated_delivery_time", e.target.value)}
                  />
                </div>

                {/* Notes - OPTIONAL */}
                <div className="grid gap-2 mb-4">
                  <Label htmlFor="notes">Notes <span className="text-xs text-gray-400">(optional)</span></Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes..."
                    value={formData.notes || ""}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    rows={3}
                  />
                </div>


              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Logistics
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
