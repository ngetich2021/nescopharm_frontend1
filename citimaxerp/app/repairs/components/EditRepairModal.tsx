"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Wrench,
  Plus,
  Loader2,
  Search,
  Trash2,
  Save,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { 
  updateRepairWithItems,
  getAssignableItemsForRepair, 
  type AssignableItem,
  type Repair 
} from "@/lib/repairs";
import { fetchUsers, type UserData as UserType } from "@/lib/users";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RepairItemForm {
  id?: string; // For existing items
  assignable_item_id: string;
  product_id: string;
  product_variant?: string;
  quantity: number;
  notes?: string;
  is_repairable: boolean;
  assignableItem?: AssignableItem;
  // For existing items from repair
  product_name?: string;
  variant_name?: string;
  unique_identifier?: string;
  isExisting?: boolean;
}

interface FormData {
  approver_id: string;
  description: string;
  notes?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  estimated_completion_date?: string;
  items: RepairItemForm[];
}

interface EditRepairModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: Repair;
  onSuccess: () => void;
}

export function EditRepairModal({
  open,
  onOpenChange,
  repair,
  onSuccess,
}: EditRepairModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignableItems, setAssignableItems] = useState<AssignableItem[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<AssignableItem | null>(null);
  const [approverSearchOpen, setApproverSearchOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    approver_id: "",
    description: "",
    notes: "",
    priority: undefined,
    estimated_completion_date: "",
    items: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Early return if repair is not available
  if (!repair) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading repair details...</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  useEffect(() => {
    if (open && repair) {
      initializeForm();
      fetchAssignableItems();
      fetchUsers();
    } else {
      resetForm();
    }
  }, [open, repair]);

  const initializeForm = () => {
    // Convert existing repair items to form format
    const existingItems: RepairItemForm[] = repair?.items?.map(item => ({
      id: item.id,
      assignable_item_id: item.id, // Use item ID as placeholder
      product_id: item.product_id,
      product_variant: item.product_variant || undefined,
      quantity: item.quantity,
      notes: item.notes || "",
      is_repairable: item.is_repairable,
      product_name: item.product?.name || item.product_name,
      variant_name: item.variant?.name || item.variant_name || undefined,
      unique_identifier: item.unique_identifier,
      isExisting: true
    })) || [];

    setFormData({
      approver_id: repair?.approved_by || "",
      description: repair?.description || "",
      notes: repair?.notes || "",
      priority: repair?.priority,
      estimated_completion_date: repair?.estimated_completion_date || "",
      items: existingItems
    });
  };

  const resetForm = () => {
    setFormData({
      approver_id: "",
      description: "",
      notes: "",
      priority: undefined,
      estimated_completion_date: "",
      items: []
    });
    setErrors({});
    setItemSearch("");
    setSelectedProduct(null);
  };

  const fetchAssignableItems = async () => {
    setLoadingItems(true);
    try {
      const response = await getAssignableItemsForRepair();
      // Filter out returned items
      const availableItems = response.items.filter(item => !item.is_returned);
      setAssignableItems(availableItems);
    } catch (error) {
      console.error('Error fetching assignable items:', error);
      toast({
        title: "Error",
        description: "Failed to load assignable items.",
        variant: "destructive",
      });
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchUsers = async () => {
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

    // Approver validation
    if (!formData.approver_id) {
      newErrors.approver_id = "Approver is required";
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    // Items validation
    if (formData.items.length === 0) {
      newErrors.items = "At least one item is required";
    } else {
      formData.items.forEach((item, index) => {
        if (!item.isExisting && !item.assignable_item_id) {
          newErrors[`item_${index}_item`] = "Item is required";
        }
        if (item.quantity <= 0) {
          newErrors[`item_${index}_quantity`] = "Quantity must be greater than 0";
        }
        
        // Check if quantity exceeds available quantity for new items
        if (!item.isExisting) {
          const selectedItem = assignableItems.find(i => i.id === item.assignable_item_id);
          if (selectedItem) {
            const availableQuantity = selectedItem.received_quantity - (selectedItem.returned_quantity || 0);
            if (item.quantity > availableQuantity) {
              newErrors[`item_${index}_quantity`] = `Quantity cannot exceed available quantity (${availableQuantity})`;
            }
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Prepare payload for comprehensive API update
      const payload = {
        approver_id: formData.approver_id !== repair.approved_by ? formData.approver_id : undefined,
        description: formData.description,
        notes: formData.notes || undefined,
        priority: formData.priority,
        estimated_completion_date: formData.estimated_completion_date || undefined,
        // Include all items (both existing and new) in the update
        items: formData.items.map(item => ({
          id: item.isExisting ? item.id : undefined, // Include ID for existing items
          product_id: item.product_id,
          product_variant: item.product_variant,
          quantity: item.quantity,
          notes: item.notes || undefined,
          is_repairable: item.is_repairable
        }))
      };

      await updateRepairWithItems(repair.id, payload);
      onSuccess();
      
      const hasChanges = formData.items.length !== repair.items?.length || 
                        formData.items.some(item => !item.isExisting) ||
                        formData.approver_id !== repair.approved_by;
      
      toast({
        title: "Success",
        description: hasChanges ? 
          "Repair updated successfully with all changes including items and approver." :
          "Repair details updated successfully.",
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating repair:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update repair. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSelectedProduct = () => {
    if (!selectedProduct) return;
    
    // Check if product is already added
    const existingItem = formData.items.find(item => 
      !item.isExisting && item.assignable_item_id === selectedProduct.id
    );
    if (existingItem) {
      toast({
        title: "Item already added",
        description: "This product is already in the repair list.",
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
          product_id: selectedProduct.product_id,
          product_variant: selectedProduct.variant_id || undefined,
          quantity: 1,
          notes: "",
          is_repairable: true,
          assignableItem: selectedProduct,
          isExisting: false
        }
      ]
    }));
    
    // Clear selection
    setSelectedProduct(null);
    setItemSearch("");
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, updates: Partial<RepairItemForm>) => {
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
            updatedItem.product_id = selectedItem?.product_id || "";
            updatedItem.product_variant = selectedItem?.variant_id || undefined;
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

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!itemSearch) return assignableItems;
    return assignableItems.filter(item => 
      item.product_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (item.variant_name && item.variant_name.toLowerCase().includes(itemSearch.toLowerCase()))
    );
  }, [assignableItems, itemSearch]);

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center space-x-2">
            <Wrench className="h-5 w-5" />
            <span>Edit Repair - {repair?.repair_number}</span>
          </SheetTitle>
          <SheetDescription>
            Update repair details, modify items, add new items, and change approver
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Approver Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Approver</CardTitle>
              <CardDescription>
                Select the user who will approve this repair report
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="approver_id">Approver *</Label>
                <Popover open={approverSearchOpen} onOpenChange={setApproverSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={approverSearchOpen}
                      className={cn("w-full justify-between font-normal", errors.approver_id ? "border-red-500" : "")}
                      disabled={usersLoading}
                    >
                      {formData.approver_id
                        ? (() => {
                            const user = users.find((u) => u.id === formData.approver_id);
                            return user ? `${user.first_name} ${user.last_name}` : "Select approver";
                          })()
                        : "Select approver"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search users..." />
                      <CommandList>
                        <CommandEmpty>No user found.</CommandEmpty>
                        <CommandGroup>
                          {users.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.first_name} ${user.last_name} ${user.email}`}
                              onSelect={() => {
                                setFormData(prev => ({ ...prev, approver_id: user.id }));
                                setApproverSearchOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", formData.approver_id === user.id ? "opacity-100" : "opacity-0")} />
                              <div>
                                <div className="font-medium">{user.first_name} {user.last_name}</div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.approver_id && (
                  <p className="text-sm text-red-600">{errors.approver_id}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Product Search and Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Products to Repair Report</CardTitle>
              <CardDescription>
                Search and add additional products, or modify existing items in this repair report
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
                            const isAlreadyAdded = formData.items.some(repairItem => 
                              !repairItem.isExisting && repairItem.assignable_item_id === item.id
                            );
                            
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
                        {selectedProduct.product_name}
                        {selectedProduct.variant_name && ` - ${selectedProduct.variant_name}`}
                      </div>
                      <div className="text-sm text-gray-600">
                        Dispatch: {selectedProduct.dispatch_number} • Available: {selectedProduct.received_quantity - (selectedProduct.returned_quantity || 0)}
                      </div>
                    </div>
                    <Button
                      onClick={addSelectedProduct}
                      className="bg-[#E30040] hover:bg-[#E30040]/90"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Repair
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Items for Repair ({formData.items.length})
                  </CardTitle>
                  <CardDescription>
                    Manage all items in this repair report - add new items, modify existing ones, or remove items as needed
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
                  <p>No items in this repair</p>
                  <p className="text-sm">Use the search above to add items to this repair report</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {formData.items.map((item, index) => {
                    const selectedItem = item.isExisting ? null : (assignableItems.find(i => i.id === item.assignable_item_id) || item.assignableItem);
                    const availableQuantity = item.isExisting ? item.quantity : (selectedItem ? getAvailableQuantity(item.assignable_item_id) : 0);
                    
                    return (
                      <div key={item.id || index} className="border rounded-lg p-4 relative">
                        {/* Allow removal of existing items now that API supports it */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-600"
                          title={item.isExisting ? "Remove existing item" : "Remove new item"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        <div className="space-y-4">
                          {/* Item Information */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Product</Label>
                              {item.isExisting && (
                                <Badge variant="outline" className="text-xs">
                                  Current Item
                                </Badge>
                              )}
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="font-medium">
                                {item.isExisting ? 
                                  `${item.product?.name || item.product_name || item.product_id}${(item.variant?.name || item.variant_name || item.product_variant) ? ` - ${item.variant?.name || item.variant_name || item.product_variant}` : ''}` :
                                  `${selectedItem?.product?.name || selectedItem?.product_name || selectedItem?.product_id}${(selectedItem?.variant?.name || selectedItem?.variant_name || selectedItem?.product_variant) ? ` - ${selectedItem?.variant?.name || selectedItem?.variant_name || selectedItem?.product_variant}` : ''}`
                                }
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {item.isExisting ? 
                                  `ID: ${item.unique_identifier}` :
                                  `Dispatch: ${selectedItem?.dispatch_number} • Available: ${availableQuantity}`
                                }
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
                                  max={item.isExisting ? undefined : availableQuantity}
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                                  className={errors[`item_${index}_quantity`] ? "border-red-500" : ""}
                                  // Allow editing quantity of existing items now that API supports it
                                />
                                {!item.isExisting && availableQuantity > 0 && (
                                  <div className="flex items-center px-3 bg-gray-100 rounded-md text-sm">
                                    <span className="text-gray-500">Available: {availableQuantity}</span>
                                  </div>
                                )}
                              </div>
                              {errors[`item_${index}_quantity`] && (
                                <p className="text-sm text-red-600">{errors[`item_${index}_quantity`]}</p>
                              )}
                            </div>

                            {/* Is Repairable */}
                            <div className="space-y-2">
                              <Label>Repairability Status</Label>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={item.is_repairable}
                                  onCheckedChange={(checked) => updateItem(index, { is_repairable: !!checked })}
                                />
                                <Label className="text-sm">Item is repairable</Label>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {/* Item Notes */}
                            <div className="space-y-2">
                              <Label>Item Notes</Label>
                              <Textarea
                                placeholder="Additional details about this item's issue..."
                                value={item.notes}
                                onChange={(e) => updateItem(index, { notes: e.target.value })}
                                rows={2}
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

          {/* General Information - Following layout preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">General Information</CardTitle>
              <CardDescription>
                Update the repair description and additional information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Repair Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the issue, symptoms, circumstances, or any additional context..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className={errors.description ? "border-red-500" : ""}
                />
                {errors.description && (
                  <p className="text-sm text-red-600">{errors.description}</p>
                )}
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
              disabled={isSubmitting || formData.items.length === 0}
              className="bg-[#E30040] hover:bg-[#E30040]/90"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSubmitting ? "Updating..." : "Update Repair"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}