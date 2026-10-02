import apiCall from '@/lib/api'
import { getApiUrl } from '@/lib/config'
import { getToken } from '@/lib/token-manager'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayrollRun {
  id: string
  company_id: string
  pay_month: number
  pay_year: number
  status: 'draft' | 'approved' | 'paid'
  notes: string | null
  created_by: string
  approved_by: string | null
  approved_at: string | null
  paid_by: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
  // Aggregates
  payslips_count?: number
  total_gross?: string | number | null
  total_net?: string | number | null
  total_paye?: string | number | null
  total_nssf_employee?: string | number | null
  total_nssf_employer?: string | number | null
  total_shif?: string | number | null
  total_housing_levy?: string | number | null
  total_deductions?: string | number | null
  total_advance_deductions?: string | number | null
}

export interface PayrollPayslip {
  id: string
  payroll_run_id: string
  employee_id: string
  employee?: {
    id: string
    employee_number: string
    first_name: string
    last_name: string
    position: string | null
    department: string | null
    kra_pin: string | null
    nssf_number: string | null
    bank_name: string | null
    bank_account: string | null
    basic_salary: number
  }
  gross_pay: string
  insurance_relief_premium: string
  allowances_json: Array<{
    name: string
    amount: number
    frequency: string
    is_taxable: boolean
  }> | null
  total_allowances: string
  deductions_json: Array<{
    name: string
    amount: number
    frequency: string
  }> | null
  total_custom_deductions: string
  nssf_tier1: string
  nssf_tier2: string
  nssf_employee: string
  nssf_employer: string
  taxable_pay: string
  paye_before_relief: string
  personal_relief: string
  insurance_relief: string
  paye: string
  shif: string
  housing_levy_employee: string
  housing_levy_employer: string
  salary_advance_deduction: string
  other_deductions: string
  other_deductions_note: string | null
  total_deductions: string
  net_pay: string
  payroll_run?: PayrollRun
}

export interface PayrollStats {
  runs_this_year: number
  pending_approval: number
  total_net_paid_this_year: number
  last_run: PayrollRun | null
}

export interface EmployeeAllowance {
  id: string
  employee_id: string
  company_id: string
  name: string
  type: 'allowance' | 'deduction'
  amount: number
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one_time'
  is_taxable: boolean
  effective_from: string | null
  effective_to: string | null
  is_active: boolean
  created_at: string
}

export interface PaginatedResponse<T> {
  current_page: number
  data: T[]
  last_page: number
  per_page: number
  total: number
}

// ---------------------------------------------------------------------------
// Internal response shapes
// ---------------------------------------------------------------------------

interface ApiSuccessResponse<T> {
  status: 'success'
  data: T
}

// ---------------------------------------------------------------------------
// Payroll Runs
// ---------------------------------------------------------------------------

export async function fetchPayrollStats(): Promise<PayrollStats> {
  const res = await apiCall<ApiSuccessResponse<PayrollStats>>(
    '/payroll-runs/stats',
    'GET',
  )
  return res.data
}

export async function fetchPayrollRuns(
  params?: { page?: number; per_page?: number },
): Promise<PaginatedResponse<PayrollRun>> {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.per_page) queryParams.append('per_page', params.per_page.toString())

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''
  const res = await apiCall<ApiSuccessResponse<PaginatedResponse<PayrollRun>>>(
    `/payroll-runs${queryString}`,
    'GET',
  )
  return res.data
}

export async function fetchPayrollRun(id: string): Promise<PayrollRun> {
  const res = await apiCall<ApiSuccessResponse<PayrollRun>>(
    `/payroll-runs/${id}`,
    'GET',
  )
  return res.data
}

export async function createPayrollRun(
  data: { pay_month: number; pay_year: number; notes?: string },
): Promise<PayrollRun> {
  const res = await apiCall<ApiSuccessResponse<PayrollRun>>(
    '/payroll-runs',
    'POST',
    data,
  )
  return res.data
}

