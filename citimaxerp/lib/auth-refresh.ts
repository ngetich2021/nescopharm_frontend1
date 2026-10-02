/**
 * Auth Refresh Service
 * Handles automatic token refresh and permission sync
 */

import { getToken, storeToken, shouldRefreshToken, isTokenExpired, getTimeUntilExpiry } from './token-manager';
import { getUserData, storeUserData, isPermissionCacheValid, clearPermissionCache } from './permission-manager';
import apiCall from './api';

interface RefreshResponse {
  status: string;
  message: string;
  data: {
    token: string;
    user: any;
  };
}

let refreshPromise: Promise<string> | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let permissionSyncTimer: NodeJS.Timeout | null = null;

/**
 * Refresh the authentication token
 * Returns a promise that resolves to the current token
 * 
 * Note: This API uses Laravel Sanctum tokens which don't expire by default.
 * The token refresh functionality is a no-op - it simply returns the current token.
 * If you implement a token refresh endpoint in the future, update this function.
 */
export async function refreshAuthToken(): Promise<string> {
  // If a refresh is already in progress, return that promise
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const currentToken = getToken();
      if (!currentToken) {
        throw new Error('No token to refresh');
      }

      // Sanctum tokens don't expire by default, so we just return the current token.
      // If you add a token refresh endpoint in the future (e.g., /auth/refresh), 
      // uncomment and modify the code below:
      //
      // const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/auth/refresh`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${currentToken}`,
      //     'Accept': 'application/json',
      //   }
      // });
      //
      // if (response.ok) {
      //   const data = await response.json();
      //   if (data.data?.token) {
      //     storeToken(data.data.token);
      //     return data.data.token;
      //   }
      // }

      // Return the current token as-is (Sanctum tokens are long-lived)
      return currentToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Sync permissions from the server
 * 
 * Note: This API doesn't have a dedicated user profile endpoint.
 * Permissions are fetched during login and stored locally.
 * This function is a no-op until a user profile endpoint is implemented.
 * If you add a profile endpoint (e.g., /auth/me or /user/profile), update this function.
 */
export async function syncPermissions(): Promise<void> {
  try {
    const userData = getUserData();
    if (!userData) return;

    // The API doesn't have a user profile endpoint yet.
    // Permissions are stored locally during login and used from cache.
    // If you implement a profile endpoint in the future, uncomment below:
    //
    // const response = await apiCall<RefreshResponse>('/auth/me', 'GET', undefined, true);
    // if (response.status === 'success' && response.data?.user) {
    //   storeUserData(response.data.user);
    // }
    
    // For now, permissions are kept in sync via the login response
    // and the local permission cache is considered authoritative
  } catch (error) {
    console.error('Permission sync failed:', error);
  }
}

/**
 * Start automatic token refresh
 * Monitors token expiration and refreshes proactively
 */
export function startTokenRefreshMonitor(): void {
  // Clear any existing timer
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  const checkAndRefresh = async () => {
    try {
      // If token is expired, trigger logout (handled by auth context)
      if (isTokenExpired()) {
        stopTokenRefreshMonitor();
        return;
      }

      // If token should be refreshed (within threshold), refresh it
      if (shouldRefreshToken()) {
        await refreshAuthToken();
      }
    } catch (error) {
      console.error('Token refresh check failed:', error);
    }
  };

  // Check every 2 minutes
  refreshTimer = setInterval(checkAndRefresh, 2 * 60 * 1000);

  // Also check immediately
  checkAndRefresh();
}

/**
 * Stop automatic token refresh
 */
export function stopTokenRefreshMonitor(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Start automatic permission sync
 * Keeps permissions fresh without disrupting user experience
 */
export function startPermissionSync(): void {
  // Clear any existing timer
  if (permissionSyncTimer) {
    clearInterval(permissionSyncTimer);
  }

  const checkAndSync = async () => {
    try {
      const userData = getUserData();
      if (!userData) return;

      // If permission cache is invalid, sync permissions
      if (!isPermissionCacheValid(userData.id)) {
        await syncPermissions();
      }
    } catch (error) {
      console.error('Permission sync check failed:', error);
    }
  };

  // Sync every 10 minutes
  permissionSyncTimer = setInterval(checkAndSync, 10 * 60 * 1000);

  // Also check immediately if cache is invalid
  checkAndSync();
}

/**
 * Stop automatic permission sync
 */
export function stopPermissionSync(): void {
  if (permissionSyncTimer) {
    clearInterval(permissionSyncTimer);
    permissionSyncTimer = null;
  }
}

/**
 * Initialize auth monitoring (token refresh + permission sync)
 * Call this when user logs in
 */
export function initializeAuthMonitoring(): void {
  startTokenRefreshMonitor();
  startPermissionSync();
}

/**
 * Cleanup auth monitoring
 * Call this when user logs out
 */
export function cleanupAuthMonitoring(): void {
  stopTokenRefreshMonitor();
  stopPermissionSync();
  clearPermissionCache();
}

/**
 * Get authentication status for debugging
 */
export function getAuthStatus() {
  return {
    tokenExpired: isTokenExpired(),
    shouldRefresh: shouldRefreshToken(),
    timeUntilExpiry: getTimeUntilExpiry(),
    hasToken: !!getToken(),
    hasUserData: !!getUserData(),
    monitoringActive: !!refreshTimer,
    syncActive: !!permissionSyncTimer,
  };
}
