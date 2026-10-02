import type { ReactNode } from "react"
import apiCall from "./api"
import type { ProductCategory } from "./product-categories"
import { getApiUrl } from "@/lib/config"

/**
 * Reads a File as a base64 data URI so it can be sent to the backend in a JSON payload
 * and actually persisted (the backend decodes and stores data: URIs; it rejects blob: URLs).
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Define product types based on API response
export interface ProductStore {
  id: string
  company_id: string
  name: string
  description?: string | null
  store_code?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  manager_name?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductCompany {
  id: string
  name: string
  description?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  website?: string | null
  logo_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  is_first_time: boolean
  current_subscription_id?: string | null
}

export interface PackagingUnit {
  id?: string
  company_id?: string
  product_id?: string
  unit_name: string
  unit_abbreviation: string
  description?: string | null
  base_unit_quantity: number | string
  is_base_unit: boolean
  is_sellable?: boolean
  is_purchasable?: boolean
  is_active?: boolean
  price_per_unit?: number | string | null
  cost_per_unit?: number | string | null
  barcode?: string | null
  display_order?: number
  weight?: number | string | null
  length?: number | string | null
  width?: number | string | null
  height?: number | string | null
  created_at?: string
  updated_at?: string
  // Hierarchical packaging fields
  parent_unit_reference?: string | null
  units_per_parent?: number | null
}

export interface ProductVariant {
  damaged: number
  on_hold: number
  id: number
  allocated: number
  on_hand: number
  name: string
  sku: string
  price: number
  cost: number
  stock_quantity: number
  is_active: boolean
  options?: string[]
  images: string[]
  image_urls?: string[] // Full URLs for variant images
  primary_image_url?: string // Full URL for primary variant image
  attributes: Record<string, string | string[]>
  store_id?: string
  price_tiers?: PriceTierInput[]
}

export interface Dimensions {
  length: string
  width: string
  height: string
}

export interface PriceTierInput {
  id?: string
  tier_name: string
  price: number
}

export interface ProductData {
  name: string
  description?: string
  category?: string // now optional and stored as category id or name depending on backend
  category_id?: string | null // optional category ID for direct category reference
  brand?: string
  supplier?: string
  tags: string[]
  price: number
  cost: number
  shipping_cost?: number
  logistics_cost?: number
  margin_amount?: number
  price_tiers?: PriceTierInput[]
  last_price?: number
  sku?: string
  barcode?: string
  unit_of_measurement?: string
  stock: number
  lowStockThreshold: number
  trackInventory: boolean
  isActive: boolean
  weight?: number
  dimensions: Dimensions
  shippingClass?: string
  images: string[]
  primaryImageIndex: number
  hasVariations: boolean
  variants: ProductVariant[]
  store_id?: string
  product_code?: string
  is_featured?: boolean
  is_digital?: boolean
  on_hand?: number
  allocated?: number
  // Tax fields
  is_taxable?: boolean
  tax_rate?: number
  hs_code?: string
  // Packaging fields
  has_packaging?: boolean
  base_unit?: string
  packaging_units?: PackagingUnit[]
}

export interface ProductSupplier {
  id: string
  company_id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  contact_person?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  company_id: string
  store_id: string
  name: string
  description?: string | null
  short_description?: string | null
  price: string
  unit_cost: string
  shipping_cost?: string | number | null
  logistics_cost?: string | number | null
  margin_amount?: string | number | null
  minimum_valid_price?: string | number | null
  price_tiers?: PriceTierInput[]
  last_price: string | null
  stock_quantity: number
  low_stock_threshold: number
  category?: ProductCategory | null
  sku?: string | null
  barcode?: string | null
  brand?: string | null
  supplier?: string | ProductSupplier | null
  unit_of_measurement?: string | null
  is_active: boolean
  is_featured: boolean
  is_digital: boolean
  track_inventory: boolean
  // Tax fields
  is_taxable?: boolean
  tax_rate?: number | string | null
  hs_code?: string | null
  weight?: string | null
  length?: string | null
  width?: string | null
  height?: string | null
  shipping_class?: string | null
  image_url?: string | null
  images: any[]
  image_urls?: string[] // Full URLs for product images
  primary_image_url?: string // Full URL for primary product image
  primary_image_index: number
  has_variations: boolean
  tags: any[]
  created_at: string
  updated_at: string
  on_hand: number
  allocated: number
  category_id?: string | null
  expiry_date?: string | null
  on_hold: number
  damaged: number
  inventory_status: string
  product_number?: string | null
  supplier_id?: string | null
  product_code?: string | null
  store: ProductStore
  company: ProductCompany
  variants: ProductVariant[]
  // Packaging fields
  has_packaging?: boolean
  base_unit?: string | null
  packaging_units?: PackagingUnit[]
}

export interface ProductSummary {
  totalProducts: number
  activeProducts: number
  totalValue: number
  lowStockProducts: number
}

// New interface for API product summary response
export interface ApiProductSummary {
  status: string
  message: string
  data: {
    overview: {
      total_products: number
      active_products: number
      inactive_products: number
      featured_products: number
      digital_products: number
      products_with_variations: number
      recently_added: number
    }
    inventory: {
      low_stock_products: number
      out_of_stock_products: number
      total_inventory_value: number
      total_potential_value: number
      potential_profit: number
    }
    categories: {
      top_categories: {
        category_name: string
        product_count: number
      }[]
      categories_count: number
    }
    filters: {
      store_id: string | null
      company_id: string
    }
    generated_at: string
  }
}

export interface ProductResponse {
  status: "success" | "failed"
  message: string
  data: {
    current_page: number
    data: Product[]
    first_page_url: string
    from: number
    last_page: number
    last_page_url: string
    links: {
      url: string | null
      label: string
      active: boolean
    }[]
    next_page_url: string | null
    path: string
    per_page: number
    prev_page_url: string | null
    to: number
    total: number
  }
}

/**
 * Fetches products from the API with pagination support
 * @param page Page number (default: 1)
 * @param pageSize Number of items per page (default: 20)
 * @param filters Optional filters for search, status, category
 * @returns Promise<{data: Product[], count: number, pagination: object}> Array of products, total count, and pagination info
 */
