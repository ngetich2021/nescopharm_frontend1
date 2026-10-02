import apiCall from './api';

export interface SalaryAdvanceRequest {
  id: string;
  employee_id: string;
  employee: string;
  amount: string;
  requestDate: string;
  reason: string;
  status: string;
}

export async function getSalaryAdvances(params?: {
  company_id?: string;
  status?: string;
  employee_id?: string;
  search?: string;
}): Promise<SalaryAdvanceRequest[]> {
  const queryParams = new URLSearchParams();
  if (params?.company_id) queryParams.append('company_id', params.company_id);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.employee_id) queryParams.append('employee_id', params.employee_id);
  if (params?.search) queryParams.append('search', params.search);

  const qs = queryParams.toString();
  const response = await apiCall(`/salary-advances${qs ? `?${qs}` : ''}`, 'GET');
  return response.salary_advances || [];
}

export async function createSalaryAdvance(data: {
  employee_id: string;
  amount: number;
  request_date: string;
  reason: string;
}): Promise<SalaryAdvanceRequest> {
  const response = await apiCall('/salary-advances', 'POST', data);
  return response.salary_advance;
}

export async function updateSalaryAdvance(id: string, data: Partial<{
  employee_id: string;
  amount: number;
  request_date: string;
  reason: string;
  status: string;
}>): Promise<SalaryAdvanceRequest> {
  const response = await apiCall(`/salary-advances/${id}`, 'PUT', data);
  return response.salary_advance;
}

export async function deleteSalaryAdvance(id: string): Promise<void> {
  await apiCall(`/salary-advances/${id}`, 'DELETE');
}

export async function approveSalaryAdvance(id: string): Promise<SalaryAdvanceRequest> {
  const response = await apiCall(`/salary-advances/${id}/approve`, 'POST');
  return response.salary_advance;
}
