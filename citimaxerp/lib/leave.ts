import apiCall from './api';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee: string;
  department?: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  requestDate?: string | null;
  reportingDate?: string | null;
  durationUnit?: string | null;
  totalRequested?: number | null;
  daysTaken?: number;
  reasonCategory?: string | null;
  reason: string;
  balanceDays?: number | null;
  isRecord?: boolean;
  status: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
}

export interface LeaveBalance {
  leaveType: string;
  allowance: number;
  used: number;
  balance: number;
}

// The four leave types on the paper leave form, with the days allowed per year (Jan to Dec).
// "annual" is the form's Casual leave. Unpaid leave stays readable on old requests.
export const LEAVE_TYPES = [
  { value: 'annual', label: 'Casual Leave', days: 21 },
  { value: 'sick', label: 'Sick Leave', days: 7 },
  { value: 'paternity', label: 'Paternity Leave', days: 14 },
  { value: 'maternity', label: 'Maternity Leave', days: 90 },
];

export const REASON_CATEGORIES = [
  { value: 'personal', label: 'Personal' },
  { value: 'medical', label: 'Medical Attention' },
  { value: 'religious', label: 'Religious Observances' },
  { value: 'other', label: 'Other' },
];

export const DURATION_UNITS = [
  { value: 'hours', label: 'Hours' },
  { value: 'day', label: 'Day' },
  { value: 'days', label: 'Days' },
];

export function leaveTypeLabel(type?: string | null): string {
  if (type === 'unpaid') return 'Unpaid Leave';
  return LEAVE_TYPES.find((t) => t.value === type)?.label || type || '';
}

export function reasonCategoryLabel(value?: string | null): string {
  return REASON_CATEGORIES.find((r) => r.value === value)?.label || '';
}

export function formatDuration(lr: Pick<LeaveRequest, 'totalRequested' | 'durationUnit' | 'daysTaken'>): string {
  if (lr.totalRequested != null && lr.durationUnit) {
    const n = Number(lr.totalRequested);
    const unit = lr.durationUnit === 'hours' ? (n === 1 ? 'hour' : 'hours') : n === 1 ? 'day' : 'days';
    return `${n} ${unit}`;
  }
  return lr.daysTaken != null ? `${lr.daysTaken} ${lr.daysTaken === 1 ? 'day' : 'days'}` : '';
}

/** Today in Nairobi as yyyy-mm-dd; leave starting on or before it is captured as a record. */
export function todayNairobi(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

export function isRecordDate(startDate: string): boolean {
  return !!startDate && startDate <= todayNairobi();
}

/** Calendar days from start to end, both counted. */
export function daysInclusive(start: string, end: string): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms < 0 ? 0 : Math.round(ms / 86400000) + 1;
}

