import apiCall from "./api"

export interface CustomerNote {
  id: string
  customer_id: string
  note_content: string
  created_by: string | null
  creator?: { id: string; first_name: string; last_name: string } | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  order_id: string
  amount_paid: string // API returns string for decimal
  payment_method: string
  status: string
  created_at: string
}

export interface Order {
  id: string
  customer_id: string
  order_number: string
  total_amount: string // API returns string for decimal
  status: string
  created_at: string
  updated_at: string
  payments: Payment[] // Nested payments
}

export interface CustomerActivity {
  id: string
  customer_id: string
  activity_type: string
  title: string
  description: string
  start_time: string
  end_time: string | null
  location: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  customer_id: string
  quote_number: string
  total_amount: string // API returns string for decimal
  status: string
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  first_name?: string // Optional, as 'name' might be composite
  last_name?: string // Optional, as 'name' might be composite
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postal_code: string | null
  status: "active" | "inactive" | "pending"
  company: string | null // Assuming company name or ID
  notes: string | null // Assuming notes are a single string field for list view
  tags: string[] | string | null // Can be null or string from API
  preferred_communication_channel: string | null
  last_contact_date: string | null
  customer_type: "individual" | "company" | null
  total_spend: string // API returns string for decimal
  total_orders: number
  loyalty_points: number
  created_at: string
  updated_at: string
  company_id: string // Added company_id as per API response
  created_by?: string | null // user id who created this customer record

  // New fields for company customers
  business_name?: string | null
  nature_of_business?: string | null
  pin_number?: string | null
  contact_person_name?: string | null
  contact_person_phone?: string | null
  contact_person_email?: string | null
  contact_person_designation?: string | null

  // Payment method
  payment_method?: string | null
  
  // New fields from API response
  customer_number?: string | null
  account_id?: string | null

  // Company Details (Nescopharm "Credit Appraisal Form" fields)
  trading_name?: string | null
  business_type?: string | null // free string, e.g. "pharmacy" | "hospital_clinic" | "distributor" | "ngo" | "other"
  registration_number?: string | null
  ppb_license_number?: string | null
  website?: string | null
  telephone?: string | null
  region?: string | null // one of Kenya's 8 former provinces, used to narrow `county`
  county?: string | null // one of Kenya's 47 counties

  // Accounts Contact - a SEPARATE contact block from the primary
  // contact_person_* fields above; the paper form has both.
  accounts_contact_name?: string | null
  accounts_contact_designation?: string | null
  accounts_contact_phone?: string | null
  accounts_contact_email?: string | null

  // Two-stage credit-approval workflow for customers created by Sales Reps in
  // POS. Normal staff-created customers stay "draft"/"approved" and never go
  // through this. See CustomerApproval below for the history of decisions.
  approval_status?:
    | "draft"
    | "pending_stage1"
    | "pending_documents"
    | "pending_stage2"
    | "approved"
    | "rejected"
    | string
    | null

  // Credit terms/details captured when the rep submitted the application -
  // directors, trade references, bank details, and requested credit terms -
  // for approvers to review before making a Stage 1/Stage 2 decision. Backend
  // field name is `pending_credit_application`, not `credit_application`.
  pending_credit_application?: CreditApplicationInput | null
}

// A single director/business owner on the paper "Credit Appraisal Form".
export interface CreditApplicationDirectorInput {
  name: string
  id_passport_number?: string | null
  pin?: string | null
  phone_number?: string | null
}

// A single trade reference/supplier on the paper form.
export interface CreditApplicationSupplierInput {
  name: string
  contact_person_name?: string | null
  phone_number?: string | null
  credit_limit?: string | number | null
}

// A single bank account on the paper form.
export interface CreditApplicationBankDetailInput {
  account_name?: string | null
  bank_name: string
  branch?: string | null
  account_number?: string | null
}

