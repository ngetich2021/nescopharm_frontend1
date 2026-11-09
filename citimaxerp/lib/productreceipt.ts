
import apiCall from "./api";
import { formatDate } from "./utils";
import type { ExportCell, TableExport } from "./table-export";

// Product Receipt Item interface
export interface ProductReceiptItem {
  id: string;
  company_id: string;
  product_receipt_id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: string;
  expiry_date?: string | null;
  batch_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  product: {
    id: string;
    company_id: string;
    store_id: string;
    name: string;
    description?: string | null;
    short_description?: string | null;
    price?: string | null;
    unit_cost?: string | null;
    last_price?: string | null;
    stock_quantity: number;
    low_stock_threshold: number;
    category?: string | null;
    sku: string;
    barcode?: string | null;
    brand?: string | null;
    supplier?: string | null;
    unit_of_measurement?: string | null;
    is_active: boolean;
    is_featured: boolean;
    is_digital: boolean;
    track_inventory: boolean;
    weight?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    shipping_class?: string | null;
    image_url?: string | null;
    images: string[];
    primary_image_index: number;
    has_variations: boolean;
    tags: string[];
    created_at: string;
    updated_at: string;
    on_hand?: number | null;
    allocated?: number | null;
    category_id?: string | null;
    expiry_date?: string | null;
  };
  variant?: {
    id: string;
    product_id: string;
    company_id: string;
    store_id: string;
    name: string;
    sku: string;
    price: string;
    cost: string;
    stock_quantity: number;
    attributes: any[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
    options: any[];
    images?: string | null;
    on_hand: number;
    allocated: number;
  } | null;
}

// Store interface
export interface Store {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  store_code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  manager_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Supplier interface
export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contact_person?: string | null;
  notes?: string | null;
  is_active: boolean;
  payment_terms_type: string;
  payment_terms_days: number;
  payment_terms_description: string;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_branch?: string | null;
  bank_swift_code?: string | null;
  created_at: string;
  updated_at: string;
}

// Recipient interface
export interface Recipient {
  id: string;
  company_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url?: string | null;
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: string | null;
  role_id: string;
  created_at: string;
  updated_at: string;
}

// Interface for Product Receipt Details (full API response)
export interface ProductReceiptDetails {
  id: string;
  company_id: string;
  supplier_id?: string | null;
  contractor_id?: string | null;
  document_type: string;
  product_receipt_number: string;
  reference_number: string;
  received_by: string;
  store_id: string;
  document_url?: string | null;
  shipping_cost?: number | string | null;
  logistics_cost?: number | string | null;
  created_at: string;
  updated_at: string;
  items_count: number;
  product?: any | null; // This seems to be null in the API response
  store: Store;
  variant?: any | null; // This seems to be null in the API response
  product_receipt_items: ProductReceiptItem[];
  supplier?: Supplier | null;
  contractor?: any | null;
  recipient: Recipient;
}

// Types for Product Receipt and Variant
export interface ProductReceipt {
  id: string;
  company_id?: string;
  supplier_id?: string | null;
  contractor_id?: string | null;
  document_type: string;
  product_receipt_number: string;
  reference_number: string;
  received_by: string;
  store_id: string;
  document_url?: string | null;
  document_path?: string | null;
  shipping_cost?: number | string | null;
  logistics_cost?: number | string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
  store?: {
    id: string;
    name: string;
    [key: string]: any;
  } | null;
  supplier?: {
    id: string;
    name: string;
    [key: string]: any;
  } | null;
  recipient?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    [key: string]: any;
  } | null;
}

