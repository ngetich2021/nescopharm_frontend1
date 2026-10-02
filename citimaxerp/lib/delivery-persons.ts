import apiCall from "./api"

/**
 * Interface for delivery person data
 */
export interface DeliveryPerson {
  availability_status: any;
  phone_number: string;
  full_name: string;
  id: string;
  company_id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface for creating a new delivery person
 */
export interface CreateDeliveryPersonData {
  full_name: string;       // Required - max 100 chars
  phone_number: string;    // Required - Kenyan format, must be unique
}

/**
 * Interface for delivery person API responses
 */
interface DeliveryPersonsResponse {
  status: string;
  delivery_persons: DeliveryPerson[];
  message?: string;
}

interface SingleDeliveryPersonResponse {
  status: string;
  delivery_person: DeliveryPerson;
  message?: string;
}

/**
 * Fetch delivery persons for a company
 * @param companyId The company ID (unused, inferred from auth token)
 * @returns Promise with an array of delivery persons
 */
export async function getDeliveryPersons(companyId?: string): Promise<DeliveryPerson[]> {
  try {
    // Make API call with authentication required
    // Note: company_id is inferred from the auth token on the backend
    const response = await apiCall<DeliveryPersonsResponse>(
      `/delivery-people`,
      "GET",
      undefined,
      true
    );

    if (response.status === "success" && response.delivery_persons) {
      return response.delivery_persons;
    } else {
      const errorMessage = typeof response.message === "string"
        ? response.message
        : `Failed to fetch delivery persons`;
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch delivery persons: ${error.message || "Unknown error"}`);
  }
}

/**
 * Create a new delivery person
 * @param companyId The company ID to create the delivery person for
 * @param data The delivery person data to create
 * @returns Promise with the created delivery person
 */
export async function createDeliveryPerson(
  companyId: string,
  data: CreateDeliveryPersonData
): Promise<DeliveryPerson> {
  try {
    // Make API call with authentication required
    const response = await apiCall<SingleDeliveryPersonResponse>(
      `/delivery-people`,
      "POST",
      { ...data, company_id: companyId },
      true
    );

    if (response.status === "success" && response.delivery_person) {
      return response.delivery_person;
    } else {
      const errorMessage = typeof response.message === "string"
        ? response.message
        : `Failed to create delivery person for company ${companyId}`;
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to create delivery person: ${error.message || "Unknown error"}`);
  }
}
