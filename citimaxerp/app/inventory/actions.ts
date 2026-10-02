"use server"

import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import apiCall from "@/lib/api"
import { getApiUrl } from "@/lib/config"

export interface ProductVariant {
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

export interface Dimensions {
  length: string
  width: string
  height: string
}

export interface ProductData {
  name: string
  description?: string
  category?: string // now optional and stored as category id or name depending on backend
  brand?: string
  supplier?: string
  tags: string[]
  price: number
  cost: number
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
  // category_id removed in favor of category (optional)
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

export async function debugToken() {
  try {
    const cookieToken = await getTokenFromCookies()
    const headerToken = await getTokenFromHeaders()
    
    return {
      success: true,
      cookieToken: cookieToken ? "Found" : "Not found",
      headerToken: headerToken ? "Found" : "Not found",
      message: "Token debug info"
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Debug failed"
    }
  }
}

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
      short_description: null,
      // category optional
      category: productData.category || null,
      sku: productData.sku?.trim() || null,
      barcode: productData.barcode?.trim() || null,
      brand: productData.brand?.trim() || null,
      supplier: productData.supplier?.trim() || null,
      unit_of_measurement: productData.unit_of_measurement || "pcs",
      is_active: productData.isActive,
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
      variations: Array.isArray(safeVariants) ? safeVariants : [],
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
