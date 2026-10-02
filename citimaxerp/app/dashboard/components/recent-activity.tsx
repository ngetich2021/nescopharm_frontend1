"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ShoppingCart, UserPlus, CreditCard, AlertCircle } from "lucide-react"

interface ActivityItem {
  id: number
  type: "order" | "customer" | "payment" | "alert"
  title: string
  description: string
  time: string
  icon?: React.ReactNode
  user?: {
    name: string
    avatar?: string
  }
}

interface RecentActivityProps {
  isLoading: boolean
}

export function RecentActivity({ isLoading }: RecentActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    // Mock data
    const mockActivities: ActivityItem[] = [
      {
        id: 1,
        type: "order",
        title: "New order placed",
        description: "Order #38294 for Ksh. 1,298.00",
        time: "5 minutes ago",
        icon: <ShoppingCart className="h-4 w-4 text-blue-500" />,
        user: {
          name: "John Doe",
          avatar: "/placeholder.svg",
        },
      },
      {
        id: 2,
        type: "customer",
        title: "New customer registered",
        description: "Customer #1205 created an account",
        time: "28 minutes ago",
        icon: <UserPlus className="h-4 w-4 text-green-500" />,
        user: {
          name: "Sarah Johnson",
          avatar: "/placeholder.svg",
        },
      },
      {
        id: 3,
        type: "payment",
        title: "Payment received",
        description: "Payment of Ksh. 3,542.00 received",
        time: "1 hour ago",
        icon: <CreditCard className="h-4 w-4 text-purple-500" />,
        user: {
          name: "Michael Brown",
          avatar: "/placeholder.svg",
        },
      },
      {
        id: 4,
        type: "alert",
        title: "Inventory alert",
        description: "Product 'Premium Headphones' is low in stock",
        time: "2 hours ago",
        icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
      },
    ]

    setActivities(mockActivities)
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-[200px]">Loading activities...</div>
  }

  return (
    <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start space-x-3 pb-3 border-b border-gray-100 last:border-0">
          <div className="flex-shrink-0 mt-1">{activity.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{activity.title}</p>
            <p className="text-xs text-gray-500">{activity.description}</p>
            <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
          </div>
          {activity.user && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={activity.user.avatar || "/placeholder.svg"} alt={activity.user.name} />
              <AvatarFallback className="bg-[#E30040]/10 text-[#E30040] text-xs">
                {activity.user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      ))}
    </div>
  )
}
