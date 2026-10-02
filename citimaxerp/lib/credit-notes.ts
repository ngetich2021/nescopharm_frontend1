import apiCall from "./api"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreditNoteStatus = "draft" | "issued" | "applied" | "refunded" | "void"

export interface CreditNoteLineItem {
    id?: string
    credit_note_id?: string
    product_id?: string
    variant_id?: string
    description: string
    quantity: number | string
    unit: string
    unit_price: number | string
    discount_amount: number | string
    tax_rate: number | string
    tax_amount?: number | string
    line_total?: number | string
    product?: { id: string; name: string; sku: string }
    variant?: { id: string; name: string; sku: string }
}

export interface CreditNoteRefund {
    id: string
    credit_note_id: string
    amount: number | string
    refund_reason: string
    refund_method?: string | null
    reference?: string | null
    notes?: string | null
    refund_date?: string | null
    created_at?: string
    updated_at?: string
    processed_by?: {
        id: string
        name: string
        email?: string
    } | null
}

export interface OpenInvoiceSummary {
    id: string
    invoice_number: string
    invoice_date?: string
    due_date?: string
    total_amount: number | string
    amount_paid: number | string
    balance_amount: number | string
    currency?: string
    status: string
}

export interface UnappliedCreditNoteSummary {
    id: string
    credit_note_number: string
    invoice_id: string
    credit_note_date: string
    expiry_date?: string | null
    currency: string
    total_amount: number | string
    amount_applied: number | string
    amount_refunded: number | string
    balance_amount: number | string
}

export interface CustomerCreditContext {
    unapplied_credit_total: number
    open_invoice_balance_total: number
    open_invoices_count: number
    unapplied_credit_notes_count: number
    suggested_next_action?: string
    open_invoices: OpenInvoiceSummary[]
    unapplied_credit_notes: UnappliedCreditNoteSummary[]
}

export interface CreditNote {
    id: string
    credit_note_number: string
    invoice_id: string
    customer_id: string
    company_id?: string
    status: CreditNoteStatus
    credit_note_date: string
    expiry_date?: string | null
    reason?: string | null
    currency: string
    notes?: string | null
    subtotal: number | string
    discount_amount: number | string
    tax_amount: number | string
    total_amount: number | string
    amount_applied: number | string
    amount_refunded?: number | string
    balance_amount: number | string
    issued_at?: string | null
    applied_at?: string | null
    refunded_at?: string | null
    voided_at?: string | null
    created_at?: string
    updated_at?: string
    customer?: {
        id: string
        name: string
        email?: string
        phone?: string
        customer_type?: string | null
        business_name?: string | null
    }
    invoice?: {
        id: string
        invoice_number: string
        total_amount: number | string
        amount_paid: number | string
        balance_amount: number | string
        status: string
    }
    line_items?: CreditNoteLineItem[]
    refunds?: CreditNoteRefund[]
}

export interface CreateCreditNoteRequest {
    invoice_id: string
    customer_id?: string
    credit_note_date: string
    expiry_date?: string
    reason?: string
    currency?: string
    notes?: string
    line_items: {
        description: string
        quantity: number
        unit_price: number
        product_id?: string
        variant_id?: string
        unit?: string
        discount_amount?: number
        tax_rate?: number
    }[]
}

export interface CreditNotesByInvoiceResponse {
    invoice: {
        id: string
        invoice_number: string
        total_amount: number | string
        amount_paid: number | string
        balance_amount: number | string
        status: string
    }
    credit_notes: CreditNote[]
    total_credits_issued: number
    total_credits_applied: number
    total_credits_refunded?: number
    total_credits_available?: number
}

// ─── API Functions ─────────────────────────────────────────────────────────────

