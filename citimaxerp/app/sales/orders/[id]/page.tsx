"use client"

import { useState, useEffect, use } from "react"
import { notFound } from "next/navigation"
import { OrderDetails } from "./order-details"
import { fetchOrderById, type OrderDetail } from "@/lib/orders"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, isLoading: isAuthLoading } = useAuth()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthLoading) {
      return // Wait for authentication to complete
    }

    if (!user) {
      setError("You must be logged in to view this page.")
      setIsLoading(false)
      return
    }

    const getOrder = async () => {
      try {
        const fetchedOrder = await fetchOrderById(id)
        if (fetchedOrder) {
          setOrder(fetchedOrder)
        } else {
          notFound()
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.")
      } finally {
        setIsLoading(false)
      }
    }

    if (!isAuthLoading && user) {
        getOrder()
    }
  }, [id, user, isAuthLoading])

  const refreshOrder = async () => {
    setIsLoading(true)
    try {
        const fetchedOrder = await fetchOrderById(id)
        if (fetchedOrder) {
          setOrder(fetchedOrder)
        }
    } catch (error) {
        console.error("Failed to refresh order", error)
    } finally {
        setIsLoading(false)
    }
  }

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-primary">
        <p>{error}</p>
      </div>
    )
  }

  if (!order) {
    // This will be handled by the notFound() call inside the effect
    return null
  }

  return <OrderDetails order={order} refreshOrder={refreshOrder} />
}
