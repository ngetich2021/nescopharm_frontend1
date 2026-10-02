import { getApiUrl } from './config'
import { getToken as getStoredToken, isTokenExpired } from './token-manager'

const BASE_URL = getApiUrl()

function buildRequestUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${BASE_URL}${normalizedPath}`
}


interface ApiResponse<T> {
  status: "success" | "failed"
  message?: string | Record<string, string[]>
  data?: {
    // Added data wrapper for token and user
    token?: string
    user?: T
    [key: string]: any
  }
  [key: string]: any // Allow for other properties like 'quote', 'product', etc.
}

interface ApiError {
  status: "failed"
  message: string | Record<string, string[]>
  isPdoError?: boolean // Flag for PDO/prepared statement errors
}

type ApiRichError = Error & {
  statusCode?: number
  apiResponse?: any
  error_code?: string
}

function buildApiError(message: string, statusCode?: number, apiResponse?: any): ApiRichError {
  const error = new Error(message) as ApiRichError
  error.statusCode = statusCode
  error.apiResponse = apiResponse
  if (apiResponse?.error_code) {
    error.error_code = apiResponse.error_code
  }
  return error
}

// Custom error class to preserve API response details
class ApiValidationError extends Error {
  public errors?: Record<string, string[]>;
  public status?: string;
  public apiResponse?: any;

  constructor(message: string, apiResponse?: any) {
    super(message);
    this.name = 'ApiValidationError';
    this.apiResponse = apiResponse;
    this.status = apiResponse?.status;
    this.errors = apiResponse?.errors;
  }
}

// Helper to get the token from secure storage
const getToken = (): string | null => {
  if (typeof window !== "undefined") {
    const token = getStoredToken();

    // Check if token is expired
    if (token && isTokenExpired()) {
      // Token is expired, clear it and return null
      // The auth context will handle redirecting to login
      return null;
    }

    return token;
  }

  // For server-side calls, there is no localStorage.
  // The token should be handled via context or other means for SSR.
  return null;
}

// Constants for retry logic
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 800

// Helper to detect PDO prepared statement errors
const isPdoStatementError = (message: string): boolean => {
  return (
    message.toLowerCase().includes("prepared statement") ||
    message.toLowerCase().includes("pdo_stmt") ||
    message.toLowerCase().includes("database error")
  )
}

// Helper to detect transaction errors
const isTransactionError = (message: string): boolean => {
  return (
    message.toLowerCase().includes("transaction is aborted") ||
    message.toLowerCase().includes("in failed sql transaction") ||
    message.toLowerCase().includes("commands ignored until end of transaction") ||
    message.toLowerCase().includes("current transaction is aborted")
  )
}

// Helper to detect database type errors
const isDatabaseTypeError = (message: string): boolean => {
  return (
    message.toLowerCase().includes("invalid input syntax for type boolean") ||
    message.toLowerCase().includes("invalid text representation") ||
    message.toLowerCase().includes("type mismatch") ||
    message.toLowerCase().includes("cannot cast")
  )
}

// Delay function for retry mechanism
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Event emitter for retry notifications (for UI feedback)
const retryListeners: Array<(info: { endpoint: string; attempt: number; maxAttempts: number }) => void> = []

export function onRetry(callback: (info: { endpoint: string; attempt: number; maxAttempts: number }) => void) {
  retryListeners.push(callback)
  return () => {
    const index = retryListeners.indexOf(callback)
    if (index > -1) retryListeners.splice(index, 1)
  }
}

function notifyRetry(endpoint: string, attempt: number, maxAttempts: number) {
  retryListeners.forEach(listener => {
    try {
      listener({ endpoint, attempt, maxAttempts })
    } catch (e) {
      console.error('Error in retry listener:', e)
    }
  })
}

// Generic API call function with retry capability
async function apiCall<T>(
  path: string,
  method: string,
  body?: object | FormData,
  requiresAuth = true,
  retryCount = 0,
): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json",
  }

  const isFormData = body instanceof FormData

  if (!isFormData) {
    headers["Content-Type"] = "application/json"
  }

  let token: string | null = null;
  if (requiresAuth) {
    token = getToken()
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    } else {
      return Promise.reject(new Error("You are not logged in. Please sign in and try again."))
    }
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

  try {
    const fullUrl = buildRequestUrl(path);
    const response = await fetch(fullUrl, config)

    const contentType = response.headers.get('content-type') || ''

    // Handle non-JSON responses (e.g., HTML error pages)
    if (!contentType.includes('application/json')) {
      const text = await response.text()
      // If it's an HTML error page, show a friendly message
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        throw new Error("The server returned an unexpected response. This may be a server error, a misconfigured endpoint, or a session timeout. Please try again or contact support if the problem persists.")
      } else {
        throw new Error("The server returned a non-JSON response: " + text.slice(0, 100))
      }
    }

    const data = await response.json()

    // Debug: Log raw response for product endpoints
    if (path.includes('/products/')) {
      console.log('apiCall - Raw API response for product endpoint:', {
        url: fullUrl,
        status: response.status,
        dataKeys: Object.keys(data),
        hasProduct: !!data.product,
        hasData: !!data.data,
        productImageFields: data.product ? {
          primary_image_url: data.product.primary_image_url,
          image_urls: data.product.image_urls,
          image_url: data.product.image_url,
          images: data.product.images,
        } : 'No product key',
      })
    }

    if (!response.ok || (data && data.status === "failed")) {
      const errorMessage =
        typeof data.message === "string"
          ? data.message
          : Object.values(data.message || {})
            .flat()
            .join(", ") || "An unknown API error occurred."

      // Handle 401 Unauthorized - Session expired
      if (response.status === 401) {
        // Clear auth state
        if (typeof window !== "undefined") {
          localStorage.removeItem("token")
          localStorage.removeItem("auth_token_data")
          localStorage.removeItem("user_data")
          localStorage.removeItem("selectedStore")
          document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'

          // Only redirect if not already on a public page
          const currentPath = window.location.pathname
          const publicPaths = ['/', '/sign-in', '/sign-up', '/forgot-password', '/set-password']

          if (!publicPaths.includes(currentPath) && !currentPath.startsWith('/set-password')) {
            window.location.href = '/sign-in'
          }
        }
        throw new Error("Your session has expired. Please sign in again.")
      }

      const isPdoError = isPdoStatementError(errorMessage)
      const isTransactionErrorDetected = isTransactionError(errorMessage)
      const isDatabaseTypeErrorDetected = isDatabaseTypeError(errorMessage)

      // Prevent retries for POST requests to avoid duplicate record creation
      const shouldRetry = (isPdoError || isTransactionErrorDetected || isDatabaseTypeErrorDetected) &&
        retryCount < MAX_RETRIES &&
        method !== 'POST'; // Don't retry POST requests

      if (shouldRetry) {
        console.warn(`Retrying ${method} ${path} (attempt ${retryCount + 2}/${MAX_RETRIES + 1}) due to: ${errorMessage}`);

        // Notify listeners about the retry
        notifyRetry(path, retryCount + 1, MAX_RETRIES)

        await delay(RETRY_DELAY_MS * (retryCount + 1))
        return apiCall<T>(path, method, body, requiresAuth, retryCount + 1)
      }

      // Friendly error for known DB errors
      if (isPdoError) {
        throw new Error("A database error occurred. Please refresh the page or contact support if this continues.")
      }
      if (isTransactionErrorDetected) {
        throw new Error("A database transaction error occurred. Please try again or contact support.")
      }
      if (isDatabaseTypeErrorDetected) {
        throw new Error("A database type error occurred. Please check your input or contact support.")
      }

      // General API error - preserve validation errors
      if (data.errors && typeof data.errors === 'object') {
        // This is a validation error with field-specific errors
        throw new ApiValidationError(errorMessage, data);
      }

      if (response.status === 500) {
        throw buildApiError(
          `Server error (500): ${errorMessage}. The server is experiencing issues. Please try again later or contact support.`,
          response.status,
          data
        )
      }

      throw buildApiError(errorMessage || "An unknown error occurred. Please try again.", response.status, data)
    }

    return data as T
  } catch (error: any) {
    // Network-level failure (fetch never got a response) - safe to retry regardless of
    // method, since the request never reached the server.
    if (error.message && error.message.includes('Failed to fetch')) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`Retrying ${method} ${path} (attempt ${retryCount + 2}/${MAX_RETRIES + 1}) after network error`);
        notifyRetry(path, retryCount + 1, MAX_RETRIES)
        await delay(RETRY_DELAY_MS * (retryCount + 1))
        return apiCall<T>(path, method, body, requiresAuth, retryCount + 1)
      }
      throw new Error("Could not connect to the server. Please check your internet connection or try again later.");
    }

    // Preserve structured API errors where available
    if (error instanceof Error) {
      throw error
    }

    // Fallback for non-Error throwables
    throw new Error(error?.message || "An unexpected error occurred. Please try again.");
  }
}

export default apiCall

// Chat Credential Management
export async function getChatCredentials() {
  return apiCall<any>("/chat/credentials", "GET", undefined, true);
}

export async function saveChatCredentials(data: any) {
  // If data contains an id, update; else, create new
  if (data.id) {
    return apiCall<any>(`/chat/credentials/${data.id}`, "PUT", data, true);
  } else {
    return apiCall<any>("/chat/credentials", "POST", data, true);
  }
}

export async function testChatCredentials(id: string) {
  return apiCall<any>(`/chat/credentials/${id}/test`, "POST", undefined, true);
}
