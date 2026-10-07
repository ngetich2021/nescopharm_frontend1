import apiCall from "./api"
import { Customer } from "./customers"

export interface Director {
  id: string
  customer_account_id: string
  company_id: string | null
  created_by: string | null
  name: string
  // Nullable to match the backend: an ID/passport number is often not on hand
  // when the appraisal form is captured and must not block saving the rest.
  id_passport_number?: string | null
  pin?: string | null
  phone_number?: string | null
  created_at: string
  updated_at: string
}

export interface AuthorisedPurchasePerson {
  id: string
  customer_account_id: string
  company_id: string | null
  created_by: string | null
  name: string
  phone_number?: string | null
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  customer_account_id: string
  name: string
  contact_person_name?: string | null
  phone_number?: string | null
  company_id: string | null
  created_by: string | null
  credit_limit?: string | null
  created_at: string
  updated_at: string
}

export interface BankDetail {
  id: string
  customer_account_id: string
  company_id: string | null
  created_by: string | null
  bank_name: string
  branch?: string | null
  account_number?: string | null
  created_at: string
  updated_at: string
}

export interface CustomerAccount {
  id: string
  customer_id: string
  company_id: string
  account_number: string
  certificate_of_incorporation_number?: string | null
  company_type?: string | null
  annual_turnover?: string | null
  credit_required?: string | null
  credit_period_required?: string | null
  credit_days?: number | null
  credit_period_pd_cheque_days?: number | null
  currently_defaulted: boolean
  credit_terms?: string | null
  current_balance?: string | null
  notes?: string | null
  // Who actually reviewed/approved this account and in what capacity,
  // captured as plain text at save time (Section 8 "For Official Use Only"
  // of the Credit Appraisal Form) - not a live lookup of whoever's currently
  // viewing, so it stays historically accurate no matter who views it later.
  reviewed_by_name?: string | null
  reviewed_by_position?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ApprovalStats {
  total_approvals: number
  approved_count: number
  rejected_count: number
  credit_limit_updates: number
  latest_approval_date?: string | null
  latest_approval_type?: string | null
}

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  full_name: string
}

export interface Approval {
  id: string
  customer_account_id: string
  approved_by: string
  approved_at: string
  status: string
  notes?: string | null
  company_id: string
  created_by?: string | User
  created_at: string
  updated_at: string
  approval_type: string
  previous_credit_limit?: string | null
  new_credit_limit?: string | null
  previous_credit_days?: number | null
  new_credit_days?: number | null
  metadata: any[]
  approver?: User
}

export interface CustomerAccountWithDetails extends CustomerAccount {
  directors: Director[]
  authorised_purchase_persons: AuthorisedPurchasePerson[]
  suppliers: Supplier[]
  bank_details: BankDetail[]
  documents: {
    id: string;
    document_name: string;
    reference_number?: string | null;
    expiry_date?: string | null;
    regulatory_body?: string | null;
    other_information?: string | null;
  }[]
  customer: Customer // Added customer object
  approval_status?: string
  workflow_instance_id?: string | null
  is_approved?: boolean
  is_rejected?: boolean
  approval_stats?: ApprovalStats
  approvals?: Approval[]
  latest_approval?: Approval
  approved_approvals?: Approval[]
  rejected_approvals?: Approval[]
  credit_limit_approvals?: Approval[]
}

export interface CustomerAccountApproval {
  id: string
  customer_account_id: string
  approved_by: string
  approval_status: "pending" | "approved" | "rejected"
  approval_notes?: string | null
  created_at: string
}

export interface CreateCustomerAccountPayload {
  customer_id: string;
  certificate_of_incorporation_number?: string | null;
  company_type?: string | null;
  annual_turnover?: number | null;
  credit_required?: number | null;
  credit_period_required?: string | null;
  credit_days?: number | null;
  credit_period_pd_cheque_days?: number | null;
  currently_defaulted: boolean;
  credit_terms?: string | null;
  notes?: string | null;
  // Include documents in the payload
  documents?: {
    id?: string;
    document_name: string;
    reference_number?: string | null;
    expiry_date?: string | null;
    regulatory_body?: string | null;
    other_information?: string | null;
  }[];
  directors: Omit<Director, "id" | "customer_account_id" | "company_id" | "created_by" | "created_at" | "updated_at">[];
  authorised_purchase_persons: Omit<AuthorisedPurchasePerson, "id" | "customer_account_id" | "company_id" | "created_by" | "created_at" | "updated_at">[];
  suppliers: Omit<Supplier, "id" | "customer_account_id" | "company_id" | "created_by" | "created_at" | "updated_at">[];
  bank_details: Omit<BankDetail, "id" | "customer_account_id" | "company_id" | "created_by" | "created_at" | "updated_at">[];
}

export async function createCustomerAccount(
  accountData: CreateCustomerAccountPayload
): Promise<CustomerAccountWithDetails> {
  try {
    const response = await apiCall<{
      message: any
      status: string
      data: CustomerAccountWithDetails
    }>(
      "/customer-accounts",
      "POST",
      {
        ...accountData,
      },
      true
    )
    
    if (response.status === "success" && response.data) {
      return response.data
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to create customer account.")
    }
  } catch (error: any) {
    throw new Error(`Failed to create customer account: ${error.message || "Unknown error"}`)
  }
}

