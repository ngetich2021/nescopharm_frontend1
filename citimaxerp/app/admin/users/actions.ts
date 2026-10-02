"use server"

import apiCall from "@/lib/api"
import type { User, Company, Role } from "@/app/types"
import { revalidatePath } from "next/cache"

export async function fetchAllUsers(): Promise<User[]> {
  try {
    return await apiCall<User[]>("/admin/users", "GET")
  } catch (error) {
    throw new Error("Failed to fetch all users.")
  }
}

export async function fetchAllCompaniesForUserCreation(): Promise<Pick<Company, "id" | "name">[]> {
  try {
    const companies = await apiCall<Company[]>("/admin/companies", "GET")
    return companies.map(({ id, name }) => ({ id, name }))
  } catch (error) {
    throw new Error("Failed to fetch companies for user creation.")
  }
}

export async function fetchRolesForCompany(companyId: string): Promise<Pick<Role, "id" | "name">[]> {
  try {
    const roles = await apiCall<Role[]>(`/admin/companies/${companyId}/roles`, "GET")
    return roles.map(({ id, name }) => ({ id, name }))
  } catch (error) {
    throw new Error(`Failed to fetch roles for company ${companyId}.`)
  }
}

export async function createGlobalUser(formData: FormData) {
  try {
    await apiCall("/admin/users", "POST", formData)
    revalidatePath("/admin/users")
    return { success: true, message: "User created successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create user." }
  }
}

export async function updateGlobalUser(userId: string, formData: FormData) {
  try {
    // Using POST with _method=PUT for FormData compatibility
    formData.append("_method", "PUT");
    await apiCall(`/admin/users/${userId}`, "POST", formData)
    revalidatePath("/admin/users")
    return { success: true, message: "User updated successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update user." }
  }
}

export async function deleteGlobalUser(userId: string) {
  try {
    await apiCall(`/admin/users/${userId}`, "DELETE")
    revalidatePath("/admin/users")
    return { success: true, message: "User deleted successfully." }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete user." }
  }
}
