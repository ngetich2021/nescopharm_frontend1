import apiCall from "./api";
import type { Employee } from "./employees";
import type { LeaveBalance, LeaveRequest } from "./leave";
import type { SalaryAdvanceRequest } from "./salary-advance";
import type { DailyWorkReport, DailyWorkReportEntry } from "./daily-reports";

export async function getEmployeePortalProfile(): Promise<Employee> {
  const response = await apiCall<{ employee: Employee }>("/employee-portal/me", "GET");
  return response.employee;
}

export async function getEmployeePortalLeaveRequests(status?: string): Promise<{
  leave_requests: LeaveRequest[];
  balances: LeaveBalance[];
  records_approver: string | null;
}> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await apiCall<{ leave_requests: LeaveRequest[]; balances?: LeaveBalance[]; records_approver?: string | null }>(`/employee-portal/leave-requests${query}`, "GET");
  return {
    leave_requests: response.leave_requests || [],
    balances: response.balances || [],
    records_approver: response.records_approver || null,
  };
}

export async function createEmployeePortalLeaveRequest(data: Record<string, string | number>): Promise<LeaveRequest> {
  const response = await apiCall<{ leave_request: LeaveRequest }>("/employee-portal/leave-requests", "POST", data);
  return response.leave_request;
}

export async function getEmployeePortalSalaryAdvances(status?: string): Promise<SalaryAdvanceRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await apiCall<{ salary_advances: SalaryAdvanceRequest[] }>(`/employee-portal/salary-advances${query}`, "GET");
  return response.salary_advances || [];
}

export async function createEmployeePortalSalaryAdvance(data: {
  amount: number;
  request_date: string;
  reason: string;
}): Promise<SalaryAdvanceRequest> {
  const response = await apiCall<{ salary_advance: SalaryAdvanceRequest }>("/employee-portal/salary-advances", "POST", data);
  return response.salary_advance;
}

export async function getEmployeePortalDailyReports(status?: string): Promise<DailyWorkReport[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await apiCall<{ daily_reports: DailyWorkReport[] }>(`/employee-portal/daily-reports${query}`, "GET");
  return response.daily_reports || [];
}

export async function deleteEmployeePortalDailyReport(id: string): Promise<void> {
  await apiCall<any>(`/employee-portal/daily-reports/${id}`, "DELETE");
}

export type DailyReportDraft = {
  report_date: string;
  entries: DailyWorkReportEntry[];
  key_achievements: string;
  pending_work: string;
  saved_at?: string;
};

/** The day's report as last saved on the server (forwarded as it stands at the 12 midnight close). */
export async function getEmployeePortalDailyReportDraft(date: string): Promise<DailyReportDraft | null> {
  const response = await apiCall<{ draft: DailyReportDraft | null }>(`/employee-portal/daily-report-draft?date=${encodeURIComponent(date)}`, "GET");
  return response.draft || null;
}

export async function saveEmployeePortalDailyReportDraft(data: DailyReportDraft): Promise<void> {
  await apiCall<any>("/employee-portal/daily-report-draft", "PUT", data);
}

export type StaffActivity = {
  date: string;
  daily_report_status: {
    submitted: { employee: string; status: string; auto_submitted: boolean; submitted_at: string }[];
    missing: { employee: string; has_draft: boolean }[];
  };
  daily_reports: DailyWorkReport[];
  leave_requests: LeaveRequest[];
  salary_advances: SalaryAdvanceRequest[];
};

/** Every employee's portal activity - GM and Directors only. */
export async function getStaffActivity(date?: string): Promise<StaffActivity> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiCall<StaffActivity>(`/employee-portal/staff-activity${query}`, "GET");
}

export async function createEmployeePortalDailyReport(data: {
  report_date: string;
  designation?: string;
  department?: string;
  entries: DailyWorkReportEntry[];
  key_achievements?: string;
  pending_work?: string;
}): Promise<DailyWorkReport> {
  const response = await apiCall<{ daily_report: DailyWorkReport }>("/employee-portal/daily-reports", "POST", data);
  return response.daily_report;
}