export async function getCustomerAccounts(): Promise<CustomerAccountWithDetails[]> {
  try {
    const response = await apiCall<any>("/customer-accounts", "GET", undefined, true)
    
    if (response.status === "success") {
      // Check if accounts data is in response.data or directly in response
      let accountsData = [];
      if (response.data && Array.isArray(response.data)) {
        accountsData = response.data;
      } else if (Array.isArray(response)) {
        accountsData = response;
      } else {
        console.warn("Unexpected response format for customer accounts:", response);
        return [];
      }
      
      return accountsData;
    } else {
      const errorMessage = typeof response.message === "string" 
        ? response.message 
        : "Failed to fetch customer accounts."
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    console.error("Error in getCustomerAccounts:", error);
    // Handle authentication errors
    if (error.message && (error.message.includes("not logged in") || error.message.includes("Unauthorized"))) {
      console.error("Authentication error in customer accounts:", error.message);
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in';
      }
      return [];
    }
    
    // Even if there's an error, return empty array to prevent app crash
    return [];
  }
}

export async function getCustomerAccount(id: string): Promise<CustomerAccountWithDetails | null> {
  try {
    const response = await apiCall<{
      message: any
      status: string
      data: CustomerAccountWithDetails
    }>(`/customer-accounts/${id}`, "GET", undefined, true)
    
    if (response.status === "success" && response.data) {
      return response.data
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to fetch customer account.")
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch customer account: ${error.message || "Unknown error"}`)
  }
}

export async function approveCustomerAccount(
  approvalData: Omit<CustomerAccountApproval, "id" | "created_at">
): Promise<CustomerAccountApproval> {
  try {
    const response = await apiCall<{
      message: any
      status: string
      data: CustomerAccountApproval
    }>("/customer-account-approvals", "POST", approvalData, true)
    
    if (response.status === "success" && response.data) {
      return response.data
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to approve customer account.")
    }
  } catch (error: any) {
    throw new Error(`Failed to approve customer account: ${error.message || "Unknown error"}`)
  }
}

// Add update function
export async function updateCustomerAccount(
  id: string,
  accountData: Partial<Omit<CustomerAccountWithDetails, "id" | "created_at" | "updated_at">>
): Promise<CustomerAccountWithDetails> {
  try {
    const response = await apiCall<{
      message: any
      status: string
      data: CustomerAccountWithDetails
    }>(
      `/customer-accounts/${id}`,
      "PUT",
      {
        ...accountData,
      },
      true
    )
    
    if (response.status === "success" && response.data) {
      return response.data
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to update customer account.")
    }
  } catch (error: any) {
    throw new Error(`Failed to update customer account: ${error.message || "Unknown error"}`)
  }
}

// Add delete function
export async function deleteCustomerAccount(id: string): Promise<boolean> {
  try {
    const response = await apiCall<{
      message: any
      status: string
    }>(`/customer-accounts/${id}`, "DELETE", undefined, true)
    
    if (response.status === "success") {
      return true
    } else {
      throw new Error(typeof response.message === "string" ? response.message : "Failed to delete customer account.")
    }
  } catch (error: any) {
    throw new Error(`Failed to delete customer account: ${error.message || "Unknown error"}`)
  }
}

// Add approval function
export async function approveOrRejectCustomerAccount(
  id: string,
  data: { status: "approved" | "rejected"; notes: string }
): Promise<void> {
  try {
    await apiCall(`/customer-accounts/${id}/approvals`, "POST", data);
  } catch (error) {
    throw new Error(`Failed to ${data.status === "approved" ? "approve" : "reject"} customer account`);
  }
}

// Credit limit request interfaces
export interface CreditLimitUpdateRequest {
  requested_credit_limit?: number;
  requested_credit_days?: number;
  reason: string;
  justification: string;
  supporting_documents?: string[];
}

export interface CreditLimitUpdateResponse {
  status: string;
  message: string;
  data: {
    approval_request: {
      id: string;
      customer_account_id: string;
      approved_by: string | null;
      approved_at: string | null;
      status: string;
      notes: string;
      company_id: string;
      created_by: string;
      approval_type: string;
      previous_credit_limit: string;
      new_credit_limit: string;
      previous_credit_days?: number | null;
      new_credit_days?: number | null;
      metadata: {
        justification: string;
        supporting_documents: string[];
        request_date: string;
        requested_by: string;
      };
      updated_at: string;
      created_at: string;
    };
    account_info: {
      current_credit_limit: string;
      requested_credit_limit: number;
      change_amount: number;
      change_type: string;
    };
  };
}

// Add credit limit request function
export async function requestCreditLimitUpdate(
  customerAccountId: string,
  requestData: CreditLimitUpdateRequest
): Promise<CreditLimitUpdateResponse> {
  try {
    const response = await apiCall<CreditLimitUpdateResponse>(
      `/customer-accounts/${customerAccountId}/request-credit-limit-update`,
      "POST",
      requestData,
      true
    );
    
    if (response.status === "success") {
      return response;
    } else {
      throw new Error(response.message || "Failed to submit credit limit request.");
    }
  } catch (error: any) {
    throw new Error(`Failed to submit credit limit request: ${error.message || "Unknown error"}`);
  }
}

// Credit limit approval interfaces
export interface CreditLimitApprovalRequest {
  status: "approved" | "rejected";
  approval_type: "credit_limit_update";
  approval_id: string;
  notes: string;
}

export interface CreditLimitApprovalResponse {
  status: string;
  message: string;
  data?: any;
}

// Add credit limit approval function
export async function approveCreditLimitUpdate(
  customerAccountId: string,
  approvalData: CreditLimitApprovalRequest
): Promise<CreditLimitApprovalResponse> {
  try {
    const response = await apiCall<CreditLimitApprovalResponse>(
      `/customer-accounts/${customerAccountId}/approvals`,
      "POST",
      approvalData,
      true
    );
    
    if (response.status === "success") {
      return response;
    } else {
      throw new Error(response.message || "Failed to process credit limit approval.");
    }
  } catch (error: any) {
    throw new Error(`Failed to process credit limit approval: ${error.message || "Unknown error"}`);
  }
}