export async function fetchCreditNotes(params?: {
    invoice_id?: string
    customer_id?: string
    status?: CreditNoteStatus
    per_page?: number
    page?: number
}): Promise<{ data: CreditNote[]; meta?: any }> {
    try {
        const queryParams = new URLSearchParams()
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, value.toString())
                }
            })
        }
        const url = `/credit-notes${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
        const response = await apiCall<{ data: CreditNote[]; meta?: any }>(url, "GET", undefined, true)
        return response
    } catch (error: any) {
        if (error.message?.includes("404") || error.message?.includes("500")) {
            return { data: [] }
        }
        throw new Error(`Failed to fetch credit notes: ${error.message || "Unknown error"}`)
    }
}

export async function fetchCreditNoteById(id: string): Promise<CreditNote> {
    try {
        const response = await apiCall<{ data: CreditNote }>(`/credit-notes/${id}`, "GET", undefined, true)
        // API may return the object directly (no wrapper) or wrapped in data
        return (response as any).data ?? response
    } catch (error: any) {
        throw new Error(`Failed to fetch credit note: ${error.message || "Unknown error"}`)
    }
}

export async function fetchCreditNotesByInvoice(invoiceId: string): Promise<CreditNotesByInvoiceResponse> {
    try {
        const response = await apiCall<CreditNotesByInvoiceResponse>(
            `/credit-notes/by-invoice/${invoiceId}`,
            "GET",
            undefined,
            true
        )
        return response
    } catch (error: any) {
        throw new Error(`Failed to fetch credit notes for invoice: ${error.message || "Unknown error"}`)
    }
}

export async function createCreditNote(data: CreateCreditNoteRequest): Promise<CreditNote> {
    try {
        const response = await apiCall<{ message: string; data?: CreditNote } | CreditNote>(
            "/credit-notes",
            "POST",
            data,
            true
        )
        return (response as any).data ?? (response as CreditNote)
    } catch (error: any) {
        throw new Error(`Failed to create credit note: ${error.message || "Unknown error"}`)
    }
}

export async function updateCreditNote(
    id: string,
    data: Partial<Omit<CreateCreditNoteRequest, "invoice_id">>
): Promise<CreditNote> {
    try {
        const response = await apiCall<{ message: string; data?: CreditNote } | CreditNote>(
            `/credit-notes/${id}`,
            "PUT",
            data,
            true
        )
        return (response as any).data ?? (response as CreditNote)
    } catch (error: any) {
        throw new Error(`Failed to update credit note: ${error.message || "Unknown error"}`)
    }
}

export async function deleteCreditNote(id: string): Promise<void> {
    try {
        await apiCall<{ message: string }>(`/credit-notes/${id}`, "DELETE", undefined, true)
    } catch (error: any) {
        throw new Error(`Failed to delete credit note: ${error.message || "Unknown error"}`)
    }
}

export async function issueCreditNote(id: string): Promise<CreditNote> {
    try {
        const response = await apiCall<{ message: string; data?: CreditNote } | CreditNote>(
            `/credit-notes/${id}/issue`,
            "POST",
            undefined,
            true
        )
        return (response as any).data ?? (response as CreditNote)
    } catch (error: any) {
        throw new Error(`Failed to issue credit note: ${error.message || "Unknown error"}`)
    }
}

export interface ApplyCreditNoteRequest {
    invoice_id: string
    amount?: number
}

export interface ApplyCreditNoteUiHint {
    primary_action?: string
    show_unapplied_credit_panel?: boolean
}

export interface ApplyCreditNoteResponse {
    message: string
    applied: number
    credit_note: {
        status: CreditNoteStatus
        amount_applied: number | string
        amount_refunded?: number | string
        balance_amount: number | string
    }
    invoice: {
        balance_amount: number | string
        amount_paid: number | string
        status: string
    }
    customer_credit_context?: CustomerCreditContext
}

export interface ApplyCreditNoteErrorResponse {
    message: string
    error_code?: string
    ui_hint?: ApplyCreditNoteUiHint
    customer_credit_context?: CustomerCreditContext
}

export async function applyCreditNote(
    id: string,
    data: ApplyCreditNoteRequest
): Promise<ApplyCreditNoteResponse> {
    try {
        const response = await apiCall<ApplyCreditNoteResponse>(
            `/credit-notes/${id}/apply`,
            "POST",
            data,
            true
        )
        return response
    } catch (error: any) {
        const apiResponse = error?.apiResponse as ApplyCreditNoteErrorResponse | undefined
        if (apiResponse?.error_code || apiResponse?.customer_credit_context || apiResponse?.ui_hint) {
            const enrichedError = new Error(apiResponse.message || error?.message || "Failed to apply credit note") as any
            enrichedError.apiResponse = apiResponse
            enrichedError.error_code = apiResponse.error_code
            enrichedError.ui_hint = apiResponse.ui_hint
            enrichedError.customer_credit_context = apiResponse.customer_credit_context
            throw enrichedError
        }
        throw new Error(`Failed to apply credit note: ${error.message || "Unknown error"}`)
    }
}

export interface RefundCreditNoteRequest {
    amount?: number
    refund_reason: string
    refund_method?: string
    reference?: string
    notes?: string
    refund_date?: string
}

export interface RefundCreditNoteResponse {
    message: string
    refunded: number
    refund?: CreditNoteRefund
    credit_note: {
        status: CreditNoteStatus
        amount_applied: number | string
        amount_refunded: number | string
        balance_amount: number | string
    }
    customer_credit_context?: CustomerCreditContext
}

export async function refundCreditNote(
    id: string,
    data: RefundCreditNoteRequest
): Promise<RefundCreditNoteResponse> {
    try {
        const response = await apiCall<RefundCreditNoteResponse>(
            `/credit-notes/${id}/refund`,
            "POST",
            data,
            true
        )
        return response
    } catch (error: any) {
        throw new Error(`Failed to refund credit note: ${error.message || "Unknown error"}`)
    }
}

export interface CustomerUnappliedCreditsResponse {
    customer: {
        id: string
        name: string
        email?: string
        phone?: string
        customer_number?: string
    }
    context: CustomerCreditContext
}

export async function fetchCustomerUnappliedCredits(customerId: string): Promise<CustomerUnappliedCreditsResponse> {
    try {
        const response = await apiCall<CustomerUnappliedCreditsResponse>(
            `/credit-notes/customers/${customerId}/unapplied-credits`,
            "GET",
            undefined,
            true
        )
        return response
    } catch (error: any) {
        throw new Error(`Failed to fetch unapplied credits: ${error.message || "Unknown error"}`)
    }
}

export async function voidCreditNote(id: string): Promise<CreditNote> {
    try {
        const response = await apiCall<{ message: string; data?: CreditNote } | CreditNote>(
            `/credit-notes/${id}/void`,
            "POST",
            undefined,
            true
        )
        return (response as any).data ?? (response as CreditNote)
    } catch (error: any) {
        throw new Error(`Failed to void credit note: ${error.message || "Unknown error"}`)
    }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

export function parseCreditNoteAmount(amount: any): number {
    if (amount === null || amount === undefined || amount === "") return 0
    const parsed = Number(amount)
    return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed
}

export function getCreditNoteStatusColor(status: CreditNoteStatus | string): string {
    switch (status) {
        case "draft":
            return "bg-gray-100 text-gray-800"
        case "issued":
            return "bg-blue-100 text-blue-800"
        case "applied":
            return "bg-green-100 text-green-800"
        case "refunded":
            return "bg-purple-100 text-purple-800"
        case "void":
            return "bg-red-100 text-red-800"
        default:
            return "bg-gray-100 text-gray-800"
    }
}
