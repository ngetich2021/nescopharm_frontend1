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
import { updateRequisition, type Requisition, type RequisitionItem } from "@/lib/requisitions";
import { getProducts, type Product as LibProduct } from "@/lib/products";
import { getUsers, type User } from "@/lib/users";

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

interface EditRequisitionItem {
  id?: string;
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
  items: EditRequisitionItem[];
}

interface EditRequisitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  requisition: Requisition | null;
}

export function EditRequisitionModal({ open, onOpenChange, onSuccess, requisition }: EditRequisitionModalProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<LibProduct[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customItemInput, setCustomItemInput] = useState("");
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    approver_id: "",
    notes: "",
    items: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form data when requisition changes
  useEffect(() => {
    if (requisition && open) {
      setFormData({
        approver_id: requisition.approver_id || "",
        notes: requisition.notes || "",
        items: requisition.items.map(item => ({
          id: item.id,
          product_id: item.product_id || undefined,
          custom_item_name: item.custom_item_name || undefined,
          variant_id: item.variant_id || undefined,
          quantity: item.quantity,
          notes: item.notes || "",
          product: item.product || undefined,
          variant: item.variant
        }))
      });
    }
  }, [requisition, open]);

  // Fetch products when sheet opens
  useEffect(() => {
    if (open) {
      fetchProducts();
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
      setSearchQuery("");
      setCustomItemInput("");
    }
  }, [open]);

  const fetchProducts = async () => {
    try {
      const [productsResponse, usersData] = await Promise.all([
        getProducts(1, 100),
        // Only users who can actually approve a requisition (e.g. GM/Directors)
        // should show up as approver options.
        getUsers({ role_scope: "can_approve_requisitions" })
      ]);
      setProducts(productsResponse.data || []);
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addProduct = (product: LibProduct, variant?: any) => {
    const existingItemIndex = formData.items.findIndex(
      item => item.product_id === product.id && item.variant_id === variant?.id
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...formData.items];
      updatedItems[existingItemIndex].quantity += 1;
      setFormData({ ...formData, items: updatedItems });
    } else {
      const newItem: EditRequisitionItem = {
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

    const newItem: EditRequisitionItem = {
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
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !requisition) return;

    setLoading(true);
    
    try {
      const payload = {
        notes: formData.notes || undefined,
        items: formData.items.map(item => ({
          id: item.id,
          product_id: item.product_id || undefined,
          custom_item_name: item.custom_item_name || undefined,
          variant_id: item.variant_id || undefined,
          quantity: item.quantity,
          notes: item.notes || undefined,
        })),
      };

      console.log('Updating requisition with payload:', payload);
      
      const response = await updateRequisition(requisition.id, payload);
      
      console.log('Update response:', response);

      toast({
        title: "Success",
        description: "Requisition updated successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update requisition",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if requisition can be edited (only pending status)
  const canEdit = requisition?.status === "pending" && requisition?.approval_status === "pending";

  if (!canEdit && requisition) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Requisition</SheetTitle>
            <SheetDescription>
              Cannot edit requisition {requisition.requisition_number}
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">This requisition cannot be edited because it has already been {requisition.status}.</p>
            </div>
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>Edit Requisition</SheetTitle>
          <SheetDescription>
            {requisition ? `Edit requisition ${requisition.requisition_number}` : "Edit requisition details"}
          </SheetDescription>
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
                    {filteredProducts.length > 0 ? (
                      <div className="divide-y">
                        {filteredProducts.slice(0, 10).map((product) => (
                          <div key={product.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{product.name}</h4>
                                <div className="flex items-center space-x-4 mt-1">
                                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                                  <p className="text-xs text-gray-500">
                                    Stock: {product.stock_quantity} {product.unit_of_measurement}
                                  </p>
                                  {product.stock_quantity > 0 && product.stock_quantity <= 10 && (
                                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                                      Low Stock
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {product.has_variations && product.variants ? (
                                  <>
                                    <Select onValueChange={(variantId) => {
                                      const variant = product.variants?.find(v => v.id === variantId);
                                      if (variant) addProduct(product, variant);
                                    }}>
                                      <SelectTrigger className="w-40">
                                        <SelectValue placeholder="Select variant" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {product.variants.map((variant) => (
                                          <SelectItem 
                                            key={variant.id} 
                                            value={variant.id}
                                            disabled={variant.stock_quantity <= 0}
                                          >
                                            <div className="flex items-center justify-between w-full">
                                              <span>{variant.name}</span>
                                              <span className="text-xs text-gray-500 ml-2">
                                                Stock: {variant.stock_quantity}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      onClick={() => addProduct(product)}
                                      disabled={product.stock_quantity <= 0}
                                      className="bg-primary hover:bg-primary/90"
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => addProduct(product)}
                                    disabled={product.stock_quantity <= 0}
                                    className="bg-[#E30040] hover:bg-[#E30040]/90"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
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
                      const availableStock = variant ? variant.stock_quantity : product?.stock_quantity || 0;

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
                                <p className="text-xs text-gray-500">
                                  Available: {availableStock} {product?.unit_of_measurement}
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

            {/* Additional Notes */}
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
                Updating...
              </>
            ) : (
              "Update Requisition"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}