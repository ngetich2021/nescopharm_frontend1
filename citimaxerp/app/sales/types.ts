export interface Order {
  id: string
  date: string
  status: "Paid" | "Pending" | "Failed"
  customer: {
    name: string
    avatar?: string
  }
  purchased: string
  revenue: number
}

export interface OrderStats {
  totalOrders: number
  totalOrdersChange: number
  totalRevenue: number
  totalRevenueChange: number
  averageOrderValue: number
  averageOrderValueChange: number
  pendingOrders: number
}

// New types for API response
export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  status: string
  created_at: string
  updated_at: string
  company: string
  address: string
  city: string
  state: string | null
  country: string
  postal_code: string
  notes: string | null
  tags: string[]
  preferred_communication_channel: string
  last_contact_date: string
  customer_type: string
  total_spend: string
  total_orders: number
  loyalty_points: number
  timestamp: string
  company_id: string
}

export interface Product {
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
  category: string
  sku: string
  barcode: string | null
  brand: string | null
  supplier: string | null
  unit_of_measurement: string
  is_active: boolean
  track_inventory: boolean
  weight: number | null
  length: number | null
  width: number | null
  height: number | null
  shipping_class: string | null
  image_url: string | null
  images: string[]
  primary_image_index: number
  has_variations: boolean
  variations: any | null
  tags: string[] | null
  created_at: string
  updated_at: string
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

export interface QuoteItem {
  id: string
  quote_id: string
  product_id: string
  variant_id: string | null
  quantity: number
  unit_price: string
  total_price: string
  created_at: string
  updated_at: string
  company_id: string
  product: Product
}

export interface Quote {
  id: string
  quote_number: string
  customer_id: string
  total_amount: string
  status: "accepted" | "pending" | "rejected" | "expired"
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
  customer: Customer | null
  quote_items: QuoteItem[]
}

export interface PaginationLinks {
  url: string | null
  label: string
  active: boolean
}

export interface QuotesPaginationData {
  current_page: number
  data: Quote[]
  first_page_url: string
  from: number
  last_page: number
  last_page_url: string
  links: PaginationLinks[]
  next_page_url: string | null
  path: string
  per_page: number
  prev_page_url: string | null
  to: number
  total: number
}

export interface ApiResponse {
  status: "success" | "failed"
  message?: string
  quotes?: QuotesPaginationData
  data?: any
  [key: string]: any
}
