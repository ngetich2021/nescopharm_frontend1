"use server"

import apiCall from "@/lib/api"
import type { Payment } from "@/app/types"

export async function fetchAllPayments(): Promise<Payment[]> {
  try {
    return await apiCall<Payment[]>("/admin/payments", "GET")
  } catch (error) {
    throw new Error("Failed to fetch all payments.")
  }
}
