"use server"

import apiCall from "@/lib/api"

export async function cleanupUserAndCompany(userId: string, companyId?: string) {
  try {
    // Delete user from the API
    await apiCall(`/admin/users/${userId}`, "DELETE")
    
    // If a company ID is provided, check if there are other users in that company
    // If not, delete the company
    if (companyId) {
      try {
        const otherUsers = await apiCall(`/users?company_id=${companyId}&limit=1`, "GET")
        if (!Array.isArray(otherUsers) || otherUsers.length === 0) {
          await apiCall(`/admin/companies/${companyId}`, "DELETE")
        }
      } catch (error) {
        // console.error("Error checking for other users in company:", error)
      }
    }

    return { success: true }
  } catch (error: any) {
    // console.error("Error during user cleanup:", error)
    return { success: false, error: error.message }
  }
}