/** The day after $date, for the reporting (day in) date. */
export function nextDay(date: string): string {
  if (!date) return '';
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

const HOURS_PER_DAY = 8;

/** Leave days the form asks for: the total typed in (hours count as part days), else start to end. */
export function formDays(form: Pick<LeaveFormValues, 'total_requested' | 'duration_unit' | 'start_date' | 'end_date'>): number {
  if (form.total_requested !== '') {
    const n = Number(form.total_requested) || 0;
    return form.duration_unit === 'hours' ? Math.round((n / HOURS_PER_DAY) * 100) / 100 : n;
  }
  return daysInclusive(form.start_date, form.end_date);
}

/**
 * Days left of the form's leave type for its year once this leave is taken, from the employee's
 * other approved leave in $requests. A balance written on a paper form (a record) is taken as
 * true from then on, as on the server. Null when the type has no yearly allowance.
 */
export function balanceAfter(requests: LeaveRequest[], employeeId: string, form: LeaveFormValues, excludeId?: string): number | null {
  const allowance = LEAVE_TYPES.find((t) => t.value === form.leave_type)?.days;
  if (allowance == null || !form.start_date) return null;
  const year = form.start_date.slice(0, 4);
  const taken = requests
    .filter((r) => r.id !== excludeId && r.employee_id === employeeId && r.leaveType === form.leave_type
      && r.status === 'approved' && (r.startDate || '').slice(0, 4) === year)
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  const anchorAt = taken.map((r) => r.isRecord && r.balanceDays != null).lastIndexOf(true);
  const start = anchorAt >= 0 ? Number(taken[anchorAt].balanceDays) : allowance;
  const used = taken.slice(anchorAt + 1).reduce((sum, r) => sum + Number(r.daysTaken || 0), 0);
  return Math.round((start - used - formDays(form)) * 100) / 100;
}

export interface LeaveFormValues {
  leave_type: string;
  request_date: string;
  start_date: string;
  end_date: string;
  reporting_date: string;
  duration_unit: string;
  total_requested: string;
  reason_category: string;
  reason: string;
  balance_days: string;
  approved_on: string;
}

export function emptyLeaveForm(): LeaveFormValues {
  return {
    leave_type: 'annual',
    request_date: todayNairobi(),
    start_date: '',
    end_date: '',
    reporting_date: '',
    duration_unit: 'days',
    total_requested: '',
    reason_category: '',
    reason: '',
    balance_days: '',
    approved_on: '',
  };
}

export function leaveFormFrom(lr: LeaveRequest): LeaveFormValues {
  return {
    leave_type: lr.leaveType || 'annual',
    request_date: lr.requestDate || '',
    start_date: lr.startDate || '',
    end_date: lr.endDate || '',
    reporting_date: lr.reportingDate || '',
    duration_unit: lr.durationUnit || 'days',
    total_requested: lr.totalRequested != null ? String(lr.totalRequested) : '',
    reason_category: lr.reasonCategory || '',
    reason: lr.reason || '',
    balance_days: lr.balanceDays != null ? String(lr.balanceDays) : '',
    approved_on: lr.isRecord ? lr.approvedAt || '' : '',
  };
}

/** API payload: blanks are left out so the server fills them (balance, approval date). */
export function leavePayload(form: LeaveFormValues): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  Object.entries(form).forEach(([k, v]) => {
    if (v === '') return;
    out[k] = k === 'total_requested' || k === 'balance_days' ? Number(v) : v;
  });
  if (!form.reason) out.reason = '';
  return out;
}

export async function getLeaveRequestsData(params?: {
  company_id?: string;
  status?: string;
  employee_id?: string;
  search?: string;
}): Promise<{ leave_requests: LeaveRequest[]; records_approver: string | null }> {
  const queryParams = new URLSearchParams();
  if (params?.company_id) queryParams.append('company_id', params.company_id);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.employee_id) queryParams.append('employee_id', params.employee_id);
  if (params?.search) queryParams.append('search', params.search);

  const qs = queryParams.toString();
  const response = await apiCall<any>(`/leave-requests${qs ? `?${qs}` : ''}`, 'GET');
  return { leave_requests: response.leave_requests || [], records_approver: response.records_approver || null };
}

export async function getLeaveRequests(params?: Parameters<typeof getLeaveRequestsData>[0]): Promise<LeaveRequest[]> {
  return (await getLeaveRequestsData(params)).leave_requests;
}

export async function createLeaveRequest(data: { employee_id: string } & Record<string, string | number>): Promise<LeaveRequest> {
  const response = await apiCall<any>('/leave-requests', 'POST', data);
  return response.leave_request;
}

export async function updateLeaveRequest(id: string, data: Record<string, string | number>): Promise<LeaveRequest> {
  const response = await apiCall<any>(`/leave-requests/${id}`, 'PUT', data);
  return response.leave_request;
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  await apiCall<any>(`/leave-requests/${id}`, 'DELETE');
}

export async function approveLeaveRequest(id: string): Promise<LeaveRequest> {
  const response = await apiCall<any>(`/leave-requests/${id}/approve`, 'POST');
  return response.leave_request;
}
