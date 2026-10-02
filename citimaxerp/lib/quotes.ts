import apiCall from "@/lib/api"

// Define the Quote type based on the API response
export interface Quote {
  id: string
  quote_number: string
  customer_id: string
  submitted_by_id?: string | null
  submitted_at?: string | null
  original_submitted_by_id?: string | null
  submittedBy?: {
    id: string
    first_name: string
    last_name: string
    full_name?: string
  } | null
  sales_rep_id?: string | null
  sales_rep?: SalesRep | null
  original_submitted_by?: { id: string; first_name: string; last_name: string } | null
  payment_terms?: string
  totals?: {
    subtotal: number
    discount: number
    vat: number
    total: number
    vat_lines: { label: string; rate: number; taxable: number; amount: number }[]
  }
  company?: { id: string; name: string; logo_url?: string | null; letterhead_url?: string | null } | null
  total_amount: string
  status: string
  company_id: string
  notes: string | null
  discount: string
  final_amount: string
  delivery_location_id: string | null
  currency: string
  below_minimum_price: boolean
  requires_approval: boolean
  valid_until: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  converted_to_order_id: string | null
  customer: {
    id: string
    name: string
    email: string
    phone: string
    status: string
    created_at: string
    updated_at: string
    company: string | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    postal_code: string | null
    notes: string | null
    tags: string[]
    preferred_communication_channel: string
    last_contact_date: string | null
    customer_type: string
    total_spend: string
    total_orders: number
    loyalty_points: number
    timestamp: string | null
    company_id: string
    deleted_at: string | null
    business_name: string | null
    nature_of_business: string | null
    pin_number: string | null
    payment_method: string
    contact_person_name: string | null
    contact_person_phone: string | null
    contact_person_email: string | null
    created_by: string
    account_id: string
    customer_number: string
    approval_status: string
    workflow_instance_id: string | null
  } | null
  quote_items?: Array<{
    id: string
    quote_id: string
    product_id: string
    variant_id: string | null
    variant_name?: string | null
    quantity: number
    unit_id?: string | null
    unit_quantity?: number | null
    base_quantity?: number
    unit_price: string
    // Which named product price tier (see PriceTierInput in lib/products.ts)
    // was used for this line, or "Custom" for a hand-typed price - internal
    // reference only, never shown on a customer-facing quote document.
    price_label?: string | null
    item_code?: string | null
    pack_size?: string
    tax_label?: string
    tax_rate?: number
    tax_amount?: number
    total_price: string
    company_id: string
    created_at: string
    updated_at: string
    packaging_breakdown?: {
      total_base_quantity: number
      breakdown: Array<{
        unit_name: string
        unit_abbreviation: string
        quantity: number
        base_unit_quantity?: number
      }>
      display_text: string
    } | null
    packagingUnit?: {
      id: string
      unit_name: string
      unit_abbreviation: string
      base_unit_quantity: number
      price_per_unit: number
      is_base_unit: boolean
      display_order: number
    } | null
    variant?: {
      id: string
      name: string
      sku?: string
      price?: string
      attributes?: Record<string, string | string[]>
    } | null
    product?: {
      id: string
      company_id: string
      store_id: string
      name: string
      description: string | null
      short_description: string | null
      price: string
      unit_cost: string
      last_price: string | null
      stock_quantity: number
      low_stock_threshold: number
      category: string | null
      sku: string | null
      barcode: string | null
      brand: string | null
      supplier: string | null
      unit_of_measurement: string
      is_active: boolean
      is_featured: boolean
      is_digital: boolean
      track_inventory: boolean
      weight: number | null
      length: number | null
      width: number | null
      height: number | null
      shipping_class: string
      image_url: string | null
      images: string[]
      primary_image_index: number
      has_variations: boolean
      has_packaging?: boolean
      base_unit?: string
      tags: string[]
      created_at: string
      updated_at: string
      on_hand: number
      allocated: number
      category_id: string | null
      expiry_date: string | null
      on_hold: number
      damaged: number
      inventory_status: string
      product_number: string
      supplier_id: string | null
      product_code: string | null
      sellablePackagingUnits?: Array<{
        id: string
        unit_name: string
        unit_abbreviation: string
        base_unit_quantity: number
        price_per_unit: number
        is_base_unit: boolean
        display_order: number
      }>
      store: {
        id: string
        company_id: string
        name: string
        description: string | null
        store_code: string | null
        email: string | null
        phone: string | null
        address: string | null
        city: string | null
        state: string | null
        country: string | null
        postal_code: string | null
        manager_name: string | null
        is_active: boolean
        created_at: string
        updated_at: string
      }
    }
  }>
}

