import apiCall from "./api";

export type DeliveryZone = "nairobi" | "upcountry";

export interface DeliveryRate {
  id: string;
  company_id: string;
  transporter_name: string;
  zone: DeliveryZone;
  rate_per_carton: string | number;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: { id: string; first_name: string; last_name: string };
  approved_by?: { id: string; first_name: string; last_name: string };
}

export async function getDeliveryRates(params?: {
  status?: string;
  zone?: string;
  active_only?: boolean;
}): Promise<DeliveryRate[]> {
  const query = new URLSearchParams();
  if (params?.status) query.append("status", params.status);
  if (params?.zone) query.append("zone", params.zone);
  if (params?.active_only) query.append("active_only", "1");
  const qs = query.toString();
  const response = await apiCall<{ delivery_rates: DeliveryRate[] }>(
    `/delivery-rates${qs ? `?${qs}` : ""}`,
    "GET"
  );
  return response.delivery_rates || [];
}

export async function createDeliveryRate(data: {
  transporter_name: string;
  zone: DeliveryZone;
  rate_per_carton: number;
  description?: string;
}): Promise<DeliveryRate> {
  const response = await apiCall<{ delivery_rate: DeliveryRate }>("/delivery-rates", "POST", data);
  return response.delivery_rate;
}

export async function updateDeliveryRate(
  id: string,
  data: Partial<{ transporter_name: string; zone: DeliveryZone; rate_per_carton: number; description: string }>
): Promise<DeliveryRate> {
  const response = await apiCall<{ delivery_rate: DeliveryRate }>(`/delivery-rates/${id}`, "PUT", data);
  return response.delivery_rate;
}

export async function approveDeliveryRate(id: string, notes?: string): Promise<DeliveryRate> {
  const response = await apiCall<{ delivery_rate: DeliveryRate }>(`/delivery-rates/${id}/approve`, "POST", { notes });
  return response.delivery_rate;
}

export async function rejectDeliveryRate(id: string, notes?: string): Promise<DeliveryRate> {
  const response = await apiCall<{ delivery_rate: DeliveryRate }>(`/delivery-rates/${id}/reject`, "POST", { notes });
  return response.delivery_rate;
}

export async function deleteDeliveryRate(id: string): Promise<void> {
  await apiCall<any>(`/delivery-rates/${id}`, "DELETE");
}