export async function processPayrollRun(id: string): Promise<PayrollRun> {
  const res = await apiCall<ApiSuccessResponse<PayrollRun>>(
    `/payroll-runs/${id}/process`,
    'POST',
  )
  return res.data
}

export async function approvePayrollRun(id: string): Promise<PayrollRun> {
  const res = await apiCall<ApiSuccessResponse<PayrollRun>>(
    `/payroll-runs/${id}/approve`,
    'POST',
  )
  return res.data
}

export async function markPayrollRunPaid(id: string): Promise<PayrollRun> {
  const res = await apiCall<ApiSuccessResponse<PayrollRun>>(
    `/payroll-runs/${id}/mark-paid`,
    'POST',
  )
  return res.data
}

// ---------------------------------------------------------------------------
// Payslips
// ---------------------------------------------------------------------------

export async function fetchPayslips(
  runId: string,
  params?: { page?: number; per_page?: number; search?: string },
): Promise<PaginatedResponse<PayrollPayslip>> {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.per_page) queryParams.append('per_page', params.per_page.toString())
  if (params?.search) queryParams.append('search', params.search)

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''
  const res = await apiCall<ApiSuccessResponse<PaginatedResponse<PayrollPayslip>>>(
    `/payroll-runs/${runId}/payslips${queryString}`,
    'GET',
  )
  return res.data
}

export async function downloadPayslipPdf(
  runId: string,
  payslipId: string,
): Promise<Blob> {
  const url = getApiUrl(`/payroll-runs/${runId}/payslips/${payslipId}/download`)
  const token = getToken()

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/pdf',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to download payslip PDF: ${response.statusText}`)
  }

  return response.blob()
}

export async function exportP10(runId: string): Promise<Blob> {
  const url = getApiUrl(`/payroll-runs/${runId}/export/p10`)
  const token = getToken()

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/octet-stream',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to export P10: ${response.statusText}`)
  }

  return response.blob()
}

// ---------------------------------------------------------------------------
// Payslip Edit (one-time adjustments on draft runs)
// ---------------------------------------------------------------------------

export async function updatePayslip(
  runId: string,
  payslipId: string,
  data: {
    allowances?: Array<{ name: string; amount: number; frequency?: string; is_taxable?: boolean }>
    deductions?: Array<{ name: string; amount: number; frequency?: string }>
    other_deductions?: number
    other_deductions_note?: string
  },
): Promise<PayrollPayslip> {
  const res = await apiCall<ApiSuccessResponse<PayrollPayslip>>(
    `/payroll-runs/${runId}/payslips/${payslipId}`,
    'PUT',
    data,
  )
  return res.data
}

// ---------------------------------------------------------------------------
// Employee Allowances
// ---------------------------------------------------------------------------

export async function fetchEmployeeAllowances(
  employeeId: string,
): Promise<EmployeeAllowance[]> {
  const res = await apiCall<ApiSuccessResponse<EmployeeAllowance[]>>(
    `/employees/${employeeId}/allowances`,
    'GET',
  )
  return res.data
}

export async function createEmployeeAllowance(
  employeeId: string,
  data: Partial<EmployeeAllowance>,
): Promise<EmployeeAllowance> {
  const res = await apiCall<ApiSuccessResponse<EmployeeAllowance>>(
    `/employees/${employeeId}/allowances`,
    'POST',
    data,
  )
  return res.data
}

export async function updateEmployeeAllowance(
  employeeId: string,
  id: string,
  data: Partial<EmployeeAllowance>,
): Promise<EmployeeAllowance> {
  const res = await apiCall<ApiSuccessResponse<EmployeeAllowance>>(
    `/employees/${employeeId}/allowances/${id}`,
    'PUT',
    data,
  )
  return res.data
}

export async function deleteEmployeeAllowance(
  employeeId: string,
  id: string,
): Promise<void> {
  await apiCall<ApiSuccessResponse<null>>(
    `/employees/${employeeId}/allowances/${id}`,
    'DELETE',
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a numeric value as a KES amount string (e.g. "1,234.56"). */
export function formatKES(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  return num.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Return the full month name for a 1-based month number. */
export function monthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString('en', { month: 'long' })
}
