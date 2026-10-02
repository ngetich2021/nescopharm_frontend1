import apiCall from "./api"
import type {
  SerialNumber,
  SerialNumberSummary,
  SerialNumberStatistics
} from "@/types/serial-numbers"

// List all serial numbers with filtering and pagination
export async function getSerialNumbers(filters: {
  store_id?: string
  product_id?: string
  status?: string
  serial_number?: string
  sort_by?: string
  sort_order?: string
  page?: number
  per_page?: number
} = {}): Promise<{ data: SerialNumber[]; total: number; current_page: number; per_page: number; last_page: number }> {
  try {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await apiCall<any>(`/serials${queryString}`, "GET", undefined, true)
    
    if (response.status === "success") {
      return {
        data: response.data?.data || [],
        total: response.data?.total || 0,
        current_page: response.data?.current_page || 1,
        per_page: response.data?.per_page || 20,
        last_page: response.data?.last_page || 1
      }
    } else {
      throw new Error(response.message || "Failed to fetch serial numbers")
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch serial numbers: ${error.message || "Unknown error"}`)
  }
}

// Create new serial numbers for a product
export async function createProductSerialNumbers(
  productId: string,
  serialData: {
    store_id?: string
    batch_id?: string
    serial_numbers: string[]
    purchase_reference?: string
    notes?: string
  }
): Promise<SerialNumber[]> {
  try {
    // Prepare the payload to match the exact API specification
    const payload = {
      store_id: serialData.store_id,
      batch_id: serialData.batch_id,
      serial_numbers: serialData.serial_numbers,
      purchase_reference: serialData.purchase_reference,
      notes: serialData.notes
    };

    // Remove undefined fields to match the API specification exactly
    Object.keys(payload).forEach(key => {
      if (payload[key as keyof typeof payload] === undefined) {
        delete payload[key as keyof typeof payload];
      }
    });

    const response = await apiCall<{ status: string; message: string; data: SerialNumber[] }>(
      `/products/${productId}/serials`,
      "POST",
      payload,
      true
    )
    
    if (response.status === "success") {
      return response.data
    } else {
      throw new Error(response.message || "Failed to create serial numbers")
    }
  } catch (error: any) {
    throw new Error(`Failed to create serial numbers: ${error.message || "Unknown error"}`)
  }
}

// Create new serial number
export async function createSerialNumber(serialData: Partial<SerialNumber>): Promise<SerialNumber> {
  try {
    const response = await apiCall<{ status: string; message: string; data: SerialNumber }>(
      `/serials`,
      "POST",
      serialData,
      true
    )
    
    if (response.status === "success") {
      return response.data
    } else {
      throw new Error(response.message || "Failed to create serial number")
    }
  } catch (error: any) {
    throw new Error(`Failed to create serial number: ${error.message || "Unknown error"}`)
  }
}

// Get serial number details
export async function getSerialNumberDetails(serialId: string): Promise<SerialNumber> {
  try {
    const response = await apiCall<{ status: string; message: string; data: SerialNumber }>(
      `/serials/${serialId}`,
      "GET",
      undefined,
      true
    )
    
    if (response.status === "success") {
      return response.data
    } else {
      throw new Error(response.message || "Failed to fetch serial number details")
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch serial number details: ${error.message || "Unknown error"}`)
  }
}

// Update serial number
export async function updateSerialNumber(serialId: string, serialData: Partial<SerialNumber>): Promise<SerialNumber> {
  try {
    const response = await apiCall<{ status: string; message: string; data: SerialNumber }>(
      `/serials/${serialId}`,
      "PUT",
      serialData,
      true
    )
    
    if (response.status === "success") {
      return response.data
    } else {
      throw new Error(response.message || "Failed to update serial number")
    }
  } catch (error: any) {
    throw new Error(`Failed to update serial number: ${error.message || "Unknown error"}`)
  }
}

// Delete serial number
export async function deleteSerialNumber(serialId: string): Promise<void> {
  try {
    const response = await apiCall<{ status: string; message: string }>(
      `/serials/${serialId}`,
      "DELETE",
      undefined,
      true
    )
    
    if (response.status !== "success") {
      throw new Error(response.message || "Failed to delete serial number")
    }
  } catch (error: any) {
    throw new Error(`Failed to delete serial number: ${error.message || "Unknown error"}`)
  }
}

// Assign batch to serial number
export async function assignBatchToSerialNumber(serialId: string, batchId: string): Promise<SerialNumber> {
  try {
    const response = await apiCall<{ status: string; message: string; data: SerialNumber }>(
      `/serials/${serialId}/assign-batch`,
      "POST",
      { batch_id: batchId },
      true
    )
    
    if (response.status === "success") {
      return response.data
    } else {
      throw new Error(response.message || "Failed to assign batch to serial number")
    }
  } catch (error: any) {
    throw new Error(`Failed to assign batch to serial number: ${error.message || "Unknown error"}`)
  }
}

// Get serial number statistics data
export async function getSerialNumberStatistics(): Promise<SerialNumberStatistics> {
  try {
    const response = await apiCall<{ status: string; message: string; data: { statistics: SerialNumberStatistics } }>(
      `/serials/statistics`,
      "GET",
      undefined,
      true
    )
    
    if (response.status === "success") {
      return response.data.statistics
    } else {
      throw new Error(response.message || "Failed to fetch serial number statistics")
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch serial number statistics: ${error.message || "Unknown error"}`)
  }
}

// Get serial number summary data
export async function getSerialNumberSummary(filters: {
  product_id?: string
  status?: string
} = {}): Promise<SerialNumberSummary> {
  try {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const response = await apiCall<{ status: string; message: string; data: SerialNumberSummary }>(
      `/serials/summary${queryString}`,
      "GET",
      undefined,
      true
    )
    
    if (response.status === "success") {
      return response.data
    } else {
      throw new Error(response.message || "Failed to fetch serial number summary")
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch serial number summary: ${error.message || "Unknown error"}`)
  }
}