// Complete EditProductReceiptModal implementation that aligns with CreateProductReceiptModal
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
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getProducts, type Product } from "@/lib/products";
import { getStores, type Store } from "@/lib/stores";
import { getSuppliers, type Supplier } from "@/lib/suppliers";
import { CreateProductModal } from "@/components/modals/create-product-modal";
import { 
  createProductReceipt,
  getProductReceipt,
  updateProductReceiptFull,
  type ProductReceiptDetails 
} from "@/lib/productreceipt";
import { 
  Package, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  User, 
  X,
  Search,
  PlusCircle,
  Save,
  Loader2,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { ShieldAlert } from "lucide-react";

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
}

interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  stock_quantity: number;
}

interface EditProductReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  productReceipt: ProductReceiptDetails | null;
}

const formSchema = z.object({
  reference_number: z.string().nonempty({ message: "Reference number is required" }),
  store_id: z.string().nonempty({ message: "Store is required" }),
  document_type: z.enum(["receipt", "invoice", "delivery_note"]),
  supplier_id: z.string().optional().nullable(),
  items: z.array(
    z.object({
      product_id: z.string().nonempty({ message: "Product is required" }),
      variant_id: z.string().optional().nullable(),
      quantity: z.number().positive({ message: "Quantity must be greater than 0" }),
      unit_price: z.number().min(0, { message: "Unit price must be greater than or equal to 0" }),
      expiry_date: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
  ),
});

type ProductReceiptFormValues = z.infer<typeof formSchema>;

export function EditProductReceiptModal({
  open,
  onOpenChange,
  onSuccess,
  productReceipt,
}: EditProductReceiptModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [referenceNumber, setReferenceNumber] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [storeId, setStoreId] = useState<string>("");
  const [document, setDocument] = useState<File | null>(null);
  const [shippingCost, setShippingCost] = useState<string>("");
  const [logisticsCost, setLogisticsCost] = useState<string>("");
  const [items, setItems] = useState<ProductReceiptItem[]>([]);

  // Import cost breakdown fields
  const [importCosts, setImportCosts] = useState<Record<string, string>>({
    ppb_permit: "", idf: "", railway_levy: "", transport_cost: "",
    clearing_agency_fee: "", other_clearing_cost: "", certificate_of_conformity: "",
    sgs_listing_approval: "", vat_on_clearing: "", vat_on_product: "",
    import_duty: "", excise_duty: "", fob_price: "",
  });

  const importCostLabels: Record<string, string> = {
    ppb_permit: "PPB Permit",
    idf: "IDF",
    railway_levy: "Railway Levy",
    transport_cost: "Transport Cost (Manufacturer to Nairobi CTD)",
    clearing_agency_fee: "Clearing Cost - Agency Fee",
    other_clearing_cost: "Other Clearing Cost",
    certificate_of_conformity: "Certificate of Conformity from Manufacturer",
    sgs_listing_approval: "SGS Listing & Approval",
    vat_on_clearing: "VAT Charges on Clearing Cost",
    vat_on_product: "VAT Cost on the Product",
    import_duty: "Import Duty",
    excise_duty: "Excise Duty",
    fob_price: "FOB Price from Manufacturer",
  };

  const updateImportCost = (field: string, value: string) => {
    setImportCosts((prev) => ({ ...prev, [field]: value }));
  };

  const totalImportCost = Object.values(importCosts).reduce(
    (sum, v) => sum + (parseFloat(v) || 0), 0
  );

  const totalItemsCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const costPerItem = totalItemsCount > 0 ? Math.round((totalImportCost / totalItemsCount) * 100) / 100 : 0;
  
  // Data arrays
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [receipt, setReceipt] = useState<ProductReceiptDetails | null>(null);

  // Loading states
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

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

  const { hasPermission, isAdmin } = usePermissions();

  const form = useForm<ProductReceiptFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reference_number: "",
      store_id: "",
      document_type: "receipt",
      supplier_id: "",
      items: [],
    }
  });

  // Load data when modal opens
  useEffect(() => {
    if (open && productReceipt) {
      loadReceipt();
      loadStores();
      loadSuppliers();
      loadProducts();
    } else {
      resetForm();
    }
  }, [open, productReceipt]);

  const resetForm = () => {
    setReferenceNumber("");
    setDocumentType("");
    setSupplierId("");
    setStoreId("");
    setDocument(null);
    setShippingCost("");
    setLogisticsCost("");
    setImportCosts({
      ppb_permit: "", idf: "", railway_levy: "", transport_cost: "",
      clearing_agency_fee: "", other_clearing_cost: "", certificate_of_conformity: "",
      sgs_listing_approval: "", vat_on_clearing: "", vat_on_product: "",
      import_duty: "", excise_duty: "", fob_price: "",
    });
    setItems([]);
    setProductSearchQuery("");
    setSelectedProductForVariant(null);
    setShowVariantModal(false);
    setShowCreateProductModal(false);
    setReceipt(null);
  };

  const loadReceipt = async () => {
    if (!productReceipt) return;

    setLoading(true);
    try {
      const response = await getProductReceipt(productReceipt.id);
      const receiptData = response.receipt;
      setReceipt(receiptData);
      
      setReferenceNumber(receiptData.reference_number || "");
      setDocumentType(receiptData.document_type || "");
      setSupplierId(receiptData.supplier_id || "");
      setStoreId(receiptData.store_id || "");
      setShippingCost(receiptData.shipping_cost !== undefined && receiptData.shipping_cost !== null ? String(receiptData.shipping_cost) : "");
      setLogisticsCost(receiptData.logistics_cost !== undefined && receiptData.logistics_cost !== null ? String(receiptData.logistics_cost) : "");

      const icFields = [
        'ppb_permit', 'idf', 'railway_levy', 'transport_cost',
        'clearing_agency_fee', 'other_clearing_cost', 'certificate_of_conformity',
        'sgs_listing_approval', 'vat_on_clearing', 'vat_on_product',
        'import_duty', 'excise_duty', 'fob_price',
      ];
      const loadedCosts: Record<string, string> = {};
      for (const f of icFields) {
        const v = (receiptData as any)[f];
        loadedCosts[f] = v !== undefined && v !== null && Number(v) !== 0 ? String(v) : "";
      }
      setImportCosts(loadedCosts);

      // Convert existing items to the correct format
      const convertedItems: ProductReceiptItem[] = receiptData.product_receipt_items?.map((item, index) => ({
        id: item.id || `existing-${index}`,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price.toString()),
        expiry_date: item.expiry_date,
        notes: item.notes,
        product: item.product as any,
        variant: item.variant,
      })) || [];
      
      setItems(convertedItems);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load receipt details.",
        variant: "destructive",
      });
      console.error('Error loading receipt:', error);
    } finally {
      setLoading(false);
    }
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
        description: "Failed to load suppliers",
        variant: "destructive",
      });
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data } = await getProducts(1, 1000);
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

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    };
    setItems([...items, newItem]);
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const updateItem = (itemId: string, field: keyof ProductReceiptItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        
        if (field === "product_id") {
          const product = products.find(p => p.id === value);
          updatedItem.product = product;
          updatedItem.variant_id = null;
          updatedItem.variant = null;
          if (product) {
            updatedItem.unit_price = parseFloat(String(product.price || 0));
          }
        }
        
        if (field === "variant_id" && value) {
          const product = updatedItem.product;
          if (product && product.variants) {
            const variant = product.variants.find((v: any) => v.id === value);
            if (variant) {
              updatedItem.variant = variant;
              updatedItem.unit_price = parseFloat(String(variant.price || product.price || 0));
            }
          }
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const addProductToItems = (product: Product, variant?: ProductVariant) => {
    const existingItem = items.find(item => 
      item.product_id === product.id && 
      item.variant_id === (variant?.id || null)
    );
    
    if (existingItem) {
      updateItem(existingItem.id, "quantity", existingItem.quantity + 1);
    } else {
      const newItem: ProductReceiptItem = {
        id: Date.now().toString(),
        product_id: product.id,
        variant_id: variant?.id || null,
        quantity: 1,
        unit_price: parseFloat(String(variant?.price || product.price || 0)),
        expiry_date: null,
        notes: null,
        product: product,
        variant: variant,
      };
      setItems([...items, newItem]);
    }
    setProductSearchQuery("");
    setShowProductDropdown(false);
  };

  const handleProductClick = (product: Product) => {
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
    setShowCreateProductModal(true);
  };

  const handleProductCreated = async () => {
    try {
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

    for (const item of items) {
      if (!item.product_id || item.product_id === "select-product") {
        toast({
          title: "Validation Error",
          description: "All items must have a product selected",
          variant: "destructive",
        });
        return false;
      }
      
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
    }

    return true;
  };

  async function onSubmit(data: ProductReceiptFormValues) {
    if (!productReceipt) return;
    
    // Check update permission
    if (!hasPermission("can_update_product_receipts") && !isAdmin()) {
      toast({
        title: "Access Denied",
        description: "You do not have permission to update product receipts.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplier_id: data.supplier_id || null,
        contractor_id: null,
        document_type: data.document_type,
        reference_number: data.reference_number.trim(),
        store_id: data.store_id,
        shipping_cost: 0,
        logistics_cost: 0,
        ...Object.fromEntries(
          Object.entries(importCosts).map(([k, v]) => [k, parseFloat(v) || 0])
        ),
        items: items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          expiry_date: item.expiry_date,
          notes: item.notes,
        })),
        document: document,
      };

      const result = await updateProductReceiptFull(productReceipt.id, payload);

      toast({
        title: "Success! ✅",
        description: "Product receipt updated successfully",
      });

      if (result.pricing_warnings && result.pricing_warnings.length > 0) {
        toast({
          title: "Pricing needs review",
          description: result.pricing_warnings.join(" "),
          variant: "destructive",
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update product receipt",
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

  if (!productReceipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product Receipt</DialogTitle>
          <DialogDescription>
            Update the product receipt details
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Check if user has permission to edit before showing form */}
            {hasPermission("can_update_product_receipts") || isAdmin() ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="referenceNumber">Reference Number *</Label>
                    <Input
                      id="referenceNumber"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g., DOC-REF-001"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="documentType">Document Type</Label>
                    <Select value={documentType} onValueChange={setDocumentType} disabled={isSubmitting}>
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

                {/* Parties Involved */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-green-600" />
                      Supplier (Optional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplier">Supplier</Label>
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
                  </CardContent>
                </Card>

                {/* Import Cost Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Import Cost Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(importCostLabels).map(([field, label]) => (
                        <div key={field} className="space-y-1">
                          <Label className="text-sm">{label}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={importCosts[field]}
                            onChange={(e) => updateImportCost(field, e.target.value)}
                            placeholder="0.00"
                            disabled={isSubmitting}
                            className="h-9"
                          />
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center pt-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Overall Import Cost</div>
                        {totalItemsCount > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Cost per item: {formatCurrency(costPerItem)} ({totalItemsCount} items)
                          </div>
                        )}
                      </div>
                      <div className="text-xl font-bold text-blue-600">
                        {formatCurrency(totalImportCost)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

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

                    {/* Bulk price setter — one row per product that has multiple sizes/lines */}
                    {(() => {
                      const groups = new Map<string, { name: string; count: number }>();
                      items.forEach((item) => {
                        if (!item.product_id) return;
                        const existing = groups.get(item.product_id);
                        if (existing) {
                          existing.count++;
                        } else {
                          groups.set(item.product_id, {
                            name: item.product?.name || products.find(p => p.id === item.product_id)?.name || "Unknown",
                            count: 1,
                          });
                        }
                      });
                      const multiSizeProducts = [...groups.entries()].filter(([, g]) => g.count > 1);
                      if (multiSizeProducts.length === 0) return null;

                      return (
                        <div className="space-y-2">
                          {multiSizeProducts.map(([productId, group]) => (
                            <div key={productId} className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-2.5">
                              <Label className="text-sm font-medium text-blue-800 truncate min-w-0 flex-1">
                                Set price for {group.name} ({group.count} sizes)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Unit price"
                                className="h-9 w-32 bg-white shrink-0"
                                defaultValue={items.find(i => i.product_id === productId)?.unit_price || ""}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const price = parseFloat((e.target as HTMLInputElement).value);
                                    if (!isNaN(price) && price >= 0) {
                                      const updated = items.map(item =>
                                        item.product_id === productId ? { ...item, unit_price: price } : item
                                      );
                                      setItems(updated);
                                      toast({ title: "Price updated", description: `Set ${formatCurrency(price)} on ${group.count} sizes.` });
                                    }
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0"
                                onClick={(e) => {
                                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                  const price = parseFloat(input?.value);
                                  if (!isNaN(price) && price >= 0) {
                                    const updated = items.map(item =>
                                      item.product_id === productId ? { ...item, unit_price: price } : item
                                    );
                                    setItems(updated);
                                    toast({ title: "Price updated", description: `Set ${formatCurrency(price)} on ${group.count} sizes.` });
                                  }
                                }}
                              >
                                Apply
                              </Button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

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
                              disabled={isSubmitting}
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
                              
                              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                <div className="space-y-2 md:col-span-2 lg:col-span-2">
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
                                        className="w-full justify-between font-normal h-10 overflow-hidden"
                                        disabled={isSubmitting}
                                      >
                                        <span className="truncate flex-1 text-left">
                                          {item.product_id ? products.find((product) => product.id === item.product_id)?.name : "Select product"}
                                        </span>
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
                                  <div className="space-y-2 md:col-span-1 lg:col-span-1">
                                    <Label className="text-sm font-medium">Variant *</Label>
                                    <Select
                                      value={item.variant_id || "select-variant"}
                                      onValueChange={(value) => updateItem(item.id, "variant_id", value)}
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
                                
                                <div className="space-y-2 md:col-span-1 lg:col-span-1">
                                  <Label className="text-sm font-medium">Qty *</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                                    disabled={isSubmitting}
                                    className="h-10"
                                  />
                                </div>

                                <div className="space-y-2 md:col-span-1 lg:col-span-1">
                                  <Label className="text-sm font-medium">Unit Price</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unit_price}
                                    onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
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
                              
                              {/* Item Total + Landed Cost */}
                              <div className="flex justify-between items-end pt-3 border-t border-gray-100">
                                <div>
                                  <div className="text-sm text-gray-500">Buying Total</div>
                                  <div className="text-base font-semibold text-gray-700">
                                    {formatCurrency(item.quantity * item.unit_price)}
                                  </div>
                                </div>
                                {costPerItem > 0 && (
                                  <div className="text-right">
                                    <div className="text-sm text-gray-500">Landed Cost / Unit</div>
                                    <div className="text-lg font-bold text-green-600">
                                      {formatCurrency(Math.round((item.unit_price + costPerItem) * 100) / 100)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          {/* Add Item Button after cards */}
                          <div className="flex justify-center pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={addItem}
                              disabled={isSubmitting}
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
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200 space-y-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">Receipt Summary</h3>
                            <div className="text-sm text-gray-600">
                              {items.length} {items.length === 1 ? 'item' : 'items'} &bull; Total Quantity: {totalItemsCount} units
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 mb-1">Buying Value</div>
                            <div className="text-xl font-bold text-gray-700">
                              {formatCurrency(totalValue)}
                            </div>
                          </div>
                        </div>
                        {totalImportCost > 0 && (
                          <>
                            <Separator />
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-gray-500">Import Cost</div>
                                <div className="font-semibold">{formatCurrency(totalImportCost)}</div>
                              </div>
                              <div>
                                <div className="text-gray-500">Import / Unit</div>
                                <div className="font-semibold">{formatCurrency(costPerItem)}</div>
                              </div>
                              <div>
                                <div className="text-gray-500">Total (Buying + Import)</div>
                                <div className="text-lg font-bold text-green-600">
                                  {formatCurrency(totalValue + totalImportCost)}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
                <p className="text-muted-foreground">
                  You do not have permission to edit product receipts. 
                  Please contact your administrator for access.
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}