"use client";

import { useState, useEffect } from "react";
import * as React from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getProducts, type Product } from "@/lib/products";
import { getStores, type Store } from "@/lib/stores";
import { getSuppliers, type Supplier } from "@/lib/suppliers";
import { getProductCategories, type ProductCategory } from "@/lib/product-categories";
import { createProduct } from "@/app/inventory/actions";
import { CreateProductModal } from "@/components/modals/create-product-modal";
import { createProductReceipt } from "@/lib/productreceipt";
import { 
  Package, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  Building2, 
  User, 
  X,
  Search,
  AlertCircle,
  Layers,
  ExternalLink,
  PlusCircle,
  Loader2,
  Save,
  ShieldAlert,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { usePermissions } from "@/hooks/use-permissions";

interface ProductReceiptItem {
  id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  expiry_date?: string | null;
  notes?: string | null;
  product?: Product;
  variant?: any;
  // Batch tracking fields
  enable_batch_tracking?: boolean;
  batch_number?: string;
  lot_number?: string;
  serial_number?: string;
  manufacture_date?: string;
  individual_serials?: string[];
}

interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  stock_quantity: number;
}

interface CreateProductReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const formSchema = z.object({
  reference_number: z.string().nonempty({ message: "Reference number is required" }),
  store_id: z.string().nonempty({ message: "Store is required" }),
  document_type: z.enum(["receipt", "invoice", "delivery_note"]),
  items: z.array(
    z.object({
      product_id: z.string().nonempty({ message: "Product is required" }),
      variant_id: z.string().optional().nullable(),
      quantity: z.number().positive({ message: "Quantity must be greater than 0" }),
      unit_price: z.number().min(0, { message: "Unit price must be greater than or equal to 0" }),
      expiry_date: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      // Batch tracking fields
      enable_batch_tracking: z.boolean().optional(),
      batch_number: z.string().optional(),
      lot_number: z.string().optional(),
      serial_number: z.string().optional(),
      manufacture_date: z.string().optional(),
      individual_serials: z.array(z.string()).optional(),
    })
  ),
});

export function CreateProductReceiptModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateProductReceiptModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [referenceNumber, setReferenceNumber] = useState("");
  const [documentType, setDocumentType] = useState("receipt");
  const [supplierId, setSupplierId] = useState<string>("");
  const [storeId, setStoreId] = useState<string>("");
  const [document, setDocument] = useState<File | null>(null);
  const [shippingCost, setShippingCost] = useState<string>("");
  const [logisticsCost, setLogisticsCost] = useState<string>("");
  
  // Data arrays
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [items, setItems] = useState<ProductReceiptItem[]>([]);

  // Loading states
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Product search and selection
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Combobox open state
  const [storeSearchOpen, setStoreSearchOpen] = useState(false);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [productRowSearchOpen, setProductRowSearchOpen] = useState<Record<string, boolean>>({});

  // Variant selection
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [showVariantModal, setShowVariantModal] = useState(false);
  
  // New product creation
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [savedReceiptState, setSavedReceiptState] = useState<any>(null);

  const { hasPermission, isAdmin } = usePermissions();

  const form = useForm<ProductReceiptFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit", // Only validate on submit
    defaultValues: {
      reference_number: "",
      store_id: "",
      document_type: "receipt",
      items: [],
    }
});