// Create Product Receipt (single or batch)
export async function createProductReceipt(payload: {
  supplier_id?: string | null;
  contractor_id?: string | null;
  document_type: string;
  reference_number: string;
  store_id: string;
  // Total shipping/logistics cost for this whole shipment - distributed across
  // the received items to update each product's landed-cost basis.
  shipping_cost?: number;
  logistics_cost?: number;
  // The purchase order this delivery is against; its lines' received quantities follow this receipt.
  purchase_order_id?: string | null;
  items: Array<{
    product_id: string;
    variant_id?: string | null;
    purchase_order_item_id?: string | null;
    quantity: number;
    unit_price: number;
    expiry_date?: string | null;
    notes?: string | null;
    // Batch tracking fields
    batch_number?: string;
    lot_number?: string;
    serial_number?: string;
    manufacture_date?: string;
    // A serial number per unit received (array length must equal quantity),
    // or omit and set track_serials to have the backend auto-generate them.
    serial_numbers?: string[];
    track_serials?: boolean;
    serial_prefix?: string;
    warranty_months?: number;
    custom_attributes?: Record<string, any>;
  }>;
  document?: File | null;
}): Promise<ProductReceiptApiResponse> {
  try {
    // If there's a document, we need to use FormData
    let requestData: any;
    if (payload.document) {
      const formData = new FormData();
      
      // Add non-file fields
      if (payload.supplier_id) formData.append('supplier_id', payload.supplier_id);
      if (payload.contractor_id) formData.append('contractor_id', payload.contractor_id);
      formData.append('document_type', payload.document_type);
      formData.append('reference_number', payload.reference_number);
      formData.append('store_id', payload.store_id);
      if (payload.shipping_cost !== undefined) formData.append('shipping_cost', String(payload.shipping_cost));
      if (payload.logistics_cost !== undefined) formData.append('logistics_cost', String(payload.logistics_cost));
      if (payload.purchase_order_id) formData.append('purchase_order_id', payload.purchase_order_id);

      // Add items array
      formData.append('items', JSON.stringify(payload.items));

      // Add document file
      formData.append('document', payload.document);

      requestData = formData;
    } else {
      // Regular JSON payload
      requestData = {
        supplier_id: payload.supplier_id,
        contractor_id: payload.contractor_id,
        document_type: payload.document_type,
        reference_number: payload.reference_number,
        store_id: payload.store_id,
        shipping_cost: payload.shipping_cost,
        logistics_cost: payload.logistics_cost,
        ...(payload.purchase_order_id ? { purchase_order_id: payload.purchase_order_id } : {}),
        items: payload.items
      };
    }

    const response = await apiCall<ProductReceiptApiResponse>("/whs/product-receipts", "POST", requestData, true);
    
    if (response.status === "success") {
      return response;
    } else {
      throw new Error(response.message || "Failed to create product receipt");
    }
  } catch (error: any) {
    throw new Error(`Failed to create product receipt: ${error.message || "Unknown error"}`);
  }
}

// Delete Product Receipt
export async function deleteProductReceipt(id: string): Promise<void> {
  await apiCall(`/whs/product-receipts/${id}`, "DELETE", undefined, true);
}

// List all Product Receipts
export async function listProductReceipts(): Promise<ProductReceipt[]> {
  const response = await apiCall<any>("/whs/product-receipts", "GET", undefined, true);
  // The API returns { status, message, receipts: { data: [...] } }
  return response.receipts?.data || [];
}

// API Response interface for getProductReceipt
export interface ProductReceiptApiResponse {
  status: string;
  message: string;
  receipt: ProductReceiptDetails;
  supplier_name?: string | null;
  contractor_name?: string | null;
  recipient_name: string;
  pricing_warnings?: string[];
}

// New interface for API product receipt summary response
export interface ApiProductReceiptSummary {
  status: string;
  message: string;
  data: {
    overview: {
      total_receipts: number;
      recent_receipts: number;
      today_receipts: number;
      this_month_receipts: number;
      total_items_received: number;
      total_line_items: number;
    };
    financial: {
      total_receipt_value: number;
      average_receipt_value: number;
    };
    breakdown: {
      by_document_type: {
        [key: string]: number;
      };
      top_suppliers: {
        supplier_name: string;
        supplier_id: string;
        receipt_count: number;
        items_count: number;
      }[];
    };
    trends: {
      monthly_receipts: {
        month: string;
        month_name: string;
        count: number;
      }[];
    };
    filters: {
      store_id: string | null;
      supplier_id: string | null;
      company_id: string;
    };
    generated_at: string;
  };
}

