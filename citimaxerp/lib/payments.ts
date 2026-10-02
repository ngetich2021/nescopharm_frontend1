import apiCall from "./api";

export interface PaymentCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  company_id: string;
  customer_type?: string | null;
  business_name?: string | null;
  [key: string]: any; // For other fields in the response
}

export interface PaymentOrder {
  id: string;
  order_number: string;
  customer_id: string;
  total_amount: string;
  status: string;
  final_amount: string;
  payment_status: string | null;
  [key: string]: any; // For other fields in the response
}

export interface Payment {
  id: string;
  order_id?: string | null; // Made optional since payments don't always need orders
  invoice_id?: string | null; // Added for invoice mapping functionality
  payment_method: string;
  transaction_id: string | null;
  amount_paid: string;
  status: string;
  created_at: string;
  payment_date: string | null;
  customer_id?: string; // Made optional since not all payments may have customer_id
  company_id: string;
  order?: PaymentOrder | null; // Made optional since order might not exist
  customer?: PaymentCustomer | null; // Made optional since customer might not exist
  [key: string]: any; // For other fields in the response
}

export interface PaymentResponse {
  status: string;
  message: string;
  payments: Payment[];
}

export interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
}

/**
 * Fetches payments data from the API - client-side only
 * @param filters Optional filters including company_id
 * @returns Promise with payments data
 */
export async function getPayments(
  filters: {
    company_id?: string;
    search?: string;
    status?: string;
    dateRange?: { from: string; to: string };
  } = {}
): Promise<Payment[]> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      return [];
    }
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    if (filters.company_id) queryParams.append('company_id', filters.company_id);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
    if (filters.dateRange?.from) queryParams.append('from_date', filters.dateRange.from);
    if (filters.dateRange?.to) queryParams.append('to_date', filters.dateRange.to);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    
    try {
      // Make API call WITH authentication required
      const response = await apiCall<PaymentResponse>(
        `/payments${queryString}`,
        "GET",
        undefined,
        true
      );
      
      if (response.status === "success" && response.payments) {
        return response.payments;
      } else {
        // Convert potential object error message to string
        const errorMessage = typeof response.message === "string" 
          ? response.message 
          : "Failed to fetch payments data";
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
    throw new Error(`Failed to fetch payments data: ${error.message || "Unknown error"}`);
  }
}

/**
 * Calculates payment summary from payments data
 * @param payments Array of payment entries
 * @returns Summary object with counts and totals
 */
export function calculatePaymentSummary(payments: Payment[]): PaymentSummary {
  const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount_paid || "0"), 0);
  
  return {
    totalPayments: payments.length,
    totalAmount,
    completedPayments: payments.filter(item => item.status === 'completed').length,
    pendingPayments: payments.filter(item => item.status === 'pending').length,
    failedPayments: payments.filter(item => item.status === 'failed').length,
  };
}

/**
 * Fetches payment summary data - client-side only
 * @param company_id Optional company ID to filter payments
 * @returns Promise with payment summary
 */
export async function getPaymentSummary(company_id?: string): Promise<PaymentSummary> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      throw new Error("getPaymentSummary must be called client-side");
    }
    
    const payments = await getPayments(company_id ? { company_id } : {});
    return calculatePaymentSummary(payments);
  } catch (error: any) {
    // Handle role-related errors specifically
    if (error.message && error.message.includes("role")) {
      return {
        totalPayments: 0,
        totalAmount: 0,
        completedPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
      };
    }
    
    // Return default empty summary on error
    return {
      totalPayments: 0,
      totalAmount: 0,
      completedPayments: 0,
      pendingPayments: 0,
      failedPayments: 0,
    };
  }
}

/**
 * Fetches a single payment by ID
 * @param paymentId The ID of the payment to fetch
 * @returns Promise with payment data
 */
export async function getPaymentById(paymentId: string): Promise<Payment | null> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      throw new Error("getPaymentById must be called client-side");
    }
    
    try {
      // Make API call WITH authentication required
      const response = await apiCall<{ status: string; message: string; payment: Payment }>(
        `/payments/${paymentId}`,
        "GET",
        undefined,
        true
      );
      
      if (response.status === "success" && response.payment) {
        return response.payment;
      } else {
        // Convert potential object error message to string
        const errorMessage = typeof response.message === "string" 
          ? response.message 
          : "Failed to fetch payment details";
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Handle specific role-related errors from the API
      if (error.message && error.message.includes("role")) {
        return null;
      }
      throw error;
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch payment details: ${error.message || "Unknown error"}`);
  }
}

export interface CreatePaymentPayload {
  order_id?: string;
  payment_method: string;
  amount_paid: number;
  transaction_id?: string;
  payment_date?: string;
  status: string;
  generate_invoice?: boolean;
  customer_id?: string;
}

/**
 * Creates a new payment
 * @param paymentData The payment data to create
 * @returns Promise with the created payment
 */
export async function createPayment(payload: CreatePaymentPayload): Promise<Payment> {
  try {
    if (typeof window === 'undefined') {
      throw new Error("createPayment must be called client-side");
    }
    
    // Clean up the payload - remove undefined or empty string values
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => 
        value !== undefined && value !== null && value !== ''
      )
    );
    
    console.log('Original payload:', payload);
    console.log('Cleaned payload being sent to API:', cleanPayload);
    
    const response = await apiCall<{ status: string; message: string; payment: Payment }>(
      `/payments`,
      "POST",
      cleanPayload,
      true
    );
    
    console.log('API response:', response);
    
    if (response.status === "success" && response.payment) {
      return response.payment;
    } else {
      const errorMessage = typeof response.message === "string"
        ? response.message
        : "Failed to create payment";
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    console.error('Create payment error:', error);
    throw new Error(`Failed to create payment: ${error.message || "Unknown error"}`);
  }
}

// Add functions to get customers and orders for the dropdown
export async function getCustomers(): Promise<PaymentCustomer[]> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      throw new Error("getCustomers must be called client-side");
    }
    
    // Make API call WITH authentication required
    const response = await apiCall<{ status: string; message: string; customers: PaymentCustomer[] }>(
      `/customers`,
      "GET",
      undefined,
      true
    );
    
    if (response.status === "success" && response.customers) {
      return response.customers;
    } else {
      // Convert potential object error message to string
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to fetch customers";
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    // Handle specific role-related errors from the API
    if (error.message && error.message.includes("role")) {
      return [];
    }
    throw new Error(`Failed to fetch customers: ${error.message || "Unknown error"}`);
  }
}

export async function getOrders(): Promise<PaymentOrder[]> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      throw new Error("getOrders must be called client-side");
    }
    
    // Make API call WITH authentication required
    const response = await apiCall<{ status: string; message: string; orders: PaymentOrder[] }>(
      `/orders`,
      "GET",
      undefined,
      true
    );
    
    if (response.status === "success" && response.orders) {
      return response.orders;
    } else {
      // Convert potential object error message to string
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to fetch orders";
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    // Handle specific role-related errors from the API
    if (error.message && error.message.includes("role")) {
      return [];
    }
    throw new Error(`Failed to fetch orders: ${error.message || "Unknown error"}`);
  }
}
