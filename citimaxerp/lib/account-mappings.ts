import apiCall from './api'

export interface ChartOfAccountMinimal {
  id: string
  account_code: string
  account_name: string
  account_type: string
}

export interface AccountMapping {
  id: string
  company_id: string
  mapping_key: string
  account_code: string
  chart_of_account?: ChartOfAccountMinimal
  description?: string | null
  context_type?: string | null
  context_id?: string | null
  priority?: number
  is_active?: boolean
}

export interface InitializeResponse {
  status: string
  message?: string
  mapped_count: number
  unmapped_count: number
  mapped?: Record<string, string>
  unmapped?: Record<string, string>
}

export const initializeMappings = async (company_id?: string): Promise<InitializeResponse> => {
  const payload = company_id ? { company_id } : {}
  const response = await apiCall<InitializeResponse>('/finance/account-mappings/initialize', 'POST', payload, true)
  return response
}

export const getMappings = async (params?: { company_id?: string; is_system?: boolean; context_type?: string }) => {
  const query = params ? new URLSearchParams(params as any).toString() : ''
  const url = query ? `/finance/account-mappings?${query}` : '/finance/account-mappings'
  const response = await apiCall<{ status: string; mappings: AccountMapping[]; available_keys?: any }>(url, 'GET', undefined, true)
  return response
}

export const getMapping = async (id: string) => {
  const response = await apiCall<{ status: string; mapping: AccountMapping }>(`/finance/account-mappings/${id}`, 'GET', undefined, true)
  return response
}

export const saveMapping = async (data: Partial<AccountMapping> & { company_id?: string; mapping_key: string; account_code: string }) => {
  const response = await apiCall<{ status: string; message?: string; mapping?: AccountMapping }>('/finance/account-mappings', 'POST', data, true)
  return response
}

export const bulkUpdateMappings = async (company_id: string, mappings: Array<{ mapping_key: string; account_code: string; description?: string }>) => {
  const response = await apiCall<{ status: string; saved_count: number; errors: any[] }>(`/finance/account-mappings/bulk`, 'POST', { company_id, mappings }, true)
  return response
}

export const getAvailableMappingKeys = async () => {
  const response = await apiCall<any>('/finance/account-mappings/available-keys', 'GET', undefined, true)
  return response
}

export const validateMappings = async (company_id?: string) => {
  const query = company_id ? `?company_id=${company_id}` : ''
  const response = await apiCall<any>(`/finance/account-mappings/validate${query}`, 'GET', undefined, true)
  return response
}

export const getPaymentMethodMappings = async (company_id?: string) => {
  const query = company_id ? `?company_id=${company_id}` : ''
  const response = await apiCall<any>(`/finance/account-mappings/payment-methods${query}`, 'GET', undefined, true)
  return response
}

export const savePaymentMethodMapping = async (data: { company_id?: string; payment_method: string; mapping_key: string; description?: string }) => {
  const response = await apiCall<any>('/finance/account-mappings/payment-methods', 'POST', data, true)
  return response
}

export const deleteMapping = async (id: string) => {
  const response = await apiCall<any>(`/finance/account-mappings/${id}`, 'DELETE', undefined, true)
  return response
}

export default {
  initializeMappings,
  getMappings,
  getMapping,
  saveMapping,
  bulkUpdateMappings,
  getAvailableMappingKeys,
  validateMappings,
  getPaymentMethodMappings,
  savePaymentMethodMapping,
  deleteMapping,
}
