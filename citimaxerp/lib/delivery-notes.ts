import apiCall from "./api";

export interface DeliveryNoteItem {
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity_dispatched: number;
  delivered_quantity: number | null;
  damaged_quantity: number;
}

export interface DeliveryNote {
  id: string;
  company_id: string;
  order_dispatch_id: string;
  note_number: string;
  status: "draft" | "finalized" | "completed";
  items: DeliveryNoteItem[];
  special_instructions: string | null;
  finalized_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Laravel serializes eager-loaded relations in snake_case (matching the
  // relationship method name lower-snaked), which for generated_by happens
  // to collide with - and override - the raw FK column name.
  generated_by?: { id: string; first_name: string; last_name: string } | string | null;
  order_dispatch?: {
    id: string;
    dispatch_number: string;
    order?: {
      id: string;
      order_number: string;
      customer?: { id: string; name: string };
    };
  };
}

export async function getDeliveryNotes(orderDispatchId?: string): Promise<DeliveryNote[]> {
  const qs = orderDispatchId ? `?order_dispatch_id=${encodeURIComponent(orderDispatchId)}` : "";
  const response = await apiCall<{ delivery_notes: DeliveryNote[] }>(`/delivery-notes${qs}`, "GET");
  return response.delivery_notes || [];
}

export async function getDeliveryNote(id: string): Promise<DeliveryNote> {
  const response = await apiCall<{ delivery_note: DeliveryNote }>(`/delivery-notes/${id}`, "GET");
  return response.delivery_note;
}
