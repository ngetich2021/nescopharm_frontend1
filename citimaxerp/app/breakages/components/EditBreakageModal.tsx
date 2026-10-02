"use client";

import { useState, useEffect, useMemo } from "react";
import { updateBreakage, type Breakage } from "@/lib/breakages";
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
  AlertTriangle, 
  Plus,
  Loader2,
  Package,
  Trash2,
  Edit,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditBreakageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  breakage: Breakage | null;
}

interface AssignableItem {
  id: string;
  dispatch_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  received_quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_returnable: boolean;
  is_returned: boolean;
  return_date: string | null;
  returned_quantity: number | null;
  return_notes: string | null;
  reminder_status: string | null;
  dispatch_number: string;
  type: string;
  from_store_id: string;
  to_entity: string;
  product_name: string;
  variant_name: string | null;
  product?: {
    name: string;
    sku?: string;
    unit_of_measurement?: string;
  };
  variant?: {
    name: string;
    sku?: string;
    price?: number;
  };
  product_variant?: string;
}

interface BreakageItem {
  id?: string;
  assignable_item_id: string;
  quantity: number;
  cause: string;
  replacement_requested: boolean;
  notes?: string;
  assignableItem?: AssignableItem;
}

interface FormData {
  notes?: string;
  items: BreakageItem[];
}

const BREAKAGE_CAUSES = [
  "handling_error",
  "equipment_malfunction", 
  "transport_damage",
  "storage_issue",
  "manufacturing_defect",
  "normal_wear",
  "accident",
  "other"
];

const CAUSE_LABELS: Record<string, string> = {
  handling_error: "Handling Error",
  equipment_malfunction: "Equipment Malfunction",
  transport_damage: "Transport Damage", 
  storage_issue: "Storage Issue",
  manufacturing_defect: "Manufacturing Defect",
  normal_wear: "Normal Wear",
  accident: "Accident",
  other: "Other"
};

