import apiCall from "./api";

export interface LogisticsDeliveryPerson {
  id: string;
  company_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  residential_address: string;
  availability_status: string;
  total_deliveries: number;
  created_at: string;
  updated_at: string;
  [key: string]: any; // For other fields in the response
}

export interface LogisticsOrder {
  id: string;
  order_number: string;
  customer_id: string;
  total_amount: string;
  status: string;
  created_at: string;
  updated_at: string;
  company_id: string;
  notes: string | null;
  discount: string;
  final_amount: string;
  payment_status: string | null;
  [key: string]: any; // For other fields in the response
}

export interface Logistics {
  id: string;
  order_id: string;
  delivery_person_id: string | null;
  delivery_method: string;
  tracking_number: string;
  transporter_invoice_number?: string | null;
  delivery_status: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  delivery_location: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  country: string | null;
  delivery_cost: string | null;
  amount_paid: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  cheque_number: string | null;
  bank_name: string | null;
  cheque_maturity_date: string | null;
  dispatch_time: string | null;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  delivery_note_file?: string | null;
  delivery_note_url?: string | null;
  delivery_note_uploaded_at?: string | null;
  delivery_note_status?: 'pending_review' | 'approved' | 'resubmit_requested' | null;
  delivery_note_reviewed_at?: string | null;
  delivery_note_review_comment?: string | null;
  delivery_note_reviewed_by?: { id: string; first_name?: string; last_name?: string } | string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  company_id: string;
  order?: LogisticsOrder;
  order_dispatch?: { id: string; dispatch_number: string; order_id?: string; [key: string]: any };
  delivery_person: LogisticsDeliveryPerson | null;
  [key: string]: any; // For other fields in the response
}

export interface LogisticsResponse {
  status: string;
  message: string;
  logistics: Logistics[];
}

export interface LogisticsSummary {
  total: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
  pending: number;
  in_transit: number;
}

/**
 * Fetches logistics data from the API
 * @param filters Optional filters
 * @returns Promise with logistics data
 */
export interface LogisticsPaginatedResponse {
  data: Logistics[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export async function getLogisticsPaginated(
  filters: {
    search?: string;
    status?: string;
    page?: number;
    per_page?: number;
  } = {}
): Promise<LogisticsPaginatedResponse> {
  if (typeof window === 'undefined') {
    return { data: [], meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } };
  }

  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.status && filters.status !== 'all') queryParams.append('delivery_status', filters.status);
  if (filters.page) queryParams.append('page', filters.page.toString());
  if (filters.per_page) queryParams.append('per_page', filters.per_page.toString());

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  try {
    const response = await apiCall<any>(`/logistics${queryString}`, 'GET', undefined, true);
    if (response.status === 'success') {
      return {
        data: response.logistics || [],
        meta: response.meta || { current_page: 1, last_page: 1, per_page: 15, total: (response.logistics || []).length },
      };
    }
    return { data: [], meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } };
  } catch {
    return { data: [], meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } };
  }
}

