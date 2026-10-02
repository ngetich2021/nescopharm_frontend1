"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  Building2, 
  Users, 
  CreditCard, 
  DollarSign, 
  BarChart3, 
  Settings, 
  Home,
  Shield,
  Key,
  Activity,
  FileText
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: Home },
  { name: "Companies", href: "/admin/companies", icon: Building2 },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Roles", href: "/admin/roles", icon: Shield },
  { name: "Permissions", href: "/admin/permissions", icon: Key },
  { name: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { name: "Payments", href: "/admin/payments", icon: DollarSign },
  { name: "Pricing", href: "/admin/pricing", icon: BarChart3 },
  { name: "Activity Logs", href: "/admin/activity-logs", icon: Activity },
  { name: "Reports", href: "/admin/reports", icon: FileText },
  { name: "Settings", href: "/admin/settings", icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-gray-50 border-r">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-xl font-semibold text-gray-900">Admin Portal</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors",
                isActive ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5 flex-shrink-0",
                  isActive ? "text-gray-900" : "text-gray-500 group-hover:text-gray-900",
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
