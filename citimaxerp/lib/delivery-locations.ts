import apiCall from "./api"

/**
 * Interface for delivery location data
 */
export interface DeliveryLocation {
  id: string;
  customer_id: string;
  house_number: string;
  estate: string | null;
  landmark: string | null;
  city: string;
  state: string | null;
  country: string;
  postal_code: string | null;
  is_default: boolean;
  location_note: string | null;
  created_at: string;
  updated_at: string;
  company_id: string;
}

/**
 * Interface for creating a new delivery location
 */
export interface CreateDeliveryLocationData {
   id: string;
  customer_id: string;
  house_number: string;
  estate: string | null;
  landmark: string | null;
  city: string;
  state: string | null;
  country: string;
  postal_code: string | null;
  is_default: boolean;
  location_note: string | null;
  created_at: string;
  updated_at: string;
  company_id: string;
}

/**
 * Interface for delivery location API responses
 */
interface DeliveryLocationsResponse {
  status: string;
  delivery_locations: DeliveryLocation[];
  message?: string;
}

interface SingleDeliveryLocationResponse {
  status: string;
  delivery_location: DeliveryLocation;
  message?: string;
}

/**
 * Fetch delivery locations for a customer
 * @param customerId The customer ID to fetch delivery locations for
 * @returns Promise with an array of delivery locations
 */
export async function getDeliveryLocations(customerId: string): Promise<DeliveryLocation[]> {
  try {
    // Make API call with authentication required
    const response = await apiCall<DeliveryLocationsResponse>(
      `/customers/${customerId}/delivery-locations`,
      "GET",
      undefined,
      true
    );
    
    if (response.status === "success" && response.delivery_locations) {
      return response.delivery_locations;
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : `Failed to fetch delivery locations for customer ${customerId}`;
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch delivery locations: ${error.message || "Unknown error"}`);
  }
}

/**
 * Create a new delivery location for a customer
 * @param data The delivery location data to create
 * @returns Promise with the created delivery location
 */
export async function createDeliveryLocation(data: CreateDeliveryLocationData): Promise<DeliveryLocation> {
  try {
    // Make API call with authentication required
    const response = await apiCall<SingleDeliveryLocationResponse>(
      `/delivery-locations`,
      "POST",
      data,
      true
    );
    
    if (response.status === "success" && response.delivery_location) {
      return response.delivery_location;
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : `Failed to create delivery location for customer ${data.customer_id}`;
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to create delivery location: ${error.message || "Unknown error"}`);
  }
}

/**
 * Update an existing delivery location
 * @param locationId The ID of the location to update
 * @param data The updated delivery location data
 * @returns Promise with the updated delivery location
 */
export async function updateDeliveryLocation(
  locationId: string, 
  data: Partial<CreateDeliveryLocationData>
): Promise<DeliveryLocation> {
  try {
    // Make API call with authentication required
    const response = await apiCall<SingleDeliveryLocationResponse>(
      `/delivery-locations/${locationId}`,
      "POST",
      data,
      true
    );
    
    if (response.status === "success" && response.delivery_location) {
      return response.delivery_location;
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : `Failed to update delivery location ${locationId}`;
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to update delivery location: ${error.message || "Unknown error"}`);
  }
}

/**
 * Delete a delivery location
 * @param locationId The ID of the location to delete
 * @returns Promise with a boolean indicating success
 */
export async function deleteDeliveryLocation(locationId: string): Promise<boolean> {
  try {
    // Make API call with authentication required
    const response = await apiCall<{status: string; message?: string}>(
      `/delivery-locations/${locationId}`,
      "DELETE",
      undefined,
      true
    );
    
    if (response.status === "success") {
      return true;
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : `Failed to delete delivery location ${locationId}`;
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to delete delivery location: ${error.message || "Unknown error"}`);
  }
}
