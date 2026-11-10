import apiCall from "./api"

// SOPs > Cleaning Records: recorded by the store manager, confirmed with a comment by the picked checker.

export interface CleaningLog {
  id: string
  cleaning_date: string // yyyy-mm-dd
  start_time: string | null // 08:40
  end_time: string | null
  areas: string
  cleaned_by: string | null
  remarks: string | null
  prepared_by_user_id: string | null
  prepared_by_name: string | null
  checker_user_id: string | null
  checker_name: string | null
  status: "pending" | "checked"
  checker_comment: string | null
  checked_at: string | null
  created_at: string
}

export interface CleaningLogPayload {
  cleaning_date: string
  start_time?: string | null
  end_time?: string | null
  areas: string
  cleaned_by?: string | null
  remarks?: string | null
  checker_user_id: string
}

/** Someone whose role may check temperature and cleaning records ("Check SOP Records" on Users > Roles). */
export interface SopChecker {
  id: string
  name: string
  role: string | null
}

export async function fetchSopCheckers(): Promise<SopChecker[]> {
  const res = await apiCall<{ data: SopChecker[] }>("/sop-checkers", "GET", undefined, true)
  return res.data || []
}

export async function fetchCleaningLogs(filters: { date_from?: string; date_to?: string } = {}) {
  const params = new URLSearchParams()
  if (filters.date_from) params.append("date_from", filters.date_from)
  if (filters.date_to) params.append("date_to", filters.date_to)
  const res = await apiCall<{ data: CleaningLog[]; areas: string[]; cleaners: string[] }>(`/cleaning-logs?${params}`, "GET", undefined, true)
  return { data: res.data || [], areas: res.areas || [], cleaners: res.cleaners || [] }
}

export async function createCleaningLog(payload: CleaningLogPayload) {
  return apiCall<{ message: string; data: CleaningLog }>("/cleaning-logs", "POST", payload, true)
}

export async function updateCleaningLog(id: string, payload: Partial<CleaningLogPayload>) {
  return apiCall<{ message: string; data: CleaningLog }>(`/cleaning-logs/${id}`, "PATCH", payload, true)
}

export async function checkCleaningLog(id: string, comment: string) {
  return apiCall<{ message: string; data: CleaningLog }>(`/cleaning-logs/${id}/check`, "POST", { comment }, true)
}

export async function deleteCleaningLog(id: string) {
  return apiCall<{ message: string }>(`/cleaning-logs/${id}`, "DELETE", undefined, true)
}
