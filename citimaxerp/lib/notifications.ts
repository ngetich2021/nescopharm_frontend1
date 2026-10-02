import apiCall from "./api"

export interface AppNotification {
  id: string
  type: string
  notifiable_type: string
  notifiable_id: string
  data: {
    type?: string
    title?: string
    message?: string
    url?: string
    [key: string]: any
  }
  read_at: string | null
  created_at: string
  updated_at: string
}

export interface NotificationsResponse {
  status: string
  data: AppNotification[]
  unread_count: number
}

export async function fetchNotifications(unreadOnly = false): Promise<NotificationsResponse> {
  const query = unreadOnly ? "?unread_only=1" : ""
  return apiCall<NotificationsResponse>(`/notifications${query}`, "GET", undefined, true)
}

export async function markNotificationRead(id: string): Promise<{ unread_count: number }> {
  return apiCall<{ status: string; unread_count: number }>(`/notifications/${id}/read`, "POST", undefined, true)
}

export async function markAllNotificationsRead(): Promise<{ unread_count: number }> {
  return apiCall<{ status: string; unread_count: number }>("/notifications/mark-all-read", "POST", undefined, true)
}
