"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import apiCall from "@/lib/api" // Import the new API client
import { hasPermission as hasPermissionFromRbac } from "@/lib/rbac" // Import the RBAC hasPermission function
import { useRouter } from "next/navigation"
import { clearStoreCache } from "@/lib/stores" // Import store cache clearing function
import { 
  storeToken, 
  getToken, 
  clearToken, 
  isTokenExpired,
  isValidTokenFormat 
} from "@/lib/token-manager"
import {
  storeUserData,
  getUserData,
  clearUserData,
  updateUserData as updateUserDataInStorage,
  hasPermissionCached
} from "@/lib/permission-manager"
import {
  initializeAuthMonitoring,
  cleanupAuthMonitoring,
  syncPermissions
} from "@/lib/auth-refresh"

// Define the Permission type based on the new API response
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

// Define the UserProfile type based on the new API response
interface ApiUser {
  message?: string;
  data?: any;
  status?: string;
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
    is_sales_rep?: boolean;
    is_warehouse_incharge?: boolean;
    permissions?: Permission[];
  } | null;
  created_at?: string;
  updated_at?: string;
}

// Map API user to a more detailed UserProfile if needed, or simplify UserProfile
type UserProfile = ApiUser;

interface AuthContextType {
  user: UserProfile | null // Now directly stores the API user profile
  userProfile: UserProfile | null
  isLoading: boolean // Global loading state for auth/profile readiness
  companyId: string | null
  storeId: string | null // storeId is not directly from API user, might need separate fetch or derivation
  signUp: (email: string, password: string, userData: any, companyData: any) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<any>
  updateFirstTimeStatus: (isFirstTime: boolean) => Promise<void>
  refreshUserProfile: () => Promise<void>
  hasPermission: (permissionKey: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true) // True until initial auth check and profile fetch (if any) are done
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null) // Store ID might need a separate API call or be derived
  const router = useRouter()

  // Inactivity timeout logic
  useEffect(() => {
    // Only run inactivity timer if user is authenticated and not on public pages
    if (!user) return
    
    let timer: NodeJS.Timeout | null = null
    const INACTIVITY_LIMIT = 10 * 60 * 1000 // 10 minutes in ms

    const resetTimer = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        // Only redirect if we're not on a public path
        const currentPath = window.location.pathname
        const publicPaths = ['/', '/sign-in', '/sign-up', '/forgot-password', '/set-password']
        
        if (!publicPaths.includes(currentPath) && !currentPath.startsWith('/set-password')) {
          clearAuthState()
          router.push("/sign-in")
        }
      }, INACTIVITY_LIMIT)
    }

    // List of events that indicate user activity
    const activityEvents = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ]

    // Attach event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer)
    })
    // Start timer on mount
    resetTimer()

    return () => {
      if (timer) clearTimeout(timer)
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [user])

  // Redirect to login if no token on mount
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      // Only redirect if we're not on a public path
      const currentPath = window.location.pathname
      const publicPaths = ['/', '/sign-in', '/sign-up', '/forgot-password', '/set-password']
      
      if (!publicPaths.includes(currentPath) && !currentPath.startsWith('/set-password')) {
        clearAuthState()
        router.push("/sign-in")
      }
    }
  }, [])

  // Function to load user from localStorage
  const loadUserFromLocalStorage = () => {
    if (typeof window !== "undefined") {
      const storedToken = getToken()
      const storedUser = getUserData()
      
      if (storedUser && storedToken) {
        try {
          // Validate token format
          if (!isValidTokenFormat(storedToken)) {
            clearAuthState()
            return false
          }
          
          // Check if token is expired
          if (isTokenExpired()) {
            clearAuthState()
            return false
          }
          
          setUser(storedUser)
          setUserProfile(storedUser)
          setCompanyId(storedUser.company?.id || null)
          
          // Initialize auth monitoring (token refresh + permission sync)
          initializeAuthMonitoring()
          
          return true
        } catch (e) {
          console.error('Failed to load user from storage:', e)
          clearAuthState()
        }
      }
    }
    return false
  }

  useEffect(() => {
    // On initial load, try to load user from localStorage
    const userLoaded = loadUserFromLocalStorage()
    setIsLoading(false) // Set loading to false after initial check
  }, []) // Keep dependency array empty for a single setup/teardown

  const clearAuthState = () => {
    if (typeof window !== "undefined") {
      // Clear old storage methods
      localStorage.removeItem("selectedStore")
      localStorage.removeItem("force_store_refresh")
      localStorage.removeItem("user_changed")
      
      // Clear new secure storage
      clearToken()
      clearUserData()
      
      // Clear all store caches when auth state is cleared
      clearStoreCache()
    }
    
    // Cleanup monitoring
    cleanupAuthMonitoring()
    
    setUser(null)
    setUserProfile(null)
    setCompanyId(null)
    setStoreId(null)
  }

  const getUserFriendlyError = (error: any): string => {
    if (error && typeof error.message === "object") {
      // Handle validation errors from API
      return Object.values(error.message).flat().join(", ")
    }
    return error?.message || "An unexpected error occurred. Please try again."
  }

  const signUp = async (email: string, password: string, userData: any, companyData: any) => {
    clearAuthState() // Clear any existing auth state
    setIsLoading(true) // Start loading

    try {
      const response = await apiCall<ApiUser>(
        "/register",
        "POST",
        {
          email: email,
          password: password,
          password_confirmation: password, // API expects password_confirmation
          first_name: userData.firstName, // Pass first name separately
          last_name: userData.lastName, // Pass last name separately
          phone: userData.phone || null, // Pass phone number
          company_name: companyData.name, // Pass company name directly
          // company_email and company_phone are collected by UI but not in sample API payload
          // If your API requires these, they need to be added here.
        },
        false,
      ) // No auth required for signup

      if (response.status === "success" && response.data?.user && response.data?.token) {
        // Store token securely
        storeToken(response.data.token)
        
        // Store user data securely
        storeUserData(response.data.user)
        
        setUser(response.data.user)
        setUserProfile(response.data.user)
        setCompanyId(response.data.user.company?.id || null)
        
        // Initialize auth monitoring
        initializeAuthMonitoring()
        
        return { data: response.data.user, error: null }
      } else {
        // This path should ideally be caught by apiCall's error handling, but as a fallback
        throw new Error((response.message as string) || "Signup failed with no specific message.")
      }
    } catch (error: any) {
      const friendlyError = getUserFriendlyError(error)
      return { data: null, error: { message: friendlyError } }
    } finally {
      setIsLoading(false) // End loading
    }
  }

  const signIn = async (email: string, password: string) => {
    clearAuthState() // Clear any existing auth state (including store cache)
    setIsLoading(true) // Start loading

    try {
      const response = await apiCall<ApiUser>("/login", "POST", { email, password }, false) // No auth required for login

      if (response.status === "success" && response.data?.user && response.data?.token) {
        // Clear any existing store cache for the previous user before setting new data
        if (typeof window !== "undefined") {
          clearStoreCache() // Clear all store caches
          
          // Force store refresh for the new user
          localStorage.setItem("force_store_refresh", "true")
          localStorage.setItem("user_changed", "true") // Flag to indicate user changed
        }
        
        // Store token securely
        storeToken(response.data.token)
        
        // Store user data securely (includes permissions)
        storeUserData(response.data.user)
        
        setUser(response.data.user)
        setUserProfile(response.data.user)
        setCompanyId(response.data.user.company?.id || null)
        
        // Initialize auth monitoring (token refresh + permission sync)
        initializeAuthMonitoring()
        
        return { data: response.data.user, error: null }
      } else {
        throw new Error((response.message as string) || "Sign in failed with no specific message.")
      }
    } catch (error: any) {
      const friendlyError = getUserFriendlyError(error)
      return { data: null, error: { message: friendlyError } }
    } finally {
      setIsLoading(false) // End loading
    }
  }

  const signOut = async () => {
    setIsLoading(true) // Start loading

    try {
      // Assuming there's a logout endpoint, if not, just clear client-side state
      // If your API has a /logout endpoint that invalidates the token:
      // await apiCall("/logout", "POST", {}, true);

      clearAuthState() // Clear client-side state
    } catch (error) {
      // Even if API logout fails, clear client-side state for UX
      clearAuthState()
    } finally {
      setIsLoading(false) // End loading
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { sendPasswordResetLink } = await import("@/lib/forgot-password")
      const response = await sendPasswordResetLink(email)
      
      if (response.status === "success") {
        return { data: { message: response.message }, error: null }
      } else {
        const errorMessage = typeof response.message === "string" 
          ? response.message 
          : Object.values(response.message).flat().join(", ")
        return { data: null, error: { message: errorMessage } }
      }
    } catch (error: any) {
      const friendlyError = getUserFriendlyError(error)
      return { data: null, error: { message: friendlyError } }
    }
  }

  const updateFirstTimeStatus = async (isFirstTime: boolean) => {
    
    if (!user || !user.company?.id) {
      return
    }

    try {
      // Update the company's is_first_time status via API
      const response = await apiCall<ApiUser>(
        `/companies/${user.company.id}`,
        "PUT",
        { is_first_time: isFirstTime },
        true
      )

      if (response.status === "success" && response.data) {
        // Update local state
        const updatedUser = {
          ...user,
          company: {
            ...user.company,
            is_first_time: isFirstTime
          }
        }
        setUser(updatedUser)
        setUserProfile(updatedUser)
        
        // Update secure storage
        updateUserDataInStorage({ company: updatedUser.company })
      }
    } catch (error: any) {
      // Don't throw error to avoid breaking the flow, just log it
      console.error('Failed to update first time status:', error)
    }
  }

  // Fetch the latest user/company profile from the API and update local state
  const refreshUserProfile = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      // Fetch the latest company details
      const companyId = user.company?.id
      if (!companyId) return
      const response = await apiCall<{ status: string; message: string; company: any }>(`/companies/${companyId}`, "GET")
      if (response.status === "success" && response.company) {
        // Update is_first_time in user/company state
        const updatedUser = {
          ...user,
          company: {
            ...user.company,
            ...response.company
          }
        }
        setUser(updatedUser)
        setUserProfile(updatedUser)
        setCompanyId(response.company.id || null)
        
        // Update secure storage
        updateUserDataInStorage({ company: updatedUser.company })
      }
      
      // Also sync permissions in the background
      await syncPermissions()
    } catch (error) {
      console.error("Failed to refresh user profile", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Function to check if user has a specific permission
  const hasPermission = (permissionKey: string): boolean => {
    return userProfile ? hasPermissionFromRbac(userProfile, permissionKey) : false;
  }

  const value = {
    user,
    userProfile,
    isLoading,
    companyId,
    storeId,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateFirstTimeStatus,
    refreshUserProfile,
    hasPermission,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
