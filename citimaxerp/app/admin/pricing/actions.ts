"use server"

import apiCall from "@/lib/api"
import { revalidatePath } from "next/cache"
import { SubscriptionPlan } from "@/app/types"

export async function fetchAllPricingPlans(): Promise<{
  data: SubscriptionPlan[] | null
  error: string | null
}> {
  try {
    const plans = await apiCall<SubscriptionPlan[]>("/admin/pricing", "GET", undefined, true)
    return { data: plans, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function createPricingPlan(formData: FormData) {
  try {
    const data = await apiCall<SubscriptionPlan>("/admin/pricing", "POST", formData, true)
    revalidatePath("/admin/pricing")
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function updatePricingPlan(id: string, formData: FormData) {
  try {
    formData.append("_method", "PUT")
    const data = await apiCall<SubscriptionPlan>(`/admin/pricing/${id}`, "POST", formData, true)
    revalidatePath("/admin/pricing")
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}

export async function deletePricingPlan(id: string) {
  try {
    await apiCall(`/admin/pricing/${id}`, "DELETE", undefined, true)
    revalidatePath("/admin/pricing")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}
