// Environment configuration utility
export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "https://citimax-main.laravel.cloud/api",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://citimax-main.laravel.cloud",
  },

  // Email Configuration
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
  },

  // WhatsApp Configuration
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v21.0",
    apiToken: process.env.WHATSAPP_API_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    catalogId: process.env.WHATSAPP_CATALOG_ID,
  },

  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
}

const DEFAULT_API_BASE_URL = "/api"

function normalizeBaseUrl(baseUrl?: string): string {
  const rawValue = (baseUrl || "").trim()

  if (!rawValue) {
    return DEFAULT_API_BASE_URL
  }

  // Absolute URLs (http/https) should stay absolute, but without trailing slash.
  if (/^https?:\/\//i.test(rawValue)) {
    const sanitizedAbsoluteUrl = rawValue.replace(/\/+$/, "")
    // If only origin is provided, default API namespace to /api.
    if (/^https?:\/\/[^/]+$/i.test(sanitizedAbsoluteUrl)) {
      return `${sanitizedAbsoluteUrl}/api`
    }
    return sanitizedAbsoluteUrl
  }

  // Relative API paths should always start with "/" and not end with "/".
  const withoutLeadingSlash = rawValue.replace(/^\/+/, "")
  const withoutTrailingSlash = withoutLeadingSlash.replace(/\/+$/, "")
  return `/${withoutTrailingSlash || "api"}`
}

function joinUrl(baseUrl: string, path: string): string {
  if (!path) {
    return baseUrl
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

// Helper function to get environment-specific API URL
export const getApiUrl = (path: string = '') => {
  const baseUrl = normalizeBaseUrl(config.api.baseUrl)
  return joinUrl(baseUrl, path)
}

// Helper function to get app URL
export const getAppUrl = (path: string = '') => {
  const appBaseUrl = (config.api.appUrl || "").replace(/\/+$/, "")
  if (!path) {
    return appBaseUrl
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${appBaseUrl}${normalizedPath}`
}