type ProductReceiptFormValues = z.infer<typeof formSchema>;

  // Load data when modal opens
  useEffect(() => {
    if (open) {
      loadStores();
      loadSuppliers();
      loadProducts();
      loadCategories();
      resetForm();
    } else {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    form.reset({
      reference_number: "",
      store_id: "",
      document_type: "receipt",
      items: [],
    });
    setReferenceNumber("");
    setDocumentType("receipt");
    setSupplierId("");
    setStoreId("");
    setDocument(null);
    setShippingCost("");
    setLogisticsCost("");
    setItems([]);
    setProductSearchQuery("");
    setSelectedProductForVariant(null);
    setShowVariantModal(false);
    setShowCreateProductModal(false);
    setSavedReceiptState(null);
  };

  const loadStores = async () => {
    setLoadingStores(true);
    try {
      const storesData = await getStores();
      setStores(storesData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load stores",
        variant: "destructive",
      });
    } finally {
      setLoadingStores(false);
    }
  };

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const suppliersData = await getSuppliers();
      setSuppliers(suppliersData);
    } catch (error: any) {
      toast({
        title: "Error", 
        description: `Failed to load suppliers: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data } = await getProducts(1, 1000); // Load all products
      setProducts(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const categoriesData = await getProductCategories();
      setCategories(categoriesData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      setDocument(file);
    }
  };

  const addItem = () => {
    const newItem: ProductReceiptItem = {
      id: Date.now().toString(),
      product_id: "",
      variant_id: null,
      quantity: 1,
      unit_price: 0,
      expiry_date: null,
      notes: null,
      // individual_serials not initialized by default
    };
    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    form.setValue("items", updatedItems);
  };

  const removeItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    setItems(updatedItems);
    form.setValue("items", updatedItems);
  };

  const updateItem = (itemId: string, field: keyof ProductReceiptItem, value: any) => {
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        
        // If product_id changed, update product reference and reset variant
        if (field === "product_id") {
          const product = products.find(p => p.id === value);
          updatedItem.product = product;
          updatedItem.variant_id = null;
          updatedItem.variant = null;
          // Set default unit price from product
          if (product) {
            updatedItem.unit_price = parseFloat((product.price || 0).toString());
          }
          // Initialize individual_serials array with empty strings when quantity changes
          if (updatedItem.quantity && updatedItem.individual_serials !== undefined) {
            updatedItem.individual_serials = Array(updatedItem.quantity).fill("");
          }
        }
        
        // If variant_id changed, update variant reference and price
        if (field === "variant_id" && value) {
          const product = updatedItem.product;
          if (product && product.variants) {
            const variant = product.variants.find((v: any) => v.id === value);
            if (variant) {
              updatedItem.variant = variant;
              updatedItem.unit_price = parseFloat((variant.price || product.price || 0).toString());
            }
          }
        }
        
        // If quantity changed, adjust individual_serials array
        if (field === "quantity") {
          if (updatedItem.individual_serials !== undefined) {
            const currentSerials = updatedItem.individual_serials || [];
            if (value > currentSerials.length) {
              // Extend array with empty strings
              updatedItem.individual_serials = [
                ...currentSerials,
                ...Array(value - currentSerials.length).fill("")
              ];
            } else if (value < currentSerials.length) {
              // Truncate array
              updatedItem.individual_serials = currentSerials.slice(0, value);
            }
          }
        }
        
        return updatedItem;
      }
      return item;
    });
    
    setItems(updatedItems);
    form.setValue("items", updatedItems);
  };

  const addProductToItems = (product: Product, variant?: ProductVariant) => {
    // Check if product with same variant already exists in items
    const existingItem = items.find(item => 
      item.product_id === product.id && 
      item.variant_id === (variant?.id || null)
    );
    
    let updatedItems;
    if (existingItem) {
      // Update quantity of existing item
      updatedItems = items.map(item => 
        item.id === existingItem.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      // Add new item
      const newItem: ProductReceiptItem = {
        id: Date.now().toString(),
        product_id: product.id,
        variant_id: variant?.id || null,
        quantity: 1,
        unit_price: parseFloat((variant?.price || product.price || 0).toString()),
        expiry_date: null,
        notes: null,
        product: product,
        variant: variant,
        // individual_serials not initialized by default
      };
      updatedItems = [...items, newItem];
    }
    
    setItems(updatedItems);
    form.setValue("items", updatedItems); // IMPORTANT: Sync with form state
    setProductSearchQuery("");
    setShowProductDropdown(false);
  };

  const handleProductClick = (product: Product) => {
    // Check if product has variants
    if (product.has_variations && product.variants && product.variants.length > 0) {
      setSelectedProductForVariant(product);
      setShowVariantModal(true);
    } else {
      addProductToItems(product);
    }
  };

  const handleVariantSelect = (variant: ProductVariant) => {
    if (selectedProductForVariant) {
      addProductToItems(selectedProductForVariant, variant);
    }
    setShowVariantModal(false);
    setSelectedProductForVariant(null);
  };

  const handleOpenCreateProduct = () => {
    // Save current receipt state
    const currentState = {
      referenceNumber,
      documentType,
      supplierId,
      storeId,
      document,
      items,
    };
    setSavedReceiptState(currentState);
    setShowCreateProductModal(true);
  };

  const handleProductCreated = async () => {
    try {
      // Refresh products list to include the new product
      await loadProducts();
      
      toast({
        title: "Success! ✅",
        description: "Product created successfully. You can now add it to the receipt.",
      });
      
      setShowCreateProductModal(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh products list",
        variant: "destructive",
      });
    }
  };

  const handleCancelCreateProduct = () => {
    setShowCreateProductModal(false);
    setSavedReceiptState(null);
  };

  const validateForm = () => {
    if (!referenceNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "Reference number is required",
        variant: "destructive",
      });
      return false;
    }

    if (!storeId) {
      toast({
        title: "Validation Error", 
        description: "Please select a store",
        variant: "destructive",
      });
      return false;
    }

    if (items.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product item",
        variant: "destructive",
      });
      return false;
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_id || item.product_id === "select-product") {
        toast({
          title: "Validation Error",
          description: "All items must have a product selected",
          variant: "destructive",
        });
        return false;
      }
      
      // Check if product requires variant selection
      if (item.product && item.product.has_variations && item.product.variants && item.product.variants.length > 0) {
        if (!item.variant_id || item.variant_id === "select-variant") {
          toast({
            title: "Validation Error",
            description: `Please select a variant for "${item.product.name}"`,
            variant: "destructive",
          });
          return false;
        }
      }
      
      if (item.quantity <= 0) {
        toast({
          title: "Validation Error",
          description: "All items must have a quantity greater than 0",
          variant: "destructive",
        });
        return false;
      }
      if (item.unit_price < 0) {
        toast({
          title: "Validation Error",
          description: "Unit prices cannot be negative",
          variant: "destructive",
        });
        return false;
      }

      if (item.individual_serials !== undefined) {
        const blankIndex = item.individual_serials.findIndex((s) => !s.trim());
        if (blankIndex !== -1) {
          toast({
            title: "Validation Error",
            description: `Enter a serial number for "${item.product?.name || "this item"}" (#${blankIndex + 1} is blank), or turn off individual serial numbers for it`,
            variant: "destructive",
          });
          return false;
        }
        const trimmed = item.individual_serials.map((s) => s.trim());
        if (new Set(trimmed).size !== trimmed.length) {
          toast({
            title: "Validation Error",
            description: `Duplicate serial numbers entered for "${item.product?.name || "this item"}"`,
            variant: "destructive",
          });
          return false;
        }
      }
    }

    return true;
  };

  async function onSubmit(data: ProductReceiptFormValues) {
    // Check create permission
    if (!hasPermission("can_create_product_receipts") && !isAdmin()) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to create product receipts.",
        variant: "destructive",
      });
      return;
    }

    // Validate form using our custom validation
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplier_id: supplierId && supplierId !== "none" ? supplierId : null,
        contractor_id: null, // Contractor functionality to be implemented later
        document_type: documentType,
        reference_number: referenceNumber.trim(),
        store_id: storeId,
        shipping_cost: shippingCost ? parseFloat(shippingCost) : 0,
        logistics_cost: logisticsCost ? parseFloat(logisticsCost) : 0,
        items: items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          expiry_date: item.expiry_date,
          notes: item.notes,
          // Batch tracking fields - only include if batch tracking is enabled
          ...(item.enable_batch_tracking && {
            batch_number: item.batch_number || undefined,
            lot_number: item.lot_number || undefined,
            serial_number: item.serial_number || undefined,
            manufacture_date: item.manufacture_date || undefined,
            // Backend reads serial_numbers (+ track_serials to auto-generate
            // when none are typed in) - individual_serials was a dead key
            // the API never looked at, so anything typed here was silently
            // discarded before this fix.
            ...(item.individual_serials !== undefined && {
              serial_numbers: item.individual_serials.map((s) => s.trim()),
              track_serials: true,
            }),
          }),
        })),
        document: document,
      };

      const result = await createProductReceipt(payload);

      toast({
        title: "Success! ✅",
        description: "Product receipt created successfully",
      });

      if (result.pricing_warnings && result.pricing_warnings.length > 0) {
        toast({
          title: "Pricing needs review",
          description: result.pricing_warnings.join(" "),
          variant: "destructive",
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create product receipt",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    product.sku?.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Product Receipt</SheetTitle>
          <SheetDescription>
            Add a new product receipt to the system
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Check if user has permission to create before showing form */}
            {hasPermission("can_create_product_receipts") || isAdmin() ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="referenceNumber">Reference Number *</Label>
                    <Input
                      id="referenceNumber"
                      value={referenceNumber}
                      onChange={(e) => {
                        setReferenceNumber(e.target.value);
                        form.setValue("reference_number", e.target.value);
                      }}
                      placeholder="e.g., DOC-REF-001"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="documentType">Document Type</Label>
                    <Select 
                      value={documentType} 
                      onValueChange={(value) => {
                        setDocumentType(value);
                        form.setValue("document_type", value as "receipt" | "invoice" | "delivery_note");
                      }} 
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receipt">Receipt</SelectItem>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="delivery_note">Delivery Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="store">Store *</Label>
                    <Popover open={storeSearchOpen} onOpenChange={setStoreSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={storeSearchOpen}
                          className="w-full justify-between font-normal"
                          disabled={isSubmitting || loadingStores}
                        >
                          {storeId ? stores.find((store) => store.id === storeId)?.name : (loadingStores ? "Loading stores..." : "Select store")}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search stores..." />
                          <CommandList>
                            <CommandEmpty>No store found.</CommandEmpty>
                            <CommandGroup>
                              {stores.map((store) => (
                                <CommandItem
                                  key={store.id}
                                  value={store.name}
                                  onSelect={() => {
                                    setStoreId(store.id);
                                    form.setValue("store_id", store.id);
                                    setStoreSearchOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", storeId === store.id ? "opacity-100" : "opacity-0")} />
                                  {store.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shippingCost">Shipping Cost</Label>
                    <Input
                      id="shippingCost"
                      type="number"
                      step="0.01"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logisticsCost">Logistics Cost</Label>
                    <Input
                      id="logisticsCost"
                      type="number"
                      step="0.01"
                      value={logisticsCost}
                      onChange={(e) => setLogisticsCost(e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document">Document (Optional)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={handleDocumentUpload}
                        disabled={isSubmitting}
                        className="hidden"
                        id="document-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.document.getElementById("document-upload")?.click()}
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {document ? document.name : "Upload Document"}
                      </Button>
                      {document && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDocument(null)}
                          disabled={isSubmitting}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier (Optional)</Label>
                    <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={supplierSearchOpen}
                          className="w-full justify-between font-normal"
                          disabled={isSubmitting || loadingSuppliers}
                        >
                          {supplierId ? suppliers.find((supplier) => supplier.id === supplierId)?.name : (loadingSuppliers ? "Loading suppliers..." : "Select supplier")}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search suppliers..." />
                          <CommandList>
                            <CommandEmpty>No supplier found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="No supplier"
                                onSelect={() => {
                                  setSupplierId("");
                                  setSupplierSearchOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", !supplierId ? "opacity-100" : "opacity-0")} />
                                No supplier
                              </CommandItem>
                              {suppliers.map((supplier) => (
                                <CommandItem
                                  key={supplier.id}
                                  value={supplier.name}
                                  onSelect={() => {
                                    setSupplierId(supplier.id);
                                    setSupplierSearchOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", supplierId === supplier.id ? "opacity-100" : "opacity-0")} />
                                  {supplier.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Product Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-purple-600" />
                        Product Items
                        {items.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {items.length} {items.length === 1 ? 'item' : 'items'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addItem}
                          disabled={isSubmitting}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Manually
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleOpenCreateProduct}
                          disabled={isSubmitting}
                          className="text-green-600 border-green-200 hover:bg-green-50"
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Create Product
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Product Search Section */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-gray-500" />
                        <Label className="text-sm font-medium text-gray-700">Quick Add Products</Label>
                      </div>
                      <div className="relative">
                        <Input
                          id="productSearch"
                          type="text"
                          placeholder="Search by product name or SKU to quickly add..."
                          value={productSearchQuery}
                          onChange={(e) => {
                            setProductSearchQuery(e.target.value);
                            setShowProductDropdown(e.target.value.length > 0);
                          }}
                          onFocus={() => setShowProductDropdown(productSearchQuery.length > 0)}
                          className="bg-white"
                          disabled={isSubmitting || loadingProducts}
                        />
                        
                        {/* Product Dropdown */}
                        {showProductDropdown && productSearchQuery.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-[200] mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {loadingProducts ? (
                              <div className="p-4 text-center text-gray-500">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                                  Loading products...
                                </div>
                              </div>
                            ) : filteredProducts.length > 0 ? (
                              <>
                                {filteredProducts.map((product) => (
                                  <button
                                    key={product.id}
                                    type="button"
                                    className="w-full text-left p-4 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center justify-between transition-colors"
                                    onClick={() => handleProductClick(product)}
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{product.name}</div>
                                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                                        <span>SKU: {product.sku || 'N/A'}</span>
                                        <span>Stock: {product.stock_quantity || 0}</span>
                                        {product.has_variations && product.variants && product.variants.length > 0 && (
                                          <Badge variant="secondary" className="text-xs">
                                            {product.variants.length} variants
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right ml-4">
                                      <div className="font-bold text-green-600">
                                        {formatCurrency(product.price || 0)}
                                      </div>
                                      <div className="text-xs text-gray-500">Click to add</div>
                                    </div>
                                  </button>
                                ))}
                                <div className="border-t border-gray-100">
                                  <button
                                    type="button"
                                    className="w-full text-left p-4 hover:bg-blue-50 text-blue-600 font-medium flex items-center gap-2 transition-colors"
                                    onClick={handleOpenCreateProduct}
                                  >
                                    <Plus className="h-4 w-4" />
                                    Create new product
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="p-4 text-center text-gray-500">
                                  <div className="mb-2">No products found for "{productSearchQuery}"</div>
                                  <div className="text-xs text-gray-400">Try a different search term or create a new product</div>
                                </div>
                                <div className="border-t border-gray-100">
                                  <button
                                    type="button"
                                    className="w-full text-left p-4 hover:bg-blue-50 text-blue-600 font-medium flex items-center gap-2 transition-colors"
                                    onClick={handleOpenCreateProduct}
                                  >
                                    <Plus className="h-4 w-4" />
                                    Create "{productSearchQuery}" as new product
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        💡 Tip: Start typing to search products, or use "Add Manually" to configure items step by step
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-4">
                      {items.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                          <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                          <h3 className="font-medium text-gray-900 mb-2">No items added yet</h3>
                          <p className="text-sm mb-4">Add products using the search above or manually configure items</p>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addItem}
                              disabled={loading}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add First Item
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {items.map((item, index) => (
                            <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white hover:shadow-sm transition-shadow">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">
                                    {index + 1}
                                  </div>
                                  {item.product && (
                                    <div>
                                      <div className="font-medium text-gray-900">{item.product?.name || item.product_id}</div>
                                      <div className="flex items-center gap-2 mt-1">
                                        {item.variant && (
                                          <Badge variant="outline" className="text-xs">
                                            {item.variant?.name}
                                          </Badge>
                                        )}
                                        <span className="text-xs text-gray-500">SKU: {item.product.sku || 'N/A'}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(item.id)}
                                  disabled={isSubmitting}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              {/* Batch Tracking Toggle */}
                              <div className="flex items-center gap-2 pt-2">
                                <input
                                  type="checkbox"
                                  id={`batch-tracking-${item.id}`}
                                  checked={item.enable_batch_tracking || false}
                                  onChange={(e) => updateItem(item.id, "enable_batch_tracking", e.target.checked)}
                                  disabled={isSubmitting}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <Label htmlFor={`batch-tracking-${item.id}`} className="text-sm font-medium text-gray-700">
                                  📦 Enable Batch Tracking
                                </Label>
                              </div>
                              
                              {/* Batch Tracking Fields */}
                              {item.enable_batch_tracking && (
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-3">
                                  <h4 className="font-medium text-blue-800 flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Batch Information
                                  </h4>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Batch Number</Label>
                                      <Input
                                        placeholder="Auto-generated if empty"
                                        value={item.batch_number || ""}
                                        onChange={(e) => updateItem(item.id, "batch_number", e.target.value)}
                                        disabled={isSubmitting}
                                        className="h-9"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Lot Number</Label>
                                      <Input
                                        placeholder="Supplier lot number"
                                        value={item.lot_number || ""}
                                        onChange={(e) => updateItem(item.id, "lot_number", e.target.value)}
                                        disabled={isSubmitting}
                                        className="h-9"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Manufacture Date</Label>
                                      <Input
                                        type="date"
                                        value={item.manufacture_date || ""}
                                        onChange={(e) => updateItem(item.id, "manufacture_date", e.target.value)}
                                        disabled={isSubmitting}
                                        className="h-9"
                                      />
                                    </div>
                                    
                                    <div className="space-y-2 md:col-span-2">
                                      <Label className="text-sm font-medium">Expiry Date</Label>
                                      <Input
                                        type="date"
                                        value={item.expiry_date || ""}
                                        onChange={(e) => updateItem(item.id, "expiry_date", e.target.value)}
                                        disabled={isSubmitting}
                                        className="h-9"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Individual Serial Numbers Toggle */}
                                  <div className="flex items-center gap-2 pt-2">
                                    <input
                                      type="checkbox"
                                      id={`individual-serials-${item.id}`}
                                      checked={item.individual_serials !== undefined}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          // Initialize individual serials array
                                          const initialSerials = Array(item.quantity).fill("");
                                          updateItem(item.id, "individual_serials", initialSerials);
                                        } else {
                                          // Remove individual serials
                                          updateItem(item.id, "individual_serials", undefined);
                                        }
                                      }}
                                      disabled={isSubmitting}
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <Label htmlFor={`individual-serials-${item.id}`} className="text-sm font-medium text-gray-700">
                                      📋 Add Individual Serial Numbers for Items
                                    </Label>
                                  </div>
                                  
                                  {/* Individual Serial Numbers Input */}
                                  {item.individual_serials !== undefined && (
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">
                                        Individual Serial Numbers ({item.quantity} items)
                                      </Label>
                                      <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-white rounded border">
                                        {Array.from({ length: item.quantity }, (_, index) => (
                                          <div key={index} className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 w-8">#{index + 1}</span>
                                            <Input
                                              type="text"
                                              placeholder={`Serial #${index + 1}`}
                                              value={item.individual_serials?.[index] || ""}
                                              onChange={(e) => {
                                                const newSerials = [...(item.individual_serials || Array(item.quantity).fill(""))];
                                                newSerials[index] = e.target.value;
                                                updateItem(item.id, "individual_serials", newSerials);
                                              }}
                                              disabled={isSubmitting}
                                              className="h-8 text-sm"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="space-y-2 md:col-span-2">
                                  <Label className="text-sm font-medium">Product *</Label>
                                  <Popover
                                    open={productRowSearchOpen[item.id] || false}
                                    onOpenChange={(open) => setProductRowSearchOpen(prev => ({ ...prev, [item.id]: open }))}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={productRowSearchOpen[item.id] || false}
                                        className="w-full justify-between font-normal h-10"
                                        disabled={isSubmitting}
                                      >
                                        {item.product_id ? products.find((product) => product.id === item.product_id)?.name : "Select product"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                      <Command>
                                        <CommandInput placeholder="Search products..." />
                                        <CommandList>
                                          <CommandEmpty>No product found.</CommandEmpty>
                                          <CommandGroup>
                                            {products.map((product) => (
                                              <CommandItem
                                                key={product.id}
                                                value={`${product.name} ${product.sku || ''}`}
                                                onSelect={() => {
                                                  updateItem(item.id, "product_id", product.id);
                                                  const updatedItems = [...items];
                                                  const index = updatedItems.findIndex(i => i.id === item.id);
                                                  if (index !== -1) {
                                                    updatedItems[index] = {...updatedItems[index], product_id: product.id};
                                                    form.setValue("items", updatedItems);
                                                  }
                                                  setProductRowSearchOpen(prev => ({ ...prev, [item.id]: false }));
                                                }}
                                              >
                                                <Check className={cn("mr-2 h-4 w-4", item.product_id === product.id ? "opacity-100" : "opacity-0")} />
                                                <div className="flex flex-col">
                                                  <div className="font-medium">{product.name}</div>
                                                  <div className="text-xs text-gray-500">SKU: {product.sku || 'N/A'}</div>
                                                </div>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                        <div className="border-t my-1">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            className="w-full justify-start text-left text-sm"
                                            onClick={() => {
                                              handleOpenCreateProduct();
                                              setProductRowSearchOpen(prev => ({ ...prev, [item.id]: false }));
                                            }}
                                          >
                                            <PlusCircle className="h-4 w-4 mr-2" /> Create Product
                                          </Button>
                                        </div>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                
                                {/* Variant Selection - Only show if product has variations */}
                                {item.product && item.product.has_variations && item.product.variants && item.product.variants.length > 0 && (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Variant *</Label>
                                    <Select
                                      value={item.variant_id || "select-variant"}
                                      onValueChange={(value) => {
                                        updateItem(item.id, "variant_id", value);
                                        const updatedItems = [...items];
                                        const index = updatedItems.findIndex(i => i.id === item.id);
                                        if (index !== -1) {
                                          updatedItems[index] = {...updatedItems[index], variant_id: value};
                                          form.setValue("items", updatedItems);
                                        }
                                      }}
                                      disabled={isSubmitting}
                                    >
                                      <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select variant" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="select-variant" disabled>
                                          Select variant
                                        </SelectItem>
                                        {item.product.variants.map((variant: any) => (
                                          <SelectItem key={variant.id} value={variant.id}>
                                            {variant.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Qty *</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 0;
                                      updateItem(item.id, "quantity", value);
                                      const updatedItems = [...items];
                                      const index = updatedItems.findIndex(i => i.id === item.id);
                                      if (index !== -1) {
                                        updatedItems[index] = {...updatedItems[index], quantity: value};
                                        form.setValue("items", updatedItems);
                                      }
                                    }}
                                    disabled={isSubmitting}
                                    className="h-10"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Unit Price</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unit_price}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      updateItem(item.id, "unit_price", value);
                                      const updatedItems = [...items];
                                      const index = updatedItems.findIndex(i => i.id === item.id);
                                      if (index !== -1) {
                                        updatedItems[index] = {...updatedItems[index], unit_price: value};
                                        form.setValue("items", updatedItems);
                                      }
                                    }}
                                    disabled={isSubmitting}
                                    className="h-10"
                                  />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Expiry Date (Optional)</Label>
                                  <Input
                                    type="date"
                                    value={item.expiry_date || ""}
                                    onChange={(e) => updateItem(item.id, "expiry_date", e.target.value || null)}
                                    disabled={isSubmitting}
                                    className="h-10"
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Notes (Optional)</Label>
                                  <Input
                                    value={item.notes || ""}
                                    onChange={(e) => updateItem(item.id, "notes", e.target.value || null)}
                                    placeholder="Additional notes..."
                                    disabled={isSubmitting}
                                    className="h-10"
                                  />
                                </div>
                              </div>
                              
                              {/* Item Total */}
                              <div className="flex justify-end pt-3 border-t border-gray-100">
                                <div className="text-right">
                                  <div className="text-sm text-gray-500">Item Total</div>
                                  <div className="text-lg font-bold text-green-600">
                                    {formatCurrency(item.quantity * item.unit_price)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Add Item Button after cards */}
                          <div className="flex justify-center pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={addItem}
                              disabled={loading}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Another Item
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Total Summary */}
                    {items.length > 0 && (
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">Receipt Summary</h3>
                            <div className="text-sm text-gray-600">
                              {items.length} {items.length === 1 ? 'item' : 'items'} • Total Quantity: {items.reduce((sum, item) => sum + item.quantity, 0)} units
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 mb-1">Total Value</div>
                            <div className="text-2xl font-bold text-green-600">
                              {formatCurrency(totalValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <SheetFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Create Receipt
                      </>
                    )}
                  </Button>
                </SheetFooter>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
                <p className="text-gray-500 text-center">
                  You do not have permission to create product receipts.<br />
                  Please contact your administrator to request access.
                </p>
              </div>
            )}
          </form>
        </Form>
        
        {/* Create Product Modal */}
        <CreateProductModal
          isOpen={showCreateProductModal}
          onClose={() => setShowCreateProductModal(false)}
          onSuccess={handleProductCreated}
        />
      </SheetContent>
    </Sheet>
  );
}