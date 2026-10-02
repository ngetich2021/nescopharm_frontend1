import apiCall from "./api";

// Supplier Payment types
export interface SupplierPayment {
    id: string;
    supplier_id: string;
    purchase_order_id?: string | null;
    payment_number?: string;
    amount: string;
    payment_date: string;
    payment_method: string;
    transaction_reference?: string | null;
    notes?: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    company_id: string;
    supplier?: {
        id: string;
        company_id: string;
        name: string;
        email?: string;
        phone?: string;
        address?: string | null;
        contact_person?: string;
        notes?: string | null;
        is_active: boolean;
        payment_terms_type?: string | null;
        payment_terms_days?: number | null;
        payment_terms_description?: string | null;
        bank_name?: string | null;
        bank_account_number?: string | null;
        bank_branch?: string | null;
        bank_swift_code?: string | null;
        created_at: string;
        updated_at: string;
    } | null;
    purchase_order?: {
        id: string;
        company_id: string;
        order_number: string;
        supplier_id: string;
        discount?: string | null;
        supplier_invoice_date?: string | null;
        tax_rate?: string | null;
        store_id?: string | null;
        exchange_rate: string;
        order_date: string;
        delivery_date?: string | null;
        template?: string | null;
        currency_code: string;
        status: string;
        comments?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
        parent_id?: string | null;
        created_at: string;
        updated_at: string;
        total_amount: string;
        amount_paid: string;
        payment_status: string;
        approval_status: string;
        approved_by?: string | null;
    } | null;
    [key: string]: any;
}

// Paginated response structure from the API
export interface PaginatedSupplierPaymentResponse {
    status: string;
    message: string;
    data: {
        current_page: number;
        data: SupplierPayment[];
        first_page_url: string;
        from: number;
        last_page: number;
        last_page_url: string;
        links: Array<{
            url: string | null;
            label: string;
            active: boolean;
        }>;
        next_page_url: string | null;
        path: string;
        per_page: number;
        prev_page_url: string | null;
        to: number;
        total: number;
    };
}

export interface SupplierPaymentResponse {
    status: string;
    message: string;
    supplier_payments?: SupplierPayment[];
    data?: SupplierPayment[] | PaginatedSupplierPaymentResponse['data'];
}

export interface CreateSupplierPaymentPayload {
    supplier_id: string;
    purchase_order_id?: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    transaction_reference?: string;
    notes?: string;
    // Required when payment_method is "cheque" - the cheque stays pending
    // (not reducing the PO balance) until it's approved/cleared.
    cheque_number?: string;
    bank_name?: string;
    maturity_date?: string;
}

export interface SupplierPaymentSummary {
    totalPayments: number;
    totalAmount: number;
    completedPayments: number;
    pendingPayments: number;
}

/**
 * Fetches supplier payments from the API
 */
export async function getSupplierPayments(
    filters: {
        search?: string;
        status?: string;
        dateRange?: { from: string; to: string };
    } = {}
): Promise<SupplierPayment[]> {
    try {
        if (typeof window === "undefined") {
            return [];
        }

        const queryParams = new URLSearchParams();
        if (filters.search) queryParams.append("search", filters.search);
        if (filters.status && filters.status !== "all")
            queryParams.append("status", filters.status);
        if (filters.dateRange?.from)
            queryParams.append("from_date", filters.dateRange.from);
        if (filters.dateRange?.to)
            queryParams.append("to_date", filters.dateRange.to);

        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

        const response = await apiCall<PaginatedSupplierPaymentResponse | SupplierPaymentResponse>(
            `/supplier-payments${queryString}`,
            "GET",
            undefined,
            true
        );

        if (response.status === "success") {
            // Handle paginated response (data.data structure) or direct array response
            if (response.data && typeof response.data === 'object' && 'data' in response.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }
            // Handle direct array response
            if (Array.isArray(response.data)) {
                return response.data;
            }
            // Handle supplier_payments key (legacy)
            if ('supplier_payments' in response && Array.isArray(response.supplier_payments)) {
                return response.supplier_payments;
            }
            return [];
        } else {
            const errorMessage =
                typeof response.message === "string"
                    ? response.message
                    : "Failed to fetch supplier payments";
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        if (
            error.message?.includes("could not be found") ||
            error.message?.includes("404")
        ) {
            return [];
        }
        throw new Error(
            `Failed to fetch supplier payments: ${error.message || "Unknown error"}`
        );
    }
}

/**
 * Fetches a single supplier payment by ID
 */
export async function getSupplierPaymentById(
    id: string
): Promise<SupplierPayment | null> {
    try {
        if (typeof window === "undefined") {
            throw new Error("getSupplierPaymentById must be called client-side");
        }

        const response = await apiCall<{
            status: string;
            message: string;
            supplier_payment?: SupplierPayment;
            data?: SupplierPayment;
        }>(`/supplier-payments/${id}`, "GET", undefined, true);

        if (response.status === "success") {
            return response.supplier_payment || response.data || null;
        } else {
            const errorMessage =
                typeof response.message === "string"
                    ? response.message
                    : "Failed to fetch supplier payment details";
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        throw new Error(
            `Failed to fetch supplier payment: ${error.message || "Unknown error"}`
        );
    }
}

/**
 * Creates a new supplier payment
 */
export async function createSupplierPayment(
    payload: CreateSupplierPaymentPayload
): Promise<SupplierPayment> {
    try {
        if (typeof window === "undefined") {
            throw new Error("createSupplierPayment must be called client-side");
        }

        // Clean up the payload
        const cleanPayload = Object.fromEntries(
            Object.entries(payload).filter(
                ([_, value]) => value !== undefined && value !== null && value !== ""
            )
        );

        console.log("Creating supplier payment with payload:", cleanPayload);

        const response = await apiCall<{
            status: string;
            message: string;
            supplier_payment?: SupplierPayment;
            data?: SupplierPayment;
        }>(`/supplier-payments`, "POST", cleanPayload, true);

        console.log("Supplier payment API response:", response);

        if (response.status === "success") {
            const payment = response.supplier_payment || response.data;
            if (payment) {
                return payment;
            }
            throw new Error("Payment created but no data returned");
        } else {
            const errorMessage =
                typeof response.message === "string"
                    ? response.message
                    : "Failed to create supplier payment";
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        console.error("Create supplier payment error:", error);
        throw new Error(
            `Failed to create supplier payment: ${error.message || "Unknown error"}`
        );
    }
}

/**
 * Calculates supplier payment summary
 */
export function calculateSupplierPaymentSummary(
    payments: SupplierPayment[]
): SupplierPaymentSummary {
    const totalAmount = payments.reduce(
        (sum, payment) => sum + parseFloat(payment.amount || "0"),
        0
    );

    return {
        totalPayments: payments.length,
        totalAmount,
        completedPayments: payments.filter((item) => item.status === "completed")
            .length,
        pendingPayments: payments.filter((item) => item.status === "pending").length,
    };
}