export interface SalesRep {
  id: string
  first_name: string
  last_name: string
  email?: string
}

export async function fetchQuoteSalesReps(): Promise<SalesRep[]> {
  const response = await apiCall<{ data: SalesRep[] }>("/quotes/sales-reps", "GET", undefined, true)
  return response.data || []
}

export async function assignQuoteSalesRep(quoteId: string, salesRepId: string | null): Promise<void> {
  await apiCall(`/quotes/${quoteId}/sales-rep`, "PATCH", { sales_rep_id: salesRepId }, true)
}

// API response interfaces
interface QuotesApiResponse {
  status: string
  quotes: {
    data: Quote[]
  }
  message?: string
}

interface QuoteApiResponse {
  status: string
  quote: Quote
  message?: string
}

// Singleton to track ongoing requests
class RequestTracker {
  private static instance: RequestTracker;
  private pendingRequests: Map<string, Promise<any>> = new Map();
  
  private constructor() {}
  
  public static getInstance(): RequestTracker {
    if (!RequestTracker.instance) {
      RequestTracker.instance = new RequestTracker();
    }
    return RequestTracker.instance;
  }
  
  public trackRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // If there's already a pending request for this key, return it
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }
    
    // Otherwise, create a new request and track it
    const requestPromise = requestFn()
      .finally(() => {
        // Remove from tracking once completed (whether success or failure)
        this.pendingRequests.delete(key);
      });
      
    this.pendingRequests.set(key, requestPromise);
    return requestPromise;
  }
}

// Helper function to normalize quote data
function normalizeQuote(quote: Quote): Quote {
  return {
    ...quote,
    total_amount: quote.total_amount || "0",
    final_amount: quote.final_amount || "0",
    discount: quote.discount || "0",
    currency: quote.currency || "KES",
    status: quote.status || "pending",
    notes: quote.notes || null,
    customer: quote.customer || null,
    quote_items: (quote.quote_items || []).map(item => ({
      ...item,
      unit_price: item.unit_price || "0",
      total_price: item.total_price || "0",
      variant_id: item.variant_id || null,
      product: item.product || undefined
    }))
  };
}

/**
 * Fetches a list of quotes from the API.
 * Uses request deduplication to prevent multiple concurrent requests for the same data.
 */
