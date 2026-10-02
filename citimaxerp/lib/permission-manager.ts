/**
 * Permission Manager
 * Handles secure storage and management of user permissions
 * Provides encryption for sensitive data and permission caching
 */

interface Permission {
  id: string;
  name: string;
  key: string;
  description: string;
  category: string;
  company_id: string;
  is_system: boolean;
  is_active: boolean;
  created_by: string;
  metadata: any[];
  created_at: string;
  updated_at: string;
  pivot: {
    role_id: string;
    permission_id: string;
    granted_by: string;
    granted_at: string;
    created_at: string;
    updated_at: string;
  };
}

// Use the same type structure as ApiUser from auth-context
export interface UserData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  email_verified: boolean;
  company: {
    id: string;
    name: string;
    is_active?: boolean;
    is_first_time?: boolean;
  };
  role: {
    id: string;
    name: string;
    description: string;
    permissions?: Permission[];
  } | null;
  created_at?: string;
  updated_at?: string;
}

interface PermissionCache {
  permissions: Permission[];
  timestamp: number;
  userId: string;
}

const USER_DATA_KEY = 'user_data';
const PERMISSION_CACHE_KEY = 'permission_cache';
const PERMISSION_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Simple encryption using base64 encoding
 * Note: This is obfuscation, not real encryption. For production, consider using a proper encryption library.
 * Real security comes from backend validation, not client-side encryption.
 */
function obfuscate(data: string): string {
  try {
    return btoa(encodeURIComponent(data));
  } catch {
    return data;
  }
}

/**
 * Simple decryption
 */
function deobfuscate(data: string): string {
  try {
    return decodeURIComponent(atob(data));
  } catch {
    return data;
  }
}

/**
 * Store user data securely
 */
export function storeUserData(userData: UserData): void {
  if (typeof window === 'undefined') return;
  
  try {
    const userDataStr = JSON.stringify(userData);
    const obfuscatedData = obfuscate(userDataStr);
    
    // Store obfuscated data
    localStorage.setItem(USER_DATA_KEY, obfuscatedData);
    
    // Also store plain version for backward compatibility (will be removed later)
    localStorage.setItem('user', userDataStr);
    
    // Cache permissions separately for quick access
    if (userData.role?.permissions) {
      cachePermissions(userData.role.permissions, userData.id);
    }
    
    // Set cookie with user data (not obfuscated for server actions)
    document.cookie = `user=${userDataStr}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict`;
  } catch (error) {
    console.error('Failed to store user data:', error);
  }
}

/**
 * Retrieve user data
 */
export function getUserData(): UserData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    // Try new encrypted storage first
    const obfuscatedData = localStorage.getItem(USER_DATA_KEY);
    if (obfuscatedData) {
      const userDataStr = deobfuscate(obfuscatedData);
      return JSON.parse(userDataStr);
    }
    
    // Fallback to old storage
    const userDataStr = localStorage.getItem('user');
    if (userDataStr) {
      return JSON.parse(userDataStr);
    }
    
    return null;
  } catch (error) {
    console.error('Failed to retrieve user data:', error);
    return null;
  }
}

/**
 * Cache permissions for quick access
 */
function cachePermissions(permissions: Permission[], userId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cache: PermissionCache = {
      permissions,
      timestamp: Date.now(),
      userId
    };
    
    const cacheStr = JSON.stringify(cache);
    const obfuscatedCache = obfuscate(cacheStr);
    localStorage.setItem(PERMISSION_CACHE_KEY, obfuscatedCache);
  } catch (error) {
    console.error('Failed to cache permissions:', error);
  }
}

/**
 * Get cached permissions
 */
export function getCachedPermissions(userId: string): Permission[] | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const obfuscatedCache = localStorage.getItem(PERMISSION_CACHE_KEY);
    if (!obfuscatedCache) return null;
    
    const cacheStr = deobfuscate(obfuscatedCache);
    const cache: PermissionCache = JSON.parse(cacheStr);
    
    // Validate cache
    const now = Date.now();
    const isExpired = now - cache.timestamp > PERMISSION_CACHE_DURATION;
    const isWrongUser = cache.userId !== userId;
    
    if (isExpired || isWrongUser) {
      clearPermissionCache();
      return null;
    }
    
    return cache.permissions;
  } catch (error) {
    console.error('Failed to get cached permissions:', error);
    return null;
  }
}

/**
 * Check if user has a specific permission (from cache)
 */
export function hasPermissionCached(userId: string, permissionKey: string): boolean {
  const permissions = getCachedPermissions(userId);
  if (!permissions) return false;
  
  // Check for system admin permission (grants all access)
  const hasSystemAccess = permissions.some(p => p.key === 'can_manage_system');
  if (hasSystemAccess) return true;
  
  // Check for company admin permission (grants company-wide access)
  const hasCompanyAccess = permissions.some(p => p.key === 'can_manage_company');
  if (hasCompanyAccess) return true;
  
  // Check for specific permission
  return permissions.some(p => p.key === permissionKey && p.is_active);
}

/**
 * Get all permission keys (from cache)
 */
export function getPermissionKeys(userId: string): string[] {
  const permissions = getCachedPermissions(userId);
  if (!permissions) return [];
  
  return permissions
    .filter(p => p.is_active)
    .map(p => p.key);
}

/**
 * Clear permission cache
 */
export function clearPermissionCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PERMISSION_CACHE_KEY);
}

/**
 * Clear all user data
 */
export function clearUserData(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(USER_DATA_KEY);
  localStorage.removeItem('user');
  localStorage.removeItem(PERMISSION_CACHE_KEY);
  
  // Clear cookies
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

/**
 * Update user data (for profile updates, company changes, etc.)
 */
export function updateUserData(updates: Partial<UserData>): void {
  const currentUser = getUserData();
  if (!currentUser) return;
  
  const updatedUser = {
    ...currentUser,
    ...updates,
    company: {
      ...currentUser.company,
      ...(updates.company || {})
    },
    role: updates.role !== undefined ? updates.role : currentUser.role
  };
  
  storeUserData(updatedUser);
}

/**
 * Check if permission cache is still valid
 */
export function isPermissionCacheValid(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const obfuscatedCache = localStorage.getItem(PERMISSION_CACHE_KEY);
    if (!obfuscatedCache) return false;
    
    const cacheStr = deobfuscate(obfuscatedCache);
    const cache: PermissionCache = JSON.parse(cacheStr);
    
    const now = Date.now();
    const isExpired = now - cache.timestamp > PERMISSION_CACHE_DURATION;
    const isWrongUser = cache.userId !== userId;
    
    return !isExpired && !isWrongUser;
  } catch {
    return false;
  }
}
