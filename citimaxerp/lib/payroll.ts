import apiCall from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayrollItem {
  id: string;
  payroll_record_id: string;
  employee_id: string;
  company_id: string;
  basic_salary: string;
  allowances: string;
  overtime_amount: string;
  bonus_amount: string;
  gross_pay: string;
  paye_amount: string;
  nssf_amount: string;
  shif_amount: string;
  other_deductions: string;
  total_deductions: string;
  net_pay: string;
  hours_worked: string;
  overtime_hours: string;
  days_worked: string;
  leave_days: string;
  allowance_breakdown: Array<{ type: string; amount: number }>;
  deduction_breakdown: Array<{ type: string; amount: number }>;
  notes?: string | null;
  metadata?: any | null;
  created_at: string;
  updated_at: string;
  employee: {
    id: string;
    company_id: string;
    employee_number: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    date_of_birth?: string | null;
    gender: string;
    national_id: string;
    kra_pin?: string | null;
    nssf_number?: string | null;
    shif_number?: string | null;
    address: string;
    city: string;
    state: string;
    postal_code?: string | null;
    hire_date: string;
    termination_date?: string | null;
    employment_type: string;
    payment_frequency: string;
    basic_salary: string;
    hourly_rate?: string | null;
    bank_name?: string | null;
    bank_account?: string | null;
    bank_branch?: string | null;
    is_active: boolean;
    department: string;
    position: string;
    supervisor_id?: string | null;
    allowances: any;
    deductions: any;
    metadata?: any | null;
    created_at: string;
    updated_at: string;
    created_by: string;
  };
}

export interface PayrollRecord {
  id: string;
  company_id: string;
  payroll_number: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  total_gross_pay: string;
  total_deductions: string;
  total_net_pay: string;
  total_paye: string;
  total_nssf: string;
  total_shif: string;
  employee_count: number;
  created_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  notes?: string | null;
  metadata?: any | null;
  created_at: string;
  updated_at: string;
  company?: {
    id: string;
    name: string;
    address?: string | null;
    email?: string | null;
  };
  items?: PayrollItem[];
}

export interface PayrollConfigurationTaxBand {
  lower_limit: number;
  upper_limit: number | null;
  rate: number;
}

export interface PayrollConfiguration {
  id: number;
  effective_from: string;
  effective_to: string | null;
  personal_relief: number;
  tax_bands: PayrollConfigurationTaxBand[];
  nssf_tiers: {
    tier1: { limit: number; rate: number };
    tier2: { limit: number; rate: number };
  };
  shif_rates: { standard: number; minimum: number };
  minimum_wages: Record<string, Record<string, number>>;
  overtime_rates: {
    regular: number;
    weekend: number;
    holiday: number;
    standard_monthly_hours: number;
    max_regular_hours: number;
  };
  created_at: string;
  updated_at: string;
}