// Strongly-typed shape for the nested `credit_application` object accepted
// by `POST /customers` (used to build the create payload). Only meaningful
// - and only sent - when the creating user is a Sales Rep; it maps 1:1 to
// the paper form's Directors, Trade References, Bank Details, and Credit
// Terms sections. (`Customer.credit_application` above is the looser
// readback shape used by the separate approval-review workflow.)
export interface CreditApplicationInput {
  annual_turnover?: number | null
  credit_required?: number | null
  credit_period_required?: string | null
  credit_period_pd_cheque_days?: number | null
  directors?: CreditApplicationDirectorInput[]
  suppliers?: CreditApplicationSupplierInput[]
  bank_details?: CreditApplicationBankDetailInput[]
}

// Company customers store the CONTACT PERSON's name in `name` (see
// CreateCustomerModal.tsx, which labels that input "Contact Person Name *"
// when customer_type === "company"). `business_name` holds the actual
// business/company name. Any picker, dropdown, table, or list that displays
// "the customer" should use this helper instead of reading `.name` directly,
// so company customers show their business name rather than their contact
// person's name. Places that intentionally show the contact person (e.g. a
// dedicated "Contact Person" field/column) should keep using `.name`.
export function getCustomerDisplayName(
  customer: { name: string; business_name?: string | null; customer_type?: string | null },
): string {
  // Business name is optional for individuals too (not just "company"
  // customers) - show it whenever it's actually been captured, rather than
  // gating on customer_type, so a filled-in field never silently disappears.
  if (customer.business_name?.trim()) {
    return customer.business_name.trim()
  }
  return customer.name
}

// Interface for the detailed customer profile response
export interface CustomerProfileData extends Omit<Customer, 'notes'> {
  notes: string | null // The customer's own plain notes column - a real CustomerNote[] collides on this key, so it's returned separately below
  customer_notes: CustomerNote[] // Actual CustomerNote records (e.g. auto-generated monthly statements), newest first
  orders: Order[] // Array of Order
  activities: CustomerActivity[] // Array of CustomerActivity
  quotes: Quote[] // Array of Quote
  payments: Payment[] // Array of Payment - Add this line
  // The 'tags' field in the profile response could be a string, string array, or null
  tags: string[] | string | null
  avg_order_value?: number // Add this line for average order value
}

export async function getCustomers(filters: { created_by?: string; include_pending?: boolean } = {}): Promise<Customer[]> {
  try {
    // Check if we're in a browser environment before making the API call
    if (typeof window === 'undefined') {
      return [];
    }

    // Add a small delay to ensure auth is loaded (helps with race conditions)
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const queryParams = new URLSearchParams();
    if (filters.created_by) queryParams.append('created_by', filters.created_by);
    // Safe to always request - the backend only actually includes pending
    // applications for viewers who have can_approve_account; everyone else
    // gets the same approved-only list as before.
    if (filters.include_pending) queryParams.append('include_pending', '1');
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await apiCall<any>(
      `/customers${queryString}`,
      "GET",
      undefined,
      true, // <-- Restore to authenticated fetch
    )
    console.log("Raw API response for getCustomers:", response);
    
    // Handle the new paginated response format
    if (response.status === "success" && response.data) {
      // The customers data is now in response.data.data array (paginated structure)
      let customersData = [];
      
      // Check if it's the new paginated format or old format
      if (response.data.data && Array.isArray(response.data.data)) {
        // New paginated format
        customersData = response.data.data;
      } else if (Array.isArray(response.data)) {
        // Old format - direct array
        customersData = response.data;
      } else {
        console.error("Unexpected response format for customers:", response);
        return [];
      }
      
      const processedCustomers = customersData
        .filter((customer: any) => customer !== null) // Filter out null customers
        .map((customer: any) => {
          console.log("Processing customer:", customer);
          // Ensure we're handling the data correctly
          const processedCustomer = {
            ...customer,
            // Ensure company_id is never null to prevent property access errors
            company_id: customer.company_id || '',
            total_spend: customer.total_spend !== undefined ? String(customer.total_spend) : "0",
            total_orders: customer.total_orders !== undefined ? Number(customer.total_orders) : 0,
            loyalty_points: customer.loyalty_points !== undefined ? Number(customer.loyalty_points) : 0,
            tags: Array.isArray(customer.tags)
              ? customer.tags
              : typeof customer.tags === "string"
                ? customer.tags
                    .split(",")
                    .map((tag: string) => tag.trim())
                    .filter((tag: string) => tag !== "")
                : [],
          };
          
          console.log("Processed customer result:", processedCustomer);
          return processedCustomer;
        })
      console.log("Final processed customers array:", processedCustomers);
      return processedCustomers;
    } else {
      // Handle error responses
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to fetch customers"
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    console.error("Error in getCustomers:", error);
    // Handle specific role-related errors from the API
    if (error.message && error.message.includes("role")) {
      console.error("Role-related error:", error.message);
      return [];
    }
    
    // Handle specific company_id errors
    if (error.message && error.message.includes("company_id") && error.message.includes("null")) {
      console.error("Company ID error:", error.message);
      return [];
    }
    
    // Handle authentication errors
    if (error.message && (error.message.includes("not logged in") || error.message.includes("Unauthorized"))) {
      console.error("Authentication error:", error.message);
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in';
      }
      return [];
    }
    
    console.error("Unknown error in getCustomers:", error.message || "Unknown error");
    // Even if there's an error, return empty array to prevent app crash
    return [];
  }
}

