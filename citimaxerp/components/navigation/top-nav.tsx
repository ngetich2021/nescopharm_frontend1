"use client"

import type React from "react"

import { useCallback, useEffect, useState } from "react"
import { Search, Bell, Settings, LogOut, User, Loader2, FileText, ChevronDown, Package, ShoppingCart, Truck, ClipboardList, Users, CheckCheck } from "lucide-react" // Added icons
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast" // For potential error feedback
import { useRouter } from "next/navigation" // For redirecting after sign out
import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications"
import { formatDate } from "@/lib/utils"

export function TopNav() {
  const [searchQuery, setSearchQuery] = useState("")
  const { userProfile, signOut: authSignOut, isLoading: authLoading, hasPermission } = useAuth() // Get signOut and isLoading
  const { toast } = useToast()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetchNotifications()
      setNotifications(response.data)
      setUnreadCount(response.unread_count)
    } catch {
      // Silently ignore - the bell just stays at its last-known count.
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    // Poll every 2 minutes so the unread badge stays reasonably fresh
    // without needing a websocket/push setup.
    const interval = setInterval(loadNotifications, 120_000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  const handleOpenNotifications = (open: boolean) => {
    setNotificationsOpen(open)
    if (open) {
      setLoadingNotifications(true)
      loadNotifications().finally(() => setLoadingNotifications(false))
    }
  }

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.read_at) {
      try {
        const { unread_count } = await markNotificationRead(notification.id)
        setUnreadCount(unread_count)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n))
        )
      } catch {
        // Non-critical - the notification just stays marked unread.
      }
    }
    setNotificationsOpen(false)
    if (notification.data.url) {
      router.push(notification.data.url)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    } catch {
      // Non-critical.
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement search functionality here
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await authSignOut()
      // The AuthGuard should handle redirection to /sign-in
      // but we can also explicitly push if needed, or just let AuthGuard do its job.
    } catch (error: any) {
      toast({
        title: "Sign Out Failed",
        description: error.message || "An unexpected error occurred during sign out.",
        variant: "destructive",
      })
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleProfileAction = (action: string) => {
    if (action === "profile") {
      router.push("/profile") // Example: Redirect to a profile page
    } else if (action === "settings") {
      router.push("/settings") // Example: Redirect to a settings page
    }
    // "logout" is handled by handleSignOut directly
  }

  // Construct initials for AvatarFallback
  const getInitials = (firstName?: string, lastName?: string) => {
    const firstInitial = firstName ? firstName[0] : ""
    const lastInitial = lastName ? lastName[0] : ""
    return `${firstInitial}${lastInitial}`.toUpperCase() || "U" // Default to "U" if no names
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-50">
      {/* Search Section */}
      <div className="flex-1 max-w-md">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search customers, orders, products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border-gray-300 focus:border-[#1E2764] focus:ring-[#1E2764]"
            disabled={authLoading || isSigningOut}
          />
        </form>
      </div>

      {/* Right Section - Notifications and Reports and Profile */}
      <div className="flex items-center gap-4">
        {/* Reports Dropdown */}
        {(hasPermission("can_view_reports_menu") ||
          hasPermission("can_view_inventory_reports") ||
          hasPermission("can_view_logistics_reports")) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={authLoading || isSigningOut}>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Reports</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {(hasPermission("can_view_reports_menu") || hasPermission("can_view_inventory_reports")) && (
                <DropdownMenuItem onClick={() => router.push("/reports/inventory")}>
                  <Package className="mr-2 h-4 w-4" />
                  <span>Inventory Reports</span>
                </DropdownMenuItem>
              )}
              {hasPermission("can_view_reports_menu") && (
                <DropdownMenuItem onClick={() => router.push("/reports/sales")}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  <span>Sales Reports</span>
                </DropdownMenuItem>
              )}
              {(hasPermission("can_view_reports_menu") || hasPermission("can_view_logistics_reports")) && (
                <DropdownMenuItem onClick={() => router.push("/reports/logistics")}>
                  <Truck className="mr-2 h-4 w-4" />
                  <span>Logistics Reports</span>
                </DropdownMenuItem>
              )}
              {hasPermission("can_view_reports_menu") && (
                <DropdownMenuItem onClick={() => router.push("/reports/procurement")}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  <span>Procurement Reports</span>
                </DropdownMenuItem>
              )}
              {hasPermission("can_view_reports_menu") && (
                <DropdownMenuItem onClick={() => router.push("/reports/customers")}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>CRM Reports</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications */}
        <DropdownMenu open={notificationsOpen} onOpenChange={handleOpenNotifications}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-gray-100"
              disabled={authLoading || isSigningOut}
            >
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 bg-[#1E2764] text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 p-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loadingNotifications ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">No notifications yet</div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                      !notification.read_at ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.read_at && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-[#1E2764] shrink-0" />
                      )}
                      <div className={notification.read_at ? "pl-4" : ""}>
                        <p className="text-sm font-medium text-gray-900">{notification.data.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{notification.data.message}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{formatDate(notification.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={authLoading || isSigningOut}>
            <button className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors disabled:opacity-50">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={undefined} // No avatar URL available, fallback will show
                  alt={userProfile?.first_name || "User"}
                />
                <AvatarFallback className="bg-[#1E2764]/10 text-[#1E2764] font-semibold">
                  {getInitials(userProfile?.first_name ?? undefined, userProfile?.last_name ?? undefined)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                  {userProfile?.first_name} {userProfile?.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate max-w-[150px]">{userProfile?.email}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userProfile?.first_name} {userProfile?.last_name}
              </p>
              <p className="text-xs text-gray-500 truncate">{userProfile?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => handleProfileAction("profile")}
              disabled={isSigningOut}
            >
              <User size={16} />
              <span>View Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => handleProfileAction("settings")}
              disabled={isSigningOut}
            >
              <Settings size={16} />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer text-blue-600 hover:!text-blue-700 focus:!text-blue-700"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogOut size={16} />
              )}
              <span>{isSigningOut ? "Signing Out..." : "Sign Out"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