export async function getLogistics(
  filters: {
    search?: string;
    status?: string;
    dateRange?: { from: string; to: string };
  } = {}
): Promise<Logistics[]> {
  try {
    if (typeof window === 'undefined') {
      return [];
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
    if (filters.dateRange?.from) queryParams.append('from_date', filters.dateRange.from);
    if (filters.dateRange?.to) queryParams.append('to_date', filters.dateRange.to);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    
    try {
      // Make API call with authentication required
      const response = await apiCall<LogisticsResponse>(
        `/logistics${queryString}`,
        "GET",
        undefined,
        true
      );
      
      if (response.status === "success" && response.logistics) {
        return response.logistics;
      } else {
        // Convert potential object error message to string
        const errorMessage = typeof response.message === "string" 
          ? response.message 
          : "Failed to fetch logistics data";
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Handle specific role-related errors from the API
      if (error.message && error.message.includes("role")) {
        return [];
      }
      
      // Handle API route not found errors
      if (error.message?.includes("could not be found") || 
          error.message?.includes("404") || 
          error.message?.includes("500")) {
        return [];
      }
      
      throw error;
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch logistics data: ${error.message || "Unknown error"}`);
  }
}

/**
 * Calculates logistics summary from logistics data
 * @param logistics Array of logistics entries
 * @returns Summary object with counts by status
 */
export function calculateLogisticsSummary(logistics: Logistics[]): LogisticsSummary {
  return {
    total: logistics.length,
    dispatched: logistics.filter(item => item.delivery_status === 'dispatched').length,
    delivered: logistics.filter(item => item.delivery_status === 'delivered').length,
    cancelled: logistics.filter(item => item.delivery_status === 'cancelled').length,
    pending: logistics.filter(item => item.delivery_status === 'pending').length,
    in_transit: logistics.filter(item => item.delivery_status === 'in_transit').length,
  };
}

/**
 * Fetches logistics summary data - client-side only
 * @returns Promise with logistics summary
 */
export async function getLogisticsSummary(): Promise<LogisticsSummary> {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return {
        total: 0,
        dispatched: 0,
        delivered: 0,
        cancelled: 0,
        pending: 0,
        in_transit: 0,
      };
    }
    
    const logistics = await getLogistics();
    return calculateLogisticsSummary(logistics);
  } catch (error) {
    // Return default empty summary on error
    return {
      total: 0,
      dispatched: 0,
      delivered: 0,
      cancelled: 0,
      pending: 0,
      in_transit: 0,
    };
  }
}

/**
 * Creates a new logistics entry for an order dispatch
 * @param logisticsData The logistics data to create
 * @returns Promise with the created logistics entry
 * 
 * Required Fields:
 * - order_dispatch_id: UUID of the dispatch order
 * - delivery_status: One of dispatched, in_transit, delivered, failed, returned, cancelled
 * 
 * Optional Fields:
 * - delivery_person_id, logistics_provider, delivery_method, vehicle_type, vehicle_id
 * - tracking_number, recipient_name, recipient_phone, delivery_address
 * - city, estimated_delivery_time, notes
 */
export interface CreateLogisticsData {
  // Required Fields
  order_dispatch_id: string;
  delivery_status: string;

  // Optional Fields
  delivery_person_id?: string;
  logistics_provider?: string;
  delivery_method?: string;
  vehicle_type?: string;
  vehicle_id?: string;
  tracking_number?: string;
  transporter_invoice_number?: string;
  recipient_name?: string;
  recipient_phone?: string;
  delivery_address?: string;
  // Human-readable delivery destination (e.g. a landmark or building name),
  // paired with a county/region picked from Kenya's administrative units.
  delivery_location?: string;
  city?: string;
  state?: string;
  region?: string;
  country?: string;
  // What was paid to the delivery/logistics provider for this dispatch -
  // distinct from the customer's payment for the goods themselves.
  delivery_cost?: number;
  amount_paid?: number;
  payment_method?: string;
  payment_reference?: string;
  payment_date?: string;
  // Only meaningful when payment_method is "cheque".
  cheque_number?: string;
  bank_name?: string;
  cheque_maturity_date?: string;
  estimated_delivery_time?: string;
  notes?: string;
  // Rate-based path: pick an approved transporter+zone rate and enter the
  // carton count - the app computes delivery_cost and raises a Delivery
  // Invoice for accounting instead of the manual payment fields above.
  delivery_rate_id?: string;
  number_of_cartons?: number;
}

interface CreateLogisticsResponse {
  status: string;
  message: string;
  logistic: Logistics;
}

export interface UpdateLogisticsData {
  delivery_status?: string;
  notes?: string;
  actual_delivery_time?: string;
  delivery_method?: string;
  tracking_number?: string;
  recipient_name?: string;
  recipient_phone?: string;
  delivery_address?: string;
  update_order_status?: boolean;
}

export async function updateLogistics(id: string, data: UpdateLogisticsData): Promise<Logistics> {
  try {
    const response = await apiCall<CreateLogisticsResponse>(
      `/logistics/${id}`,
      'PUT',
      data,
      true
    );

    if (response.status === 'success' && response.logistic) {
      return response.logistic;
    } else {
      const errorMessage = typeof response.message === 'string'
        ? response.message
        : 'Failed to update logistics entry';
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to update logistics: ${error.message || 'Unknown error'}`);
  }
}

export async function createLogistics(data: CreateLogisticsData): Promise<Logistics> {
  try {
    const response = await apiCall<CreateLogisticsResponse>(
      '/logistics',
      'POST',
      data,
      true
    );

    if (response.status === 'success' && response.logistic) {
      return response.logistic;
    } else {
      const errorMessage = typeof response.message === 'string'
        ? response.message
        : 'Failed to create logistics entry';
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to create logistics entry: ${error.message || 'Unknown error'}`);
  }
}

export async function uploadDeliveryNote(logisticsId: string, file: File): Promise<Logistics> {
  try {
    const formData = new FormData();
    formData.append('delivery_note', file);

    const response = await apiCall<CreateLogisticsResponse>(
      `/logistics/${logisticsId}/upload-delivery-note`,
      'POST',
      formData,
      true
    );

    if (response.status === 'success' && response.logistic) {
      return response.logistic;
    } else {
      const errorMessage = typeof response.message === 'string'
        ? response.message
        : 'Failed to upload delivery note';
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`Failed to upload delivery note: ${error.message || 'Unknown error'}`);
  }
}

export async function reviewDeliveryNote(
  logisticsId: string,
  action: 'approve' | 'resubmit',
  comment?: string
): Promise<Logistics> {
  const response = await apiCall<CreateLogisticsResponse>(
    `/logistics/${logisticsId}/review-delivery-note`,
    'POST',
    { action, comment },
    true
  );
  if (response.status === 'success' && response.logistic) {
    return response.logistic;
  }
  throw new Error(typeof response.message === 'string' ? response.message : 'Failed to review delivery note');
}
