import apiCall from "./api";

export interface TemperatureLog {
  id: string;
  company_id: string;
  thermometer_name: string;
  area_room: string | null;
  acceptance_max_celsius: string | null;
  log_date: string;
  morning_temp: string | null;
  afternoon_temp: string | null;
  checked_by: string | null;
  remarks: string | null;
  is_out_of_range: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemperatureLogPayload {
  thermometer_name: string;
  area_room?: string;
  acceptance_max_celsius?: number;
  log_date: string;
  morning_temp?: number | null;
  afternoon_temp?: number | null;
  checked_by?: string;
  remarks?: string;
}

export interface TemperatureLogFilters {
  thermometer_name?: string;
  month?: string; // YYYY-MM
  date_from?: string;
  date_to?: string;
}

export async function fetchTemperatureLogs(
  filters: TemperatureLogFilters = {}
): Promise<{ data: TemperatureLog[]; thermometers: string[]; areas: string[] }> {
  const params = new URLSearchParams();
  if (filters.thermometer_name) params.append("thermometer_name", filters.thermometer_name);
  if (filters.month) params.append("month", filters.month);
  if (filters.date_from) params.append("date_from", filters.date_from);
  if (filters.date_to) params.append("date_to", filters.date_to);

  const response = await apiCall<{ status: string; data: TemperatureLog[]; thermometers: string[]; areas: string[] }>(
    `/temperature-logs?${params.toString()}`,
    "GET",
    undefined,
    true
  );
  return { data: response.data || [], thermometers: response.thermometers || [], areas: response.areas || [] };
}

export async function createTemperatureLog(payload: TemperatureLogPayload): Promise<TemperatureLog> {
  const response = await apiCall<{ status: string; data: TemperatureLog }>(
    "/temperature-logs",
    "POST",
    payload,
    true
  );
  return response.data;
}

export async function updateTemperatureLog(
  id: string,
  payload: Partial<TemperatureLogPayload>
): Promise<TemperatureLog> {
  const response = await apiCall<{ status: string; data: TemperatureLog }>(
    `/temperature-logs/${id}`,
    "PATCH",
    payload,
    true
  );
  return response.data;
}

export async function deleteTemperatureLog(id: string): Promise<void> {
  await apiCall(`/temperature-logs/${id}`, "DELETE", undefined, true);
}
