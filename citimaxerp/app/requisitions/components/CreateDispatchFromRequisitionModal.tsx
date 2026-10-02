"use client";

import { useState, useEffect } from "react";
import { createDispatch, getProductBatches, type InventoryBatch } from "@/lib/dispatch";
import { type Requisition } from "@/lib/requisitions";
import { getStores } from "@/lib/stores";
import { fetchUsers, type UserData as UserType } from "@/lib/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  X, 
  Package, 
  Building2, 
  Calendar, 
  Plus,
  Minus,
  AlertTriangle,
  Loader2,
  ClipboardList,
  User
} from "lucide-react";
import { format } from "date-fns";
import { cn, toSentenceCase } from "@/lib/utils";

interface CreateDispatchFromRequisitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  requisition: Requisition | null;
}

interface Store {
  id: string;
  name: string;
  description?: string;
  address?: string;
}

interface DispatchItem {
  product_id: string;
  variant_id?: string;
  batch_id?: string;
  quantity: number;
  is_returnable: boolean;
  return_date?: string;
  notes?: string;
  product?: any;
  variant?: any;
}

interface FormData {
  from_store_id: string;
  to_entity: string;
  to_user_id: string;
  type: "internal" | "external";
  notes: string;
  items: DispatchItem[];
}

export function CreateDispatchFromRequisitionModal({ 
  open, 
  onOpenChange, 
  onSuccess, 
  requisition 
}: CreateDispatchFromRequisitionModalProps) {
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [batchesByIndex, setBatchesByIndex] = useState<Record<number, InventoryBatch[]>>({});
  const [otherStoreBatches, setOtherStoreBatches] = useState<Record<number, InventoryBatch[]>>({});
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchErrors, setBatchErrors] = useState<Record<number, string>>({});
  const [batchReloadKey, setBatchReloadKey] = useState(0);
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    from_store_id: "",
    to_entity: "",
    to_user_id: "",
    type: "internal",
    notes: "",
    items: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      loadInitialData();
      if (requisition) {
        // Pre-populate form with requisition data
        setFormData({
          from_store_id: "",
          to_entity: "warehouse", // Default to warehouse for internal dispatch
          to_user_id: requisition.requester_id, // Set requester as assigned user
          type: "internal",
          notes: `Dispatch for requisition ${requisition.requisition_number}`,
          // Custom (non-catalog) items have no product/stock to dispatch from -
          // they need to be sourced manually, so leave them out of this list.
          items: requisition.items
            .filter(item => item.product_id)
            .map(item => ({
              product_id: item.product_id as string,
              variant_id: item.variant_id || undefined,
              quantity: item.quantity,
              is_returnable: true,
              return_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
              notes: item.notes || "",
              product: item.product,
              variant: item.variant
            }))
        });
      }
    } else {
      const timer = setTimeout(() => {
        setIsVisible(false);
        resetForm();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, requisition]);

  const resetForm = () => {
    setFormData({
      from_store_id: "",
      to_entity: "",
      to_user_id: "",
      type: "internal" as "internal" | "external",
      notes: "",
      items: []
    });
    setErrors({});
    setBatchesByIndex({});
    setOtherStoreBatches({});
    setBatchErrors({});
  };

  // Re-fetch available batches (FEFO-sorted) for every line item whenever the
  // source store changes - availability is store-scoped.
  useEffect(() => {
    if (!formData.from_store_id || formData.items.length === 0) {
      setBatchesByIndex({});
      setOtherStoreBatches({});
      setBatchErrors({});
      setBatchesLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setBatchesLoading(true);
      try {
        // One request per item across all stores, split client-side by store.
        const results = await Promise.allSettled(
          formData.items.map((item) =>
            getProductBatches(item.product_id, { variant_id: item.variant_id })
          )
        );
        if (cancelled) return;
        const map: Record<number, InventoryBatch[]> = {};
        const otherMap: Record<number, InventoryBatch[]> = {};
        const errorMap: Record<number, string> = {};
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            map[index] = [];
            otherMap[index] = [];
            errorMap[index] = result.reason?.message || "Failed to load batches";
            return;
          }
          map[index] = result.value.filter((b) => b.store_id === formData.from_store_id);
          otherMap[index] = result.value.filter((b) => b.store_id !== formData.from_store_id);
        });

        setBatchesByIndex(map);
        setOtherStoreBatches(otherMap);
        setBatchErrors(errorMap);
        // Keep a selected batch only if it belongs to the new store; otherwise default to soonest expiry
        setFormData((prev) => ({
          ...prev,
          items: prev.items.map((item, index) => {
            const options = map[index] || [];
            if (item.batch_id && options.some((b) => b.id === item.batch_id)) return item;
            return { ...item, batch_id: options[0]?.id };
          }),
        }));
      } finally {
        if (!cancelled) setBatchesLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.from_store_id, formData.items.length, batchReloadKey]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load stores
      const storesData = await getStores();
      setStores(storesData);

      // Load users from company
      const usersData = await fetchUsers();
      setUsers(usersData);
      
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Basic information validation
    if (!formData.from_store_id) newErrors.from_store_id = "From store is required";
    if (!formData.to_entity) newErrors.to_entity = "To entity is required";
    if (!formData.to_user_id) newErrors.to_user_id = "To user is required";

    // Items validation
    if (formData.items.length === 0) {
      newErrors.items = "At least one item is required";
    } else {
      formData.items.forEach((item, index) => {
        if (item.quantity <= 0) {
          newErrors[`item_${index}_quantity`] = "Quantity must be greater than 0";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !requisition) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        requisition_id: requisition.id,
        items: formData.items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          batch_id: item.batch_id || undefined,
          quantity: item.quantity,
          is_returnable: item.is_returnable,
          return_date: item.return_date || undefined,
          notes: item.notes || undefined
        }))
      };

      // Creates the dispatch and marks the requisition dispatched in one backend transaction
      const dispatchResponse = await createDispatch(payload);

      if (dispatchResponse.status === 'success') {
        toast({
          title: "Success",
          description: `Dispatch created successfully for requisition ${requisition.requisition_number}`,
        });
        
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error creating dispatch:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create dispatch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, updates: Partial<DispatchItem>) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, ...updates } : item)
    }));
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />
      
      {/* Sliding Modal */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-4xl bg-white shadow-2xl z-[100] transition-transform duration-300 ease-in-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create Dispatch from Requisition</h2>
              <p className="text-sm text-gray-500">
                {requisition ? `Creating dispatch for requisition ${requisition.requisition_number}` : "Create a new dispatch"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Requisition Summary */}
          {requisition && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <ClipboardList className="h-5 w-5" />
                  <span>Source Requisition</span>
                </CardTitle>
                <CardDescription>
                  Dispatch will be created from this approved requisition
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Requisition Number</Label>
                    <p className="text-sm text-gray-700">{requisition.requisition_number}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Requester</Label>
                    <p className="text-sm text-gray-700">
                      {requisition.requester.first_name} {requisition.requester.last_name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total Items</Label>
                    <p className="text-sm text-gray-700">
                      {requisition.items.length} product{requisition.items.length !== 1 ? 's' : ''} 
                      ({requisition.items.reduce((sum, item) => sum + item.quantity, 0)} total qty)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Dispatch Information</span>
              </CardTitle>
              <CardDescription>
                Set up the basic dispatch details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* From Store */}
                <div className="space-y-2">
                  <Label htmlFor="from_store_id">From Store *</Label>
                  <Select 
                    value={formData.from_store_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, from_store_id: value }))}
                  >
                    <SelectTrigger className={errors.from_store_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select store to dispatch from" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          <div>
                            <div className="font-medium">{store.name}</div>
                            {store.description && (
                              <div className="text-xs text-muted-foreground">{store.description}</div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.from_store_id && (
                    <p className="text-sm text-red-600">{errors.from_store_id}</p>
                  )}
                </div>

                {/* Dispatch Type */}
                <div className="space-y-2">
                  <Label htmlFor="type">Dispatch Type *</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => {
                      const newType = value as "internal" | "external";
                      setFormData(prev => ({ 
                        ...prev, 
                        type: newType,
                        to_entity: newType === "internal" ? "warehouse" : "" // Reset to_entity when type changes
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select dispatch type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal Transfer</SelectItem>
                      <SelectItem value="external">External Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* To Entity */}
                <div className="space-y-2">
                  <Label htmlFor="to_entity">To Entity *</Label>
                  <Select 
                    value={formData.to_entity} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, to_entity: value }))}
                  >
                    <SelectTrigger className={errors.to_entity ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select entity/department">
                        {formData.to_entity ? toSentenceCase(formData.to_entity) : "Select entity/department"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {formData.type === "internal" ? (
                        <>
                          <SelectItem value="warehouse">Warehouse</SelectItem>
                          <SelectItem value="sales">Sales Department</SelectItem>
                          <SelectItem value="operations">Operations</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="external_company">External Company</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="supplier">Supplier</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.to_entity && (
                    <p className="text-sm text-red-600">{errors.to_entity}</p>
                  )}
                </div>

                {/* To User - Pre-populated with requester */}
                <div className="space-y-2">
                  <Label htmlFor="to_user_id">Assign to User *</Label>
                  <Select 
                    value={formData.to_user_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, to_user_id: value }))}
                  >
                    <SelectTrigger className={errors.to_user_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select user to acknowledge dispatch" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center space-x-2">
                            <div className="font-medium">{user.first_name} {user.last_name}</div>
                            {requisition && user.id === requisition.requester_id && (
                              <Badge variant="secondary" className="text-xs">Requester</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.to_user_id && (
                    <p className="text-sm text-red-600">{errors.to_user_id}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes about this dispatch..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items from Requisition */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Dispatch Items ({formData.items.length})
              </CardTitle>
              <CardDescription>
                Items from the requisition that will be dispatched
              </CardDescription>
              {requisition && requisition.items.some(item => !item.product_id) && (
                <p className="text-xs text-amber-600 mt-1">
                  {requisition.items.filter(item => !item.product_id).length} custom (non-catalog) item(s) on this
                  requisition aren't in stock and are excluded here - source them manually.
                </p>
              )}
            </CardHeader>
            <CardContent>
              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No items to dispatch</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.items.map((item, index) => {
                    const product = item.product;
                    const variant = item.variant;
                    
                    return (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="font-medium">{product?.name}</h4>
                            {variant && (
                              <p className="text-sm text-gray-600">Variant: {variant.name}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              SKU: {variant?.sku || product?.sku || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">Qty: {item.quantity}</div>
                            <div className="text-sm text-gray-500">
                              {product?.unit_of_measurement}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <Label>Batch (FEFO - earliest expiry first)</Label>
                          <Select
                            value={item.batch_id || ""}
                            onValueChange={(value) => updateItem(index, { batch_id: value })}
                            disabled={!formData.from_store_id || batchesLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={
                                !formData.from_store_id
                                  ? "Select a from-store first"
                                  : batchesLoading
                                    ? "Loading batches..."
                                    : batchErrors[index]
                                      ? "Couldn't load batches"
                                      : (batchesByIndex[index]?.length
                                          ? "Select a batch"
                                          : otherStoreBatches[index]?.length
                                            ? "No batches in this store"
                                            : "No batches - not batch-tracked")
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {(batchesByIndex[index] || []).map((batch) => (
                                <SelectItem key={batch.id} value={batch.id}>
                                  {batch.batch_number} — exp {batch.expiry_date ? format(new Date(batch.expiry_date), "dd MMM yyyy") : "N/A"} — {batch.quantity_available} avail
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(() => {
                            const selected = batchesByIndex[index]?.find((b) => b.id === item.batch_id);
                            if (!selected) return null;
                            return (
                              <p className="text-xs text-gray-600">
                                Batch <span className="font-medium">{selected.batch_number}</span>
                                {" · "}Expiry{" "}
                                <span className="font-medium">
                                  {selected.expiry_date ? format(new Date(selected.expiry_date), "dd MMM yyyy") : "N/A"}
                                </span>
                                {" · "}{selected.quantity_available} available
                              </p>
                            );
                          })()}
                          {!batchesLoading && batchErrors[index] && (
                            <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                              <span>Couldn't load batches: {batchErrors[index]}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                onClick={() => setBatchReloadKey((k) => k + 1)}
                              >
                                Retry
                              </Button>
                            </div>
                          )}
                          {!batchesLoading && !batchErrors[index] && !batchesByIndex[index]?.length && otherStoreBatches[index]?.length > 0 && (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                              <p className="font-medium">Batches for this item are held in another store:</p>
                              {otherStoreBatches[index].map((b) => (
                                <div key={b.id} className="flex items-center justify-between gap-2">
                                  <span>
                                    {b.store?.name ?? "Unknown store"} — {b.batch_number}, exp{" "}
                                    {b.expiry_date ? format(new Date(b.expiry_date), "dd MMM yyyy") : "N/A"}, {b.quantity_available} avail
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => setFormData((prev) => ({ ...prev, from_store_id: b.store_id }))}
                                  >
                                    Use this store
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Quantity - Read-only since it comes from requisition */}
                          <div className="space-y-2">
                            <Label>Requested Quantity</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              readOnly
                              className="bg-gray-50"
                            />
                          </div>

                          {/* Returnable */}
                          <div className="space-y-2">
                            <Label>Return Settings</Label>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={item.is_returnable}
                                onCheckedChange={(checked) => updateItem(index, { is_returnable: !!checked })}
                              />
                              <span className="text-sm">Returnable</span>
                            </div>
                            {item.is_returnable && (
                              <Input
                                type="date"
                                value={item.return_date}
                                onChange={(e) => updateItem(index, { return_date: e.target.value })}
                                className="text-sm"
                              />
                            )}
                          </div>

                          {/* Notes */}
                          <div className="space-y-2">
                            <Label>Item Notes</Label>
                            <Input
                              placeholder="Optional notes for this item..."
                              value={item.notes}
                              onChange={(e) => updateItem(index, { notes: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || formData.items.length === 0}
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            Create Dispatch
          </Button>
        </div>
      </div>
    </>
  );
}