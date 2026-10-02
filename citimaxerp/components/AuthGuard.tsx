"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context" // Adjust path if needed
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react" // For a loading spinner
import { getToken, isTokenExpired } from "@/lib/token-manager"

interface AuthGuardProps {
  children: React.ReactNode
}

const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up', '/forgot-password', '/set-password']; // Add any other public paths

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const token = getToken()
    const hasValidToken = token && !isTokenExpired()

    const isPublicPath = PUBLIC_PATHS.some(path =>
      pathname === path || pathname.startsWith(`${path}/`)
    );

    if (!isLoading) {
      if (!user && !hasValidToken && !isPublicPath) {
        // No user and no valid token on protected route - redirect to login
        router.push("/sign-in")
      } else if (user && isPublicPath && pathname !== '/sign-in' && pathname !== '/sign-up/success' && pathname !== '/forgot-password' && !pathname.startsWith('/set-password')) {
        // User logged in on public pages (except sign-in/forgot-password/set-password) - redirect to dashboard
        router.push("/dashboard")
      } else {
        // Show content - let the user stay on sign-in even with a stored session
        // so they can log in with different credentials or after password reset
        setIsReady(true)
      }
    }
  }, [user, isLoading, router, pathname])

  // On public paths, show content immediately (no full-screen spinner)
  const isPublicPath = PUBLIC_PATHS.some(path =>
    pathname === path || pathname.startsWith(`${path}/`)
  );

  if ((isLoading || !isReady) && !isPublicPath) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // For public paths, render immediately even if still loading
  if (isPublicPath && !isReady) {
    return <>{children}</>
  }

  return <>{children}</>
}
