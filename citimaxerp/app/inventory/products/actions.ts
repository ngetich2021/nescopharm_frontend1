"use server"

import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import apiCall from "@/lib/api"
import { getApiUrl } from "@/lib/config"
import type { ProductCategory } from "@/lib/product-categories"
import type { Product, ProductData } from "@/lib/products"

// Define product types based on API response
interface ProductStore {
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

interface ProductCompany {
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

interface ProductVariant {
  name: string
  sku: string
  price: number
  cost: number
  stock_quantity: number
  is_active: boolean
  options?: string[]
  images: string[]
  attributes: Record<string, string | string[]>
  store_id?: string
}

interface Dimensions {
  length: string
  width: string
  height: string
}

// Helper function to get token from cookies for server actions
async function getTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value || null
    return token
  } catch (error) {
    return null
  }
}

// Helper function to get user data from cookies
async function getUserFromCookies(): Promise<any | null> {
  try {
    const cookieStore = await cookies()
    const userData = cookieStore.get("user")?.value || null
    if (userData) {
      return JSON.parse(userData)
    }
    return null
  } catch (error) {
    return null
  }
}

// Fallback function to get token from headers
async function getTokenFromHeaders(): Promise<string | null> {
  try {
    const headersList = await headers()
    const authHeader = headersList.get("authorization")
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7)
      return token
    }
    return null
  } catch (error) {
    return null
  }
}

// Server-side API call function that uses cookies for authentication
async function serverApiCall<T>(
  path: string,
  method: string,
  body?: object | FormData,
): Promise<T> {
  let token = await getTokenFromCookies()
  
  // Fallback to headers if cookies don't have the token
  if (!token) {
    token = await getTokenFromHeaders()
  }
  
  if (!token) {
    throw new Error("Authentication required, but no token found")
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  }

  const isFormData = body instanceof FormData

  if (!isFormData) {
    headers["Content-Type"] = "application/json"
  }

  const config: RequestInit = {
    method,
    headers,
  }

  if (body) {
    if (isFormData) {
      config.body = body
    } else {
      config.body = JSON.stringify(body)
    }
  }

  const BASE_URL = getApiUrl()
  
  try {
    const response = await fetch(`${BASE_URL}${path}`, config)
    // Check Content-Type before parsing
    const contentType = response.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
      const text = await response.text()
      throw new Error(
        `Server returned a non-JSON response. This may indicate a server error, a misconfigured endpoint, or a session timeout.\n\nResponse snippet: ${text.slice(0, 200)}`
      )
    }
    const data = await response.json()

    if (!response.ok || (data && data.status === "failed")) {
      const errorMessage =
        typeof data.message === "string"
          ? data.message
          : Object.values(data.message || {})
              .flat()
              .join(", ") || "An unknown API error occurred."

      throw new Error(`API Error: ${errorMessage}`)
    }

    return data as T
  } catch (error: any) {
    throw new Error(`Network or API call failed: ${error.message}`)
  }
}

/**
 * Creates a product using server action with user context and data transformation
 * @param productData The data for the new product
 * @returns Promise<{success: boolean, data?: any, message?: string}> Result of the operation
 */
export async function createProduct(productData: ProductData) {
  try {
    // Get user data to extract company_id
    const user = await getUserFromCookies()
    if (!user) {
      throw new Error("User data not found")
    }

    const companyId = user.company?.id

    if (!companyId) {
      throw new Error("Company ID not found in user data")
    }

    // Use the provided store_id or fallback to company_id
    const storeId = productData.store_id || companyId

    // Defensive: ensure arrays for images, tags, variants/variations (permanent fix)
    const imagesInput = productData.images as unknown as string[] | string | undefined;
    const safeImages: string[] = Array.isArray(imagesInput)
      ? imagesInput.filter(Boolean)
      : (typeof imagesInput === "string" && imagesInput.length > 0
          ? [imagesInput]
          : []);
    let safeTags: string[] = [];
    if (Array.isArray(productData.tags)) {
      safeTags = productData.tags.filter(Boolean);
    } else if (typeof productData.tags === 'string') {
      safeTags = (productData.tags as string).split(',').map((t: string) => t.trim()).filter(Boolean);
    } else {
      safeTags = [];
    }
    // Accept both 'variants' and 'variations' as possible keys from import
    const safeVariants = Array.isArray((productData as any).variants)
      ? (productData as any).variants
      : Array.isArray((productData as any).variations)
        ? (productData as any).variations
        : [];
    // Always ensure these fields are arrays for the payload
    const primaryImageIndex =
      typeof productData.primaryImageIndex === "number" && !isNaN(productData.primaryImageIndex) && productData.primaryImageIndex >= 0 && productData.primaryImageIndex < (safeImages?.length || 0)
        ? productData.primaryImageIndex
        : 0

    const payload = {
      company_id: companyId,
      store_id: storeId,
      name: productData.name.trim(),
      description: productData.description || null,
      short_description: productData.description ? productData.description.substring(0, 100) : null,
      product_code: productData.product_code || null,
      // category optional
      category: productData.category || null,
      sku: productData.sku?.trim() || null,
      barcode: productData.barcode?.trim() || null,
      brand: productData.brand?.trim() || null,
      supplier: productData.supplier?.trim() || null,
      unit_of_measurement: productData.unit_of_measurement || "piece",
      is_active: productData.isActive,
      is_featured: productData.is_featured || false,
      is_digital: productData.is_digital || false,
      track_inventory: productData.trackInventory,
      weight: productData.weight || null,
      length: productData.dimensions.length ? Number.parseFloat(productData.dimensions.length) : null,
      width: productData.dimensions.width ? Number.parseFloat(productData.dimensions.width) : null,
      height: productData.dimensions.height ? Number.parseFloat(productData.dimensions.height) : null,
      shipping_class: productData.shippingClass || null,
      image_url: safeImages.length > 0 && safeImages[primaryImageIndex] ? safeImages[primaryImageIndex] : null,
      images: safeImages,
      primary_image_index: primaryImageIndex,
      has_variations: productData.hasVariations,
      tags: safeTags,
      on_hand: productData.on_hand || 0,
      allocated: productData.allocated || 0,
      stock_quantity: productData.stock,
      low_stock_threshold: productData.lowStockThreshold,
      price: productData.price,
      unit_cost: productData.cost,
      last_price: productData.last_price || null,
      variations: Array.isArray(safeVariants) ? safeVariants.map(variant => ({
        ...variant,
        price: variant.price,
        cost: variant.cost,
        stock_quantity: variant.stock_quantity,
        on_hand: variant.on_hand || variant.stock_quantity,
        allocated: variant.allocated || 0,
      })) : [],
    }

    const product = await serverApiCall<{ id: string }>("/products", "POST", payload)

    revalidatePath("/inventory")

    return {
      success: true,
      data: product,
      message: "Product created successfully.",
    }
  } catch (error: any) {
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