export async function getCustomerProfile(customerId: string): Promise<CustomerProfileData | null> {
  try {
    // Add a small delay to ensure auth is loaded (helps with race conditions)
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const response = await apiCall<{
      message: any; status: string; customer: CustomerProfileData 
}>(
      `/customers/${customerId}/profile`,
      "GET",
      undefined,
      true,
    )
    if (response.status === "success" && response.customer) {
      // Ensure numeric fields are parsed and tags are an array
      return {
        ...response.customer,
        total_spend: String(response.customer.total_spend || "0"),
        total_orders: Number(response.customer.total_orders || 0),
        loyalty_points: Number(response.customer.loyalty_points || 0),
        avg_order_value: response.customer.avg_order_value !== undefined 
          ? Number(response.customer.avg_order_value) 
          : undefined,
        tags: Array.isArray(response.customer.tags)
          ? response.customer.tags
          : typeof response.customer.tags === "string"
            ? response.customer.tags
                .split(",")
                .map((tag: string) => tag.trim())
                .filter((tag: string) => tag !== "")
            : [],
      }
    } else {
      // Convert potential object error message to string
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to fetch customer profile"
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    // Handle specific role-related errors from the API
    if (error.message && error.message.includes("role")) {
      return null;
    }
    throw new Error(`Failed to fetch customer profile: ${error.message || "Unknown error"}`)
  }
}

export async function createCustomer(
  customerData: Omit<
    Customer,
    "id" | "created_at" | "updated_at" | "total_spend" | "total_orders" | "loyalty_points" | "status" | "notes" | "tags"
  > & { notes?: string | null; tags?: string[] | null },
): Promise<Customer> {
  try {
    const { ...dataToSend } = customerData;
    
    const finalPayload = {
      ...dataToSend,
      tags: customerData.tags || null,
    };
    
    const response = await apiCall<{
      message?: any
      status: string; 
      customer?: Customer;
      customers?: Customer[];
}>(
      "/customers",
      "POST",
      finalPayload,
      true,
    )
    
    // Handle both possible response formats
    if (response.status === "success") {
      let customerData: Customer | null = null;
      
      // Check if response has a single customer object
      if (response.customer) {
        customerData = response.customer;
      }
      // Check if response has customers array (actual API format)
      else if (response.customers && Array.isArray(response.customers) && response.customers.length > 0) {
        customerData = response.customers[0]; // Take the first (and likely only) customer
      }
      
      if (customerData) {
        const processedCustomer = {
          ...customerData,
          // Ensure proper data types
          total_spend: String(customerData.total_spend || "0"),
          total_orders: Number(customerData.total_orders || 0),
          loyalty_points: Number(customerData.loyalty_points || 0),
          tags: Array.isArray(customerData.tags)
            ? customerData.tags
            : typeof customerData.tags === "string"
              ? customerData.tags
                  .split(",")
                  .map((tag: string) => tag.trim())
                  .filter((tag: string) => tag !== "")
              : [],
        };
        
        return processedCustomer;
      } else {
        throw new Error("No customer data returned from API")
      }
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to create customer.")
    }
  } catch (error: any) {
    // Handle specific role-related errors from the API
    if (error.message && error.message.includes("role")) {
      // Role-related error
    }
    throw new Error(`Failed to create customer: ${error.message || "Unknown error"}`)
  }
}

export async function updateCustomer(
  id: string,
  updates: Partial<Omit<Customer, "id" | "created_at" | "updated_at">>,
): Promise<Customer | null> {
  try {
    const response = await apiCall<{
      message: string | undefined; customer: Customer; status: string;
}>(`/customers/${id}`, "PUT", updates, true)
    if (response.status === "success" && response.customer) {
      return {
        ...response.customer,
        total_spend: String(response.customer.total_spend || "0"),
        total_orders: Number(response.customer.total_orders || 0),
        loyalty_points: Number(response.customer.loyalty_points || 0),
        tags: Array.isArray(response.customer.tags)
          ? response.customer.tags
          : typeof response.customer.tags === "string"
            ? response.customer.tags
                .split(",")
                .map((tag: string) => tag.trim())
                .filter((tag: string) => tag !== "")
            : [],
      }
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to update customer.")
    }
  } catch (error: any) {
    // Handle specific role-related errors from the API
    if (error.message && error.message.includes("role")) {
      return null;
    }
    throw new Error(`Failed to update customer: ${error.message || "Unknown error"}`)
  }
}

export async function deleteCustomer(id: string): Promise<boolean> {
  try {
    const response = await apiCall<{
      status: string; message: string 
}>(`/customers/${id}`, "DELETE", undefined, true)
    if (response.status === "success") {
      return true
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to delete customer.")
    }
  } catch (error: any) {
    // Handle specific role-related errors from the API
    if (error.message && error.message.includes("role")) {
      return false;
    }
    throw new Error(`Failed to delete customer: ${error.message || "Unknown error"}`)
  }
}

export interface CustomerCreditTerms {
  payment_method: string
  credit_required: string | number | null
  credit_used: string | number | null
  available_credit: string | number | null
  credit_days: number | null
  credit_terms: string | null
  has_pending_change: boolean
  customer_account_id: string | null
}

export async function fetchCustomerCreditTerms(customerId: string): Promise<CustomerCreditTerms> {
  const response = await apiCall<{ status: string; data: CustomerCreditTerms }>(
    `/customers/${customerId}/credit-terms`,
    "GET",
    undefined,
    true
  )
  return response.data
}

export interface CreditTermsChange {
  id: string
  customer_account_id: string
  approval_type: string
  status: 'pending' | 'approved' | 'rejected'
  previous_credit_limit: string | number | null
  new_credit_limit: string | number | null
  previous_credit_days: number | null
  new_credit_days: number | null
  notes: string | null
  approved_at: string | null
  created_at: string
  approver: { id: string; first_name: string; last_name: string; email: string } | null
  created_by: { id: string; first_name: string; last_name: string; email: string } | null
}

// History of GM approvals/rejections that changed (or proposed changing) this
// customer's credit limit/terms over time - who requested it, who approved it,
// and what the terms were before and after.
export async function fetchCustomerCreditTermsHistory(customerAccountId: string): Promise<CreditTermsChange[]> {
  const response = await apiCall<{ status: string; data: CreditTermsChange[] }>(
    `/customer-accounts/${customerAccountId}/approvals?approval_type=credit_limit_update`,
    "GET",
    undefined,
    true
  )
  return response.data
}


// ---------------------------------------------------------------------------
// Two-stage credit-approval workflow (customers created by Sales Reps in POS)
// ---------------------------------------------------------------------------
// draft/approved (normal staff-created customers, no workflow)
// pending_stage1 -> (Stage 1 approve) -> pending_documents
//   -> (signed doc uploaded) -> pending_stage2 -> (Stage 2 approve) -> approved
//   -> rejected (from either stage)

export interface CustomerApprovalUser {
  id: string
  first_name: string
  last_name: string
  email: string
}

export interface CustomerApproval {
  id: string
  customer_id: string
  approval_type: "stage1" | "stage2"
  status: "pending" | "approved" | "rejected"
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  approver: CustomerApprovalUser | null
  createdBy: CustomerApprovalUser | null
  created_at: string
}

// History of Stage 1 / Stage 2 approval decisions for a customer going
// through the credit-approval workflow.
export async function getCustomerApprovals(customerId: string): Promise<CustomerApproval[]> {
  try {
    const response = await apiCall<{ status: string; data: CustomerApproval[]; message?: string }>(
      `/customers/${customerId}/approvals`,
      "GET",
      undefined,
      true,
    )
    if (response.status === "success" && response.data) {
      return response.data
    }
    return []
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch customer approval history.")
  }
}

// Approve or reject whichever stage the customer is currently awaiting. The
// server determines the stage from the customer's current approval_status -
// it returns a 400 if the customer isn't currently awaiting approval, and a
// 422 for Stage 2 if the signed, stamped credit application hasn't been
// uploaded yet. Both errors should be surfaced to the reviewer as-is.
export async function submitCustomerApproval(
  customerId: string,
  data: {
    status: "approved" | "rejected"
    notes?: string
    // Stage 1 approval only - overrides the credit terms the CustomerAccount
    // gets created with, in place of what the rep originally submitted.
    annual_turnover?: number
    credit_required?: number
    credit_period_required?: string
    credit_period_pd_cheque_days?: number
    credit_days?: number
  },
): Promise<{ approval: CustomerApproval; customer: Customer }> {
  try {
    const response = await apiCall<{
      status: string
      message?: string
      data: CustomerApproval
      customer: Customer
    }>(`/customers/${customerId}/approvals`, "POST", data, true)

    if (response.status === "success" && response.data) {
      return { approval: response.data, customer: response.customer }
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to submit approval decision.")
    }
  } catch (error: any) {
    throw new Error(error.message || "Failed to submit approval decision.")
  }
}

export interface SignedApplicationDocument {
  id: string
  document_name: string
  url?: string
  [key: string]: any
}

// Uploads the signed, stamped credit application (scan/photo, any file type,
// max 5MB). Only works while the customer is in "pending_documents"; on
// success the customer advances to "pending_stage2".
export async function uploadSignedCreditApplication(
  customerId: string,
  file: File,
): Promise<{ document: SignedApplicationDocument; customer: Customer }> {
  try {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiCall<{
      status: string
      message?: string
      document: SignedApplicationDocument
      customer: Customer
    }>(`/customers/${customerId}/signed-application`, "POST", formData, true)

    if (response.status === "success" && response.document) {
      return { document: response.document, customer: response.customer }
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to upload signed application.")
    }
  } catch (error: any) {
    throw new Error(error.message || "Failed to upload signed application.")
  }
}

// Uploads the approver's own company-stamped copy of the credit application -
// a separate record-keeping attachment from the rep's customer-signed scan
// above. Available once the customer reaches "pending_stage2" or "approved";
// unlike the signed-application upload, it never changes approval_status.
export async function uploadStampedCreditApplication(
  customerId: string,
  file: File,
): Promise<{ document: SignedApplicationDocument }> {
  try {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiCall<{
      status: string
      message?: string
      document: SignedApplicationDocument
    }>(`/customers/${customerId}/stamped-application`, "POST", formData, true)

    if (response.status === "success" && response.document) {
      return { document: response.document }
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to upload stamped application.")
    }
  } catch (error: any) {
    throw new Error(error.message || "Failed to upload stamped application.")
  }
}

export async function createCustomerNote(
  customerId: string,
  noteContent: string,
): Promise<CustomerNote> {
  const response = await apiCall<{
    status: string
    message?: string
    note: CustomerNote
  }>(`/customers/${customerId}/notes`, "POST", { note_content: noteContent }, true)

  if (response.status === "success" && response.note) {
    return response.note
  }
  throw new Error(typeof response.message === "string" ? response.message : "Failed to add note.")
}