// Import/clearing costs a receipt can carry on top of its items (shown in the details view too).
const IMPORT_COSTS: [string, string][] = [
  ["ppb_permit", "PPB Permit"], ["idf", "IDF"], ["railway_levy", "Railway Levy"], ["transport_cost", "Transport Cost"],
  ["clearing_agency_fee", "Clearing Agency Fee"], ["other_clearing_cost", "Other Clearing Cost"],
  ["certificate_of_conformity", "Certificate of Conformity"], ["sgs_listing_approval", "SGS Listing & Approval"],
  ["vat_on_clearing", "VAT on Clearing"], ["vat_on_product", "VAT on Product"], ["import_duty", "Import Duty"],
  ["excise_duty", "Excise Duty"], ["fob_price", "FOB Price"],
];

// The receipt as a document (details + items + totals) for the PDF / Excel / CSV download.
export function productReceiptExport(receipt: ProductReceiptDetails): TableExport {
  const items = receipt.product_receipt_items ?? [];
  const lineTotal = (i: ProductReceiptItem) => Math.round(Number(i.unit_price || 0) * i.quantity * 100) / 100;
  const itemsTotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const costs = IMPORT_COSTS
    .map(([key, label]) => [label, Number((receipt as any)[key]) || 0] as const)
    .filter(([, v]) => v > 0);
  const importTotal = costs.reduce((s, [, v]) => s + v, 0);
  const recipient = [receipt.recipient?.first_name, receipt.recipient?.last_name].filter(Boolean).join(" ");
  const date = (d?: string | null) => (d ? formatDate(d) : "");
  const footer: ExportCell[][] = [["", "Items total", "", "", "", items.reduce((s, i) => s + i.quantity, 0), "", itemsTotal]];
  costs.forEach(([label, v]) => footer.push(["", label, "", "", "", null, "", v]));
  if (importTotal > 0) footer.push(["", "Landed total", "", "", "", null, "", itemsTotal + importTotal]);

  return {
    fileName: `product-receipt-${receipt.product_receipt_number || receipt.reference_number}`,
    title: `Product Receipt ${receipt.product_receipt_number || ""}`.trim(),
    details: [
      ["Supplier", receipt.supplier?.name || "-"],
      ["Reference", receipt.reference_number || "-"],
      ["Store", receipt.store?.name || "-"],
      ["Document type", (receipt.document_type || "-").replace(/_/g, " ")],
      ["Received by", recipient || "-"],
      ["Date", date(receipt.created_at) || "-"],
    ],
    headers: ["S/No", "Product", "Variant", "Batch", "Expiry", "Qty", "Unit Cost", "Total"],
    moneyColumns: [6, 7],
    rows: items.map((i, index) => [
      index + 1,
      i.product?.name || "-",
      i.variant?.name || "",
      i.batch_number || "",
      date(i.expiry_date),
      i.quantity,
      Number(i.unit_price || 0),
      lineTotal(i),
    ]),
    footer,
  };
}

/** A receipt line as the debit note form shows it: what came in, what already went back, what can still go. */
export interface DebitNoteLine {
  receipt_item_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  batch_number: string | null;
  expiry_date: string | null;
  received: number;
  returned: number;
  in_batch: number;
  has_batch: boolean;
  in_stock: number; // what of this receipt's batch is left (the item's stock when it came in without a batch)
  returnable: number;
  unit_price: number;
}

export interface ReceiptDebitNoteInfo {
  receipt_number: string;
  reference_number: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  vat_rate: number;
  next_number: string;
  lines: DebitNoteLine[];
  debit_notes: { id: string; number: string; date: string | null; total: number }[];
}

export async function getReceiptDebitNoteLines(receiptId: string): Promise<ReceiptDebitNoteInfo> {
  const res = await apiCall<{ data: ReceiptDebitNoteInfo }>(`/whs/product-receipts/${receiptId}/debit-note-lines`, "GET", undefined, true);
  return res.data;
}

/** Send goods from a receipt back to the supplier (SDEB/0001): stock out, the supplier is debited. */
export async function createReceiptDebitNote(receiptId: string, payload: {
  date: string;
  reason: string;
  supplier_reference?: string;
  items: { receipt_item_id: string; quantity: number }[];
}): Promise<{ message: string; data: { id: string; invoice_number: string; total: number } }> {
  return apiCall(`/whs/product-receipts/${receiptId}/debit-notes`, "POST", payload, true);
}

