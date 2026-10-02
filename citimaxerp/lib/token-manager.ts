/**
 * Token Manager
 * Handles secure token storage, validation, and expiration checking
 */

interface TokenData {
  token: string;
  expiresAt: number; // Unix timestamp
  issuedAt: number;  // Unix timestamp
}

const TOKEN_KEY = 'auth_token_data';
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh 5 minutes before expiry

/**
 * Parse JWT token to extract expiration time
 * Note: This is for client-side UX only. Never trust client-side token validation for security.
 */
function parseJWT(token: string): { exp?: number; iat?: number } {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return {};
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    return {};
  }
}

/**
 * Store token securely with expiration metadata
 */
export function storeToken(token: string): void {
  if (typeof window === 'undefined') return;
  
  const payload = parseJWT(token);
  const now = Date.now();
  
  // Laravel Sanctum tokens don't have exp claim by default
  // Set a default expiration of 7 days if not present
  const expiresAt = payload.exp 
    ? payload.exp * 1000 
    : now + (7 * 24 * 60 * 60 * 1000);
  
  const tokenData: TokenData = {
    token,
    expiresAt,
    issuedAt: payload.iat ? payload.iat * 1000 : now
  };
  
  // Store in localStorage
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
  
  // Also store plain token for backward compatibility
  localStorage.setItem('token', token);
  
  // Set cookie for server-side access
  // Only add Secure flag in production (HTTPS)
  const isProduction = window.location.protocol === 'https:';
  const maxAge = Math.floor((expiresAt - now) / 1000);
  const securePart = isProduction ? '; Secure' : '';
  document.cookie = `token=${token}; path=/; max-age=${maxAge}; SameSite=Lax${securePart}`;
}

/**
 * Sync token to cookie if it exists in localStorage but not in cookie
 * This ensures server-side actions can access the token
 */
export function syncTokenToCookie(): void {
  if (typeof window === 'undefined') return;
  
  // Check if cookie exists
  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('token='))
    ?.split('=')[1];
  
  if (cookieToken) return; // Cookie already exists
  
  // Get token from localStorage
  const tokenDataStr = localStorage.getItem(TOKEN_KEY);
  if (!tokenDataStr) {
    const plainToken = localStorage.getItem('token');
    if (plainToken) {
      // Set cookie from plain token
      const isProduction = window.location.protocol === 'https:';
      const maxAge = 7 * 24 * 60 * 60; // 7 days default
      const securePart = isProduction ? '; Secure' : '';
      document.cookie = `token=${plainToken}; path=/; max-age=${maxAge}; SameSite=Lax${securePart}`;
    }
    return;
  }
  
  try {
    const tokenData: TokenData = JSON.parse(tokenDataStr);
    const now = Date.now();
    const maxAge = Math.floor((tokenData.expiresAt - now) / 1000);
    
    if (maxAge > 0) {
      const isProduction = window.location.protocol === 'https:';
      const securePart = isProduction ? '; Secure' : '';
      document.cookie = `token=${tokenData.token}; path=/; max-age=${maxAge}; SameSite=Lax${securePart}`;
    }
  } catch (error) {
    console.error('Failed to sync token to cookie:', error);
  }
}

/**
 * Get current token
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Ensure token is synced to cookie for server-side access
  syncTokenToCookie();
  
  const tokenDataStr = localStorage.getItem(TOKEN_KEY);
  if (!tokenDataStr) {
    // Fallback to old storage method
    return localStorage.getItem('token');
  }
  
  try {
    const tokenData: TokenData = JSON.parse(tokenDataStr);
    return tokenData.token;
  } catch {
    return localStorage.getItem('token');
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(): boolean {
  if (typeof window === 'undefined') return true;
  
  const tokenDataStr = localStorage.getItem(TOKEN_KEY);
  if (!tokenDataStr) return true;
  
  try {
    const tokenData: TokenData = JSON.parse(tokenDataStr);
    const now = Date.now();
    return now >= tokenData.expiresAt;
  } catch {
    return true;
  }
}

/**
 * Check if token needs refresh (within threshold before expiry)
 */
export function shouldRefreshToken(): boolean {
  if (typeof window === 'undefined') return false;
  
  const tokenDataStr = localStorage.getItem(TOKEN_KEY);
  if (!tokenDataStr) return false;
  
  try {
    const tokenData: TokenData = JSON.parse(tokenDataStr);
    const now = Date.now();
    const timeUntilExpiry = tokenData.expiresAt - now;
    
    return timeUntilExpiry > 0 && timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD;
  } catch {
    return false;
  }
}

/**
 * Get time until token expiration (in milliseconds)
 */
export function getTimeUntilExpiry(): number {
  if (typeof window === 'undefined') return 0;
  
  const tokenDataStr = localStorage.getItem(TOKEN_KEY);
  if (!tokenDataStr) return 0;
  
  try {
    const tokenData: TokenData = JSON.parse(tokenDataStr);
    const now = Date.now();
    return Math.max(0, tokenData.expiresAt - now);
  } catch {
    return 0;
  }
}

/**
 * Clear token from storage
 */
export function clearToken(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('token');
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

/**
 * Validate token format (basic check)
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token) return false;
  
  // Laravel Sanctum tokens are in format: ID|hash
  // JWT tokens have 3 parts separated by dots
  const parts = token.split('.');
  const isSanctumToken = /^\d+\|[\w-]+$/.test(token);
  const isJWT = parts.length === 3;
  
  return isSanctumToken || isJWT;
}
