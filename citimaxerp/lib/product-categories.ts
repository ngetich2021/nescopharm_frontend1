import apiCall from "./api"

export interface ProductCategory {
  id: string
  company_id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ListCategoriesResponse {
  status: string
  message: string
  categories: ProductCategory[]
}

interface SingleCategoryResponse {
  status: string
  message: string
  category: ProductCategory
}

interface CreateCategoryResponse extends SingleCategoryResponse {}

export interface CreateCategoryPayload {
  name: string
  description?: string
  color?: string
  is_active?: boolean
}

export async function getProductCategories(params?: {
  company_id?: string
  is_active?: boolean
  search?: string
  sort_by?: string
  sort_direction?: "asc" | "desc"
}): Promise<ProductCategory[]> {
  const query = params
    ? "?" + new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== "") acc[k] = String(v)
          return acc
        }, {} as Record<string, string>),
      ).toString()
    : ""
  const res = await apiCall<ListCategoriesResponse>(`/product-categories${query}`,'GET', undefined, true)
  if (res.status === 'success' && Array.isArray(res.categories)) return res.categories
  return []
}

export async function getProductCategory(id: string): Promise<ProductCategory | null> {
  try {
    const res = await apiCall<SingleCategoryResponse>(`/product-categories/${id}`,'GET', undefined, true)
    if (res.status === 'success' && res.category) return res.category
    return null
  } catch {
    return null
  }
}

export async function createProductCategory(payload: CreateCategoryPayload): Promise<{success: boolean; category?: ProductCategory; message?: string}> {
  try {
    const res = await apiCall<CreateCategoryResponse>('/product-categories','POST', payload, true)
    if (res.status === 'success' && res.category) {
      return { success: true, category: res.category, message: res.message }
    }
    return { success: false, message: res.message || 'Failed to create category' }
  } catch (e: any) {
    return { success: false, message: e.message || 'Failed to create category' }
  }
}
