import apiCall from './api';

// Employee interface matching the API specification
export interface Employee {
  id?: string;
  company_id: string;
  employee_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  national_id?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  employment_type?: string | null;
  payment_frequency?: string | null;
  basic_salary?: string | null; // API returns this as a string
  hourly_rate?: string | null; // API returns this as a string
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_branch?: string | null;
  department?: string | null;
  position?: string | null;
  supervisor_id?: string | null;
  leave_approver_id?: string | null;
  salary_advance_approver_id?: string | null;
  user_id?: string | null; // login connected to this employee for the employee portal
  user?: { id: string; first_name: string; last_name: string; email?: string } | null;
  is_active: boolean; // API uses is_active instead of employment_status
  employment_status?: 'active' | 'inactive' | 'terminated';
  gross_salary?: number;
  statutory_details: {
    kra_pin: string;
    nssf_number: string;
    shif_number: string;
    has_disability?: boolean;
    disability_exemption_certificate?: string | null;
    disability_exemption_amount?: number | null;
    has_insurance_relief?: boolean;
    insurance_relief_amount?: number;
  };
  allowances?: Record<string, number> | Array<{ name: string; amount: number; frequency?: string; is_taxable?: boolean }>;
  deductions?: Record<string, number> | Array<{ name: string; amount: number; frequency?: string }>;
  payroll_history?: any[]; // PayrollRecord[] - moved to payroll.ts
  created_at?: string;
  updated_at?: string;
  company?: {
    id: string;
    name: string;
    description?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    website?: string;
    logo_url?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    is_first_time: boolean;
    current_subscription_id?: string;
  };
  supervisor?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  leave_approver?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
  } | null;
  salary_advance_approver?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
  } | null;
}



// Employee Statistics interface
interface EmployeeStatistics {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  by_department: Record<string, number>;
  by_employment_type: Record<string, number>;
}

interface EmployeeStatisticsResponse {
  status: string;
  message: string;
  statistics: EmployeeStatistics;
}

// Response interfaces
interface EmployeeResponse {
  status: string;
  employee: Employee;
  message?: string;
}

interface EmployeesResponse {
  status: string;
  employees: Employee[];
  total: number;
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
  message?: string;
}



// Updated Employee interface to match API specification

interface CreateEmployeePayload {
  employee_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  national_id?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  employment_type?: string | null;
  payment_frequency?: string | null;
  basic_salary?: string | null; // API expects this as a string
  hourly_rate?: string | null; // API expects this as a string
  department?: string | null;
  position?: string | null;
  supervisor_id?: string | null;
  leave_approver_id?: string | null;
  salary_advance_approver_id?: string | null;
  user_id?: string | null;
  employment_status?: 'active' | 'inactive' | 'terminated';
  is_active?: boolean;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  bank_name?: string;
  bank_account?: string;
  bank_branch?: string;
  statutory_details: {
    kra_pin: string;
    nssf_number: string;
    shif_number: string;
    has_disability?: boolean;
    disability_exemption_certificate?: string | null;
    disability_exemption_amount?: number | null;
    has_insurance_relief?: boolean;
    insurance_relief_amount?: number;
  };
  allowances?: Record<string, number> | Array<{ name: string; amount: number; frequency?: string; is_taxable?: boolean }>;
  deductions?: Record<string, number> | Array<{ name: string; amount: number; frequency?: string }>;
}

// Employee Management Functions

/**
 * Fetch all employees with optional filters
 * @param params Optional filtering parameters
 * @returns Promise with employees data
 */
export async function getEmployees(params?: {
  company_id?: string;
  department?: string;
  employment_status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<EmployeesResponse> {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.company_id) queryParams.append('company_id', params.company_id);
    if (params?.department) queryParams.append('department', params.department);
    if (params?.employment_status) queryParams.append('employment_status', params.employment_status);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const url = `/employees${queryString}`;
    
    const response = await apiCall<EmployeesResponse>(url, 'GET');
    return response;
  } catch (error: any) {
    throw new Error(`Failed to fetch employees: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Fetch a single employee by ID
 * @param id Employee ID
 * @returns Promise with employee data
 */
export async function getEmployee(id: string): Promise<EmployeeResponse> {
  try {
    const response = await apiCall<EmployeeResponse>(`/employees/${id}`, 'GET');
    return response;
  } catch (error: any) {
    throw new Error(`Failed to fetch employee: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Create a new employee
 * @param data Employee data
 * @returns Promise with created employee
 */
export async function createEmployee(data: CreateEmployeePayload): Promise<EmployeeResponse> {
  try {
    const response = await apiCall<EmployeeResponse>('/employees', 'POST', data);
    return response;
  } catch (error: any) {
    throw new Error(`Failed to create employee: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Update an existing employee
 * @param id Employee ID
 * @param data Updated employee data
 * @returns Promise with updated employee
 */
export async function updateEmployee(id: string, data: Partial<CreateEmployeePayload>): Promise<EmployeeResponse> {
  try {
    const response = await apiCall<EmployeeResponse>(`/employees/${id}`, 'PUT', data);
    return response;
  } catch (error: any) {
    throw new Error(`Failed to update employee: ${error.message || 'Unknown error'}`);
  }
}

export async function terminateEmployee(id: string, data?: {
  termination_date?: string;
  reason?: string;
}): Promise<EmployeeResponse> {
  try {
    const response = await apiCall<EmployeeResponse>(`/employees/${id}/terminate`, 'POST', data || {});
    return response;
  } catch (error: any) {
    throw new Error(`Failed to terminate employee: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Delete an employee
 * @param id Employee ID
 * @returns Promise with deletion confirmation
 */
export async function deleteEmployee(id: string): Promise<{ status: string; message: string }> {
  try {
    const response = await apiCall<{ status: string; message: string }>(`/employees/${id}`, 'DELETE');
    return response;
  } catch (error: any) {
    throw error; // The apiCall function already formats the error message properly
  }
}





/**
 * Fetch employee statistics
 * @returns Promise with employee statistics
 */
export async function getEmployeeStatistics(): Promise<EmployeeStatisticsResponse> {
  try {
    const response = await apiCall<EmployeeStatisticsResponse>('/employees/statistics', 'GET');
    return response;
  } catch (error: any) {
    throw new Error(`Failed to fetch employee statistics: ${error.message || 'Unknown error'}`);
  }
}

export interface LinkableUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  role?: { id: string; name: string } | null;
}

// Logins that can be connected to this employee (excludes ones already connected to another employee).
export async function getLinkableUsers(employeeId: string): Promise<LinkableUser[]> {
  const response = await apiCall<{ status: string; data: LinkableUser[] }>(`/employees/${employeeId}/linkable-users`, 'GET');
  return response.data || [];
}

export interface DisbursedAllowance {
  id: string;
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  name: string;
  amount: number;
  is_taxable: boolean;
  updated_at: string | null;
}

export interface DisbursedAllowancesResponse {
  status: string;
  month: string;
  data: DisbursedAllowance[];
  summary: { total_amount: number; allowance_count: number; employee_count: number };
}

export async function getDisbursedAllowances(month: string): Promise<DisbursedAllowancesResponse> {
  return apiCall<DisbursedAllowancesResponse>(`/employee-allowances/disbursed?month=${encodeURIComponent(month)}`, 'GET');
}

// Export all functions as a single object for easier imports
export const employeesApi = {
  // Employee Management
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  terminateEmployee,
  deleteEmployee,
  
  // Employee Statistics
  getEmployeeStatistics,
};
