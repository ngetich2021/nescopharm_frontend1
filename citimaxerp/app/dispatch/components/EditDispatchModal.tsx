"use client";
import { sizedName } from "@/lib/product-sizes"
import { useState, useEffect } from "react";
import { updateOrderDispatch, type OrderDispatch } from "@/lib/order-dispatches";
import { getProducts } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { X, Package, Loader2, Plus, Minus, Search, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: OrderDispatch | null;
  onSuccess?: () => void;
}

interface Product {
  id: string;
  name: string;
  sku?: string | null;
  price: string | number;
  stock_quantity: number;
  has_variations: boolean;
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    price: string;
    stock_quantity: number;
  }>;
  image_url?: string;
  unit_of_measurement: string;
}

interface DispatchItem {
  id?: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  notes?: string;
  product?: Product;
  variant?: any;
}

interface EditFormData {
  notes: string;
  items: DispatchItem[];
}

export function EditDispatchModal({ open, onOpenChange, dispatch, onSuccess }: EditDispatchModalProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState<EditFormData>({
    notes: "",
    items: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Handle visibility for animation
  useEffect(() => {
    if (open) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Initialize form data when dispatch changes
  useEffect(() => {
    if (dispatch) {
      setFormData({
        notes: dispatch.notes || "",
        items: dispatch.items?.map(item => ({
          id: item.id,
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          quantity: item.quantity,
          notes: "", // Notes not currently on item in new type?
          product: {
            ...item.product,
            image_url: item.product.image_url || undefined,
            unit_of_measurement: 'units', // default
            has_variations: false,
            variants: []
          } as Product,
          variant: item.variant,
        })) || [],
      });
    }
  }, [dispatch]);

  // Fetch initial data on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // Load products for item management
        const productsResponse = await getProducts(1, 100);
        setProducts((productsResponse.data || []) as unknown as Product[]);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchInitialData();
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dispatch || !validateForm()) return;

    setLoading(true);
    
    try {
      // NOTE: Using 'any' here as we need to match the UpdateOrderDispatchRequest structure loosely 
      // or we need to update that interface in the library as well.
      // Assuming updateOrderDispatch takes generic update payload
      const payload: any = {
        notes: formData.notes || undefined,
        items: formData.items.map(item => ({
          id: item.id,
          order_item_id: '', // This might be required by backend but we don't have it easily unless we preserve it? 
          // Actually, if we are editing existing items, we pass ID. If new, we need order_item_id?
          // New items can only be added from the Order probably.
          // For now, let's assume we are updating quantities of existing items or removing them.
          // If we add new items that are not in the order, it might fail.
          product_id: item.product_id,
          quantity_dispatched: item.quantity,
        })),
        // We aren't updating location for now as it wasn't requested
      };

      await updateOrderDispatch(dispatch.id, payload);

      toast({
        title: "Success",
        description: "Dispatch updated successfully!",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating dispatch:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update dispatch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      notes: "",
      items: [],
    });
    setErrors({});
    setSearchQuery("");
    onOpenChange(false);
  };

  // Item management functions
  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, updates: Partial<DispatchItem>) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, ...updates } : item
      )
    }));
  };

  if (!dispatch || !isVisible) return null;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />
      
      <div
        className={cn(
          "fixed inset-0 w-full max-w-4xl bg-white shadow-2xl z-[100] transition-transform duration-300 ease-in-out flex flex-col ml-auto",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Edit Dispatch {dispatch.dispatch_number}
              </h2>
              <p className="text-sm text-gray-500">
                Update dispatch notes and items
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Dispatch Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Dispatch Items ({formData.items.length})
                </CardTitle>
                {errors.items && (
                  <p className="text-sm text-red-600">{errors.items}</p>
                )}
              </CardHeader>
              <CardContent>
                {formData.items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No items in this dispatch</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.items.map((item, index) => (
                      <div key={`${item.product_id}-${item.variant_id || 'no-variant'}-${index}`} className="border rounded-lg p-4">
                        <div className="flex items-start space-x-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-medium">{item.product ? sizedName(item.product?.name, (item as any).variant?.name || (item as any).variant_name) : 'Unknown Product'}</h4>
                                {item.variant && (
                                  <p className="text-sm text-gray-600">Variant: {item.variant?.name || 'Unknown Variant'}</p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Quantity *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 0 })}
                                  className={errors[`item_${index}_quantity`] ? "border-red-500" : ""}
                                />
                                {errors[`item_${index}_quantity`] && (
                                  <p className="text-sm text-red-600">
                                    {errors[`item_${index}_quantity`]}
                                  </p>
                                )}
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Item Notes</Label>
                                <Input
                                  value={item.notes || ""}
                                  onChange={(e) => updateItem(index, { notes: e.target.value })}
                                  placeholder="Optional notes for this item"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </div>

        <div className="flex-shrink-0 border-t bg-white px-6 py-4">
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={loading}
              className="bg-[#E30040] hover:bg-[#E30040]/90 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                "Update Dispatch"
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}