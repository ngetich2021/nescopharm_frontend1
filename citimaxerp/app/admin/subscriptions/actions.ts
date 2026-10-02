"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import apiCall from "@/lib/api"
import type { Subscription, Company } from "@/app/types"

// Combined type for subscription with company details
type SubscriptionWithCompany = Subscription & { 
  company: Pick<Company, "id" | "name"> | null 
}

export async function fetchAllSubscriptions(): Promise<{
  success: boolean
  data?: SubscriptionWithCompany[]
  error?: string
}> {
  try {
    const subscriptions = await apiCall<SubscriptionWithCompany[]>("/admin/subscriptions", "GET", undefined, true)
    return { success: true, data: subscriptions }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to fetch subscriptions",
    }
  }
}

export async function updateSubscription(id: string, formData: FormData) {
  try {
    formData.append("_method", "PUT")
    await apiCall(`/admin/subscriptions/${id}`, "POST", formData, true)
  } catch (error) {
    return { message: "Unexpected Error: Failed to Update Subscription." }
  }

  revalidatePath("/admin/subscriptions")
  return { message: "Subscription updated successfully." }
}

export async function createSubscription(formData: FormData) {
  try {
    await apiCall("/admin/subscriptions", "POST", formData, true)
  } catch (error) {
    return { message: "Unexpected Error: Failed to Create Subscription." }
  }

  revalidatePath("/admin/subscriptions")
  redirect("/admin/subscriptions")
}

export async function deleteSubscription(id: string) {
  try {
    await apiCall(`/admin/subscriptions/${id}`, "DELETE", undefined, true)
  } catch (error) {
    return { message: "Unexpected Error: Failed to Delete Subscription." }
  }

  revalidatePath("/admin/subscriptions")
}