export interface CreatePayrollRequest {
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  basic_salary: number;
  allowances?: Array<{ type: string; amount: number }>;
  deductions?: Array<{ type: string; amount: number }>;
  overtime_hours?: number;
  overtime_type?: 'regular' | 'weekend' | 'holiday';
  notes?: string;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface Pagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

interface PayrollRecordsResponse {
  status: string;
  payroll_records: PayrollRecord[];
  pagination?: Pagination;
  message?: string;
}

interface PayrollRecordResponse {
  status: string;
  payroll_record: PayrollRecord;
  message?: string;
}

interface BulkPayrollResponse {
  status: string;
  message?: string;
  payroll_record_id: string;
  payroll_record: PayrollRecord;
  results: Array<{
    employee_id: string;
    payroll_item_id?: string;
    status: 'success' | 'failed';
    message?: string;
    net_pay?: number;
  }>;
}

// ---------------------------------------------------------------------------
// Payroll Records
// ---------------------------------------------------------------------------

export async function getPayrollRecords(params?: {
  employee_id?: string;
  pay_period_start?: string;
  pay_period_end?: string;
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<PayrollRecordsResponse> {
  const q = new URLSearchParams();
  if (params?.employee_id)     q.append('employee_id',     params.employee_id);
  if (params?.pay_period_start)q.append('pay_period_start',params.pay_period_start);
  if (params?.pay_period_end)  q.append('pay_period_end',  params.pay_period_end);
  if (params?.status)          q.append('status',          params.status);
  if (params?.search)          q.append('search',          params.search);
  if (params?.page)            q.append('page',            String(params.page));
  if (params?.per_page)        q.append('per_page',        String(params.per_page));
  const qs = q.toString() ? `?${q}` : '';
  return apiCall<PayrollRecordsResponse>(`/payroll${qs}`, 'GET');
}

export async function getPayrollRecord(id: string): Promise<PayrollRecordResponse> {
  return apiCall<PayrollRecordResponse>(`/payroll/${id}`, 'GET');
}

export async function createPayrollRecord(data: CreatePayrollRequest): Promise<PayrollRecordResponse> {
  return apiCall<PayrollRecordResponse>('/payroll', 'POST', data);
}

export async function updatePayrollRecord(
  id: string,
  data: { pay_period_start?: string; pay_period_end?: string; pay_date?: string; notes?: string }
): Promise<PayrollRecordResponse> {
  return apiCall<PayrollRecordResponse>(`/payroll/${id}`, 'PUT', data);
}

export async function deletePayrollRecord(id: string): Promise<{ status: string; message: string }> {
  return apiCall<{ status: string; message: string }>(`/payroll/${id}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

export async function approvePayrollRecord(id: string): Promise<PayrollRecordResponse> {
  return apiCall<PayrollRecordResponse>(`/payroll/${id}/approve`, 'POST', {});
}

export async function payPayrollRecord(id: string): Promise<PayrollRecordResponse> {
  return apiCall<PayrollRecordResponse>(`/payroll/${id}/pay`, 'POST', {});
}

export async function cancelPayrollRecord(id: string): Promise<PayrollRecordResponse> {
  return apiCall<PayrollRecordResponse>(`/payroll/${id}/cancel`, 'POST', {});
}

// ---------------------------------------------------------------------------
// Payslip
// ---------------------------------------------------------------------------

export interface PayslipData {
  employee: {
    id: string;
    employee_number: string;
    full_name: string;
    position: string;
    department: string;
    kra_pin?: string | null;
    nssf_number?: string | null;
    shif_number?: string | null;
    bank_name?: string | null;
    bank_account?: string | null;
  };
  payroll: {
    payroll_number: string;
    pay_period_start: string;
    pay_period_end: string;
    pay_date: string;
    status: string;
  };
  earnings: {
    basic_salary: number;
    allowances: number;
    allowance_breakdown: Array<{ type: string; amount: number }>;
    overtime_amount: number;
    overtime_hours: number;
    gross_pay: number;
  };
  deductions: {
    paye: number;
    nssf: number;
    shif: number;
    other: number;
    breakdown: Array<{ type: string; amount: number }>;
    total: number;
  };
  net_pay: number;
  company: { name: string; address?: string | null; email?: string | null };
  approved_by: string | null;
}

export async function getPayrollPayslips(id: string): Promise<{ status: string; payslips: PayslipData[] }> {
  return apiCall<{ status: string; payslips: PayslipData[] }>(`/payroll/${id}/payslip`, 'GET');
}

// ---------------------------------------------------------------------------
// Bulk payroll
// ---------------------------------------------------------------------------

export async function processBulkPayroll(data: {
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  employee_ids: string[];
  notes?: string;
  custom_data: Record<string, {
    basic_salary: number;
    allowances: Array<{ type: string; amount: number }>;
    deductions: Array<{ type: string; amount: number }>;
    overtime_hours?: number;
    overtime_type?: 'regular' | 'weekend' | 'holiday';
    region?: string;
    skill_level?: 'unskilled' | 'semi_skilled' | 'skilled' | 'highly_skilled';
  }>;
}): Promise<BulkPayrollResponse> {
  return apiCall<BulkPayrollResponse>('/payroll/bulk', 'POST', data);
}

// ---------------------------------------------------------------------------
// Summary / Dashboard
// ---------------------------------------------------------------------------

export async function getPayrollSummary(params?: { pay_period?: string; status?: string }) {
  const q = new URLSearchParams();
  if (params?.pay_period) q.append('period', params.pay_period);
  if (params?.status)     q.append('status', params.status);
  const qs = q.toString() ? `?${q}` : '';
  return apiCall<any>(`/payroll-company-summary${qs}`, 'GET');
}

export async function getEmployeePayrollHistory(employeeId: string, params?: {
  status?: string;
  page?: number;
  per_page?: number;
}) {
  const q = new URLSearchParams();
  q.append('employee_id', employeeId);
  if (params?.status)   q.append('status',   params.status);
  if (params?.page)     q.append('page',     String(params.page));
  if (params?.per_page) q.append('per_page', String(params.per_page));
  return apiCall<PayrollRecordsResponse>(`/payroll?${q}`, 'GET');
}

// ---------------------------------------------------------------------------
// Payroll Configuration
// ---------------------------------------------------------------------------

export async function getPayrollConfigurations(): Promise<{
  status: string;
  configurations: PayrollConfiguration[];
  current: PayrollConfiguration | null;
}> {
  return apiCall<any>('/payroll-configurations', 'GET');
}

export async function getCurrentPayrollConfiguration(): Promise<{
  status: string;
  configuration: PayrollConfiguration | null;
}> {
  return apiCall<any>('/payroll-configurations/current', 'GET');
}

export async function createPayrollConfiguration(
  data: Omit<PayrollConfiguration, 'id' | 'created_at' | 'updated_at'>
): Promise<{ status: string; configuration: PayrollConfiguration }> {
  return apiCall<any>('/payroll-configurations', 'POST', data);
}

export async function updatePayrollConfiguration(
  id: number,
  data: Partial<Omit<PayrollConfiguration, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ status: string; configuration: PayrollConfiguration }> {
  return apiCall<any>(`/payroll-configurations/${id}`, 'PUT', data);
}

export async function deletePayrollConfiguration(id: number): Promise<{ status: string; message: string }> {
  return apiCall<any>(`/payroll-configurations/${id}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Legacy alias — kept for any existing call-sites during migration
// ---------------------------------------------------------------------------

/** @deprecated Use createPayrollRecord() */
export const createSinglePayroll = createPayrollRecord;
