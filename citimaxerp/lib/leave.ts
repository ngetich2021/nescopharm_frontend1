import apiCall from './api';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
}

export async function getLeaveRequests(params?: {
  company_id?: string;
  status?: string;
  employee_id?: string;
  search?: string;
}): Promise<LeaveRequest[]> {
  const queryParams = new URLSearchParams();
  if (params?.company_id) queryParams.append('company_id', params.company_id);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.employee_id) queryParams.append('employee_id', params.employee_id);
  if (params?.search) queryParams.append('search', params.search);

  const qs = queryParams.toString();
  const response = await apiCall(`/leave-requests${qs ? `?${qs}` : ''}`, 'GET');
  return response.leave_requests || [];
}

export async function createLeaveRequest(data: {
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}): Promise<LeaveRequest> {
  const response = await apiCall('/leave-requests', 'POST', data);
  return response.leave_request;
}

export async function updateLeaveRequest(id: string, data: Partial<{
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
}>): Promise<LeaveRequest> {
  const response = await apiCall(`/leave-requests/${id}`, 'PUT', data);
  return response.leave_request;
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  await apiCall(`/leave-requests/${id}`, 'DELETE');
}

export async function approveLeaveRequest(id: string): Promise<LeaveRequest> {
  const response = await apiCall(`/leave-requests/${id}/approve`, 'POST');
  return response.leave_request;
}
