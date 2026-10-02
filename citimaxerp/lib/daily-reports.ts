import apiCall from './api';

export interface DailyWorkReportEntry {
  time: string;
  activity: string;
}

export interface DailyWorkReport {
  id: string;
  employee_id: string;
  employee: string;
  reportDate: string;
  designation: string | null;
  department: string | null;
  entries: DailyWorkReportEntry[];
  keyAchievements: string | null;
  pendingWork: string | null;
  remarks: string | null;
  status: string;
  approverRole: string | null;
  approver: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  created_at: string;
  updated_at: string;
}

// Default time blocks for Mon-Fri: 8:30-10:30, 10:30-1:00, 2:00-5:00
// Saturday: 9:00 AM - 1:30 PM only
// Sunday: Off (no report submitted)
export const DEFAULT_DAILY_REPORT_ENTRIES: DailyWorkReportEntry[] = [
  { time: '8:30 AM - 10:30 AM', activity: '' },
  { time: '10:30 AM - 1:00 PM', activity: '' },
  { time: '2:00 PM - 5:00 PM', activity: '' },
];

export const SATURDAY_DAILY_REPORT_ENTRIES: DailyWorkReportEntry[] = [
  { time: '9:00 AM - 1:30 PM', activity: '' },
];

/** Sundays are skipped - the company works Mon-Sat only ("Sunday: Off"). */
export function isSunday(dateStr: string): boolean {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return false;
  return new Date(year, month - 1, day).getDay() === 0;
}

export function isSaturday(dateStr: string): boolean {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return false;
  return new Date(year, month - 1, day).getDay() === 6;
}

export function getEntriesForDate(dateStr: string): DailyWorkReportEntry[] {
  return isSaturday(dateStr) ? SATURDAY_DAILY_REPORT_ENTRIES : DEFAULT_DAILY_REPORT_ENTRIES;
}

// Admin/approver-facing endpoints (/daily-reports)

export async function getDailyReports(params?: {
  status?: string;
  employee_id?: string;
}): Promise<DailyWorkReport[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.employee_id) queryParams.append('employee_id', params.employee_id);

  const qs = queryParams.toString();
  const response = await apiCall<{ daily_reports: DailyWorkReport[] }>(`/daily-reports${qs ? `?${qs}` : ''}`, 'GET');
  return response.daily_reports || [];
}

export async function approveDailyReport(id: string, remarks?: string): Promise<DailyWorkReport> {
  const response = await apiCall<{ daily_report: DailyWorkReport }>(`/daily-reports/${id}/approve`, 'POST', { remarks });
  return response.daily_report;
}

export async function rejectDailyReport(id: string, reason?: string, remarks?: string): Promise<DailyWorkReport> {
  const response = await apiCall<{ daily_report: DailyWorkReport }>(`/daily-reports/${id}/reject`, 'POST', { reason, remarks });
  return response.daily_report;
}

// Draft save/load functions for client-side storage
const DRAFT_STORAGE_KEY = 'daily_report_draft';

export function saveDraftReport(reportDate: string, data: any): void {
  if (typeof window !== 'undefined') {
    const drafts = getDraftReports();
    drafts[reportDate] = {
      ...data,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  }
}

export function getDraftReport(reportDate: string): any | null {
  if (typeof window !== 'undefined') {
    const drafts = getDraftReports();
    return drafts[reportDate] || null;
  }
  return null;
}

export function getDraftReports(): Record<string, any> {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }
  return {};
}

export function clearDraftReport(reportDate: string): void {
  if (typeof window !== 'undefined') {
    const drafts = getDraftReports();
    delete drafts[reportDate];
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  }
}

export function isFormComplete(entries: DailyWorkReportEntry[], keyAchievements: string, pendingWork: string): boolean {
  const hasAllEntries = entries.every(entry => entry.activity?.trim().length > 0);
  const hasAchievements = keyAchievements?.trim().length > 0;
  const hasPendingWork = pendingWork?.trim().length > 0;
  return hasAllEntries && hasAchievements && hasPendingWork;
}

export function shouldAutoSubmit(): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Don't auto-submit on Sundays
  if (dayOfWeek === 0) return false;

  // Auto-submit at 8:00 PM (20:00)
  return now.getHours() >= 20;
}
