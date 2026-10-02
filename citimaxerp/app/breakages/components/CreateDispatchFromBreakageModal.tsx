"use client";

import { useState, useEffect } from "react";
import { createDispatch } from "@/lib/dispatch";
import { type Breakage, updateBreakageStatus } from "@/lib/breakages";
import { getStores } from "@/lib/stores";
import { fetchUsers, type UserData as UserType } from "@/lib/users";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Package, 
  Building2, 
  Calendar, 
  Plus,
  Minus,
  AlertTriangle,
  Loader2,
  RefreshCw,
  User
} from "lucide-react";
import { format } from "date-fns";
import { cn, toSentenceCase } from "@/lib/utils";

interface CreateDispatchFromBreakageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  breakage: Breakage | null;
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
  quantity: number;
  is_returnable: boolean;
  return_date?: string;
  notes?: string;
  // Additional fields for display
  product?: any;
  variant?: any;
  breakage_item_id?: string;
}

interface FormData {
  from_store_id: string;
  to_entity: string;
  to_user_id: string;
  type: "internal" | "external";
  notes?: string;
  items: DispatchItem[];
}

export function CreateDispatchFromBreakageModal({ 
  open, 
  onOpenChange, 
  onSuccess,
  breakage 
}: CreateDispatchFromBreakageModalProps) {
  const [loading, setLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    from_store_id: "",
    to_entity: "",
    to_user_id: "",
    type: "internal" as "internal" | "external",
    notes: "",
    items: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      loadInitialData();
      if (breakage) {
        // Filter items that have replacement_requested: true
        const replacementItems = breakage.items.filter(item => item.replacement_requested);
        
        if (replacementItems.length === 0) {
          toast({
            title: "No Replacement Items",
            description: "This breakage report has no items that require replacement.",
            variant: "destructive",
          });
          onOpenChange(false);
          return;
        }

        // Pre-populate form with breakage data
        setFormData({
          from_store_id: "",
          to_entity: "warehouse", // Default to warehouse for internal dispatch
          to_user_id: breakage.reported_by, // Set reporter as assigned user
          type: "internal",
          notes: `Replacement dispatch for breakage ${breakage.breakage_number}`,
          items: replacementItems.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id || undefined,
            quantity: item.quantity,
            is_returnable: false, // Replacements typically not returnable
            return_date: undefined,
            notes: `Replacement for broken item: ${item.cause}`,
            product: item.product,
            variant: item.variant,
            breakage_item_id: item.id
          }))
        });
      }
    } else {
      resetForm();
    }
  }, [open, breakage]);

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
  };

  const loadInitialData = async () => {
    await Promise.all([
      loadStores(),
      loadUsers()
    ]);
  };

  const loadStores = async () => {
    try {
      setStoresLoading(true);
      const response = await getStores();
      setStores(response || []);
    } catch (error) {
      console.error("Error loading stores:", error);
      toast({
        title: "Error",
        description: "Failed to load stores. Please try again.",
        variant: "destructive",
      });
    } finally {
      setStoresLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await fetchUsers();
      setUsers(response || []);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Error",
        description: "Failed to load users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.from_store_id) {
      newErrors.from_store_id = "From store is required";
    }

    if (!formData.to_entity) {
      newErrors.to_entity = "To entity is required";
    }

    if (!formData.to_user_id) {
      newErrors.to_user_id = "Assigned user is required";
    }

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
    if (!validateForm() || !breakage) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        items: formData.items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          quantity: item.quantity,
          is_returnable: item.is_returnable,
          return_date: item.return_date || undefined,
          notes: item.notes || undefined
        }))
      };

      // Create the dispatch
      const dispatchResponse = await createDispatch(payload);
      
      if (dispatchResponse.status === 'success') {
        // Update breakage status to 'dispatch_initiated'
        await updateBreakageStatus(breakage.id, 'dispatch_initiated');
        
        toast({
          title: "Success",
          description: `Replacement dispatch created successfully for breakage ${breakage.breakage_number}`,
        });
        
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error creating dispatch:", error);
      toast({
        title: "Error",
        description: "Failed to create dispatch. Please try again.",
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-4xl flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Create Replacement Dispatch</SheetTitle>
          <SheetDescription>
            {breakage ? `Create dispatch for breakage ${breakage.breakage_number}` : "Create replacement dispatch"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Breakage Information */}
          {breakage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Breakage Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Breakage Number</Label>
                    <p className="text-sm text-gray-700">{breakage.breakage_number}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Reported By</Label>
                    <p className="text-sm text-gray-700">
                      {breakage.reporter?.first_name} {breakage.reporter?.last_name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Date Reported</Label>
                    <p className="text-sm text-gray-700">
                      {format(new Date(breakage.created_at), "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
                
                {/* Items Summary */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Items Requiring Replacement ({formData.items.length})
                  </h4>
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.product?.name}</p>
                            {item.variant && (
                              <p className="text-sm text-gray-600">Variant: {item.variant.name}</p>
                            )}
                            <p className="text-xs text-gray-500">SKU: {item.product?.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">Qty: {item.quantity}</p>
                            <p className="text-xs text-gray-500">{item.product?.unit_of_measurement}</p>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Notes: </span>
                          {item.notes}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dispatch Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Dispatch Information</span>
              </CardTitle>
              <CardDescription>
                Set up the replacement dispatch details
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
                    disabled={storesLoading}
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
                              <div className="text-xs text-gray-500">{store.description}</div>
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

                {/* To Entity */}
                <div className="space-y-2">
                  <Label htmlFor="to_entity">To Entity *</Label>
                  <Select 
                    value={formData.to_entity} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, to_entity: value }))}
                  >
                    <SelectTrigger className={errors.to_entity ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="store">Store</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.to_entity && (
                    <p className="text-sm text-red-600">{errors.to_entity}</p>
                  )}
                </div>
              </div>

              {/* Assigned User */}
              <div className="space-y-2">
                <Label htmlFor="to_user_id">Assigned User *</Label>
                <Select 
                  value={formData.to_user_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, to_user_id: value }))}
                  disabled={usersLoading}
                >
                  <SelectTrigger className={errors.to_user_id ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select user to assign dispatch to" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center space-x-2">
                          <div className="font-medium">{user.first_name} {user.last_name}</div>
                          {breakage && user.id === breakage.reported_by && (
                            <Badge variant="secondary" className="text-xs">Reporter</Badge>
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

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes about this replacement dispatch..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dispatch Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Replacement Items ({formData.items.length})
              </CardTitle>
              <CardDescription>
                Items to be dispatched as replacements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errors.items && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.items}</p>
                </div>
              )}
              
              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="space-y-4">
                      {/* Item Information */}
                      <div className="space-y-2">
                        <Label>Product</Label>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="font-medium">
                            {item.product?.name}
                            {item.variant && ` - ${item.variant.name}`}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            SKU: {item.product?.sku} • Unit: {item.product?.unit_of_measurement}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Quantity */}
                        <div className="space-y-2">
                          <Label>Quantity *</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                            className={errors[`item_${index}_quantity`] ? "border-red-500" : ""}
                          />
                          {errors[`item_${index}_quantity`] && (
                            <p className="text-sm text-red-600">{errors[`item_${index}_quantity`]}</p>
                          )}
                        </div>

                        {/* Returnable */}
                        <div className="space-y-2">
                          <Label>Returnable</Label>
                          <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                              checked={item.is_returnable}
                              onCheckedChange={(checked) => updateItem(index, { is_returnable: !!checked })}
                            />
                            <span className="text-sm">Item is returnable</span>
                          </div>
                        </div>
                      </div>

                      {/* Return Date (if returnable) */}
                      {item.is_returnable && (
                        <div className="space-y-2">
                          <Label>Return Date</Label>
                          <Input
                            type="date"
                            value={item.return_date || ""}
                            onChange={(e) => updateItem(index, { return_date: e.target.value })}
                            min={format(new Date(), "yyyy-MM-dd")}
                          />
                        </div>
                      )}

                      {/* Item Notes */}
                      <div className="space-y-2">
                        <Label>Item Notes</Label>
                        <Textarea
                          placeholder="Additional notes for this replacement item..."
                          value={item.notes}
                          onChange={(e) => updateItem(index, { notes: e.target.value })}
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <SheetFooter className="flex-shrink-0 border-t pt-4 mt-auto">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || formData.items.length === 0}
              className="bg-[#1E2764] hover:bg-[#1E2764]/90"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Create Replacement Dispatch
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}