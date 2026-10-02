"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Trash2, 
  Search, 
  Package, 
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createRequisition } from "@/lib/requisitions";
import { getProducts, type Product as LibProduct } from "@/lib/products";
import { fetchUsers as fetchUsersFromApi, type UserData as User } from "@/lib/users";

interface Product {
  id: string;
  name: string;
  sku?: string | null;
  price: string | number;
  stock_quantity: number;
  has_variations?: boolean;
  variants?: any[] | null;
  image_url?: string | null;
  unit_of_measurement?: string | null;
}

interface RequisitionItem {
  product_id?: string;
  custom_item_name?: string;
  variant_id?: string;
  quantity: number;
  notes?: string;
  product?: Product;
  variant?: any;
}

interface FormData {
  approver_id: string;
  notes: string;
  items: RequisitionItem[];
}

interface CreateRequisitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateRequisitionModal({ open, onOpenChange, onSuccess }: CreateRequisitionModalProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<LibProduct[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customItemInput, setCustomItemInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    approver_id: "",
    notes: "",
    items: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiResponse, setApiResponse] = useState<any>(null);

  // Fetch users and initial data when sheet opens
  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData({
        approver_id: "",
        notes: "",
        items: []
      });
      setErrors({});
      setApiResponse(null);
      setSearchQuery("");
      setCustomItemInput("");
      setProducts([]);
    }
  }, [open]);

  // Search products as user types (server-side search)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setProducts([]);
      return;
    }

    const searchProducts = async () => {
      setSearchLoading(true);
      try {
        const response = await getProducts(1, 50, { search: searchQuery });
        setProducts(response.data || []);
      } catch (error) {
        console.error('Error searching products:', error);
        setProducts([]);
      } finally {
        setSearchLoading(false);
      }
    };

    // Debounce search to avoid too many requests
    const timer = setTimeout(searchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUsers = async () => {
    try {
      const usersData = await fetchUsersFromApi({ role_scope: "can_approve_requisitions" });
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch approvers. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Products are already filtered by server-side search, no client-side filtering needed
  const filteredProducts = products;

  // Mirrors the dispatch check: stock already reserved by open dispatches (on_hand) isn't available.
  const availableOf = (product: any, variant?: any): number => {
    if (variant) {
      return Math.max(0, Number(variant.stock_quantity ?? 0) - Number(variant.on_hand ?? 0));
    }
    if (product?.has_variations && product.variants?.length) {
      return product.variants.reduce((sum: number, v: any) => sum + availableOf(product, v), 0);
    }
    return Math.max(0, Number(product?.stock_quantity ?? 0) - Number(product?.on_hand ?? 0));
  };

  const addProduct = (product: LibProduct, variant?: any) => {
    const existingItemIndex = formData.items.findIndex(
      item => item.product_id === product.id && item.variant_id === variant?.id
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...formData.items];
      updatedItems[existingItemIndex].quantity += 1;
      setFormData({ ...formData, items: updatedItems });
    } else {
      const newItem: RequisitionItem = {
        product_id: product.id,
        variant_id: variant?.id,
        quantity: 1,
        notes: "",
        product,
        variant
      };
      setFormData({ ...formData, items: [...formData.items, newItem] });
    }
    setSearchQuery("");
  };

  const addCustomItem = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const newItem: RequisitionItem = {
      custom_item_name: trimmed,
      quantity: 1,
      notes: "",
    };
    setFormData({ ...formData, items: [...formData.items, newItem] });
    setSearchQuery("");
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const updatedItems = [...formData.items];
    updatedItems[index].quantity = Math.max(0, quantity);
    setFormData({ ...formData, items: updatedItems });
  };

  const updateItemNotes = (index: number, notes: string) => {
    const updatedItems = [...formData.items];
    updatedItems[index].notes = notes;
    setFormData({ ...formData, items: updatedItems });
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.approver_id) {
      newErrors.approver_id = "Approver is required";
    }

    if (formData.items.length === 0) {
      newErrors.items = "At least one item is required";
    }

    formData.items.forEach((item, index) => {
      if (item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = "Quantity must be greater than 0";
      } else if (item.product) {
        const available = availableOf(item.product, item.variant);
        if (available <= 0) {
          newErrors[`item_${index}_quantity`] = "Out of stock - remove this item";
        } else if (item.quantity > available) {
          newErrors[`item_${index}_quantity`] = `Only ${available} available`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      const payload = {
        approver_id: formData.approver_id,
        notes: formData.notes || undefined,
        items: formData.items.map(item => ({
          product_id: item.product_id || undefined,
          custom_item_name: item.custom_item_name || undefined,
          variant_id: item.variant_id || undefined,
          quantity: item.quantity,
          notes: item.notes || undefined,
        })),
      };

      console.log('Creating requisition with payload:', payload);
      const response = await createRequisition(payload);
      
      console.log('Create requisition response:', response);
      setApiResponse(response);
      
      if (response.status === 'success') {
        toast({
          title: "Success",
          description: response.message || "Requisition created successfully.",
        });
        onSuccess();
      }
    } catch (error) {
      console.error('Create requisition failed:', error);
      setApiResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create requisition",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>Create New Requisition</SheetTitle>
          <SheetDescription>Add products to create a new requisition request.</SheetDescription>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-6">
            {/* Approver Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Approver</CardTitle>
                <CardDescription>
                  Select the user who will approve this requisition
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="approver_id">Approver *</Label>
                  <Select 
                    value={formData.approver_id} 
                    onValueChange={(value) => setFormData({ ...formData, approver_id: value })}
                  >
                    <SelectTrigger className={errors.approver_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select approver" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div>
                            <div className="font-medium">{user.first_name} {user.last_name}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.approver_id && (
                    <p className="text-sm text-red-600">{errors.approver_id}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Add Products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Products</CardTitle>
                <CardDescription>
                  Search and select products to include in this requisition
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search products by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Not in the catalog? Add it as a plain named item - it's never saved as a Product */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Not in the list? Type an item name, e.g. Laptop"
                    value={customItemInput}
                    onChange={(e) => setCustomItemInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomItem(customItemInput);
                        setCustomItemInput("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!customItemInput.trim()}
                    onClick={() => {
                      addCustomItem(customItemInput);
                      setCustomItemInput("");
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>

                {/* Product Search Results */}
                {searchQuery && (
                  <div className="max-h-60 overflow-y-auto border rounded-md">
                    {searchLoading ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                        Searching products...
                      </div>
                    ) : filteredProducts.length > 0 ? (
                      <div className="divide-y">
                        {filteredProducts.slice(0, 10).map((product) => {
                          const hasVariants = !!(product.has_variations && product.variants?.length);
                          const available = availableOf(product);
                          const outOfStock = available <= 0;
                          return (
                          <div key={product.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{product.name}</h4>
                                <div className="flex items-center space-x-4 mt-1">
                                  {product.sku && <p className="text-xs text-gray-500">SKU: {product.sku}</p>}
                                  <p className="text-xs text-gray-500">
                                    {hasVariants ? "Available (all variants)" : "Available"}: {available} {product.unit_of_measurement}
                                  </p>
                                  {outOfStock ? (
                                    <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                                      Out of Stock
                                    </Badge>
                                  ) : available <= 10 && (
                                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                                      Low Stock
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {hasVariants ? (
                                  <Select
                                    value=""
                                    disabled={outOfStock}
                                    onValueChange={(variantId) => {
                                      const variant = product.variants?.find(v => String(v.id) === variantId);
                                      if (variant) addProduct(product, variant);
                                    }}
                                  >
                                    <SelectTrigger className="w-56">
                                      <SelectValue placeholder={outOfStock ? "All variants out of stock" : "Select variant to add"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {product.variants!.map((variant) => {
                                        const variantAvailable = availableOf(product, variant);
                                        return (
                                          <SelectItem
                                            key={variant.id}
                                            value={String(variant.id)}
                                            disabled={variantAvailable <= 0}
                                          >
                                            <div className="flex items-center justify-between w-full">
                                              <span>{variant.name}</span>
                                              <span className={`text-xs ml-2 ${variantAvailable <= 0 ? "text-red-600 font-medium" : "text-gray-500"}`}>
                                                {variantAvailable <= 0 ? "Out of stock" : `${variantAvailable} available`}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => addProduct(product)}
                                    disabled={outOfStock}
                                    className="bg-[#E30040] hover:bg-[#E30040]/90"
                                  >
                                    {outOfStock ? (
                                      "Out of stock"
                                    ) : (
                                      <>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No products found matching "{searchQuery}". Use the field above to add it as a
                        plain item instead.
                      </div>
                    )}
                  </div>
                )}

                {errors.items && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.items}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Selected Items ({formData.items.length})
                </CardTitle>
                {errors.items && (
                  <p className="text-sm text-red-600">{errors.items}</p>
                )}
              </CardHeader>
              <CardContent>
                {formData.items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No items selected yet</p>
                    <p className="text-sm">Search and add products above</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.items.map((item, index) => {
                      const product = item.product;
                      const variant = item.variant;
                      const isCustom = !product;
                      const availableStock = product ? availableOf(product, variant) : 0;

                      return (
                        <div key={`${item.product_id || item.custom_item_name}-${item.variant_id || 'no-variant'}-${index}`} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{product?.name || item.custom_item_name}</h4>
                                {isCustom && (
                                  <Badge variant="secondary" className="text-xs">Custom item</Badge>
                                )}
                              </div>
                              {variant && (
                                <p className="text-sm text-gray-600">Variant: {variant.name}</p>
                              )}
                              {isCustom ? (
                                <p className="text-xs text-gray-500">Not in the product catalog - to be sourced manually</p>
                              ) : (
                                <p className={`text-xs ${availableStock <= 0 || item.quantity > availableStock ? "text-red-600 font-medium" : "text-gray-500"}`}>
                                  {availableStock <= 0
                                    ? "Out of stock"
                                    : `Available: ${availableStock} ${product?.unit_of_measurement ?? ""}`}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Quantity */}
                            <div className="space-y-2">
                              <Label>Quantity *</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                                className={errors[`item_${index}_quantity`] ? "border-red-500" : ""}
                              />
                              {errors[`item_${index}_quantity`] && (
                                <p className="text-xs text-red-600">{errors[`item_${index}_quantity`]}</p>
                              )}
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                              <Label>Item Notes</Label>
                              <Input
                                placeholder="Optional notes for this item..."
                                value={item.notes || ""}
                                onChange={(e) => updateItemNotes(index, e.target.value)}
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

            {/* Optional Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter any additional notes for this requisition..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* API Response Display */}
            {apiResponse && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {apiResponse.error ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    <span>API Response</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-gray-100 p-3 rounded-md overflow-auto">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t mt-auto">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || formData.items.length === 0}
            className="bg-[#E30040] hover:bg-[#E30040]/90"
            onClick={handleSubmit}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Requisition"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}