// View Product Receipt
export async function getProductReceipt(id: string): Promise<ProductReceiptApiResponse> {
  console.log('getProductReceipt: fetching for id', id);
  const response = await apiCall<ProductReceiptApiResponse>(`/whs/product-receipts/${id}`, "GET", undefined, true);
  console.log('getProductReceipt: API response', response);
  return response;
}

// Update Product Receipt
export async function updateProductReceipt(id: string, payload: Partial<Omit<ProductReceipt, "id" | "created_at" | "updated_at" | "product" | "variant" | "store">>): Promise<ProductReceipt> {
  const response = await apiCall<{ data: ProductReceipt }>(`/whs/product-receipts/${id}`, "PUT", payload, true);
  return response.data;
}

// Update Product Receipt with full data including items and document
export async function updateProductReceiptFull(id: string, payload: {
  supplier_id?: string | null;
  contractor_id?: string | null;
  document_type: string;
  reference_number: string;
  store_id: string;
  shipping_cost?: number;
  logistics_cost?: number;
  // The purchase order this delivery is against; its lines' received quantities follow this receipt.
  purchase_order_id?: string | null;
  items: Array<{
    product_id: string;
    variant_id?: string | null;
    purchase_order_item_id?: string | null;
    quantity: number;
    unit_price: number;
    expiry_date?: string | null;
    notes?: string | null;
    // Batch tracking fields
    batch_number?: string;
    lot_number?: string;
    serial_number?: string;
    manufacture_date?: string;
    // A serial number per unit received (array length must equal quantity),
    // or omit and set track_serials to have the backend auto-generate them.
    serial_numbers?: string[];
    track_serials?: boolean;
    serial_prefix?: string;
    warranty_months?: number;
    custom_attributes?: Record<string, any>;
  }>;
  document?: File | null;
}): Promise<ProductReceiptApiResponse> {
  try {
    // If there's a document, we need to use FormData
    let requestData: any;
    if (payload.document) {
      const formData = new FormData();
      
      // Add non-file fields
      if (payload.supplier_id) formData.append('supplier_id', payload.supplier_id);
      if (payload.contractor_id) formData.append('contractor_id', payload.contractor_id);
      formData.append('document_type', payload.document_type);
      formData.append('reference_number', payload.reference_number);
      formData.append('store_id', payload.store_id);
      if (payload.shipping_cost !== undefined) formData.append('shipping_cost', String(payload.shipping_cost));
      if (payload.logistics_cost !== undefined) formData.append('logistics_cost', String(payload.logistics_cost));
      if (payload.purchase_order_id) formData.append('purchase_order_id', payload.purchase_order_id);

      // Add items array
      formData.append('items', JSON.stringify(payload.items));

      // Add document file
      formData.append('document', payload.document);

      requestData = formData;
    } else {
      // Regular JSON payload
      requestData = {
        supplier_id: payload.supplier_id,
        contractor_id: payload.contractor_id,
        document_type: payload.document_type,
        reference_number: payload.reference_number,
        store_id: payload.store_id,
        shipping_cost: payload.shipping_cost,
        logistics_cost: payload.logistics_cost,
        ...(payload.purchase_order_id ? { purchase_order_id: payload.purchase_order_id } : {}),
        items: payload.items
      };
    }

    const response = await apiCall<ProductReceiptApiResponse>(`/whs/product-receipts/${id}`, "PUT", requestData, true);
    
    if (response.status === "success") {
      return response;
    } else {
      throw new Error(response.message || "Failed to update product receipt");
    }
  } catch (error: any) {
    throw new Error(`Failed to update product receipt: ${error.message || "Unknown error"}`);
  }
}

/**
 * Fetches product receipt summary from the API
 * @returns Promise<ApiProductReceiptSummary> Product receipt summary data from API
 */
export async function getProductReceiptSummary(): Promise<ApiProductReceiptSummary> {
  try {
    const response = await apiCall<ApiProductReceiptSummary>("/whs/product-receipts/summary", "GET", undefined, true);
    return response;
  } catch (error: any) {
    console.error("Error fetching product receipt summary:", error);
    throw new Error(`Failed to fetch product receipt summary: ${error.message || "Unknown error"}`);
  }
}