"use server"

import apiCall from "@/lib/api"

export async function fetchDashboardSummary() {
  try {
    const data = await apiCall("/admin/dashboard/summary", "GET")
    return data || {
      totalRevenue: 0,
      totalUsers: 0,
      activeSubscriptions: 0,
      openTickets: 0,
    }
  } catch (error) {
    return {
      totalRevenue: 0,
      totalUsers: 0,
      activeSubscriptions: 0,
      openTickets: 0,
    }
  }
}

export async function fetchRecentActivity() {
  try {
    const data = await apiCall("/admin/dashboard/recent-activity", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}
