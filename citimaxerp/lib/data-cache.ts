"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

// Default cache expiration time in milliseconds (5 minutes)
const DEFAULT_CACHE_EXPIRATION = 5 * 60 * 1000;

// Shorter expiration for error states (30 seconds)
const ERROR_CACHE_EXPIRATION = 30 * 1000;

// Maximum cache size in bytes (4MB to be safe)
const MAX_CACHE_SIZE = 4 * 1024 * 1024;

interface CacheItem<T> {
  data: T;
  timestamp: number;
  isError?: boolean;
  dataHash?: string; // Add hash for data comparison
}

// Function to estimate cache size
const estimateCacheSize = (key: string, data: any): number => {
  const cacheItem = {
    data,
    timestamp: Date.now(),
    isError: false
  };
  return new Blob([JSON.stringify(cacheItem)]).size;
};

// Simple hash function for data comparison
const createDataHash = (data: any): string => {
  const str = JSON.stringify(data);
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString();
};

// Function to clean old cache entries when quota is exceeded
const cleanOldCacheEntries = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith('cache_'));
    
    if (cacheKeys.length === 0) return;
    
    // Get all cache entries with their timestamps
    const cacheEntries = cacheKeys.map(key => {
      try {
        const data = localStorage.getItem(key);
        if (!data) return null;
        
        const parsed = JSON.parse(data) as CacheItem<any>;
        return {
          key,
          timestamp: parsed.timestamp,
          size: new Blob([data]).size
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    // Sort by timestamp (oldest first)
    cacheEntries.sort((a, b) => a!.timestamp - b!.timestamp);
    
    // Remove oldest entries until we have space
    let removedSize = 0;
    for (const entry of cacheEntries) {
      if (entry) {
        localStorage.removeItem(entry.key);
        removedSize += entry.size;
        
        // Stop if we've freed up enough space
        if (removedSize > MAX_CACHE_SIZE / 2) {
          break;
        }
      }
    }
    
  } catch (e) {
  }
};

/**
 * Uses localStorage to cache data and prevent unnecessary API calls
 * @param key The unique key to store the data under
 * @param fetchFn The function to call to fetch new data
 * @param options Options for caching behavior
 */
export function useDataCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    enabled?: boolean;
    expirationMs?: number;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    retryOnError?: boolean;
    autoRefresh?: boolean; // Enable automatic background refresh
    autoRefreshIntervalMs?: number; // Interval for background refresh checks
  } = {}
) {
  const {
    enabled = true,
    expirationMs = DEFAULT_CACHE_EXPIRATION,
    onSuccess,
    onError,
    retryOnError = true,
    autoRefresh = false,
    autoRefreshIntervalMs = 60000 // 1 minute default
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Used to trigger refetch

  // Monitor network connectivity
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Function to check if the cache is valid
  const isCacheValid = (timestamp: number, isErrorCache = false): boolean => {
    const effectiveExpiration = isErrorCache ? ERROR_CACHE_EXPIRATION : expirationMs;
    return Date.now() - timestamp < effectiveExpiration;
  };

  // Function to get data from cache
  const getFromCache = (): CacheItem<T> | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cachedData = localStorage.getItem(`cache_${key}`);
      if (!cachedData) return null;
      
      const parsed = JSON.parse(cachedData) as CacheItem<T>;
      return parsed;
    } catch (e) {
      return null;
    }
  };

  // Function to save data to cache
  const saveToCache = (data: T, isError = false): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        isError,
        dataHash: !isError ? createDataHash(data) : undefined
      };
      
      const cacheKey = `cache_${key}`;
      const cacheData = JSON.stringify(cacheItem);
      
      // Check if this would exceed the cache size limit
      if (cacheData.length > MAX_CACHE_SIZE) {
        return;
      }
      
      localStorage.setItem(cacheKey, cacheData);
    } catch (e: any) {
      // Handle quota exceeded error
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.message?.includes('quota')) {
        cleanOldCacheEntries();
        
        // Try again after cleaning
        try {
          const cacheItem: CacheItem<T> = {
            data,
            timestamp: Date.now(),
            isError,
            dataHash: !isError ? createDataHash(data) : undefined
          };
          localStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
        } catch (retryError) {
        }
      } else {
      }
    }
  };

  // Check if an error is a PDO/database connection error or a null role error
  const isRetryableError = (error: any): boolean => {
    if (!error) return false;
    
    // Check for custom flag added to our API error objects
    if (error.isPdoError) return true;
    
    // Check error message for PDO/prepared statement patterns
    const errorMsg = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    
    // Check for common error patterns that indicate temporary issues
    return errorMsg.includes('prepared statement') || 
           errorMsg.includes('pdo_stmt') ||
           errorMsg.includes('database error') ||
           errorMsg.includes('transaction is aborted') ||
           errorMsg.includes('in failed sql transaction') ||
           errorMsg.includes('commands ignored until end of transaction') ||
           errorMsg.includes('invalid input syntax for type boolean') ||
           errorMsg.includes('invalid text representation') ||
           errorMsg.includes('type mismatch') ||
           errorMsg.includes('cannot cast') ||
           errorMsg.includes('property "role" on null') ||  // Auth not fully loaded yet
           errorMsg.includes('property "user" on null') ||  // Auth not fully loaded yet
           errorMsg.includes('token') ||                   // Auth token issues
           errorMsg.includes('network');                   // Network connectivity issues
  };

  // Function to fetch data, either from cache or the API
  const fetchData = async (forceRefresh = false): Promise<void> => {
    if (!enabled) return;
    
    setIsLoading(true);
    
    try {
      // Check cache first, unless we're forcing a refresh
      if (!forceRefresh) {
        const cachedItem = getFromCache();
        if (cachedItem && isCacheValid(cachedItem.timestamp, cachedItem.isError)) {
          // We still set data from error cache, but we'll retry in the background if it's an error
          setData(cachedItem.data);
          
          if (!cachedItem.isError) {
            onSuccess?.(cachedItem.data);
            setError(null);
            setIsLoading(false);
            return;
          }
          // If it's an error cache, we'll continue to fetch in the background
        }
      }
      
      // No valid cache or error cache, fetch fresh data
      const freshData = await fetchFn();
      
      // Check if the data has actually changed by comparing hashes
      const cachedItem = getFromCache();
      const freshDataHash = createDataHash(freshData);
      
      if (cachedItem && cachedItem.dataHash === freshDataHash && !forceRefresh) {
        // Data hasn't changed, just update timestamp to extend cache validity
        saveToCache(freshData);
        if (!data) {
          // If we don't have data in state yet, set it
          setData(freshData);
          onSuccess?.(freshData);
        }
        setError(null);
        setRetryCount(0);
        return;
      }
      
      // Data has changed or this is first fetch, update everything
      setData(freshData);
      saveToCache(freshData);
      setError(null);
      setRetryCount(0); // Reset retry count on success
      onSuccess?.(freshData);
    } catch (e) {
      const errorObj = e instanceof Error ? e : new Error(String(e));
      
      // If we have cached data, keep showing it despite the error
      const cachedItem = getFromCache();
      if (cachedItem && !forceRefresh) {
        // Keep using the old data even if expired
        setData(cachedItem.data);
      }
      
      setError(errorObj);
      
      // Save error to cache with short expiration
      if (data) {
        saveToCache(data as T, true);
      }
      
      onError?.(errorObj);
      
      // If it's a PDO error and retryOnError is enabled, schedule a retry
      if (retryOnError && isRetryableError(e) && retryCount < 3) {
        const nextRetry = retryCount + 1;
        setRetryCount(nextRetry);
        
        // Exponential backoff: 1s, 2s, 4s
        const retryDelay = 1000 * Math.pow(2, retryCount);
        
        setTimeout(() => {
          fetchData(true);
        }, retryDelay);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to invalidate the cache
  const invalidateCache = (): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (e) {
    }
  };

  // Function to invalidate all cache entries matching a pattern
  const invalidateCachePattern = (pattern: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith('cache_') && key.includes(pattern));
      
      cacheKeys.forEach(cacheKey => {
        try {
          localStorage.removeItem(cacheKey);
        } catch (e) {
        }
      });
    } catch (e) {
    }
  };

  // Initialize data fetch on mount and when refreshTrigger changes
  useEffect(() => {
    fetchData(refreshTrigger > 0); // Force refresh when triggered manually
    // We deliberately exclude fetchFn from dependencies to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, expirationMs, refreshTrigger]);

  // Set up automatic refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !enabled || !isOnline) return;

    const intervalId = setInterval(() => {
      // Only refresh if we have existing data, no current loading, and we're online
      if (data && !isLoading && isOnline) {
        // Check if cache is getting close to expiring (within 25% of expiration time)
        const cachedItem = getFromCache();
        if (cachedItem) {
          const timeElapsed = Date.now() - cachedItem.timestamp;
          const refreshThreshold = expirationMs * 0.75; // Refresh when 75% of cache time has elapsed
          
          if (timeElapsed >= refreshThreshold) {
            setRefreshTrigger(prev => prev + 1); // Trigger refresh
          }
        }
      }
    }, autoRefreshIntervalMs);

    return () => clearInterval(intervalId);
  }, [autoRefresh, enabled, data, isLoading, expirationMs, autoRefreshIntervalMs, isOnline]);

  // Auto-refresh when coming back online if cache is stale
  useEffect(() => {
    if (isOnline && data && enabled) {
      const cachedItem = getFromCache();
      if (cachedItem) {
        const timeElapsed = Date.now() - cachedItem.timestamp;
        // If cache is older than 50% of expiration time, refresh immediately when coming online
        if (timeElapsed >= expirationMs * 0.5) {
          setRefreshTrigger(prev => prev + 1); // Trigger refresh
        }
      }
    }
  }, [isOnline, enabled]);

  // Listen for global cache invalidation events
  useEffect(() => {
    const handleCacheInvalidation = (event: CustomEvent) => {
      const detail = event.detail;
      // Check if this cache key should be invalidated
      if (detail.key === key || (detail.keys && detail.keys.includes(key))) {
        if (isOnline) {
          // Trigger a refresh by incrementing refreshTrigger
          setRefreshTrigger(prev => prev + 1);
        } else {
          // If offline, just invalidate the cache so it refreshes when back online
          invalidateCache();
        }
      }
      // Check if this matches a pattern-based invalidation
      else if (detail.pattern && key.includes(detail.pattern)) {
        if (isOnline) {
          // Trigger a refresh by incrementing refreshTrigger
          setRefreshTrigger(prev => prev + 1);
        } else {
          // If offline, just invalidate the cache so it refreshes when back online
          invalidateCache();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('cache-invalidated', handleCacheInvalidation as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cache-invalidated', handleCacheInvalidation as EventListener);
      }
    };
  }, [key, isOnline]);

  return {
    data,
    isLoading,
    error,
    isOnline,
    refetch: () => setRefreshTrigger(prev => prev + 1), // Trigger refresh via state
    invalidateCache
  };
}

/**
 * Utility function to invalidate cache for a specific key from anywhere in the app
 */
export function invalidateCacheKey(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(`cache_${key}`);
    
    // Dispatch a custom event to notify any active useDataCache hooks
    window.dispatchEvent(new CustomEvent('cache-invalidated', {
      detail: { key, timestamp: Date.now() }
    }));
  } catch (e) {
    // Silently handle errors
  }
}

/**
 * Utility function to invalidate all cache entries matching a pattern
 */
export function invalidateCachePattern(pattern: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith('cache_') && key.includes(pattern));
    
    cacheKeys.forEach(cacheKey => {
      try {
        localStorage.removeItem(cacheKey);
      } catch (e) {
      }
    });
    
    // Dispatch a custom event to notify any active useDataCache hooks
    window.dispatchEvent(new CustomEvent('cache-invalidated', {
      detail: { pattern, timestamp: Date.now() }
    }));
  } catch (e) {
  }
}

/**
 * Utility function to refresh cache for multiple keys at once
 */
export function invalidateMultipleCacheKeys(keys: string[]): void {
  if (typeof window === 'undefined') return;
  
  keys.forEach(key => {
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (e) {
      // Silently handle errors
    }
  });
  
  // Dispatch a custom event to notify any active useDataCache hooks
  window.dispatchEvent(new CustomEvent('cache-invalidated', {
    detail: { keys, timestamp: Date.now() }
  }));
}
