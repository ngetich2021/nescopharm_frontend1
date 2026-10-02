import apiCall from "@/lib/api"

export interface Company {
  id: string
  name: string
  description?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  website?: string | null
  logo_url?: string | null
  letterhead_url?: string | null
  bank_name?: string | null
  bank_account_name?: string | null
  bank_account_number?: string | null
  bank_branch?: string | null
  mpesa_paybill?: string | null
  mpesa_account_number?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  is_first_time: boolean
}

export async function getCompany(companyId: string): Promise<Company | null> {
  try {
    if (!companyId) throw new Error("No companyId provided")
    const response = await apiCall<{
      status: string;
      message: any;
      company: Company;
    }>(`/companies/${companyId}`, "GET", undefined, true)
    if (response.status === "success" && response.company) {
      return response.company
    } else {
      const errorMessage = typeof response.message === "string"
        ? response.message
        : "Failed to fetch company details"
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch company: ${error.message || "Unknown error"}`)
  }
} 