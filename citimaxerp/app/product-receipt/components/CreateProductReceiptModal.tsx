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
import { getReceivablePurchaseOrders, itemLabel, type PurchaseOrder } from "@/lib/purchaseorders";
import { 
  Package, 
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
  ChevronsUpDown,
  Download
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PRODUCT_RECEIPT_SCHEMA_KEY,
  downloadTemplate,
  fetchImportSchema,
  parseProductReceiptSheet,
} from "@/lib/data-import";
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
  // Set when the line is receiving against a purchase order line.
  purchase_order_item_id?: string | null;
}

interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  cost?: number;
  stock_quantity: number;
}

interface CreateProductReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  // Opens the receipt already filled from this purchase order.
  initialPurchaseOrderId?: string | null;
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
  initialPurchaseOrderId,
}: CreateProductReceiptModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Purchase order this delivery is against
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>("");
  const [poSearchOpen, setPoSearchOpen] = useState(false);
  const [loadingPurchaseOrders, setLoadingPurchaseOrders] = useState(false);
  const selectedPurchaseOrder = purchaseOrders.find((po) => po.id === purchaseOrderId) || null;
  const poLines = React.useMemo(
    () => new Map((selectedPurchaseOrder?.items || []).map((line) => [line.id as string, line])),
    [selectedPurchaseOrder]
  );

  // Form state
  const [referenceNumber, setReferenceNumber] = useState("");
  const [documentType, setDocumentType] = useState("receipt");
  const [supplierId, setSupplierId] = useState<string>("");
  const [storeId, setStoreId] = useState<string>("");
  const [document, setDocument] = useState<File | null>(null);
  const [shippingCost, setShippingCost] = useState<string>("");
  const [logisticsCost, setLogisticsCost] = useState<string>("");

  // Import cost breakdown fields
  const [importCosts, setImportCosts] = useState<Record<string, string>>({
    ppb_permit: "",
    idf: "",
    railway_levy: "",
    transport_cost: "",
    clearing_agency_fee: "",
    other_clearing_cost: "",
    certificate_of_conformity: "",
    sgs_listing_approval: "",
    vat_on_clearing: "",
    vat_on_product: "",
    import_duty: "",
    excise_duty: "",
    fob_price: "",
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

  // Data arrays
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [items, setItems] = useState<ProductReceiptItem[]>([]);

  const totalImportCost = Object.values(importCosts).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );
  const totalItems = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const costPerItem = totalItems > 0 ? Math.round((totalImportCost / totalItems) * 100) / 100 : 0;

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

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProblems, setImportProblems] = useState<{ row: number; message: string }[]>([]);

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
      loadPurchaseOrders(initialPurchaseOrderId);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPurchaseOrderId]);

  const loadPurchaseOrders = async (applyId?: string | null) => {
    setLoadingPurchaseOrders(true);
    try {
      const list = await getReceivablePurchaseOrders();
      setPurchaseOrders(list);
      const po = applyId ? list.find((p) => p.id === applyId) : null;
      if (po) applyPurchaseOrder(po);
      else if (applyId) {
        toast({ title: "Purchase order not open", description: "It may be unapproved, cancelled or already fully received.", variant: "destructive" });
      }
    } catch {
      // Receipts can still be recorded without a purchase order.
      setPurchaseOrders([]);
    } finally {
      setLoadingPurchaseOrders(false);
    }
  };

  // Fill the receipt with the order's outstanding lines; staff then adjust to what actually arrived.
  const applyPurchaseOrder = (po: PurchaseOrder | null) => {
    setPurchaseOrderId(po?.id ?? "");
    setImportProblems([]);
    if (!po) {
      setItems([]);
      form.setValue("items", []);
      return;
    }
    if (po.supplier_id) setSupplierId(po.supplier_id);
    if (po.store_id) {
      setStoreId(po.store_id);
      form.setValue("store_id", po.store_id);
    }
    const stamp = Date.now();
    const lines: ProductReceiptItem[] = po.items
      .filter((line) => (line.pending_quantity ?? 0) > 0)
      .map((line, index) => ({
        id: `${stamp}-${index}`,
        product_id: line.product_id,
        variant_id: line.variant_id ?? null,
        quantity: line.pending_quantity ?? 0,
        unit_price: Number(line.unit_price) || 0,
        expiry_date: null,
        notes: null,
        product: line.product,
        variant: line.variant,
        enable_batch_tracking: true,
        purchase_order_item_id: line.id ?? null,
      }));
    setItems(lines);
    form.setValue("items", lines);
  };

  // A PO line can arrive in several batches: add another receipt line for it.
  const splitBatch = (itemId: string) => {
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) return;
    const source = items[index];
    const lineId = source.purchase_order_item_id as string;
    // Starts with whatever the earlier batches leave; if they still cover everything, it starts at 0
    // and fills in as soon as an earlier batch is lowered.
    const remaining = Math.max(0, (poLines.get(lineId)?.pending_quantity ?? 0) - receivingForLine(lineId));
    const siblings = items.filter((i) => i.purchase_order_item_id === lineId);
    const insertAt = items.findIndex((i) => i.id === siblings[siblings.length - 1].id) + 1;
    const copy: ProductReceiptItem = {
      ...source,
      id: `${Date.now()}-split`,
      quantity: remaining,
      enable_batch_tracking: true,
      batch_number: "",
      lot_number: "",
      manufacture_date: "",
      expiry_date: null,
      individual_serials: undefined,
    };
    const next = [...items.slice(0, insertAt), copy, ...items.slice(insertAt)];
    setItems(next);
    form.setValue("items", next);
  };

  // Quantity on this receipt for a PO line, summed over its batch lines.
  const receivingForLine = (lineId: string) =>
    items.filter((i) => i.purchase_order_item_id === lineId).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  // With an order chosen the sheet comes out already listing its outstanding lines, so the delivery
  // is edited rather than typed from nothing; without one it is just the blank format.
  const handleTemplate = async () => {
    try {
      const schema = await fetchImportSchema(PRODUCT_RECEIPT_SCHEMA_KEY);
      const outstanding = (selectedPurchaseOrder?.items ?? []).filter((l) => (l.pending_quantity ?? 0) > 0);
      downloadTemplate(schema, {
        rows: outstanding.map((line) => ({
          item_name: itemLabel(line),
          quantity: line.pending_quantity ?? 0,
          unit_price: Number(line.unit_price) || 0,
        })),
        fileName: selectedPurchaseOrder ? `receipt-${selectedPurchaseOrder.order_number}.xlsx` : undefined,
      });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not build the template.", variant: "destructive" });
    }
  };

  // The sheet is the delivery, so it replaces the lines prefilled from the order: anything it
  // doesn't mention didn't arrive and stays outstanding. Nothing is saved until Save is pressed.
  const handleSheet = async (file: File) => {
    if (!purchaseOrderId) return;
    setImporting(true);
    try {
      const { header, lines: parsed, problems } = await parseProductReceiptSheet(file, purchaseOrderId);
      const stamp = Date.now();
      const next: ProductReceiptItem[] = parsed.map((l, index) => {
        const poLine = selectedPurchaseOrder?.items.find((i) => i.id === l.purchase_order_item_id);
        return {
          id: `${stamp}-x-${index}`,
          product_id: l.product_id,
          variant_id: l.variant_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          expiry_date: l.expiry_date,
          notes: l.notes,
          product: poLine?.product,
          variant: poLine?.variant,
          enable_batch_tracking: true,
          batch_number: l.batch_number ?? "",
          lot_number: l.lot_number ?? "",
          manufacture_date: l.manufacture_date ?? "",
          purchase_order_item_id: l.purchase_order_item_id,
        };
      });
      setItems(next);
      form.setValue("items", next as any);

      if (header.reference_number) {
        setReferenceNumber(header.reference_number);
        form.setValue("reference_number", header.reference_number);
      }
      if (header.shipping_cost !== null) setShippingCost(String(header.shipping_cost));
      if (header.logistics_cost !== null) setLogisticsCost(String(header.logistics_cost));

      setImportProblems(problems);
      setImportOpen(false);
      toast({
        title: `${next.length} line${next.length === 1 ? "" : "s"} loaded`,
        description: problems.length
          ? `${problems.length} row${problems.length === 1 ? "" : "s"} need a look - see the note above the items.`
          : "Check the delivery and save when you're happy with it.",
      });
    } catch (e) {
      toast({ title: "Could not read the sheet", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    form.reset({
      reference_number: "",
      store_id: "",
      document_type: "receipt",
      items: [],
    });
    setReferenceNumber("");
    setDocumentType("receipt");
    setPurchaseOrderId("");
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

  const removeItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    setItems(updatedItems);
    form.setValue("items", updatedItems);
  };

  const resizeSerials = (item: ProductReceiptItem, qty: number): ProductReceiptItem => {
    if (item.individual_serials === undefined) return { ...item, quantity: qty };
    const serials = item.individual_serials;
    return {
      ...item,
      quantity: qty,
      individual_serials: qty > serials.length ? [...serials, ...Array(qty - serials.length).fill("")] : serials.slice(0, qty),
    };
  };

  // A PO line's batch lines share its outstanding quantity: a batch can't take more than what the
  // others leave, and the last batch line soaks up the remainder when an earlier one changes.
  const updateBatchQuantity = (itemId: string, rawQty: number) => {
    const item = items.find((i) => i.id === itemId);
    const lineId = item?.purchase_order_item_id;
    const outstanding = lineId ? poLines.get(lineId)?.pending_quantity ?? 0 : 0;
    if (!item || !lineId) return;

    const siblings = items.filter((i) => i.purchase_order_item_id === lineId);
    const last = siblings[siblings.length - 1];
    const othersExceptLast = siblings
      .filter((i) => i.id !== itemId && i.id !== last.id)
      .reduce((s, i) => s + (Number(i.quantity) || 0), 0);

    let qty = Math.max(0, Math.floor(rawQty) || 0);
    const editingLast = last.id === itemId;
    // When an earlier batch changes, the last batch is the one that gives way.
    const cap = outstanding - othersExceptLast;
    if (qty > cap) {
      toast({
        title: "More than ordered",
        description: `Only ${Math.max(0, cap)} left to receive on this order line. Raise a new purchase order for the extra ${qty - Math.max(0, cap)}.`,
        variant: "destructive",
      });
      qty = Math.max(0, cap);
    }

    const next = items.map((i) => {
      if (i.id === itemId) return resizeSerials(i, qty);
      if (!editingLast && i.id === last.id) return resizeSerials(i, Math.max(0, outstanding - othersExceptLast - qty));
      return i;
    });
    setItems(next);
    form.setValue("items", next);
  };

  const updateItem = (itemId: string, field: keyof ProductReceiptItem, value: any) => {
    if (field === "quantity" && items.find((i) => i.id === itemId)?.purchase_order_item_id) {
      updateBatchQuantity(itemId, Number(value));
      return;
    }
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        
        // If product_id changed, update product reference and reset variant
        if (field === "product_id") {
          const product = products.find(p => p.id === value);
          updatedItem.product = product;
          updatedItem.variant_id = null;
          updatedItem.variant = null;
          updatedItem.purchase_order_item_id = null;
          // Receipts value stock at cost; selling prices live in the price lists.
          if (product) {
            updatedItem.unit_price = parseFloat((product.unit_cost || product.price || 0).toString());
          }
          // Initialize individual_serials array with empty strings when quantity changes
          if (updatedItem.quantity && updatedItem.individual_serials !== undefined) {
            updatedItem.individual_serials = Array(updatedItem.quantity).fill("");
          }
        }
        
        // If variant_id changed, update variant reference and price
        if (field === "variant_id" && value) {
          if (value !== item.variant_id) updatedItem.purchase_order_item_id = null;
          const product = updatedItem.product;
          if (product && product.variants) {
            const variant = product.variants.find((v: any) => v.id === value);
            if (variant) {
              updatedItem.variant = variant;
              if (!item.purchase_order_item_id) {
                updatedItem.unit_price = parseFloat((Number(variant.cost) || product.unit_cost || 0).toString());
              }
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
        unit_price: parseFloat((Number(variant?.cost) || product.unit_cost || product.price || 0).toString()),
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

    if (!purchaseOrderId) {
      toast({
        title: "Validation Error",
        description: "Select the purchase order this delivery is for. Stock can only be received against an approved purchase order.",
        variant: "destructive",
      });
      return false;
    }

    if (items.length === 0 || items.every((i) => !i.quantity)) {
      toast({
        title: "Validation Error",
        description: "Enter the quantity received for at least one line",
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
        contractor_id: null,
        document_type: documentType,
        reference_number: referenceNumber.trim(),
        store_id: storeId,
        shipping_cost: 0,
        logistics_cost: 0,
        ...Object.fromEntries(
          Object.entries(importCosts).map(([k, v]) => [k, parseFloat(v) || 0])
        ),
        purchase_order_id: purchaseOrderId || null,
        // Lines left at 0 didn't arrive in this delivery and stay outstanding on the order.
        items: items.filter((item) => item.quantity > 0).map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          purchase_order_item_id: purchaseOrderId ? item.purchase_order_item_id || null : null,
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
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <Label>Purchase order *</Label>
                  <Popover open={poSearchOpen} onOpenChange={setPoSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal bg-background"
                        disabled={isSubmitting || loadingPurchaseOrders}
                      >
                        <span className="truncate">
                          {selectedPurchaseOrder
                            ? `${selectedPurchaseOrder.order_number} · ${selectedPurchaseOrder.supplier?.name || ""}`
                            : loadingPurchaseOrders
                              ? "Loading open purchase orders..."
                              : purchaseOrders.length === 0
                                ? "No approved purchase orders awaiting goods"
                                : "Select the purchase order this delivery is for"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search PO number or supplier..." />
                        <CommandList>
                          <CommandEmpty>No approved purchase orders awaiting goods.</CommandEmpty>
                          <CommandGroup>
                            {purchaseOrders.map((po) => {
                              const outstanding = po.items.reduce((s, l) => s + (l.pending_quantity ?? 0), 0);
                              return (
                                <CommandItem
                                  key={po.id}
                                  value={`${po.order_number} ${po.supplier?.name || ""}`}
                                  onSelect={() => { applyPurchaseOrder(po); setPoSearchOpen(false); }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", purchaseOrderId === po.id ? "opacity-100" : "opacity-0")} />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{po.order_number} · {po.supplier?.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {po.items.length} lines · {outstanding} units outstanding{po.status === "partial" ? " · partly received" : ""}
                                    </span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Only items on the order can be received, up to what is still outstanding; anything extra needs a new purchase order. Use "Split batch" when one line came in several batches: the last batch takes whatever the earlier ones leave.
                  </p>
                </div>

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
                        {totalItems > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Cost per item: {formatCurrency(costPerItem)} ({totalItems} items)
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
                        <Button type="button" variant="ghost" size="sm" onClick={handleTemplate}>
                          <Download className="mr-2 h-4 w-4" />
                          {purchaseOrderId ? "Download order as Excel" : "Excel template"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!purchaseOrderId}
                          title={purchaseOrderId ? undefined : "Pick the purchase order first"}
                          onClick={() => setImportOpen(true)}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Import from Excel
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {importProblems.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                        <div className="flex items-center gap-2 font-medium text-amber-900">
                          <AlertCircle className="h-4 w-4" />
                          {importProblems.length} row{importProblems.length !== 1 ? "s" : ""} from the sheet need a look
                        </div>
                        <ul className="mt-2 space-y-1 text-amber-800">
                          {importProblems.map((p, i) => (
                            <li key={i}>Row {p.row}: {p.message}</li>
                          ))}
                        </ul>
                        <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-amber-900" onClick={() => setImportProblems([])}>
                          Dismiss
                        </Button>
                      </div>
                    )}

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
                                      form.setValue("items", updated);
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
                                    form.setValue("items", updated);
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
                          <h3 className="font-medium text-gray-900 mb-2">No items yet</h3>
                          <p className="text-sm">Pick the purchase order above. Only items on the order can be received; anything extra needs a new purchase order.</p>
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
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => splitBatch(item.id)}
                                    disabled={isSubmitting || !item.product_id}
                                    title="Add another batch line for this item"
                                  >
                                    <Layers className="h-4 w-4 mr-1" />
                                    Split batch
                                  </Button>
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
                              </div>

                              {(() => {
                                const line = item.purchase_order_item_id ? poLines.get(item.purchase_order_item_id) : undefined;
                                if (!line) return null;
                                const outstanding = line.pending_quantity ?? 0;
                                const receiving = receivingForLine(line.id as string);
                                return (
                                  <div className="rounded-md px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1 bg-muted/50 text-muted-foreground">
                                    <span>{selectedPurchaseOrder?.order_number}: {itemLabel(line)}</span>
                                    <span>Ordered {line.quantity}</span>
                                    <span>Received before {line.received_quantity || 0}</span>
                                    <span>Outstanding {outstanding}</span>
                                    <span className="font-medium text-foreground">Receiving now {receiving}</span>
                                    <span>Still to come {Math.max(0, outstanding - receiving)}</span>
                                  </div>
                                );
                              })()}
                              
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
                                        disabled={isSubmitting || !!item.purchase_order_item_id}
                                      >
                                        <span className="truncate flex-1 text-left">
                                          {item.product_id ? (item.product?.name || products.find((product) => product.id === item.product_id)?.name) : "Select product"}
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
                                  <div className="space-y-2 md:col-span-1 lg:col-span-1">
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
                                      disabled={isSubmitting || !!item.purchase_order_item_id}
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

                                <div className="space-y-2 md:col-span-1 lg:col-span-1">
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
                              {items.length} {items.length === 1 ? 'item' : 'items'} &bull; Total Quantity: {totalItems} units
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

        <Dialog open={importOpen} onOpenChange={(next) => !importing && setImportOpen(next)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import from Excel</DialogTitle>
              <DialogDescription>
                Download {selectedPurchaseOrder?.order_number ?? "the order"} as Excel and it comes out already listing
                what is still outstanding. Change the quantities to what actually arrived, add batch numbers and expiry
                dates, delete any line that didn&apos;t come, then upload it here. Two rows for the same item become two
                batch lines. Nothing is saved until you press Create Receipt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleSheet(file);
                }}
              />
              {importing && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reading the sheet...
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleTemplate} disabled={importing}>
                <Download className="mr-2 h-4 w-4" />
                {purchaseOrderId ? "Download order as Excel" : "Download template"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}