import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, PlusCircle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getCachedStores, type Store } from "@/lib/stores";
import { getProductCategories, createProductCategory, type ProductCategory } from "@/lib/product-categories"
import { getSuppliers, createSupplier, type Supplier } from "@/lib/suppliers"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { Upload, ImageIcon, Star } from "lucide-react";
import { updateProduct } from "@/lib/products";
import { useToast } from "@/hooks/use-toast";

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onSuccess?: () => void;
}

interface ValidationErrors {
  name?: string;
  price?: string;
  sku?: string;
  store?: string;
}

// Helper function to validate UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export function EditProductModal({ isOpen, onClose, product, onSuccess }: EditProductModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentTab, setCurrentTab] = useState("basic");
  const [errors, setErrors] = useState<ValidationErrors>({})

  // Category creation states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState("#6B7280")
  const [newCategoryActive, setNewCategoryActive] = useState(true)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)

  // Supplier creation states
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierEmail, setNewSupplierEmail] = useState("")
  const [newSupplierPhone, setNewSupplierPhone] = useState("")
  const [newSupplierAddress, setNewSupplierAddress] = useState("")
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)

  // Basic info state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [supplier, setSupplier] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isActive, setIsActive] = useState(true);
  // Pricing state
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [lastPrice, setLastPrice] = useState("");
  const [unitOfMeasurement, setUnitOfMeasurement] = useState("pcs");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  // Shipping state
  const [weight, setWeight] = useState("")
  const [dimensions, setDimensions] = useState({ length: "", width: "", height: "" })
  const [shippingClass, setShippingClass] = useState("")
  // Inventory state
  const [trackInventory, setTrackInventory] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [stock, setStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");

  // Variants state
  const [hasVariations, setHasVariations] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);

  // Images state
  const [images, setImages] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Categories state
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false)
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("")
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false)

  // Units of measurement
  const unitsOfMeasurement = [
    "pcs", "kg", "g", "lb", "oz", "liter", "ml", "m", "cm", "ft", "inch",
    "box", "pack", "pair", "set", "dozen", "roll", "bottle", "can", "bag", "carton"
  ]

  // Shipping classes
  const shippingClasses = ["standard", "express", "overnight", "free", "heavy", "fragile"]

  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStores();
      loadCategories();
      loadSuppliers();
    }
  }, [isOpen]);

  const loadStores = async () => {
    setIsLoadingStores(true);
    try {
      const storesData = await getCachedStores();
      setStores(storesData);
      if (storesData.length > 0 && !selectedStoreId) {
        setSelectedStoreId(storesData[0].id);
      }
    } catch (error: any) {
      // Optionally handle error
    } finally {
      setIsLoadingStores(false);
    }
  };

  const loadCategories = async () => {
    setIsLoadingCategories(true)
    try {
      const data = await getProductCategories()
      setCategories(data)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load categories"
      toast({
        title: "Error loading categories",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const loadSuppliers = async () => {
    setIsLoadingSuppliers(true)
    try {
      const data = await getSuppliers()
      setSuppliers(data)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load suppliers"
      toast({
        title: "Error loading suppliers",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoadingSuppliers(false)
    }
  }

  useEffect(() => {
    if (isOpen && product) {
      setName(product.name || "");
      setCategory(product.category_id || (typeof product.category === 'string' ? product.category : (product.category as any)?.id) || "");
      setDescription(product.description || "");
      setBrand(product.brand || "");
      setSupplier(product.supplier || "");
      setTags(Array.isArray(product.tags) ? product.tags : typeof product.tags === "string" ? product.tags.split(",").map((t: string) => t.trim()) : []);
      setIsActive(product.is_active ?? true);
      setPrice(product.price?.toString() || "");
      setCost(product.unit_cost?.toString() || "");
      setLastPrice(product.last_price?.toString() || "");
      setUnitOfMeasurement(product.unit_of_measurement || "pcs");
      setSku(product.sku || "");
      setBarcode(product.barcode || "");
      setWeight(product.weight?.toString() || "");
      setDimensions({
        length: product.length?.toString() || "",
        width: product.width?.toString() || "",
        height: product.height?.toString() || ""
      });
      setShippingClass(product.shipping_class || "");
      setTrackInventory(product.track_inventory ?? true);
      setSelectedStoreId(product.store_id || "");
      setStock(product.stock_quantity?.toString() || "");
      setLowStockThreshold(product.low_stock_threshold?.toString() || "");
      // Support both 'variations' and 'variants' keys
      const variantArray = Array.isArray(product.variations) && product.variations.length > 0
        ? product.variations
        : (Array.isArray(product.variants) ? product.variants : []);
      const mappedVariants = variantArray.map((v: any, idx: number) => ({
        id: v.id || v.sku || String(idx),
        name: v.name || "",
        sku: v.sku || "",
        price: v.price !== undefined ? String(v.price) : "",
        cost: v.cost !== undefined ? String(v.cost) : "",
        stock_quantity: v.stock_quantity !== undefined ? String(v.stock_quantity) : "",
        is_active: v.is_active !== undefined ? v.is_active : true,
        options: Array.isArray(v.options) ? v.options : [],
        option_stocks: Array.isArray(v.option_stocks) ? v.option_stocks : (v.options ? v.options.map((opt: string) => ({ option: opt, stock: "" })) : []),
        images: Array.isArray(v.images) ? v.images : [],
        // Handle both array and object formats for attributes
        attributes: Array.isArray(v.attributes) ? v.attributes : 
                   (typeof v.attributes === 'object' && v.attributes !== null ? 
                    Object.entries(v.attributes).map(([key, value]) => ({ key, value: String(value) })) : []),
        store_id: v.store_id || product.store_id || "",
        // Additional fields from API documentation
        weight: v.weight ? String(v.weight) : "",
        allocated: v.allocated !== undefined ? String(v.allocated) : "",
        on_hand: v.on_hand !== undefined ? String(v.on_hand) : "",
      }));
      setHasVariations(!!product.has_variations);
      setVariants(mappedVariants);
      // Robustly fetch images: support array, string, or image_url fallback
      let initialImages: string[] = [];
      if (Array.isArray(product.images) && product.images.length > 0) {
        initialImages = product.images.filter((img: any) => typeof img === 'string' && img.trim() !== '');
      } else if (product.image_url && typeof product.image_url === 'string' && product.image_url.trim() !== '') {
        initialImages = [product.image_url];
      } else if (typeof product.images === 'string' && product.images.trim() !== '') {
        initialImages = [product.images];
      }
      setImages(initialImages);
      setPrimaryImageIndex(product.primary_image_index || 0);
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return

    setIsCreatingCategory(true)
    try {
      await createProductCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim(),
        color: newCategoryColor,
        is_active: newCategoryActive,
      })

      toast({
        title: "Success",
        description: "Category created successfully",
      })

      // Reset form
      setNewCategoryName("")
      setNewCategoryDescription("")
      setNewCategoryColor("#6B7280")
      setNewCategoryActive(true)
      setIsCategoryModalOpen(false)

      // Reload categories
      loadCategories()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create category"
      toast({
        title: "Error creating category",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsCreatingCategory(false)
    }
  }

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return

    setIsCreatingSupplier(true)
    try {
      const supplier = await createSupplier({
        name: newSupplierName.trim(),
        email: newSupplierEmail.trim() || undefined,
        phone: newSupplierPhone.trim() || undefined,
        address: newSupplierAddress.trim() || undefined,
      })

      setSuppliers((prev) => [supplier, ...prev])
      setSupplier(supplier.id)
      toast({ 
        title: "Supplier Created", 
        description: "New supplier added successfully." 
      })
      setIsSupplierModalOpen(false)
      setNewSupplierName("")
      setNewSupplierEmail("")
      setNewSupplierPhone("")
      setNewSupplierAddress("")
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create supplier"
      toast({
        title: "Error creating supplier",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsCreatingSupplier(false)
    }
  }

  // Variant helpers (add, update, remove, etc.)
  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        name: "",
        sku: "",
        price: "",
        cost: "",
        stock_quantity: "",
        is_active: true,
        options: [],
        option_stocks: [],
        images: [],
        attributes: [],
        store_id: selectedStoreId,
        weight: "",
        allocated: "",
        on_hand: "",
      },
    ]);
  };
  const updateVariant = (id: string, field: string, value: any) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  };
  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  // Variant options helpers
  const addVariantOption = (variantId: string) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? { ...v, options: [...(v.options || []), ""] }
          : v
      )
    );
  };
  const updateVariantOption = (variantId: string, optionIndex: number, value: string) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              options: (v.options || []).map((opt: string, idx: number) =>
                idx === optionIndex ? value : opt
              ),
            }
          : v
      )
    );
  };
  const removeVariantOption = (variantId: string, optionIndex: number) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              options: (v.options || []).filter((_: string, idx: number) => idx !== optionIndex),
            }
          : v
      )
    );
  };

  // Variant option stock helpers
  const updateVariantOptionStock = (variantId: string, option: string, value: string) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              option_stocks: (v.option_stocks || []).map((os: any) =>
                os.option === option ? { ...os, stock: value } : os
              ),
            }
          : v
      )
    );
  };
  const removeVariantOptionStock = (variantId: string, option: string) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              option_stocks: (v.option_stocks || []).filter((os: any) => os.option !== option),
            }
          : v
      )
    );
  };

  // Variant attributes helpers
  const addVariantAttribute = (variantId: string) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? { ...v, attributes: [...(v.attributes || []), { key: "", value: "" }] }
          : v
      )
    );
  };
  const updateVariantAttribute = (variantId: string, attrIndex: number, field: string, value: string) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              attributes: (v.attributes || []).map((attr: any, idx: number) =>
                idx === attrIndex ? { ...attr, [field]: value } : attr
              ),
            }
          : v
      )
    );
  };
  const removeVariantAttribute = (variantId: string, attrIndex: number) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              attributes: (v.attributes || []).filter((_: any, idx: number) => idx !== attrIndex),
            }
          : v
      )
    );
  };


  // Variant images helpers
  const handleVariantImageUpload = (variantId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i]);
      newImages.push(url);
    }
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? { ...v, images: [...(v.images || []), ...newImages] }
          : v
      )
    );
  };
  const handleRemoveVariantImage = (variantId: string, imageIndex: number) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              images: (v.images || []).filter((_: string, idx: number) => idx !== imageIndex),
            }
          : v
      )
    );
  };

  // Image upload handlers (handleImageUpload, handleDragOver, handleDragLeave, handleDrop, handleRemoveImage, handleSetPrimaryImage)
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i]);
      newImages.push(url);
    }
    setImages((prev) => [...prev, ...newImages]);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files) return;
    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i]);
      newImages.push(url);
    }
    setImages((prev) => [...prev, ...newImages]);
  };
  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (primaryImageIndex === index) setPrimaryImageIndex(0);
    else if (primaryImageIndex > index) setPrimaryImageIndex((prev) => prev - 1);
  };
  const handleSetPrimaryImage = (index: number) => {
    setPrimaryImageIndex(index);
  };

  const handleSubmit = async () => {
    if (!product) return;
    setIsLoading(true);
    
    let payload: any = {}; // Declare payload at function scope for debugging
    let mappedVariants: any[] = []; // Declare mappedVariants at function scope for debugging
    
    try {
      // Filter out empty/incomplete variants
      const filteredVariants = variants.filter(variant => {
        // Consider a variant incomplete if it has no name, sku, or price
        return (
          (variant.name && variant.name.trim() !== "") ||
          (variant.sku && variant.sku.trim() !== "") ||
          (variant.price && !isNaN(parseFloat(variant.price)))
        );
      });
      
      // Always map variants if they exist - backend will process them if product has_variations is true
      // This ensures existing variants are updated even when loaded from the database
      mappedVariants = filteredVariants.map(variant => {
        const base = {
          store_id: variant.store_id || selectedStoreId,
          name: variant.name ? variant.name.trim() : "",
          sku: variant.sku ? variant.sku.trim() : "",
          price: variant.price && !isNaN(parseFloat(variant.price)) ? parseFloat(variant.price) : 0,
          cost: variant.cost && !isNaN(parseFloat(variant.cost)) ? parseFloat(variant.cost) : 0,
          stock_quantity: variant.stock_quantity && !isNaN(parseInt(variant.stock_quantity, 10)) ? parseInt(variant.stock_quantity, 10) : 0,
          is_active: variant.is_active !== undefined ? variant.is_active : true,
          // Convert options array to proper format for API
          options: Array.isArray(variant.options) ? variant.options.filter((opt: string) => opt && opt.trim() !== "") : [],
          // Process option_stocks for API
          option_stocks: Array.isArray(variant.option_stocks) ? variant.option_stocks.filter((os: any) => os.option && os.option.trim()) : [],
          images: Array.isArray(variant.images) ? variant.images : [],
          // Convert attributes array to key-value object as required by API
          attributes: Array.isArray(variant.attributes) && variant.attributes.length > 0
            ? variant.attributes.reduce((acc: Record<string, string | string[]>, attr: any) => {
                if (attr.key && attr.key.trim() && attr.value && attr.value.trim()) {
                  // Handle comma-separated values as arrays
                  acc[attr.key.trim()] = attr.value.includes(",")
                    ? attr.value.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0)
                    : attr.value.trim()
                }
                return acc
              }, {} as Record<string, string | string[]>)
            : {},
          // Include weight if specified
          weight: variant.weight && !isNaN(parseFloat(variant.weight)) ? parseFloat(variant.weight) : undefined,
          // Include allocated and on_hand for inventory tracking
          allocated: variant.allocated && !isNaN(parseInt(variant.allocated, 10)) ? parseInt(variant.allocated, 10) : undefined,
          on_hand: variant.on_hand && !isNaN(parseInt(variant.on_hand, 10)) ? parseInt(variant.on_hand, 10) : undefined,
        };
        
        // Only include id if it's a valid UUID for existing variants
        if (variant.id && isValidUUID(variant.id)) {
          return { ...base, id: variant.id };
        }
        // Otherwise, omit id (let backend generate for new variants)
        return base;
      });
      
      // Only send images that are real URLs (not local object URLs)
      // TODO: If you support uploading, replace object URLs with uploaded URLs before sending
      const filteredImages = (Array.isArray(images) ? images : []).filter(img => img && !img.startsWith('blob:'));
      // Ensure primaryImageIndex is valid
      let validPrimaryIndex = primaryImageIndex;
      if (filteredImages.length === 0) {
        validPrimaryIndex = 0;
      } else if (primaryImageIndex < 0 || primaryImageIndex >= filteredImages.length) {
        validPrimaryIndex = 0;
      }
      payload = {
        name: name ? name.trim() : "",
        category_id: category ? category.trim() : "",
        description: description ? description.trim() : "",
        brand: brand ? brand.trim() : "",
        supplier: supplier ? supplier.trim() : "",
        tags: Array.isArray(tags) ? tags.filter(tag => tag && tag.trim()).map(tag => tag.trim()) : [],
        is_active: isActive !== undefined ? isActive : true,
        price: price && !isNaN(parseFloat(price)) ? parseFloat(price) : 0,
        unit_cost: cost && !isNaN(parseFloat(cost)) ? parseFloat(cost) : 0,
        last_price: lastPrice && !isNaN(parseFloat(lastPrice)) ? parseFloat(lastPrice) : undefined,
        unit_of_measurement: unitOfMeasurement ? unitOfMeasurement.trim() : "pcs",
        sku: sku ? sku.trim() : "",
        barcode: barcode ? barcode.trim() : "",
        weight: weight && !isNaN(parseFloat(weight)) ? parseFloat(weight) : undefined,
        length: dimensions.length && !isNaN(parseFloat(dimensions.length)) ? parseFloat(dimensions.length) : undefined,
        width: dimensions.width && !isNaN(parseFloat(dimensions.width)) ? parseFloat(dimensions.width) : undefined,
        height: dimensions.height && !isNaN(parseFloat(dimensions.height)) ? parseFloat(dimensions.height) : undefined,
        shipping_class: shippingClass ? shippingClass.trim() : "",
        track_inventory: trackInventory !== undefined ? trackInventory : false,
        store_id: selectedStoreId || "",
        stock_quantity: stock && !isNaN(parseInt(stock, 10)) ? parseInt(stock, 10) : 0,
        low_stock_threshold: lowStockThreshold && !isNaN(parseInt(lowStockThreshold, 10)) ? parseInt(lowStockThreshold, 10) : undefined,
        has_variations: hasVariations !== undefined ? hasVariations : false,
        // Always send variations - backend will process them if product has_variations is true in DB or payload
        variations: mappedVariants,
        images: filteredImages,
        image_url: filteredImages.length > 0 ? filteredImages[validPrimaryIndex] : null,
        primary_image_index: validPrimaryIndex,
      };

      const response = await updateProduct(product.id, payload);

      // Check if the response indicates success
      if (response.status === "success") {
        toast({
          title: "Product Updated",
          description: "Product has been updated successfully",
        });

        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        // Handle error response from API
        toast({
          title: "Error updating product",
          description: response.message || "Failed to update product. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update product"
      toast({
        title: "Error updating product",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-4xl bg-white shadow-xl z-50 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Edit Product</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 h-[calc(100vh-140px)]">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5 h-9">
              <TabsTrigger value="basic" className="text-xs px-2 py-1">Basic</TabsTrigger>
              <TabsTrigger value="pricing" className="text-xs px-2 py-1">Price</TabsTrigger>
              <TabsTrigger value="inventory" className="text-xs px-2 py-1">Stock</TabsTrigger>
              <TabsTrigger value="variations" className="text-xs px-2 py-1">Options</TabsTrigger>
              <TabsTrigger value="media" className="text-xs px-2 py-1">Images</TabsTrigger>
            </TabsList>
            <TabsContent value="basic">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => {
                      setName(e.target.value)
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
                    }} 
                    placeholder="Enter product name"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category (optional)</Label>
                  <div className="flex gap-2">
                    <Select
                      value={category}
                      onValueChange={(value) => {
                        setCategory(value)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingCategories ? "Loading categories..." : "Select category (optional)"} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 && !isLoadingCategories && (
                          <div className="px-2 py-1 text-sm text-muted-foreground">No categories found</div>
                        )}
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full border"
                                style={{ backgroundColor: cat.color || '#6B7280' }}
                              />
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                        <div className="border-t my-1" />
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start text-left text-sm"
                          onClick={() => setIsCategoryModalOpen(true)}
                        >
                          <PlusCircle className="h-4 w-4 mr-2" /> Create Category
                        </Button>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter product description (optional)"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Product brand (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag (optional)"
                    onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                  />
                  <Button type="button" onClick={handleAddTag} variant="outline">
                    Add
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="isActive">Active Product</Label>
              </div>
            </TabsContent>
            <TabsContent value="pricing" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Selling Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value)
                      if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }))
                    }}
                    placeholder="0.00"
                    className={errors.price ? "border-red-500" : ""}
                  />
                  {errors.price && <p className="text-sm text-red-500">{errors.price}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost Price</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00 (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lastPrice">Last Price</Label>
                  <Input
                    id="lastPrice"
                    type="number"
                    step="0.01"
                    value={lastPrice}
                    onChange={(e) => setLastPrice(e.target.value)}
                    placeholder="0.00 (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitOfMeasurement">Unit of Measurement</Label>
                  <Select value={unitOfMeasurement} onValueChange={setUnitOfMeasurement}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit of measurement (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitsOfMeasurement.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value)
                    }}
                    placeholder="Product SKU (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Product barcode (optional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.00 (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label>Dimensions (cm)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    value={dimensions.length}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, length: e.target.value }))}
                    placeholder="Length (optional)"
                  />
                  <Input
                    type="number"
                    value={dimensions.width}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, width: e.target.value }))}
                    placeholder="Width (optional)"
                  />
                  <Input
                    type="number"
                    value={dimensions.height}
                    onChange={(e) => setDimensions((prev) => ({ ...prev, height: e.target.value }))}
                    placeholder="Height (optional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingClass">Shipping Class</Label>
                <Select value={shippingClass} onValueChange={setShippingClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shipping class (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingClasses.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="inventory" className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Switch id="trackInventory" checked={trackInventory} onCheckedChange={setTrackInventory} />
                <Label htmlFor="trackInventory">Track Inventory</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="store">Store *</Label>
                <Select 
                  value={selectedStoreId} 
                  onValueChange={(value) => {
                    setSelectedStoreId(value)
                    if (errors.store) setErrors((prev) => ({ ...prev, store: undefined }))
                  }} 
                  disabled={isLoadingStores}
                >
                  <SelectTrigger className={cn("w-full", errors.store ? "border-red-500" : "")}>
                    <SelectValue placeholder={isLoadingStores ? "Loading stores..." : "Select a store"} />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.store && <p className="text-sm text-red-500">{errors.store}</p>}
                {stores.length === 0 && !isLoadingStores && (
                  <p className="text-sm text-red-500">No stores available. Please create a store first.</p>
                )}
              </div>

              {trackInventory && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      placeholder="0 (optional)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      placeholder="10 (optional)"
                    />
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="variations" className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Variations are no longer used. Add each size or type as its own product with its own price codes.
              </p>
              {hasVariations ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Product Variants</h4>
                    <Button onClick={addVariant} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Variant
                    </Button>
                  </div>
                  {/* Variants Summary */}
                  {variants.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Variants:</span> {variants.length}
                        </div>
                        <div>
                          <span className="font-medium">Total Options:</span> {variants.reduce((total, v) => total + (v.options?.length || 0), 0)}
                        </div>
                        <div>
                          <span className="font-medium">Total Stock:</span> {variants.reduce((total, v) => total + (v.option_stocks ? v.option_stocks.reduce((s: number, os: any) => s + (parseInt(os.stock, 10) || 0), 0) : 0), 0)}
                        </div>
                      </div>
                    </div>
                  )}
                  {variants.map((variant) => (
                    <Card key={variant.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 space-y-2">
                            <Input
                              value={variant.name}
                              onChange={(e) => updateVariant(variant.id, "name", e.target.value)}
                              placeholder="Variant name (e.g., Yellow, Small)"
                              className="max-w-xs"
                            />
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Total Stock: {variant.option_stocks ? variant.option_stocks.reduce((s: number, os: any) => s + (parseInt(os.stock, 10) || 0), 0) : 0}</span>
                              {variant.store_id && (
                                <span>Store: {stores.find(s => s.id === variant.store_id)?.name || 'Unknown'}</span>
                              )}
                            </div>
                          </div>
                          <Button onClick={() => removeVariant(variant.id)} variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <Label htmlFor={`variant-price-${variant.id}`}>Price</Label>
                            <Input
                              id={`variant-price-${variant.id}`}
                              type="number"
                              step="0.01"
                              value={variant.price}
                              onChange={(e) => updateVariant(variant.id, "price", e.target.value)}
                              placeholder={price}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`variant-cost-${variant.id}`}>Cost Price</Label>
                            <Input
                              id={`variant-cost-${variant.id}`}
                              type="number"
                              step="0.01"
                              value={variant.cost}
                              onChange={(e) => updateVariant(variant.id, "cost", e.target.value)}
                              placeholder={cost}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`variant-sku-${variant.id}`}>SKU</Label>
                            <Input
                              id={`variant-sku-${variant.id}`}
                              value={variant.sku}
                              onChange={(e) => updateVariant(variant.id, "sku", e.target.value)}
                              placeholder={sku}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`variant-stock-${variant.id}`}>Stock Quantity</Label>
                            <Input
                              id={`variant-stock-${variant.id}`}
                              type="number"
                              value={variant.stock_quantity}
                              onChange={(e) => updateVariant(variant.id, "stock_quantity", e.target.value)}
                              placeholder={stock}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`variant-weight-${variant.id}`}>Weight (kg)</Label>
                            <Input
                              id={`variant-weight-${variant.id}`}
                              type="number"
                              step="0.01"
                              value={variant.weight || ""}
                              onChange={(e) => updateVariant(variant.id, "weight", e.target.value)}
                              placeholder="0.00 (optional)"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`variant-allocated-${variant.id}`}>Allocated Stock</Label>
                            <Input
                              id={`variant-allocated-${variant.id}`}
                              type="number"
                              value={variant.allocated || ""}
                              onChange={(e) => updateVariant(variant.id, "allocated", e.target.value)}
                              placeholder="0 (optional)"
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch
                            id={`variant-active-${variant.id}`}
                            checked={variant.is_active}
                            onCheckedChange={(val) => updateVariant(variant.id, "is_active", val)}
                          />
                          <Label htmlFor={`variant-active-${variant.id}`}>Active</Label>
                        </div>
                        <div className="space-y-2 mb-4">
                          <Label>Variant Options</Label>
                          <p className="text-sm text-muted-foreground">
                            Define the option types for this variant (e.g., size, color, storage). These will be used to categorize attributes.
                          </p>
                          {variant.options && variant.options.map((option: string, optionIndex: number) => {
                            const optionStock = variant.option_stocks?.find((s: any) => s.option === option)?.stock || "";
                            return (
                              <div key={optionIndex} className="space-y-2 p-3 border rounded-lg">
                                <div className="flex gap-2 items-center">
                                  <Input
                                    value={option}
                                    onChange={(e) => updateVariantOption(variant.id, optionIndex, e.target.value)}
                                    placeholder="Option type (e.g., size, color, storage)"
                                    className="flex-1"
                                  />
                                  <Input
                                    type="number"
                                    value={optionStock}
                                    onChange={(e) => updateVariantOptionStock(variant.id, option, e.target.value)}
                                    placeholder="Stock"
                                    className="w-24"
                                  />
                                  <Button
                                    onClick={() => removeVariantOption(variant.id, optionIndex)}
                                    variant="ghost"
                                    size="sm"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                          <Button onClick={() => addVariantOption(variant.id)} variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Option Type
                          </Button>
                        </div>
                        <div className="space-y-2 mb-4">
                          <Label htmlFor={`variant-store-${variant.id}`}>Store</Label>
                          <Select
                            value={variant.store_id || selectedStoreId}
                            onValueChange={(value) => updateVariant(variant.id, "store_id", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select store" />
                            </SelectTrigger>
                            <SelectContent>
                              {stores.map((store) => (
                                <SelectItem key={store.id} value={store.id}>
                                  {store.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 mb-4">
                          <Label>Variant Attributes</Label>
                          <p className="text-sm text-muted-foreground">
                            Define the specific values for this variant (e.g., Color: "Red", Size: "Large"). Use commas to separate multiple values.
                          </p>
                          {variant.attributes && variant.attributes.map((attr: any, attrIndex: number) => (
                            <div key={attrIndex} className="flex gap-2 items-center">
                              <Input
                                value={attr.key}
                                onChange={(e) => updateVariantAttribute(variant.id, attrIndex, "key", e.target.value)}
                                placeholder="Attribute Name (e.g., Color, Size, Storage)"
                                className="w-1/2"
                              />
                              <Input
                                value={attr.value}
                                onChange={(e) => updateVariantAttribute(variant.id, attrIndex, "value", e.target.value)}
                                placeholder="Value (e.g., Red, Large, or 'S,M,L' for multiple)"
                                className="w-1/2"
                              />
                              <Button
                                onClick={() => removeVariantAttribute(variant.id, attrIndex)}
                                variant="ghost"
                                size="sm"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button onClick={() => addVariantAttribute(variant.id)} variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Attribute
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label>Variant Images</Label>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleVariantImageUpload(variant.id, e)}
                          />
                          <div className="flex flex-wrap gap-2 mt-2">
                            {variant.images &&
                              variant.images.length > 0 &&
                              (variant.images as string[]).map((img: string, imgIdx: number) => (
                                <div key={imgIdx} className="relative group">
                                  <Image
                                    src={img || "/placeholder.svg"}
                                    alt={`Variant image ${imgIdx + 1}`}
                                    width={60}
                                    height={60}
                                    className="rounded border"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute -top-2 -right-2 h-5 w-5"
                                    onClick={() => handleRemoveVariantImage(variant.id, imgIdx)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </TabsContent>
            <TabsContent value="media">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Product Images</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload multiple images for your product. The first image will be used as the primary image.
                  </p>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                      isDragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400",
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("image-upload")?.click()}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <div className="flex flex-col items-center">
                      <Upload className="h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Product Images</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {isDragOver ? "Drop your images here" : "Drag and drop your images here, or click to browse"}
                      </p>
                      <Button type="button" variant="outline" onClick={(e) => e.stopPropagation()}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Choose Images
                      </Button>
                    </div>
                  </div>
                  {images.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Uploaded Images ({images.length})</h4>
                        <p className="text-sm text-muted-foreground">Click the star to set as primary image</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((image, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                              <Image
                                src={image || "/placeholder.svg"}
                                alt={`Product image ${index + 1}`}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {index === primaryImageIndex && (
                              <Badge className="absolute top-2 left-2 bg-yellow-500 text-white">
                                <Star className="h-3 w-3 mr-1 fill-current" />
                                Primary
                              </Badge>
                            )}
                            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                              <Button
                                onClick={() => handleSetPrimaryImage(index)}
                                variant="secondary"
                                size="sm"
                                className="text-xs"
                              >
                                <Star className={cn("h-3 w-3 mr-1", index === primaryImageIndex && "fill-current")} />
                                {index === primaryImageIndex ? "Primary" : "Set Primary"}
                              </Button>
                              <Button
                                onClick={() => handleRemoveImage(index)}
                                variant="destructive"
                                size="sm"
                                className="text-xs"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                              {index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {images.length === 0 && (
                    <div className="mt-4 text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No images uploaded yet</p>
                      <p className="text-sm text-gray-500">Upload at least one image to showcase your product</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Updating..." : "Update Product"}
          </Button>
        </div>
      </div>

      {/* Category Creation Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCategoryModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Create New Category</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsCategoryModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newCategoryName">Category Name *</Label>
                <Input
                  id="newCategoryName"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newCategoryDescription">Description</Label>
                <Textarea
                  id="newCategoryDescription"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="Enter category description (optional)"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newCategoryColor">Color</Label>
                <Input
                  id="newCategoryColor"
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="newCategoryActive"
                  checked={newCategoryActive}
                  onCheckedChange={setNewCategoryActive}
                />
                <Label htmlFor="newCategoryActive">Active</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateCategory} disabled={isCreatingCategory || !newCategoryName.trim()}>
                {isCreatingCategory ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Creation Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsSupplierModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Create New Supplier</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsSupplierModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newSupplierName">Supplier Name *</Label>
                <Input
                  id="newSupplierName"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Enter supplier name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newSupplierEmail">Email</Label>
                <Input
                  id="newSupplierEmail"
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  placeholder="Enter email address (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newSupplierPhone">Phone</Label>
                <Input
                  id="newSupplierPhone"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="Enter phone number (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newSupplierAddress">Address</Label>
                <Textarea
                  id="newSupplierAddress"
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  placeholder="Enter address (optional)"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setIsSupplierModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateSupplier} disabled={isCreatingSupplier || !newSupplierName.trim()}>
                {isCreatingSupplier ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 