export function EditBreakageModal({ 
  open, 
  onOpenChange, 
  onSuccess,
  breakage 
}: EditBreakageModalProps) {
  const [loading, setLoading] = useState(false);
  const [assignableItemsLoading, setAssignableItemsLoading] = useState(false);
  const [assignableItems, setAssignableItems] = useState<AssignableItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<AssignableItem | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    notes: "",
    items: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      loadAssignableItems();
      if (breakage) {
        // Pre-populate form with breakage data
        setFormData({
          notes: breakage.notes || "",
          items: breakage.items.map(item => ({
            id: item.id,
            assignable_item_id: item.assignable_item_id,
            quantity: item.quantity,
            cause: item.cause,
            replacement_requested: item.replacement_requested,
            notes: item.notes || "",
            assignableItem: item.assignableItem
          }))
        });
      }
    } else {
      resetForm();
    }
  }, [open, breakage]);

  const resetForm = () => {
    setFormData({
      notes: "",
      items: []
    });
    setErrors({});
    setItemSearch("");
    setSelectedProduct(null);
  };

  const loadAssignableItems = async () => {
    try {
      setAssignableItemsLoading(true);
      // Import the function dynamically to avoid circular dependencies
      const { getAssignableItems } = await import("@/lib/breakages");
      const response = await getAssignableItems();
      // Filter out returned items
      const availableItems = response.items.filter(item => !item.is_returned);
      setAssignableItems(availableItems);
    } catch (error) {
      console.error("Error loading assignable items:", error);
      toast({
        title: "Error",
        description: "Failed to load assignable items. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAssignableItemsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Items validation
    if (formData.items.length === 0) {
      newErrors.items = "At least one item is required";
    } else {
      formData.items.forEach((item, index) => {
        if (!item.assignable_item_id) {
          newErrors[`item_${index}_item`] = "Item is required";
        }
        if (item.quantity <= 0) {
          newErrors[`item_${index}_quantity`] = "Quantity must be greater than 0";
        }
        if (!item.cause) {
          newErrors[`item_${index}_cause`] = "Cause is required";
        }
        
        // Check if quantity exceeds available quantity
        const selectedItem = assignableItems.find(i => i.id === item.assignable_item_id);
        if (selectedItem) {
          const availableQuantity = selectedItem.received_quantity - (selectedItem.returned_quantity || 0);
          if (item.quantity > availableQuantity) {
            newErrors[`item_${index}_quantity`] = `Quantity cannot exceed available quantity (${availableQuantity})`;
          }
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
      // Map form data to API payload
      const payload = {
        ...formData,
        items: formData.items.map(item => {
          const selectedItem = assignableItems.find(i => i.id === item.assignable_item_id) || item.assignableItem;
          return {
            id: item.id,
            assignable_item_id: item.assignable_item_id,
            product_id: selectedItem?.product_id,
            quantity: item.quantity,
            cause: item.cause,
            replacement_requested: item.replacement_requested,
            notes: item.notes || undefined
          };
        })
      };

      await updateBreakage(breakage.id, payload);
      
      toast({
        title: "Success",
        description: "Breakage report updated successfully.",
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating breakage:", error);
      toast({
        title: "Error",
        description: "Failed to update breakage report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addSelectedProduct = () => {
    if (!selectedProduct || !canEdit) return;
    
    // Check if product is already added
    const existingItem = formData.items.find(item => item.assignable_item_id === selectedProduct.id);
    if (existingItem) {
      toast({
        title: "Item already added",
        description: "This product is already in the breakage list.",
        variant: "destructive",
      });
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          assignable_item_id: selectedProduct.id,
          quantity: 1,
          cause: "",
          replacement_requested: false,
          notes: "",
          assignableItem: selectedProduct
        }
      ]
    }));
    
    // Clear selection
    setSelectedProduct(null);
    setItemSearch("");
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const updateItem = (index: number, updates: Partial<BreakageItem>) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, ...updates };
          
          // If item changed, reset quantity to 1
          if (updates.assignable_item_id && updates.assignable_item_id !== item.assignable_item_id) {
            updatedItem.quantity = 1;
            const selectedItem = assignableItems.find(i => i.id === updates.assignable_item_id);
            updatedItem.assignableItem = selectedItem;
          }
          
          return updatedItem;
        }
        return item;
      })
    }));
  };

  // Get available quantity for a specific item
  const getAvailableQuantity = (itemId: string) => {
    const item = assignableItems.find(i => i.id === itemId);
    if (!item) return 0;
    return item.received_quantity - (item.returned_quantity || 0);
  };

  // Check if editing is allowed (only pending approval can be edited)
  const canEdit = breakage?.approval_status === "pending";

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!itemSearch) return assignableItems;
    return assignableItems.filter(item => 
      item.product_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (item.variant_name && item.variant_name.toLowerCase().includes(itemSearch.toLowerCase()))
    );
  }, [assignableItems, itemSearch]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-4xl flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Edit Breakage Report</SheetTitle>
          <SheetDescription>
            {breakage ? `Editing breakage ${breakage.breakage_number}` : "Edit breakage report"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Warning if cannot edit */}
          {!canEdit && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">Editing Restricted</p>
                    <p className="text-sm text-yellow-700">
                      This breakage report cannot be edited because it has been {breakage?.approval_status}. 
                      Only pending reports can be modified.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Breakage Info */}
          {breakage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Package className="h-5 w-5" />
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
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant={breakage.status === "pending" ? "secondary" : "default"}>
                      {breakage.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Approval Status</Label>
                    <Badge 
                      variant={
                        breakage.approval_status === "approved" ? "default" : 
                        breakage.approval_status === "rejected" ? "destructive" : 
                        "secondary"
                      }
                    >
                      {breakage.approval_status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* General Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">General Information</CardTitle>
              <CardDescription>
                Add any general notes about this breakage incident
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">General Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Describe the incident, circumstances, or any additional context..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>

          {/* Product Search and Selection - Only show when editing is allowed and not in initial data load */}
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Products to Breakage Report</CardTitle>
                <CardDescription>
                  Search and select additional products to add to this breakage report
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Product Search */}
                  <div className="space-y-2">
                    <Label>Search Products</Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <Input
                        type="text"
                        placeholder="Search for products to add..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  {/* Product Selection */}
                  {itemSearch && (
                    <div className="space-y-2">
                      <Label>Available Products</Label>
                      <div className="max-h-48 overflow-y-auto border rounded-md">
                        {filteredItems.length > 0 ? (
                          <div className="space-y-1 p-2">
                            {filteredItems.map((item) => {
                              const availableQty = item.received_quantity - (item.returned_quantity || 0);
                              const isAlreadyAdded = formData.items.some(breakageItem => breakageItem.assignable_item_id === item.id);
                              
                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "p-3 rounded-lg border cursor-pointer transition-colors",
                                    selectedProduct?.id === item.id
                                      ? "bg-blue-50 border-blue-200"
                                      : "hover:bg-gray-50 border-gray-200",
                                    isAlreadyAdded && "opacity-50 cursor-not-allowed"
                                  )}
                                  onClick={() => !isAlreadyAdded && setSelectedProduct(item)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium">
                                        {item.product?.name || item.product_name || item.product_id}
                                        {(item.variant?.name || item.variant_name || item.product_variant) && ` - ${item.variant?.name || item.variant_name || item.product_variant}`}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Dispatch: {item.dispatch_number}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Badge variant="secondary">
                                        Available: {availableQty}
                                      </Badge>
                                      {isAlreadyAdded && (
                                        <Badge variant="destructive">Added</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            No products found matching your search
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Add Selected Product Button */}
                  {selectedProduct && (
                    <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div>
                        <div className="font-medium">
                          {selectedProduct.product?.name || selectedProduct.product_name || selectedProduct.product_id}
                          {(selectedProduct.variant?.name || selectedProduct.variant_name || selectedProduct.product_variant) && ` - ${selectedProduct.variant?.name || selectedProduct.variant_name || selectedProduct.product_variant}`}
                        </div>
                        <div className="text-sm text-gray-600">
                          Dispatch: {selectedProduct.dispatch_number} • Available: {selectedProduct.received_quantity - (selectedProduct.returned_quantity || 0)}
                        </div>
                      </div>
                      <Button
                        onClick={addSelectedProduct}
                        className="bg-[#1E2764] hover:bg-[#1E2764]/90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Breakage
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Broken Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Broken Items ({formData.items.length})
                  </CardTitle>
                  <CardDescription>
                    Items in this breakage report
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {errors.items && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.items}</p>
                </div>
              )}
              
              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No products in this breakage report</p>
                  {canEdit && (
                    <p className="text-sm">Use the search above to add products to this breakage report</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {formData.items.map((item, index) => {
                    const selectedItem = assignableItems.find(i => i.id === item.assignable_item_id) || item.assignableItem;
                    const availableQuantity = selectedItem ? getAvailableQuantity(item.assignable_item_id) : 0;
                    
                    return (
                      <div key={index} className="border rounded-lg p-4 relative">
                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-primary"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}

                        <div className="space-y-4">
                          {/* Item Information */}
                          <div className="space-y-2">
                            <Label>Product</Label>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="font-medium">
                                {selectedItem?.product?.name || selectedItem?.product_name || selectedItem?.product_id}
                                {(selectedItem?.variant?.name || selectedItem?.variant_name || selectedItem?.product_variant) && ` - ${selectedItem?.variant?.name || selectedItem?.variant_name || selectedItem?.product_variant}`}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                Dispatch: {selectedItem?.dispatch_number} • Available: {availableQuantity}
                              </div>
                            </div>
                          </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Quantity */}
                          <div className="space-y-2">
                            <Label>Quantity *</Label>
                            <div className="flex space-x-2">
                              <Input
                                type="number"
                                min="1"
                                max={availableQuantity}
                                value={item.quantity}
                                onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                                className={errors[`item_${index}_quantity`] ? "border-red-500" : ""}
                                disabled={!canEdit}
                              />
                              {availableQuantity > 0 && (
                                <div className="flex items-center px-3 bg-gray-100 rounded-md text-sm">
                                  <span className="text-gray-500">Available: {availableQuantity}</span>
                                </div>
                              )}
                            </div>
                            {errors[`item_${index}_quantity`] && (
                              <p className="text-sm text-red-600">{errors[`item_${index}_quantity`]}</p>
                            )}
                          </div>

                          {/* Cause */}
                          <div className="space-y-2">
                            <Label>Cause *</Label>
                            <Select 
                              value={item.cause} 
                              onValueChange={(value) => updateItem(index, { cause: value })}
                              disabled={!canEdit}
                            >
                              <SelectTrigger className={errors[`item_${index}_cause`] ? "border-red-500" : ""}>
                                <SelectValue placeholder="Select cause of breakage" />
                              </SelectTrigger>
                              <SelectContent>
                                {BREAKAGE_CAUSES.map((cause) => (
                                  <SelectItem key={cause} value={cause}>
                                    {CAUSE_LABELS[cause]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors[`item_${index}_cause`] && (
                              <p className="text-sm text-red-600">{errors[`item_${index}_cause`]}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          {/* Replacement Request */}
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={item.replacement_requested}
                              onCheckedChange={(checked) => updateItem(index, { replacement_requested: !!checked })}
                              disabled={!canEdit}
                            />
                            <Label className="text-sm">Request replacement for this item</Label>
                          </div>

                          {/* Item Notes */}
                          <div className="space-y-2">
                            <Label>Item Notes</Label>
                            <Textarea
                              placeholder="Additional details about this broken item..."
                              value={item.notes}
                              onChange={(e) => updateItem(index, { notes: e.target.value })}
                              rows={2}
                              disabled={!canEdit}
                            />
                          </div>
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
        <SheetFooter className="flex-shrink-0 border-t pt-4 mt-auto">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit && (
              <Button 
                onClick={handleSubmit} 
                disabled={loading || formData.items.length === 0}
                className="bg-[#1E2764] hover:bg-[#1E2764]/90"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Edit className="h-4 w-4 mr-2" />
                )}
                Update Breakage
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}