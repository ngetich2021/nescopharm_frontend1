import apiCall from "./api"

export interface Store {
  id: string
  name: string
  company_id: string
  address?: string
  phone?: string
  email?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StoreResponse {
  status: string
  stores: Store[]
  message?: string
}

/**
 * Fetches all stores for the current user's company
 * @returns Promise<Store[]> Array of stores
 */
export async function getStores(): Promise<Store[]> {
  try {
    const response = await apiCall<StoreResponse>("/stores", "GET", undefined, true)

    if (response.status === "success" && response.stores) {
      return response.stores
    } else {
      const errorMessage = typeof response.message === "string" ? response.message : "Failed to fetch stores"
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch stores: ${error.message || "Unknown error"}`)
  }
}

/**
 * Fetches a store by its ID
 * @param storeId The ID of the store to fetch
 * @returns Promise<Store> The store or null if not found
 */
export async function getStoreById(storeId: string): Promise<Store | null> {
  try {
    const response = await apiCall<{ status: string; store: Store; message?: string }>(`/stores/${storeId}`, "GET", undefined, true)

    if (response.status === "success" && response.store) {
      return response.store
    } else {
      return null
    }
  } catch (error: any) {
    return null
  }
}

/**
 * Gets stores from localStorage if available and valid, otherwise fetches from API and caches them.
 * @param companyId The company ID to use for cache key specificity
 * @returns Promise<Store[]> Array of stores
 */
export async function getCachedStores(companyId?: string): Promise<Store[]> {
  if (typeof window === 'undefined') {
    // SSR fallback
    return await getStores();
  }
  
  // Create company-specific cache keys
  const cacheKey = companyId ? `stores_${companyId}` : 'stores';
  const timestampKey = companyId ? `stores_timestamp_${companyId}` : 'stores_timestamp';
  
  // Check if user changed (forcing refresh for new user)
  const userChanged = localStorage.getItem("user_changed") === "true";
  const forceRefresh = localStorage.getItem("force_store_refresh") === "true";
  
  if (userChanged || forceRefresh) {
    // Clear flags and force fetch
    localStorage.removeItem("user_changed");
    localStorage.removeItem("force_store_refresh");
    
    // Clear existing cache for this company
    if (companyId) {
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(timestampKey);
    }
    
    // Fetch fresh data
    const stores = await getStores();
    localStorage.setItem(cacheKey, JSON.stringify(stores));
    localStorage.setItem(timestampKey, Date.now().toString());
    return stores;
  }
  
  const cached = localStorage.getItem(cacheKey);
  const timestamp = localStorage.getItem(timestampKey);
  const now = Date.now();
  
  if (cached && timestamp) {
    try {
      const ts = parseInt(timestamp, 10);
      // Cache valid for 24 hours
      if (!isNaN(ts) && now - ts < 86400000) {
        return JSON.parse(cached);
      }
    } catch {}
  }
  
  // Fetch from API and cache
  const stores = await getStores();
  localStorage.setItem(cacheKey, JSON.stringify(stores));
  localStorage.setItem(timestampKey, now.toString());
  return stores;
}

/**
 * Clears all store caches from localStorage
 * Useful when a user logs out or switches companies
 */
export function clearStoreCache(companyId?: string): void {
  if (typeof window === 'undefined') return;
  
  if (companyId) {
    // Clear specific company cache
    localStorage.removeItem(`stores_${companyId}`);
    localStorage.removeItem(`stores_timestamp_${companyId}`);
  } else {
    // Clear all store-related cache items
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('stores') || key === 'selectedStore') {
        localStorage.removeItem(key);
      }
    });
  }
}

/**
 * Forces a refresh of store data by clearing the cache and re-fetching
 * @param companyId Optional company ID to force refresh for specific company
 */
export function forceRefreshStores(companyId?: string): void {
  if (typeof window === 'undefined') return;
  
  clearStoreCache(companyId);
  // Set a flag to indicate stores should be refreshed
  localStorage.setItem("force_store_refresh", "true");
}