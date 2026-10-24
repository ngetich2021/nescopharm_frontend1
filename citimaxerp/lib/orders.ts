import apiCall from "./api"

// Define the Order type based on the API response
export interface Order {
  id: string
  customer_id: string
  company_id: string
  order_number: string
  total_amount: string
  final_amount: string
  tax?: string
  status: string
  payment_status: string
  payment_type?: 'cash' | 'credit'
  credit_terms_days?: number | null
  order_date?: string | null
  created_at: string
  updated_at: string
  item_count: number
  customer: {
    id: string
    name: string
    email: string
    phone: string
    total_spend: string
    total_orders: number
    customer_type?: string
    business_name?: string
    contact_person_name?: string | null
    contact_person_phone?: string | null
  } | null
  // GM / Director sign-off required before the order can be invoiced.
  invoice_approved_by?: string | null
  invoice_approved_at?: string | null
  // A sale dated before go-live: no approvals, no stock movement.
  is_historical?: boolean
  invoice_approval_comment?: string | null
  invoice_contact_person?: string | null
  invoice_contact_phone?: string | null
  invoice_approver?: { id: string; first_name: string; last_name: string } | null
  // Whether the logged-in user may approve this order (set by the order details endpoint).
  can_approve_invoice?: boolean
  // The order's invoice, if raised (order details endpoint). Editing the order updates it.
  invoice?: { id: string; invoice_number: string; status: string; etims_status?: string | null } | null
}

// Go-live date; matches Order::HISTORICAL_CUTOFF on the backend. Orders dated before it are
// past sales: they count in sales and balances but never move stock.
export const HISTORICAL_CUTOFF = "2026-10-17"
export const isPastSaleDate = (date?: string | null) => !!date && date.slice(0, 10) < HISTORICAL_CUTOFF

// Define the detailed order type with all related data
export interface OrderDetail extends Order {
  notes?: string
  discount?: string
  tax?: string
  delivery_location_id?: string
  tracking_number?: string | null
  amount_paid?: string
  currency?: string
  delivery_location?: {
    postal_code: null
    id: string
    customer_id: string
    house_number: string
    estate: string
    city: string
    street: string
    country: string
    is_default: boolean
    location_note: string
    created_at: string
    updated_at: string
    landmark: string
    company_id: string
  } | null
  order_items: Array<{
    variant_name: string | null
    id: string
    order_id: string
    product_id: string
    variant_id: string | null
    quantity: number
    unit_id?: string | null
    unit_quantity?: number | null
    base_quantity?: number
    unit_price: string
    // Which named product price tier (see PriceTierInput in lib/products.ts)
    // was used for this line, or "Custom" for a hand-typed price - internal
    // reference only, never shown on a customer-facing order document.
    price_label?: string | null
    price_unit?: string | null
    total_price: string
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
    batch_allocations?: Array<{
      batch_id: string
      batch_number: string
      quantity: number
      expiry_date: string | null
    }> | null
    packagingUnit?: {
      id: string
      unit_name: string
      unit_abbreviation: string
      base_unit_quantity: number
      price_per_unit: number
      is_base_unit: boolean
      display_order: number
    } | null
    product: {
      id: string
      name: string
      sku?: string
      price: string
      store_id: string
      has_packaging?: boolean
      base_unit?: string
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
        name: string
      }
    } | null
    variant: any | null
  }>
  payments: Array<{
    id: string
    order_id: string
    amount_paid: string
    payment_method: string
    status: string
    created_at: string
  }>
  delivery_details: Array<{
    delivery_address: string
    tracking_number: any
    id: string
    order_id: string
    delivery_status: string
    estimated_delivery_date: string | null
    created_at: string
    updated_at: string
  }>
}

// Define the paginated API response type
interface PaginatedOrdersResponse {
  current_page: number
  data: Order[]
  first_page_url: string
  from: number
  last_page: number
  last_page_url: string
  links: Array<{
    url: string | null
    label: string
    active: boolean
  }>
  next_page_url: string | null
  path: string
  per_page: number
  prev_page_url: string | null
  to: number
  total: number
}

// Define the API response type
interface OrdersApiResponse {
  status: string
  message: string
  orders: PaginatedOrdersResponse
}

// Define the API response type for a single order
interface OrderDetailApiResponse {
  status: string
  order: OrderDetail
  message?: string
}

/**
 * Fetches a list of orders from the API.
 * @returns A promise that resolves to an array of Order objects.
 * @throws An error if the API call fails or returns an invalid format.
 */
export async function fetchOrders(filters: { mine?: boolean } = {}): Promise<Order[]> {
  try {
    // API will handle company filtering based on the authenticated user
    const query = filters.mine ? '?mine=1' : ''
    const response = await apiCall<OrdersApiResponse>(`/orders${query}`, "GET", undefined, true);

    // Handle the paginated response structure
    if (response.status === "success" && response.orders && response.orders.data) {
      return response.orders.data;
    } else {
      // Handle unexpected response format
      console.warn('Unexpected orders API response format:', response);
      return [];
    }
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    throw new Error(`An unexpected error occurred while fetching orders: ${error.message || "Unknown error"}.`);
  }
}

// Function to fetch a single order by its ID
export async function fetchOrderById(orderId: string): Promise<OrderDetail | null> {
  try {
    // Make the API call requiring authentication
    const response = await apiCall<OrderDetailApiResponse>(
      `/orders/${orderId}`,
      "GET",
      undefined,
      true, // Requires authentication
    )

    if (response.status === "success") {
      return response.order
    } else {
      const errorMessage = typeof response.message === 'string'
        ? response.message
        : `Failed to fetch order with ID ${orderId}`
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    throw new Error(`An unexpected error occurred while fetching the order: ${error.message || "Unknown error"}.`)
  }
}

// Function to delete an order by its ID
export async function deleteOrder(orderId: string): Promise<void> {
  try {
    const response = await apiCall<{ status: string; message?: string }>(
      `/orders/${orderId}`,
      "DELETE",
      undefined,
      true, // Requires authentication
    )

    if (response.status === "success") {
      return
    } else {
      const errorMessage = typeof response.message === 'string'
        ? response.message
        : `Failed to delete order with ID ${orderId}`
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    throw new Error(`An unexpected error occurred while deleting the order: ${error.message || "Unknown error"}.`)
  }
}

// GM / Director approval that lets an order be invoiced.
export async function approveOrderForInvoice(
  orderId: string,
  data: { comment?: string; contact_person?: string; contact_phone?: string },
): Promise<OrderDetail> {
  const response = await apiCall<{ status: string; message?: string; order: OrderDetail }>(
    `/orders/${orderId}/approve-invoice`,
    "POST",
    data,
    true,
  )
  if (response.status !== "success") {
    throw new Error(typeof response.message === "string" ? response.message : "Failed to approve order for invoicing")
  }
  return response.order
}
