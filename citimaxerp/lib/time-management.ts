import apiCall from './api';

export interface TimeEntry {
  id: string;
  employee_id: string;
  employee: string;
  date: string;
  hours: string;
  project: string;
  description: string;
  status: string;
}

export async function getTimeEntries(params?: {
  company_id?: string;
  status?: string;
  employee_id?: string;
  search?: string;
}): Promise<TimeEntry[]> {
  const queryParams = new URLSearchParams();
  if (params?.company_id) queryParams.append('company_id', params.company_id);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.employee_id) queryParams.append('employee_id', params.employee_id);
  if (params?.search) queryParams.append('search', params.search);

  const qs = queryParams.toString();
  const response = await apiCall(`/time-entries${qs ? `?${qs}` : ''}`, 'GET');
  return response.time_entries || [];
}

export async function createTimeEntry(data: {
  employee_id: string;
  date: string;
  hours: number;
  project: string;
  description?: string;
}): Promise<TimeEntry> {
  const response = await apiCall('/time-entries', 'POST', data);
  return response.time_entry;
}

export async function updateTimeEntry(id: string, data: Partial<{
  employee_id: string;
  date: string;
  hours: number;
  project: string;
  description: string;
  status: string;
}>): Promise<TimeEntry> {
  const response = await apiCall(`/time-entries/${id}`, 'PUT', data);
  return response.time_entry;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await apiCall(`/time-entries/${id}`, 'DELETE');
}

export async function approveTimeEntry(id: string): Promise<TimeEntry> {
  const response = await apiCall(`/time-entries/${id}/approve`, 'POST');
  return response.time_entry;
}