export async function getProducts(
  page = 1,
  pageSize = 20,
  filters: {
    search?: string
    status?: string
    category?: string
  } = {}
): Promise<{ data: Product[]; count: number; pagination?: { current_page: number, per_page: number, total: number, last_page: number } }> {
  try {
    // Build query parameters
    const queryParams = new URLSearchParams()
    queryParams.append('page', page.toString())
    queryParams.append('per_page', pageSize.toString())

    if (filters.search) queryParams.append('search', filters.search)
    if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status)
    if (filters.category && filters.category !== 'all') queryParams.append('category', filters.category)

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''

    const response = await apiCall<ProductResponse>(`/products${queryString}`, "GET", undefined, true)

    // Handle the response structure
    if (response.status === "success" && response.data && Array.isArray(response.data.data)) {
      const productsArray = response.data.data;
      const totalCount = response.data.total;

      const processedProducts = productsArray.map((product: any) => ({
        ...product,
        price: product.price || "0.00",
        unit_cost: product.unit_cost || "0.00",
        stock_quantity: Number(product.stock_quantity || 0),
        low_stock_threshold: Number(product.low_stock_threshold || 10),
        image_url: product.image_url || null,
        images: Array.isArray(product.images) ? product.images : [],
        image_urls: Array.isArray(product.image_urls) ? product.image_urls : [],
        primary_image_url: product.primary_image_url || null,
        is_active: Boolean(product.is_active),
        is_featured: Boolean(product.is_featured),
        is_digital: Boolean(product.is_digital),
        track_inventory: Boolean(product.track_inventory),
        has_variations: Boolean(product.has_variations),
        tags: Array.isArray(product.tags) ? product.tags : [],
        on_hand: Number(product.on_hand || 0),
        allocated: Number(product.allocated || 0),
        on_hold: Number(product.on_hold || 0),
        damaged: Number(product.damaged || 0),
        // Process variants to include image URLs
        variants: Array.isArray(product.variants) ? product.variants.map((variant: any) => ({
          ...variant,
          images: Array.isArray(variant.images) ? variant.images : [],
          image_urls: Array.isArray(variant.image_urls) ? variant.image_urls : [],
          primary_image_url: variant.primary_image_url || null,
        })) : [],
        // Packaging fields
        has_packaging: Boolean(product.has_packaging),
        base_unit: product.base_unit || null,
        packaging_units: (() => {
          if (Array.isArray(product.packaging_units)) return product.packaging_units;
          if (typeof product.packaging_units === 'string') {
            try {
              const parsed = JSON.parse(product.packaging_units);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        })(),
      }));

      return {
        data: processedProducts,
        count: totalCount,
        pagination: {
          current_page: response.data.current_page,
          per_page: response.data.per_page,
          total: response.data.total,
          last_page: response.data.last_page
        }
      };
    } else {
      throw new Error("Unexpected API response structure")
    }
  } catch (error: any) {
    // Enhanced error logging with full context
    console.error("Error fetching products:", {
      endpoint: '/products',
      page,
      pageSize,
      filters,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Provide more user-friendly error messages
    if (error.message && error.message.includes("You are not logged in")) {
      throw new Error("You are not logged in. Please sign in and try again.")
    }

    if (error.message && error.message.includes("Failed to fetch")) {
      throw new Error("Unable to connect to the server. Please check your internet connection and try again.")
    }

    // Check for database errors
    if (error.message && (
      error.message.includes("database") ||
      error.message.includes("transaction") ||
      error.message.includes("prepared statement")
    )) {
      throw new Error("Database connection issue. The server is experiencing temporary difficulties. Please try again in a moment.")
    }

    throw new Error(`Failed to fetch products: ${error.message || "Unknown error"}`)
  }
}

/**
 * Fetches a product by its ID
 * @param productId The ID of the product to fetch
 * @returns Promise<Product> The product or null if not found
 */
export async function getProductById(productId: string): Promise<any> {
  try {
    const response = await apiCall<{ status: string; data?: Product; product?: Product; message?: string }>(`/products/${productId}`, "GET", undefined, true)

    // Handle both "data" and "product" keys in response
    const productData = (response as any).product || response.data

    if (response.status === "success" && productData) {
      let product = productData as any
      // Remove any quote or quote_items associations if present (type-safe)
      if ('quote' in product || 'quote_items' in product) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { quote, quote_items, ...cleanProduct } = product
        product = cleanProduct
      }

      // Debug logging to trace image data
      console.log('getProductById - Raw API product data:', {
        primary_image_url: product.primary_image_url,
        image_urls: product.image_urls,
        image_url: product.image_url,
        images: product.images,
      })

      const processedProduct = {
        ...product,
        price: product.price || "0.00",
        unit_cost: product.unit_cost || "0.00",
        stock_quantity: Number(product.stock_quantity || 0),
        low_stock_threshold: Number(product.low_stock_threshold || 10),
        image_url: product.image_url || null,
        images: Array.isArray(product.images) ? product.images : [],
        image_urls: Array.isArray(product.image_urls) ? product.image_urls : [],
        primary_image_url: product.primary_image_url || null,
        is_active: Boolean(product.is_active),
        is_featured: Boolean(product.is_featured),
        is_digital: Boolean(product.is_digital),
        track_inventory: Boolean(product.track_inventory),
        has_variations: Boolean(product.has_variations),
        tags: Array.isArray(product.tags) ? product.tags : [],
        on_hand: Number(product.on_hand || 0),
        allocated: Number(product.allocated || 0),
        on_hold: Number(product.on_hold || 0),
        damaged: Number(product.damaged || 0),
        // Process variants to include image URLs
        variants: Array.isArray(product.variants) ? product.variants.map((variant: any) => ({
          ...variant,
          images: Array.isArray(variant.images) ? variant.images : [],
          image_urls: Array.isArray(variant.image_urls) ? variant.image_urls : [],
          primary_image_url: variant.primary_image_url || null,
        })) : [],
        // Packaging fields - explicitly include them
        has_packaging: Boolean(product.has_packaging),
        base_unit: product.base_unit || null,
        packaging_units: Array.isArray(product.packaging_units) ? product.packaging_units : [],
      }

      console.log('getProductById - Processed product data:', {
        primary_image_url: processedProduct.primary_image_url,
        image_urls: processedProduct.image_urls,
        image_url: processedProduct.image_url,
        images: processedProduct.images,
      })

      return {
        status: "success",
        data: processedProduct,
      }
    } else {
      return {
        status: "error",
        message: typeof response.message === "string" ? response.message : "Failed to fetch product",
      }
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch product: ${error.message || "Unknown error"}`)
  }
}

/**
 * Deletes a product
 * @param productId The ID of the product to delete
 * @returns Promise<boolean> True if deletion was successful
 */
export async function deleteProduct(productId: string): Promise<boolean> {
  try {
    const response = await apiCall<{ status: string; message?: string }>(`/products/${productId}`, "DELETE", undefined, true)

    if (response.status === "success") {
      return true
    } else {
      const errorMessage = typeof response.message === "string" ? response.message : "Failed to delete product"
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    throw new Error(`Failed to delete product: ${error.message || "Unknown error"}`)
  }
}

/**
 * Creates a product using direct API call
 * @param productData The data for the new product
 * @returns Promise<{success: boolean, data?: any, message?: string}> Result of the operation
 */
export async function createProduct(productData: ProductData) {
  try {
    // Prepare the payload for the API call
    const payload = {
      name: productData.name.trim(),
      description: productData.description || null,
      short_description: productData.description ? productData.description.substring(0, 100) : null,
      product_code: productData.product_code || null,
      category: productData.category || null,
      category_id: productData.category_id || null,
      sku: productData.sku?.trim() || null,
      barcode: productData.barcode?.trim() || null,
      brand: productData.brand?.trim() || null,
      supplier: productData.supplier?.trim() || null,
      unit_of_measurement: productData.unit_of_measurement || "piece",
      is_active: productData.isActive,
      is_featured: productData.is_featured || false,
      is_digital: productData.is_digital || false,
      track_inventory: productData.trackInventory,
      // Tax fields
      is_taxable: productData.is_taxable !== undefined ? productData.is_taxable : true,
      tax_rate: productData.tax_rate || null,
      hs_code: productData.hs_code?.trim() || null,
      weight: productData.weight || null,
      length: productData.dimensions.length ? Number.parseFloat(productData.dimensions.length) : null,
      width: productData.dimensions.width ? Number.parseFloat(productData.dimensions.width) : null,
      height: productData.dimensions.height ? Number.parseFloat(productData.dimensions.height) : null,
      shipping_class: productData.shippingClass || null,
      image_url: productData.images.length > 0 ? productData.images[productData.primaryImageIndex] : null,
      images: productData.images,
      primary_image_index: productData.primaryImageIndex,
      has_variations: productData.hasVariations,
      tags: Array.isArray(productData.tags) ? productData.tags.filter(Boolean) : [],
      on_hand: productData.on_hand || 0,
      allocated: productData.allocated || 0,
      stock_quantity: productData.stock,
      low_stock_threshold: productData.lowStockThreshold,
      price: productData.price,
      unit_cost: productData.cost,
      shipping_cost: productData.shipping_cost || 0,
      logistics_cost: productData.logistics_cost || 0,
      margin_amount: productData.margin_amount || 0,
      price_tiers: Array.isArray(productData.price_tiers)
        ? productData.price_tiers.filter(t => t.tier_name?.trim()).map(t => ({ tier_name: t.tier_name.trim(), price: t.price }))
        : [],
      last_price: productData.last_price || null,
      store_id: productData.store_id,
      // Packaging fields
      has_packaging: productData.has_packaging || false,
      base_unit: productData.base_unit || null,
      packaging_units: productData.has_packaging && Array.isArray(productData.packaging_units)
        ? productData.packaging_units.map(unit => ({
          unit_name: unit.unit_name,
          unit_abbreviation: unit.unit_abbreviation,
          base_unit_quantity: unit.base_unit_quantity,
          is_base_unit: unit.is_base_unit,
          is_sellable: unit.is_sellable !== undefined ? unit.is_sellable : true,
          is_purchasable: unit.is_purchasable !== undefined ? unit.is_purchasable : true,
          is_active: unit.is_active !== undefined ? unit.is_active : true,
          price_per_unit: unit.price_per_unit || null,
          cost_per_unit: unit.cost_per_unit || null,
          barcode: unit.barcode || null,
          display_order: unit.display_order || 0
        }))
        : [],
      variations: Array.isArray(productData.variants) ? productData.variants.map(variant => ({
        name: variant.name,
        sku: variant.sku,
        price: variant.price,
        cost: variant.cost,
        stock_quantity: variant.stock_quantity,
        is_active: variant.is_active,
        options: variant.options || [],
        images: variant.images,
        store_id: variant.store_id,
        allocated: variant.allocated,
        on_hand: variant.on_hand,
        attributes: variant.attributes,
        price_tiers: (variant.price_tiers ?? []).filter(t => t.tier_name?.trim() && t.price > 0).map(t => ({ tier_name: t.tier_name.trim(), price: t.price })),
      })) : [],
    }

    // Add debug logging
    console.log('API payload being sent:', JSON.stringify(payload, null, 2))
    console.log('Has variations in payload:', payload.has_variations)
    console.log('Number of variations in payload:', payload.variations.length)
    console.log('Has packaging in payload:', payload.has_packaging)
    console.log('Number of packaging units in payload:', payload.packaging_units.length)

    if (payload.has_variations && payload.variations.length > 0) {
      console.log('Variations data:', JSON.stringify(payload.variations, null, 2))

      // Log the structure of the first variation to check if it matches expected format
      console.log('First variation structure:', {
        name: typeof payload.variations[0].name,
        sku: typeof payload.variations[0].sku,
        price: typeof payload.variations[0].price,
        cost: typeof payload.variations[0].cost,
        stock_quantity: typeof payload.variations[0].stock_quantity,
        is_active: typeof payload.variations[0].is_active,
        options: Array.isArray(payload.variations[0].options) ? payload.variations[0].options : 'Not an array',
        images: Array.isArray(payload.variations[0].images) ? payload.variations[0].images : 'Not an array',
        store_id: typeof payload.variations[0].store_id,
        allocated: typeof payload.variations[0].allocated,
        on_hand: typeof payload.variations[0].on_hand,
        attributes: typeof payload.variations[0].attributes
      });
    }

    if (payload.has_packaging && payload.packaging_units.length > 0) {
      console.log('Packaging units data:', JSON.stringify(payload.packaging_units, null, 2))
    }

    const response = await apiCall<{ status: string; data: { id: string }; message?: string }>(
      "/products",
      "POST",
      payload,
      true
    )

    console.log('API response received:', response)

    // Check if response indicates success
    if (response.status === "success") {
      console.log('Product created successfully with ID:', response.data?.id)
      return {
        success: true,
        data: response.data,
        message: "Product created successfully.",
      }
    } else {
      // Handle error cases
      const errorMessage = response.message || "Failed to create product.";
      console.error('Product creation failed:', errorMessage)
      return {
        success: false,
        message: typeof errorMessage === "string" ? errorMessage : "Failed to create product.",
      }
    }
  } catch (error: any) {
    console.error('Exception in createProduct:', error)
    return {
      success: false,
      message: error.message || "Failed to create product.",
    }
  }
}

/**
 * Bulk creates products by sending them to the backend /products/bulk endpoint
 * @param products Array of product objects to create
 * @returns Promise<any> Backend response (success/failure summary)
 */
export async function createProductsBulk(products: any[]): Promise<any> {
  try {
    const response = await apiCall("/products/bulk", "POST", { products }, true)
    return response
  } catch (error: any) {
    throw new Error(error.message || "Bulk product creation failed")
  }
}

export async function updateProduct(productId: string, productData: any): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  const url = `${baseUrl}/products/${productId}`;

  // Get token from localStorage
  let token: string | null = null;
  if (typeof window !== "undefined") {
    const tokenData = localStorage.getItem("auth_token_data");
    if (tokenData) {
      try {
        const parsed = JSON.parse(tokenData);
        token = parsed.token;
      } catch {
        token = localStorage.getItem("token");
      }
    } else {
      token = localStorage.getItem("token");
    }
  }

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(productData),
    });

    const responseText = await response.text();

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return {
        status: "error",
        message: `Server returned non-JSON response: ${responseText.substring(0, 200)}`,
      };
    }

    if (!response.ok) {
      const errorMessage = typeof data.message === 'string'
        ? data.message
        : (data.message ? Object.values(data.message).flat().join(', ') : 'Unknown error');
      return {
        status: "error",
        message: errorMessage,
      };
    }

    return data;
  } catch (error: any) {
    console.error('Update product fetch error:', error);
    return {
      status: "error",
      message: `Failed to update product: ${error.message || "Unknown error"}`,
    };
  }
}

/**
 * Fetches product summary from the API
 * @returns Promise<ApiProductSummary> Product summary data from API
 */
export async function getProductSummary(): Promise<ApiProductSummary> {
  try {
    const response = await apiCall<ApiProductSummary>("/products/summary", "GET", undefined, true)
    return response
  } catch (error: any) {
    // Enhanced error logging with full context
    console.error("Error fetching product summary:", {
      endpoint: '/products/summary',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Check for database errors
    if (error.message && (
      error.message.includes("database") ||
      error.message.includes("transaction") ||
      error.message.includes("prepared statement")
    )) {
      throw new Error("Database connection issue. The summary service is temporarily unavailable. Showing calculated summary instead.")
    }

    throw new Error(`Failed to fetch product summary: ${error.message || "Unknown error"}`)
  }
}

/**
 * Calculates summary data for products
 * @param products Array of products
 * @returns ProductSummary Object with summary data
 */
export function calculateProductSummary(products: Product[]): ProductSummary {
  // Handle case where products might be undefined or null
  if (!products || !Array.isArray(products)) {
    return {
      totalProducts: 0,
      activeProducts: 0,
      totalValue: 0,
      lowStockProducts: 0,
    };
  }

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.is_active).length;

  // Safely calculate total value
  let totalValue = 0;
  try {
    totalValue = products.reduce((sum, p) => {
      const price = parseFloat(p.price || "0");
      const quantity = Number(p.stock_quantity || 0);
      return sum + (price * quantity);
    }, 0);
  } catch (error) {
    console.warn("Error calculating total product value:", error);
    totalValue = 0;
  }

  const lowStockProducts = products.filter((p) => {
    const stockQuantity = Number(p.stock_quantity || 0);
    const lowStockThreshold = Number(p.low_stock_threshold || 10);
    return stockQuantity <= lowStockThreshold;
  }).length;

  return {
    totalProducts,
    activeProducts,
    totalValue,
    lowStockProducts,
  };
}