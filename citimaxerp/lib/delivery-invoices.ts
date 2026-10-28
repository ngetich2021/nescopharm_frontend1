import apiCall from "./api";

export interface DeliveryInvoice {
  id: string;
  company_id: string;
  order_dispatch_id: string;
  delivery_rate_id: string | null;
  invoice_number: string;
  transporter_invoice_number?: string | null;
  transporter_name: string;
  zone: string;
  number_of_cartons: number;
  rate_per_carton: string | number;
  total_amount: string | number;
  status: "pending" | "paid" | "cancelled";
  payment_method: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  cheque_number?: string | null;
  bank_name?: string | null;
  cheque_maturity_date?: string | null;
  amount_paid: string | number;
  notes: string | null;
  invoice_date?: string | null;
  order_reference?: string | null;
  supplier_id?: string | null;
  created_at: string;
  updated_at: string;
  // Laravel serializes eager-loaded relations in snake_case (matching the
  // relationship method name lower-snaked), which for created_by/paid_by
  // happens to collide with - and override - the raw FK column name.
  order_dispatch?: {
    id: string;
    dispatch_number: string;
    order_id?: string;
    order?: {
      id: string;
      order_number: string;
      customer?: {
        id: string;
        name: string;
        business_name?: string | null;
        customer_type?: string | null;
        address?: string | null;
        postal_code?: string | null;
        city?: string | null;
        county?: string | null;
        country?: string | null;
        pin_number?: string | null;
      };
    };
  };
  logistic?: {
    id: string;
    driver_name?: string | null;
    driver_contact?: string | null;
    delivery_person?: { id: string; full_name: string; phone_number?: string | null } | null;
  } | null;
  created_by?: { id: string; first_name: string; last_name: string; email?: string } | string;
  paid_by?: { id: string; first_name: string; last_name: string; email?: string } | string | null;
  company?: {
    id: string;
    name: string;
    logo_url?: string | null;
    letterhead_url?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

export interface DeliveryInvoicesResponse {
  status: string;
  data: DeliveryInvoice[];
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
  };
}

export async function getDeliveryInvoices(params?: {
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}): Promise<DeliveryInvoicesResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.append('status', params.status);
  if (params?.search) qs.append('search', params.search);
  if (params?.sort_by) qs.append('sort_by', params.sort_by);
  if (params?.sort_order) qs.append('sort_order', params.sort_order);
  if (params?.page) qs.append('page', params.page.toString());
  if (params?.per_page) qs.append('per_page', params.per_page.toString());

  const queryString = qs.toString() ? `?${qs.toString()}` : '';
  const response = await apiCall<DeliveryInvoicesResponse>(`/delivery-invoices${queryString}`, "GET");
  return {
    status: response.status || 'success',
    data: response.data || [],
    pagination: response.pagination || { total: 0, per_page: 20, current_page: 1, last_page: 0, from: 0, to: 0 },
  };
}

export async function exportDeliveryInvoicesToExcel(params?: {
  status?: string;
  search?: string;
  supplierId?: string;
}): Promise<void> {
  const qs = new URLSearchParams();
  if (params?.status) qs.append('status', params.status);
  if (params?.search) qs.append('search', params.search);
  if (params?.supplierId) qs.append('supplier_id', params.supplierId);

  const queryString = qs.toString() ? `?${qs.toString()}` : '';
  // Downloaded here rather than opened in another window.
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/delivery-invoices/export/excel${queryString}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await res.blob());
  link.download = `delivery-invoices-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

/** Preview (dryRun) or save a delivery invoices sheet. Paid rows also record the transporter payment. */
export async function importDeliveryInvoices(file: File, dryRun: boolean = true): Promise<any> {
  const form = new FormData();
  form.append("file", file);
  form.append("dry_run", dryRun ? "1" : "0");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/data-import/delivery_invoices`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.message === "string" ? body.message : "Import failed");
  return body;
}

export interface Transporter {
  supplier_id: string;
  name: string;
  invoices: number;
  billed: number;
  paid: number;
  balance: number;
}

/** Transporters with their totals; each one's statement is its supplier statement. */
export async function getTransporters(): Promise<Transporter[]> {
  const response = await apiCall<{ data: Transporter[] }>("/delivery-invoices/transporters", "GET");
  return response.data ?? [];
}

export async function getDeliveryInvoice(id: string): Promise<DeliveryInvoice> {
  const response = await apiCall<{ delivery_invoice: DeliveryInvoice }>(`/delivery-invoices/${id}`, "GET");
  return response.delivery_invoice;
}

export async function payDeliveryInvoice(
  id: string,
  data: {
    payment_method: string;
    payment_reference?: string;
    payment_date?: string;
    cheque_number?: string;
    bank_name?: string;
    cheque_maturity_date?: string;
  }
): Promise<DeliveryInvoice> {
  const response = await apiCall<{ delivery_invoice: DeliveryInvoice }>(`/delivery-invoices/${id}/pay`, "POST", data);
  return response.delivery_invoice;
}

export async function cancelDeliveryInvoice(id: string): Promise<DeliveryInvoice> {
  const response = await apiCall<{ delivery_invoice: DeliveryInvoice }>(`/delivery-invoices/${id}/cancel`, "POST");
  return response.delivery_invoice;
}
