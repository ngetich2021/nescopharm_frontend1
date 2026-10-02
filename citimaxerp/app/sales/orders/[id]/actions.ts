"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { updateMockOrder, deleteMockOrder } from "@/lib/mock-sales-data" // Import mock data functions

// Mock auth function for server actions
async function mockAuth() {
  // Simulate a logged-in user with a company ID
  return {
    user: {
      id: "mock-user-id",
      user_metadata: { company_id: "company-1" }, // Use a consistent mock company ID
    },
  }
}

const orderSchema = z.object({
  id: z.string().optional(), // Make ID optional for updates
  customer_id: z.string(),
  total_amount: z.number(), // Changed from 'amount' to 'total_amount' to match schema
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "dispatch_initiated"]), // Added dispatch_initiated
  notes: z.string().optional().nullable(),
  delivery_location_id: z.string().optional().nullable(),
})

export async function updateOrder(id: string, formData: FormData) {
  const session = await mockAuth()
  if (!session?.user) {
    return { message: "Unauthorized" }
  }
  const userCompanyId = session.user.user_metadata?.company_id as string
  if (!userCompanyId) {
    return { message: "Company ID not found for user." }
  }

  const rawFormData = {
    customer_id: formData.get("customer_id") as string,
    total_amount: Number(formData.get("total_amount")), // Match schema
    status: formData.get("status") as string,
    notes: formData.get("notes") as string,
    delivery_location_id: formData.get("delivery_location_id") as string,
  }

  const validatedFields = orderSchema.omit({ id: true }).safeParse(rawFormData)

  if (!validatedFields.success) {
    return {
      message: "Missing Fields. Failed to Update Order.",
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const { customer_id, total_amount, status, notes, delivery_location_id } = validatedFields.data

  try {
    const result = await updateMockOrder(
      id,
      {
        customer_id,
        total_amount,
        status,
        notes,
        delivery_location_id,
      },
      userCompanyId,
    )

    if (!result) {
      return {
        message: "Mock Database Error: Failed to Update Order.",
      }
    }
  } catch (error) {
    return {
      message: "Unexpected Error: Failed to Update Order.",
    }
  }

  revalidatePath("/sales/orders")
  revalidatePath(`/sales/orders/${id}`)
  // No redirect here, as this is a server action for a detail page
  return { message: "Order updated successfully." }
}

export async function deleteOrder(id: string) {
  const session = await mockAuth()
  if (!session?.user) {
    return { message: "Unauthorized" }
  }
  const userCompanyId = session.user.user_metadata?.company_id as string
  if (!userCompanyId) {
    return { message: "Company ID not found for user." }
  }

  try {
    const result = await deleteMockOrder(id, userCompanyId)

    if (!result) {
      return { message: "Mock Database Error: Failed to Delete Order." }
    }
    revalidatePath("/sales/orders")
    return { message: "Deleted Order." }
  } catch (error) {
    return { message: "Unexpected Error: Failed to Delete Order." }
  }
}
