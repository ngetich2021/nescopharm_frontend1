import { NextRequest, NextResponse } from "next/server"
import apiCall from "@/lib/api"
import { cookies as getCookies } from "next/headers"

// DashboardData interface from app/types.ts
// import { DashboardData } from "@/app/types"

export async function GET(request: NextRequest) {
  try {
    // Get user from cookies (assumes user is stored in cookies as JSON)
    const cookieStore = await getCookies()
    const userCookie = cookieStore.get("user")?.value
    if (!userCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const user = JSON.parse(userCookie)
    const companyId = user?.company?.id
    if (!companyId) {
      return NextResponse.json({ error: "No company found for user" }, { status: 400 })
    }

    // Parse date range from query
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Fetch orders for the company
    const ordersRes = await apiCall(`/orders?company_id=${companyId}${startDate && endDate ? `&start_date=${startDate}&end_date=${endDate}` : ""}`, "GET") as any
    const orders = ordersRes.orders || []

    // Fetch products for the company
    const productsRes = await apiCall(`/products?company_id=${companyId}`, "GET") as any
    const products = productsRes.products || []

    // Fetch customers for the company
    const customersRes = await apiCall(`/customers?company_id=${companyId}`, "GET") as any
    const customers = customersRes.customers || []

    // Fetch tickets for the company (if available)
    let tickets = []
    try {
      const ticketsRes = await apiCall(`/tickets?company_id=${companyId}`, "GET") as any
      tickets = ticketsRes.tickets || []
    } catch {}

    // Aggregate sales data by date
    const salesDataMap = new Map<string, number>()
    for (const order of orders) {
      const date = order.created_at?.split("T")[0]
      if (!date) continue
      salesDataMap.set(date, (salesDataMap.get(date) || 0) + (order.total || 0))
    }
    const salesData = Array.from(salesDataMap.entries()).map(([date, sales]) => ({ date, sales }))

    // Top products by sales
    const productSalesMap = new Map<string, { id: string, name: string, stock_quantity: number, sales: number }>()
    for (const order of orders) {
      for (const item of order.items || []) {
        const prod = products.find((p: any) => p.id === item.product_id)
        if (!prod) continue
        const key = prod.id
        if (!productSalesMap.has(key)) {
          productSalesMap.set(key, { id: prod.id, name: prod.name, stock_quantity: prod.stock_quantity || 0, sales: 0 })
        }
        productSalesMap.get(key)!.sales += item.quantity || 0
      }
    }
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5)
      .map(({ id, name, stock_quantity }) => ({ id, name, stock_quantity }))

    // Inventory status
    let inStock = 0, lowStock = 0, outOfStock = 0
    for (const prod of products) {
      if (prod.stock_quantity > 10) inStock++
      else if (prod.stock_quantity > 0) lowStock++
      else outOfStock++
    }
    const inventoryStatus = { inStock, lowStock, outOfStock }

    // Recent activity (mocked as recent orders)
    const recentActivity = orders.slice(-10).map((order: any) => ({
      id: order.id,
      customer_name: order.customer_name || "",
      activity_type: "Order",
      timestamp: order.created_at,
    }))

    // Performance metrics (mocked)
    const performanceMetrics = [
      { name: "Revenue Growth", value: 12, change: 2 },
      { name: "Order Fulfillment", value: 98, change: 1 },
      { name: "Customer Retention", value: 87, change: -1 },
    ]

    // Sales forecast (mocked)
    const salesForecast = salesData.slice(-6).map(({ date, sales }) => ({ date, prediction: sales * 1.05 }))

    // Compose dashboard data
    const dashboardData = {
      totalRevenue: orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
      totalCustomers: customers.length,
      totalOrders: orders.length,
      totalTickets: tickets.length,
      salesData,
      topProducts,
      inventoryStatus,
      recentActivity,
      performanceMetrics,
      salesForecast,
    }

    return NextResponse.json(dashboardData)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch dashboard data" }, { status: 500 })
  }
} 