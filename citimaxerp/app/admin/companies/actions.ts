"use server"

import apiCall from "@/lib/api"
import type { Company } from "@/app/types"

export async function fetchCompanies(): Promise<Company[]> {
  try {
    return await apiCall<Company[]>("/admin/companies", "GET")
  } catch (error) {
    return []
  }
}

// Export with the exact name expected
export async function fetchAllCompanies(): Promise<Company[]> {
  return fetchCompanies()
}

export async function createCompany(companyData: {
  name: string
  email?: string
  phone?: string
  address?: string
  is_active: boolean
}): Promise<{ success: boolean; message: string; data?: Company }> {
  try {
    const company = await apiCall<Company>("/admin/companies", "POST", companyData)
    return { success: true, message: "Company created successfully", data: company }
  } catch (error) {
    return { success: false, message: "Failed to create company" }
  }
}

export async function updateCompany(
  id: string,
  companyData: Partial<Company>,
): Promise<{ success: boolean; message: string; data?: Company }> {
  try {
    const company = await apiCall<Company>(`/admin/companies/${id}`, "PUT", companyData)
    return { success: true, message: "Company updated successfully", data: company }
  } catch (error) {
    return { success: false, message: "Failed to update company" }
  }
}

export async function deleteCompany(id: string): Promise<{ success: boolean; message: string }> {
  try {
    await apiCall(`/admin/companies/${id}`, "DELETE")
    return { success: true, message: "Company deleted successfully" }
  } catch (error) {
    return { success: false, message: "Failed to delete company" }
  }
}