export async function fetchQuotes(
  filters: {
    search?: string;
    status?: string;
    dateRange?: { from: string; to: string };
    /** Only the current user's own submitted-from-POS quotes; bypasses can_view_quotes. */
    mine?: boolean;
  } = {}
): Promise<Quote[]> {
  // Server-side check
  if (typeof window === 'undefined') {
    return [];
  }

  // Check for token
  const token = localStorage.getItem('token');
  if (!token) {
    return [];
  }

  // Build query parameters
  const queryParams = new URLSearchParams();

  if (filters.search) queryParams.append('search', filters.search);
  if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
  if (filters.dateRange?.from) queryParams.append('from_date', filters.dateRange.from);
  if (filters.dateRange?.to) queryParams.append('to_date', filters.dateRange.to);
  if (filters.mine) queryParams.append('mine', '1');
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const requestKey = `quotes${queryString}`;
  
  // Use the RequestTracker to deduplicate requests
  return RequestTracker.getInstance().trackRequest(requestKey, async () => {
    try {
      const response = await apiCall<QuotesApiResponse>(`/quotes${queryString}`, "GET", undefined, true);

      if (response.status === "success" && response.quotes?.data) {
        return response.quotes.data.map(normalizeQuote);
      } else {
        const errorMessage = typeof response.message === 'string' 
          ? response.message 
          : 'Failed to fetch quotes';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Handle specific error types without throwing
      if (
        (error.message && error.message.includes("role")) ||
        (error.message && error.message.includes("company_id") && error.message.includes("null")) ||
        error.isPdoError
      ) {
        return [];
      }
      
      throw error;
    }
  });
}

/**
 * Fetches a single quote by ID.
 * Uses request deduplication to prevent multiple concurrent requests for the same quote.
 */
export async function getQuoteById(quoteId: string): Promise<Quote | null> {
  // Server-side check
  if (typeof window === 'undefined') {
    return null;
  }

  // Check for token
  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }
  
  const requestKey = `quote_${quoteId}`;
  
  // Use the RequestTracker to deduplicate requests
  return RequestTracker.getInstance().trackRequest(requestKey, async () => {
    try {
      const response = await apiCall<QuoteApiResponse>(`/quotes/${quoteId}`, "GET", undefined, true);
      
      if (response.status === "success" && response.quote) {
        return normalizeQuote(response.quote);
      } else {
        const errorMessage = typeof response.message === 'string' 
          ? response.message 
          : 'Failed to fetch quote';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Handle specific error types without throwing
      if (
        (error.message && error.message.includes("role")) ||
        (error.message && error.message.includes("company_id") && error.message.includes("null")) ||
        error.isPdoError
      ) {
        return null;
      }
      
      throw error;
    }
  });
}

/**
 * Creates a new quote in the system.
 */
export async function createQuote(quoteData: {
  customer_id: string;
  sales_rep_id?: string | null;
  items: { product_id: string; variant_id?: string | null; quantity: number; unit_price: string; price_label?: string | null }[];
  notes?: string;
  valid_until?: string;
  status?: string;
  currency?: string;
}): Promise<Quote> {
  // Server-side check
  if (typeof window === 'undefined') {
    throw new Error("createQuote must be called client-side");
  }
  
  // Check for token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error("Authentication required. Please sign in to create a quote.");
  }
  
  const requestKey = `create_quote_${Date.now()}`;
  
  // Use the RequestTracker to deduplicate requests
  return RequestTracker.getInstance().trackRequest(requestKey, async () => {
    try {
      const response = await apiCall<QuoteApiResponse>("/quotes", "POST", quoteData, true);
      
      if (response.status === "success" && response.quote) {
        return normalizeQuote(response.quote);
      } else {
        const errorMessage = typeof response.message === 'string' 
          ? response.message 
          : 'Failed to create quote';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // For create operations, we don't want to silently handle errors
      // But we'll provide more context for specific error types
      if (error.message && error.message.includes("role")) {
        throw new Error("You don't have permission to create quotes. Please check your role.");
      }
      
      if (error.message && error.message.includes("company_id") && error.message.includes("null")) {
        throw new Error("Company ID is required. Please ensure your account is associated with a company.");
      }
      
      if (error.isPdoError) {
        throw new Error("Database connection issue occurred. Please try again.");
      }
      
      throw error;
    }
  });
}

/**
 * Updates an existing quote.
 */
export async function updateQuote(
  quoteId: string, 
  quoteData: {
    customer_id?: string;
    items?: { product_id: string; variant_id?: string | null; quantity: number; unit_price: string; price_label?: string | null }[];
    notes?: string;
    valid_until?: string;
    status?: string;
    currency?: string;
  }
): Promise<Quote> {
  // Server-side check
  if (typeof window === 'undefined') {
    throw new Error("updateQuote must be called client-side");
  }
  
  // Check for token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error("Authentication required. Please sign in to update a quote.");
  }
  
  const requestKey = `update_quote_${quoteId}_${Date.now()}`;
  
  // Use the RequestTracker to deduplicate requests
  return RequestTracker.getInstance().trackRequest(requestKey, async () => {
    try {
      const response = await apiCall<QuoteApiResponse>(`/quotes/${quoteId}`, "PUT", quoteData, true);
      
      if (response.status === "success" && response.quote) {
        return normalizeQuote(response.quote);
      } else {
        const errorMessage = typeof response.message === 'string' 
          ? response.message 
          : 'Failed to update quote';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // For update operations, we don't want to silently handle errors
      // But we'll provide more context for specific error types
      if (error.message && error.message.includes("role")) {
        throw new Error("You don't have permission to update quotes. Please check your role.");
      }
      
      if (error.message && error.message.includes("company_id") && error.message.includes("null")) {
        throw new Error("Company ID is required. Please ensure your account is associated with a company.");
      }
      
      if (error.isPdoError) {
        throw new Error("Database connection issue occurred. Please try again.");
      }
      
      throw error;
    }
  });
}

/**
 * Deletes a quote by ID.
 */
export async function deleteQuote(quoteId: string): Promise<boolean> {
  // Server-side check
  if (typeof window === 'undefined') {
    throw new Error("deleteQuote must be called client-side");
  }
  
  // Check for token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error("Authentication required. Please sign in to delete a quote.");
  }
  
  const requestKey = `delete_quote_${quoteId}`;
  
  // Use the RequestTracker to deduplicate requests
  return RequestTracker.getInstance().trackRequest(requestKey, async () => {
    try {
      const response = await apiCall<{status: string; message?: string}>(
        `/quotes/${quoteId}`, 
        "DELETE", 
        undefined, 
        true
      );
      
      if (response.status === "success") {
        return true;
      } else {
        const errorMessage = typeof response.message === 'string' 
          ? response.message 
          : 'Failed to delete quote';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // For delete operations, we don't want to silently handle errors
      // But we'll provide more context for specific error types
      if (error.message && error.message.includes("role")) {
        throw new Error("You don't have permission to delete quotes. Please check your role.");
      }
      
      if (error.message && error.message.includes("company_id") && error.message.includes("null")) {
        throw new Error("Company ID is required. Please ensure your account is associated with a company.");
      }
      
      if (error.isPdoError) {
        throw new Error("Database connection issue occurred. Please try again.");
      }
      
      throw error;
    }
  });
}

/**
 * Converts a quote to an order.
 */
export async function convertQuoteToOrder(quoteId: string): Promise<any> {
  // Server-side check
  if (typeof window === 'undefined') {
    throw new Error("convertQuoteToOrder must be called client-side");
  }

  // Check for token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error("Authentication required. Please sign in to convert a quote to order.");
  }

  const requestKey = `convert_quote_${quoteId}`;

  // Use the RequestTracker to deduplicate requests
  return RequestTracker.getInstance().trackRequest(requestKey, async () => {
    try {
      const response = await apiCall<{status: string; order?: any; message?: string}>(
        `/quotes/${quoteId}/convert-to-order`,
        "POST",
        undefined,
        true
      );
      
      if (response.status === "success" && response.order) {
        return response.order;
      } else {
        const errorMessage = typeof response.message === 'string' 
          ? response.message 
          : 'Failed to convert quote to order';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // For convert operations, we don't want to silently handle errors
      // But we'll provide more context for specific error types
      if (error.message && error.message.includes("role")) {
        throw new Error("You don't have permission to convert quotes to orders. Please check your role.");
      }

      if (error.message && error.message.includes("company_id") && error.message.includes("null")) {
        throw new Error("Company ID is required. Please ensure your account is associated with a company.");
      }

      if (error.isPdoError) {
        throw new Error("Database connection issue occurred. Please try again.");
      }

      throw error;
    }
  });
}

/**
 * Rep confirms a quote they originally submitted from POS (after staff have
 * reviewed/adjusted pricing) - turns it into a real order.
 */
export async function confirmQuote(quoteId: string): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error("confirmQuote must be called client-side");
  }
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error("Authentication required. Please sign in to confirm this quote.");
  }

  const requestKey = `confirm_quote_${quoteId}`;
  return RequestTracker.getInstance().trackRequest(requestKey, async () => {
    const response = await apiCall<{ status: string; order?: any; message?: string }>(
      `/quotes/${quoteId}/confirm`,
      "POST",
      undefined,
      true
    );

    if (response.status === "success" && response.order) {
      return response.order;
    }
    const errorMessage = typeof response.message === 'string' ? response.message : 'Failed to confirm quote';
    throw new Error(errorMessage);
  });
}

/**
 * Rep sends a quote awaiting their confirmation back to staff for further
 * price adjustment, with an optional note.
 */
export async function requestQuoteChanges(quoteId: string, note?: string): Promise<Quote> {
  if (typeof window === 'undefined') {
    throw new Error("requestQuoteChanges must be called client-side");
  }
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error("Authentication required. Please sign in to request changes.");
  }

  const requestKey = `request_changes_${quoteId}`;
  return RequestTracker.getInstance().trackRequest(requestKey, async () => {
    const response = await apiCall<QuoteApiResponse>(
      `/quotes/${quoteId}/request-changes`,
      "POST",
      { note },
      true
    );

    if (response.status === "success" && response.quote) {
      return normalizeQuote(response.quote);
    }
    const errorMessage = typeof response.message === 'string' ? response.message : 'Failed to request changes';
    throw new Error(errorMessage);
  });
}
