<?php

namespace App\Http\Controllers;

use App\Models\Cheque;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Customer;
use App\Models\Logistic;
use App\Models\DeliveryNote;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\AccountingWorkflowService;
use App\Services\InvoicePaymentApplicationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use App\Http\Traits\HandlesDatabaseErrors;
use App\Mail\InvoiceMail;

class InvoiceController extends Controller
{
    use HandlesDatabaseErrors;

    protected AccountingWorkflowService $accountingWorkflow;
    protected InvoicePaymentApplicationService $paymentApplication;

    public function __construct(AccountingWorkflowService $accountingWorkflow, InvoicePaymentApplicationService $paymentApplication)
    {
        $this->middleware('auth:sanctum');
        $this->accountingWorkflow = $accountingWorkflow;
        $this->paymentApplication = $paymentApplication;
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }

    /**
     * Calculate invoice status based on payment amount and due date.
     *
     * @param float $amountPaid
     * @param float $totalAmount
     * @param string $dueDate
     * @return string
     */
    protected function calculateInvoiceStatus($amountPaid, $totalAmount, $dueDate)
    {
        // If fully paid
        if ($amountPaid >= $totalAmount) {
            return 'paid';
        }

        // If partially paid
        if ($amountPaid > 0) {
            // Check if overdue
            if (now()->isAfter($dueDate)) {
                return 'overdue';
            }
            return 'partially_paid';
        }

        // No payment made
        if (now()->isAfter($dueDate)) {
            return 'overdue';
        }

        // Default status for new invoices
        return 'draft';
    }

    /**
     * Work out payment_type/credit_terms_days/due_date/payment_terms for a new invoice
     * from the customer's registered payment method and credit terms, unless the
     * caller explicitly supplied a due_date/payment_terms to override it.
     */
    private function resolveInvoiceCredit(
        \App\Models\Customer $customer,
        string $invoiceDate,
        ?string $explicitDueDate = null,
        ?string $explicitPaymentTerms = null,
    ): array {
        $isCredit = $customer->payment_method === 'credit';
        $creditDays = $isCredit ? $customer->account?->credit_days : null;

        if ($isCredit) {
            $days = $creditDays ?? 30;
            $dueDate = $explicitDueDate ?? \Carbon\Carbon::parse($invoiceDate)->addDays($days)->toDateString();
            $paymentTerms = $explicitPaymentTerms ?? "Net {$days}";
        } else {
            $dueDate = $explicitDueDate ?? $invoiceDate;
            $paymentTerms = $explicitPaymentTerms ?? 'Due on Receipt';
        }

        return [
            'payment_type' => $isCredit ? 'credit' : 'cash',
            'credit_terms_days' => $isCredit ? $creditDays : null,
            'due_date' => $dueDate,
            'payment_terms' => $paymentTerms,
        ];
    }

    /**
     * List users eligible to be assigned as an invoice's sales rep
     * (users whose role is marked as a sales rep role).
     */
    public function getSalesReps(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_invoices', $user->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $reps = \App\Models\User::where('company_id', $user->company_id)
            ->whereHas('role', fn ($q) => $q->salesRep())
            ->whereRaw('is_active = true')
            ->select('id', 'first_name', 'last_name', 'email')
            ->orderBy('first_name')
            ->get();

        return response()->json(['data' => $reps]);
    }

    /**
     * Assign (or clear) the sales rep on an existing invoice.
     */
    public function assignRep(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_invoices', $user->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'sales_rep_id' => 'nullable|uuid|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $invoice = Invoice::where('company_id', $user->company_id)->findOrFail($id);
        $invoice->update(['sales_rep_id' => $request->sales_rep_id]);

        return response()->json([
            'message' => $request->sales_rep_id ? 'Sales rep assigned' : 'Sales rep cleared',
            'data' => $invoice->fresh(['salesRep:id,first_name,last_name,email']),
        ]);
    }

    /**
     * Display a listing of invoices.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            return $this->executeWithRetry(function () use ($request) {
                $user = $request->user();
                $companyId = $user->company_id;
                if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
                    return response()->json(['message' => 'Unauthorized'], 403);
                }
                $query = Invoice::with(['customer', 'order', 'createdBy', 'salesRep:id,first_name,last_name,email'])
                    ->withCount('lineItems')
                    ->where('company_id', $companyId);
                // ...existing code...
                // Filter by customer
                if ($request->has('customer_id')) {
                    $query->where('customer_id', $request->customer_id);
                }
                // Filter by sales rep
                if ($request->has('sales_rep_id')) {
                    $query->where('sales_rep_id', $request->sales_rep_id);
                }
                // Filter by payment type (cash vs credit)
                if ($request->has('payment_type')) {
                    $query->where('payment_type', $request->payment_type);
                }
                if ($request->filled('search')) {
                    $term = $request->input('search');
                    $query->where(function ($q) use ($term) {
                        $q->where('invoice_number', 'ilike', "%{$term}%")
                            ->orWhereHas('customer', function ($cq) use ($term) {
                                $cq->where('name', 'ilike', "%{$term}%")
                                    ->orWhere('business_name', 'ilike', "%{$term}%");
                            });
                    });
                }
                // ...existing code...
                $invoices = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 15));
                return response()->json($invoices);
            });
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching invoices');
        }
    }

    /**
     * Store a newly created invoice.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_create_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:customers,id',
            'sales_rep_id' => 'nullable|uuid|exists:users,id',
            'payment_option' => 'sometimes|in:instant,credit',
            'payment_method' => 'required_if:payment_option,instant|nullable|string',
            'transaction_id' => 'nullable|string',
            // Optional down payment on an otherwise-credit invoice, e.g. to cover the
            // portion that would exceed the customer's available credit.
            'down_payment_amount' => 'nullable|numeric|min:0.01',
            'down_payment_method' => 'required_with:down_payment_amount|nullable|string',
            'down_payment_transaction_id' => 'nullable|string',
            'type' => 'sometimes|in:sales,service,recurring',
            'invoice_date' => 'required|date',
            'due_date' => 'sometimes|date|after_or_equal:invoice_date',
            'currency' => 'sometimes|string|size:3',
            'payment_terms' => 'nullable|string',
            'notes' => 'nullable|string',
            'terms_and_conditions' => 'nullable|string',
            'delivery_note_number' => 'nullable|string|max:100',
            'delivery_note_date' => 'nullable|date',
            'reference_number' => 'nullable|string|max:100',
            'reference_date' => 'nullable|date',
            'other_references' => 'nullable|string|max:255',
            'buyers_order_no' => 'nullable|string|max:100',
            'buyers_order_date' => 'nullable|date',
            'dispatch_doc_no' => 'nullable|string|max:100',
            'dispatched_through' => 'nullable|string|max:100',
            'destination' => 'nullable|string|max:100',
            'terms_of_delivery' => 'nullable|string|max:255',
            'mode_of_payment' => 'nullable|string|max:100',
            'generate_etims_receipt' => 'sometimes|boolean',
            'line_items' => 'required|array|min:1',
            'line_items.*.product_id' => 'nullable|exists:products,id',
            'line_items.*.variant_id' => 'nullable|exists:product_variants,id',
            'line_items.*.description' => 'required|string',
            'line_items.*.quantity' => 'required|numeric|min:0.01',
            'line_items.*.unit' => 'sometimes|string',
            'line_items.*.batch_number' => 'nullable|string|max:100',
            'line_items.*.expiry_date' => 'nullable|date',
            'line_items.*.unit_price' => 'required|numeric|min:0',
            'line_items.*.discount_amount' => 'sometimes|numeric|min:0',
            'line_items.*.tax_rate' => 'sometimes|numeric|min:0|max:100',
            'line_items.*.etims_tax_type_code' => 'nullable|string|in:A,B,C,D,E',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $user = $request->user();
            $customer = Customer::findOrFail($request->customer_id);
            $paymentOption = $request->input('payment_option'); // 'instant' | 'credit' | null (legacy auto)

            if ($paymentOption === 'instant') {
                // Paid on the spot - due immediately, no credit terms involved.
                $credit = [
                    'payment_type' => 'cash',
                    'credit_terms_days' => null,
                    'due_date' => $request->invoice_date,
                    'payment_terms' => $request->payment_terms ?? 'Paid Instantly',
                ];
            } else {
                // 'credit' or legacy/unspecified: use the customer's GM-approved credit terms
                $credit = $this->resolveInvoiceCredit(
                    $customer,
                    $request->invoice_date,
                    $request->due_date,
                    $request->payment_terms,
                );
            }

            $invoice = Invoice::create([
                'company_id' => $user->company_id,
                'customer_id' => $request->customer_id,
                'sales_rep_id' => $request->sales_rep_id,
                'payment_type' => $credit['payment_type'],
                'credit_terms_days' => $credit['credit_terms_days'],
                'type' => $request->type ?? 'sales',
                'status' => 'draft',
                'invoice_date' => $request->invoice_date,
                'due_date' => $credit['due_date'],
                'currency' => $request->currency ?? 'KES',
                'payment_terms' => $credit['payment_terms'],
                'notes' => $request->notes,
                'terms_and_conditions' => $request->terms_and_conditions,
                'delivery_note_number' => $request->delivery_note_number,
                'delivery_note_date' => $request->delivery_note_date,
                'reference_number' => $request->reference_number,
                'reference_date' => $request->reference_date,
                'other_references' => $request->other_references,
                'buyers_order_no' => $request->buyers_order_no ?: $this->generateBuyersOrderNo($user->company_id),
                'buyers_order_date' => $request->buyers_order_date,
                'dispatch_doc_no' => $request->dispatch_doc_no,
                'dispatched_through' => $request->dispatched_through,
                'destination' => $request->destination,
                'terms_of_delivery' => $request->terms_of_delivery,
                'mode_of_payment' => $request->mode_of_payment,
                'etims_requested' => $request->boolean('generate_etims_receipt', true),
                'created_by' => $user->id,
                'subtotal' => 0,
                'tax_amount' => 0,
                'discount_amount' => $request->discount_amount ?? 0,
                'total_amount' => 0,
                'amount_paid' => 0,
                'balance_amount' => 0,
                'invoice_number' => $this->generateInvoiceNumber($user->company_id),
            ]);

            // Create line items
            foreach ($request->line_items as $lineItemData) {
                $taxTypeCode = \App\Services\TaxCompliance\EtimsTaxType::fromInput(
                    $lineItemData['etims_tax_type_code'] ?? null,
                    $lineItemData['tax_rate'] ?? 0,
                );

                InvoiceLineItem::create([
                    'invoice_id' => $invoice->id,
                    'product_id' => $lineItemData['product_id'] ?? null,
                    'variant_id' => $lineItemData['variant_id'] ?? null,
                    'description' => $lineItemData['description'],
                    'quantity' => $lineItemData['quantity'],
                    'unit' => $lineItemData['unit'] ?? 'pcs',
                    'batch_number' => $lineItemData['batch_number'] ?? null,
                    'expiry_date' => $lineItemData['expiry_date'] ?? null,
                    'unit_price' => $lineItemData['unit_price'],
                    'discount_amount' => $lineItemData['discount_amount'] ?? 0,
                    'tax_rate' => \App\Services\TaxCompliance\EtimsTaxType::rate($taxTypeCode),
                    'metadata' => array_merge($lineItemData['metadata'] ?? [], [
                        'etims_tax_type_code' => $taxTypeCode,
                    ]),
                ]);
            }

            // Calculate totals
            $invoice->calculateTotals();

            // Instant payment: record it now so the invoice is created already paid,
            // instead of leaving a manual "Record Payment" step for a cash/mpesa/bank sale.
            if ($paymentOption === 'instant') {
                $this->paymentApplication->applyPayment(
                    $invoice,
                    $user,
                    (float) $invoice->total_amount,
                    $request->payment_method,
                    $request->transaction_id,
                    null,
                    $request->invoice_date,
                );
                $invoice->refresh();
            } elseif ($request->filled('down_payment_amount')) {
                // Credit invoice with a down payment, e.g. to cover the slice that
                // exceeds the customer's available credit. applyPayment() itself
                // rejects an amount larger than the invoice total.
                $this->paymentApplication->applyPayment(
                    $invoice,
                    $user,
                    (float) $request->down_payment_amount,
                    $request->down_payment_method,
                    $request->down_payment_transaction_id,
                    null,
                    $request->invoice_date,
                );
                $invoice->refresh();
            }

            DB::commit();

            return response()->json([
                'message' => 'Invoice created successfully',
                'data' => $invoice->load(['customer', 'lineItems', 'salesRep:id,first_name,last_name,email'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create invoice', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to create invoice', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified invoice.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        try {
            return $this->executeWithRetry(function () use ($request, $id) {
                $user = $request->user();
                $companyId = $user->company_id;
                if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
                    return response()->json(['message' => 'Unauthorized'], 403);
                }
                $invoice = Invoice::with(['customer', 'order', 'lineItems.product', 'lineItems.variant', 'createdBy', 'company'])
                    ->where('company_id', $companyId)
                    ->findOrFail($id);
                return response()->json($invoice);
            });
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching invoice');
        }
    }

    /**
     * Update the specified invoice.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $invoice = Invoice::where('company_id', $companyId)->findOrFail($id);

        if ($invoice->status === 'paid') {
            return response()->json(['message' => 'Cannot update paid invoice'], 400);
        }

        $validator = Validator::make($request->all(), [
            'customer_id' => 'sometimes|exists:customers,id',
            'type' => 'sometimes|in:sales,service,recurring',
            'invoice_date' => 'sometimes|date',
            'due_date' => 'sometimes|date|after_or_equal:invoice_date',
            'currency' => 'sometimes|string|size:3',
            'payment_terms' => 'nullable|string',
            'notes' => 'nullable|string',
            'terms_and_conditions' => 'nullable|string',
            'delivery_note_number' => 'nullable|string|max:100',
            'delivery_note_date' => 'nullable|date',
            'reference_number' => 'nullable|string|max:100',
            'reference_date' => 'nullable|date',
            'other_references' => 'nullable|string|max:255',
            'buyers_order_no' => 'nullable|string|max:100',
            'buyers_order_date' => 'nullable|date',
            'dispatch_doc_no' => 'nullable|string|max:100',
            'dispatched_through' => 'nullable|string|max:100',
            'destination' => 'nullable|string|max:100',
            'terms_of_delivery' => 'nullable|string|max:255',
            'mode_of_payment' => 'nullable|string|max:100',
            'generate_etims_receipt' => 'sometimes|boolean',
            'payment_type' => 'sometimes|in:cash,credit',
            'credit_terms_days' => 'nullable|integer|min:0',
            'status' => 'sometimes|in:draft,sent,viewed,paid,overdue,cancelled',
            'line_items' => 'sometimes|array|min:1',
            'line_items.*.id' => 'sometimes|exists:invoice_line_items,id',
            'line_items.*.product_id' => 'nullable|exists:products,id',
            'line_items.*.variant_id' => 'nullable|exists:product_variants,id',
            'line_items.*.description' => 'required|string',
            'line_items.*.quantity' => 'required|numeric|min:0.01',
            'line_items.*.unit' => 'sometimes|string',
            'line_items.*.batch_number' => 'nullable|string|max:100',
            'line_items.*.expiry_date' => 'nullable|date',
            'line_items.*.unit_price' => 'required|numeric|min:0',
            'line_items.*.discount_amount' => 'sometimes|numeric|min:0',
            'line_items.*.tax_rate' => 'sometimes|numeric|min:0|max:100',
            'line_items.*.etims_tax_type_code' => 'nullable|string|in:A,B,C,D,E',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $invoice->update($request->only([
                'customer_id',
                'type',
                'invoice_date',
                'due_date',
                'currency',
                'payment_terms',
                'notes',
                'terms_and_conditions',
                'delivery_note_number',
                'delivery_note_date',
                'reference_number',
                'reference_date',
                'other_references',
                'buyers_order_no',
                'buyers_order_date',
                'dispatch_doc_no',
                'dispatched_through',
                'destination',
                'terms_of_delivery',
                'mode_of_payment',
                'status',
                'payment_type',
                'credit_terms_days',
            ]));

            if ($request->has('generate_etims_receipt')) {
                $invoice->update([
                    'etims_requested' => $request->boolean('generate_etims_receipt'),
                ]);
            }

            // Update line items if provided
            if ($request->has('line_items')) {
                // Delete existing line items
                $invoice->lineItems()->delete();

                // Create new line items
                foreach ($request->line_items as $lineItemData) {
                    $taxTypeCode = \App\Services\TaxCompliance\EtimsTaxType::fromInput(
                        $lineItemData['etims_tax_type_code'] ?? null,
                        $lineItemData['tax_rate'] ?? 0,
                    );

                    InvoiceLineItem::create([
                        'invoice_id' => $invoice->id,
                        'product_id' => $lineItemData['product_id'] ?? null,
                        'variant_id' => $lineItemData['variant_id'] ?? null,
                        'description' => $lineItemData['description'],
                        'quantity' => $lineItemData['quantity'],
                        'unit' => $lineItemData['unit'] ?? 'pcs',
                        'batch_number' => $lineItemData['batch_number'] ?? null,
                        'expiry_date' => $lineItemData['expiry_date'] ?? null,
                        'unit_price' => $lineItemData['unit_price'],
                        'discount_amount' => $lineItemData['discount_amount'] ?? 0,
                        'tax_rate' => \App\Services\TaxCompliance\EtimsTaxType::rate($taxTypeCode),
                        'metadata' => array_merge($lineItemData['metadata'] ?? [], [
                            'etims_tax_type_code' => $taxTypeCode,
                        ]),
                    ]);
                }

                // Recalculate totals
                $invoice->calculateTotals();
            }

            DB::commit();

            return response()->json([
                'message' => 'Invoice updated successfully',
                'data' => $invoice->load(['customer', 'lineItems'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update invoice', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to update invoice', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified invoice.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_delete_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        try {
            $invoice = Invoice::where('company_id', $companyId)->findOrFail($id);

            if ($invoice->amount_paid > 0) {
                return response()->json(['message' => 'Cannot delete invoice with payments'], 400);
            }

            DB::beginTransaction();

            // Delete line items
            $invoice->lineItems()->delete();
            $invoice->delete();

            DB::commit();

            return response()->json(['message' => 'Invoice deleted successfully']);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete invoice', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to delete invoice', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Create invoice from an existing order.
     */
    public function createFromOrder(Request $request, string $orderId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_create_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'invoice_date' => 'sometimes|date',
            'due_date' => 'sometimes|date',
            'payment_terms' => 'nullable|string',
            'notes' => 'nullable|string',
            'sales_rep_id' => 'nullable|uuid|exists:users,id',
            'payment_option' => 'sometimes|in:instant,credit',
            // Not required_if here - whether a method is actually needed depends on
            // how much of the order's total the order already has paid (checked below,
            // after the order is loaded), which can be enough to leave nothing to collect.
            'payment_method' => 'nullable|string',
            'transaction_id' => 'nullable|string',
            'down_payment_amount' => 'nullable|numeric|min:0.01',
            'down_payment_method' => 'required_with:down_payment_amount|nullable|string',
            'down_payment_transaction_id' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $user = $request->user();
            $order = Order::with([
                'orderItems.product',
                'orderItems.variant',
                'customer.account.directors',
                'deliveryLocation',
                'deliveryDetails',
                'latestOrderDispatch',
                'salesRep',
            ])
                ->where('company_id', $user->company_id)
                ->findOrFail($orderId);

            // Check if invoice already exists for this order
            $existingInvoice = Invoice::where('order_id', $orderId)->first();
            if ($existingInvoice) {
                return response()->json(['message' => 'Invoice already exists for this order', 'invoice' => $existingInvoice], 400);
            }

            DB::beginTransaction();

            // Calculate invoice status based on payment amount
            $amountPaid = $order->amount_paid ?? 0;
            $totalAmount = $order->final_amount;
            $invoiceDate = $request->invoice_date ?? now()->toDateString();
            $paymentOption = $request->input('payment_option');
            $alreadySettled = $totalAmount > 0 && (float) $amountPaid >= (float) $totalAmount;

            if ($paymentOption === 'instant' || $alreadySettled) {
                $credit = [
                    'payment_type' => 'cash',
                    'credit_terms_days' => null,
                    'due_date' => $invoiceDate,
                    'payment_terms' => $alreadySettled ? 'Paid' : ($request->payment_terms ?? 'Paid Instantly'),
                ];
            } else {
                $credit = $this->resolveInvoiceCredit(
                    $order->customer,
                    $invoiceDate,
                    $request->due_date,
                    $request->payment_terms,
                );
            }
            $invoiceStatus = $this->calculateInvoiceStatus($amountPaid, $totalAmount, $credit['due_date']);

            // Pull the reference/dispatch details straight from the order
            // this invoice is being created from, rather than leaving them
            // for manual re-entry - the data already exists in the system.
            $dispatch = $order->latestOrderDispatch;
            $deliveryDetail = $order->deliveryDetails->first();
            // The dispatch's own logistics entry carries the delivery company
            // and destination actually picked when the dispatch was created -
            // that's the source of truth here, not the order's delivery
            // details (which only records a generic method like "courier").
            $logistic = $dispatch
                ? Logistic::where('order_dispatch_id', $dispatch->id)->latest()->first()
                : null;
            $deliveryNote = $dispatch
                ? DeliveryNote::where('order_dispatch_id', $dispatch->id)->latest()->first()
                : null;
            $destination = collect([$logistic?->delivery_location, $logistic?->state])
                ->filter()
                ->implode(', ') ?: ($order->deliveryLocation?->estate ?: $order->deliveryLocation?->city);
            // "Other References" on the reference invoice format is the
            // customer's primary contact - the first director on their
            // credit account (name - phone).
            $director1 = $order->customer?->account?->directors?->first();
            $otherReferences = $director1
                ? trim($director1->name . ($director1->phone_number ? ' - ' . $director1->phone_number : ''))
                : null;

            $invoice = Invoice::create([
                'company_id' => $user->company_id,
                'customer_id' => $order->customer_id,
                'sales_rep_id' => $request->sales_rep_id ?? $order->sales_rep_id,
                'payment_type' => $credit['payment_type'],
                'credit_terms_days' => $credit['credit_terms_days'],
                'order_id' => $order->id,
                'type' => 'sales',
                'status' => $invoiceStatus,
                'invoice_date' => $invoiceDate,
                'due_date' => $credit['due_date'],
                'currency' => $order->currency ?? 'KES',
                'payment_terms' => $credit['payment_terms'],
                'notes' => $request->notes,
                // A running per-company counter, independent of the order
                // number, per the printed invoice format.
                'buyers_order_no' => $this->generateBuyersOrderNo($user->company_id),
                'buyers_order_date' => $order->order_date,
                'mode_of_payment' => $credit['payment_terms'],
                // A dispatch's delivery note and dispatch doc are the same
                // physical document in this system, hence the shared number.
                'dispatch_doc_no' => $dispatch?->dispatch_number,
                'delivery_note_number' => $dispatch?->dispatch_number,
                // The date the delivery note itself was generated, not the
                // dispatch's estimated delivery date.
                'delivery_note_date' => $deliveryNote?->created_at?->toDateString(),
                'dispatched_through' => $logistic?->logistics_provider ?: ($logistic?->delivery_method ?: $deliveryDetail?->delivery_method),
                'destination' => $destination,
                // The order IS the buyer's reference document for this sale.
                'reference_number' => $order->order_number,
                'reference_date' => $order->order_date,
                'other_references' => $otherReferences,
                'created_by' => $user->id,
                'subtotal' => 0,
                'tax_amount' => 0,
                'discount_amount' => 0,
                'total_amount' => $totalAmount,
                // Not seeded from $amountPaid here - the reconciliation right after
                // calculateTotals() below allocates the order's actual Payment
                // record(s) onto this invoice and sets these from that, which is
                // the same source of truth applyPayment() uses everywhere else.
                'amount_paid' => 0,
                'balance_amount' => $totalAmount,
                'invoice_number' => $this->generateInvoiceNumber($user->company_id),
                'etims_requested' => $request->boolean('generate_etims_receipt', true),
            ]);

            $order->update([
                'payment_type' => $credit['payment_type'],
                'credit_terms_days' => $credit['credit_terms_days'],
            ]);

            // The order's discount is spread over its lines in proportion to
            // each line's value, so the invoice's VAT (charged on the
            // discounted amount) and total match the order exactly.
            $orderSubtotal = (float) $order->orderItems->sum(fn ($i) => (float) $i->quantity * (float) ($i->unit_price ?? 0));
            $discountRatio = $orderSubtotal > 0 ? min(1, (float) ($order->discount ?? 0) / $orderSubtotal) : 0;

            // Create line items from order items
            foreach ($order->orderItems as $orderItem) {
                // The order already recorded exactly which batch(es) FEFO
                // drew from at order-creation time - carry that onto the
                // invoice rather than leaving it for manual entry. If a line
                // spanned more than one batch, list every batch number and
                // use the earliest expiry (the more conservative date).
                $batchNumber = null;
                $expiryDate = null;
                // VAT rate as agreed on the order; a 0% line keeps the
                // product's own exempt/zero-rated/non-VAT classification.
                $lineTaxRate = (float) ($orderItem->tax_rate ?? 0);
                $taxCode = \App\Services\TaxCompliance\EtimsTaxType::fromInput(null, $lineTaxRate);
                if ($lineTaxRate == 0.0 && $orderItem->product) {
                    $productCode = \App\Services\TaxCompliance\EtimsTaxType::forProduct($orderItem->product);
                    $taxCode = in_array($productCode, ['A', 'C', 'D'], true) ? $productCode : 'D';
                }
                $metadata = ['etims_tax_type_code' => $taxCode, 'price_label' => $orderItem->price_label];
                $allocations = $orderItem->batch_allocations ?? [];
                if (!empty($allocations)) {
                    $batchNumber = collect($allocations)->pluck('batch_number')->filter()->unique()->implode(', ');
                    $expiryDate = collect($allocations)->pluck('expiry_date')->filter()->sort()->first();
                    // Per-batch split so the printed invoice can list each batch with its own qty and expiry.
                    $metadata['batches'] = collect($allocations)->map(fn ($a) => [
                        'batch_number' => $a['batch_number'] ?? null,
                        'expiry_date' => $a['expiry_date'] ?? null,
                        'quantity' => $a['quantity'] ?? null,
                    ])->values()->all();
                }

                $lineUnitPrice = $orderItem->unit_price ?? $orderItem->price ?? $orderItem->total_price ?? 0;
                InvoiceLineItem::create([
                    'invoice_id' => $invoice->id,
                    'product_id' => $orderItem->product_id,
                    'variant_id' => $orderItem->variant_id,
                    'description' => $orderItem->product->name . ($orderItem->variant ? ' - ' . $orderItem->variant->name : ''),
                    'quantity' => $orderItem->quantity,
                    'unit' => 'pcs',
                    'batch_number' => $batchNumber ?: null,
                    'expiry_date' => $expiryDate ?: null,
                    'unit_price' => $lineUnitPrice,
                    'discount_amount' => round((float) $orderItem->quantity * (float) $lineUnitPrice * $discountRatio, 2),
                    'tax_rate' => \App\Services\TaxCompliance\EtimsTaxType::rate($taxCode),
                    'metadata' => $metadata,
                ]);
            }

            // Calculate totals
            $invoice->calculateTotals();

            // The order this invoice is created from may already have real Payment
            // record(s) against it (e.g. an instant-payment order, or one that ended
            // up overpaid) that were never linked to any invoice - allocate whatever
            // each has unapplied onto this invoice now, up to the invoice total,
            // instead of leaving that money stranded or collecting it again below.
            // Anything left over (a genuine overpayment) stays unapplied on the
            // original Payment record, exactly like any other over-collected
            // payment - visible via the existing payment-mapping tools for a
            // refund or applying it to a future invoice.
            $unallocated = $order->payments()
                ->where('status', 'completed')
                ->get()
                ->map(fn ($payment) => [
                    'payment' => $payment,
                    'available' => (float) $payment->amount_paid - (float) $payment->allocations()->sum('amount_allocated'),
                ])
                ->filter(fn ($entry) => $entry['available'] > 0.01);

            if ($unallocated->isNotEmpty()) {
                $stillToAllocate = (float) $invoice->total_amount;
                foreach ($unallocated as $entry) {
                    if ($stillToAllocate <= 0.01) {
                        break;
                    }
                    $allocateAmount = round(min($entry['available'], $stillToAllocate), 2);
                    PaymentAllocation::create([
                        'payment_id' => $entry['payment']->id,
                        'invoice_id' => $invoice->id,
                        'amount_allocated' => $allocateAmount,
                        'allocated_date' => now(),
                        'notes' => 'Auto-allocated from the order\'s existing payment on invoice creation',
                    ]);
                    $stillToAllocate -= $allocateAmount;
                }

                $invoice->refresh();
                $allocated = (float) $invoice->getTotalAllocatedAmount();
                $invoice->update([
                    'amount_paid' => $allocated,
                    'balance_amount' => (float) $invoice->total_amount - $allocated,
                    'status' => $this->calculateInvoiceStatus($allocated, $invoice->total_amount, $invoice->due_date),
                ]);
                $invoice->refresh();
            }

            // Instant payment: settle whatever balance remains right now, after
            // the reconciliation above - getTotalAllocatedAmount() is now accurate,
            // so this only collects a genuine shortfall, never money already paid.
            if ($paymentOption === 'instant') {
                $remaining = round((float) $invoice->total_amount - (float) $invoice->getTotalAllocatedAmount(), 2);
                if ($remaining > 0) {
                    if (!$request->filled('payment_method')) {
                        DB::rollBack();
                        return response()->json([
                            'message' => 'Payment method is required to collect the remaining balance of ' . number_format($remaining, 2) . '.',
                        ], 422);
                    }
                    $this->paymentApplication->applyPayment(
                        $invoice,
                        $user,
                        $remaining,
                        $request->payment_method,
                        $request->transaction_id,
                        null,
                        $invoiceDate,
                    );
                    $invoice->refresh();
                }
                // remaining <= 0: the order's existing payment(s) already cover the
                // invoice in full (or overpaid it) - nothing new to collect.
            } elseif ($request->filled('down_payment_amount')) {
                // Credit invoice with a down payment, e.g. to cover the slice that
                // exceeds the customer's available credit.
                $this->paymentApplication->applyPayment(
                    $invoice,
                    $user,
                    (float) $request->down_payment_amount,
                    $request->down_payment_method,
                    $request->down_payment_transaction_id,
                    null,
                    $invoiceDate,
                );
                $invoice->refresh();
            }

            DB::commit();

            return response()->json([
                'message' => 'Invoice created from order successfully',
                'data' => $invoice->load(['customer', 'order', 'lineItems', 'salesRep:id,first_name,last_name,email'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create invoice from order', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to create invoice from order', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Send invoice to customer.
     */
    public function sendInvoice(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'method' => 'sometimes|in:email,whatsapp',
            'email' => 'required_if:method,email|email',
            'phone' => 'required_if:method,whatsapp|regex:/^\+?[0-9]{10,15}$/',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $user = $request->user();
            $invoice = Invoice::with(['customer', 'company'])->where('company_id', $user->company_id)->findOrFail($id);

            if ($invoice->status === 'paid') {
                return response()->json(['message' => 'Cannot send paid invoice'], 400);
            }

            $method = $request->get('method', 'email');

            if ($method === 'email') {
                // Use the email from the request if provided, otherwise fallback to the customer's email
                $recipientEmail = $request->get('email') ?: ($invoice->customer ? $invoice->customer->email : null);
                if (!$recipientEmail) {
                    return response()->json(['message' => 'No recipient email found'], 400);
                }
                try {
                    \Illuminate\Support\Facades\Notification::route('mail', $recipientEmail)
                        ->notify(new \App\Notifications\SendInvoiceNotification($invoice));
                } catch (\Exception $mailEx) {
                    Log::error('Failed to send invoice email', ['error' => $mailEx->getMessage()]);
                    return response()->json(['message' => 'Failed to send invoice email', 'error' => $mailEx->getMessage()], 500);
                }
            } else if ($method === 'whatsapp') {
                // Use the phone from the request if provided, otherwise fallback to the customer's WhatsApp phone
                $customer = $invoice->customer;
                if (!$customer) {
                    return response()->json(['message' => 'No customer found for invoice'], 400);
                }
                $whatsappPhone = $request->get('phone') ?: $customer->getWhatsAppPhone();
                if (!$whatsappPhone) {
                    return response()->json(['message' => 'No WhatsApp phone found for customer'], 400);
                }

                // 1. Generate PDF and save to a temp file
                $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('invoice.pdf', ['invoice' => $invoice]);
                $pdfContent = $pdf->output();
                $pdfFileName = 'invoice-' . $invoice->invoice_number . '-' . time() . '.pdf';
                $tmpDir = storage_path('app/tmp');
                if (!file_exists($tmpDir)) {
                    mkdir($tmpDir, 0775, true);
                }
                $tmpFilePath = $tmpDir . '/' . $pdfFileName;
                file_put_contents($tmpFilePath, $pdfContent);

                // 3. Find or create WhatsApp conversation
                $conversation = \App\Models\Conversation::firstOrCreate([
                    'company_id' => $invoice->company_id,
                    'customer_id' => $customer->id,
                    'platform' => 'whatsapp',
                    'platform_user_id' => $whatsappPhone,
                ], [
                    'customer_name' => $customer->name,
                    'customer_phone' => $whatsappPhone,
                    'status' => 'active',
                    // Provide a default value for NOT NULL field
                    'platform_conversation_id' => '',
                ]);

                // 4. Send via MetaChatService with local file path
                // Move PDF to public storage for WhatsApp (must be accessible by WhatsApp API)
                $publicPath = 'invoices/' . $pdfFileName;
                $publicFullPath = public_path($publicPath);
                if (!file_exists(dirname($publicFullPath))) {
                    mkdir(dirname($publicFullPath), 0775, true);
                }
                copy($tmpFilePath, $publicFullPath);
                $publicUrl = asset($publicPath);
                // Clean up temp file
                @unlink($tmpFilePath);

                // Create Message record of type 'document'
                $message = \App\Models\Message::create([
                    'conversation_id' => $conversation->id,
                    'direction' => 'outbound',
                    'sender_type' => 'agent',
                    'sender_name' => $user->name ?? 'System',
                    'message_type' => 'document',
                    'media_url' => $publicUrl,
                    'media_type' => 'application/pdf',
                    'caption' => 'Invoice #' . $invoice->invoice_number,
                    'status' => 'pending',
                ]);

                // Send via MetaChatService
                $metaChatService = app(\App\Services\MetaChatService::class);
                $result = $metaChatService->sendMessage($conversation, $message);
                if (!$result['success']) {
                    Log::error('Failed to send invoice via WhatsApp', ['error' => $result['error'] ?? 'Unknown', 'invoice_id' => $invoice->id]);
                    return response()->json(['message' => 'Failed to send invoice via WhatsApp', 'error' => $result['error']], 500);
                }
            }

            $invoice->markAsSent();

            // Create accounting journal entry based on company settings
            // The workflow service checks company_accounting_settings to determine
            // if this is the right trigger point for recording the invoice
            try {
                $result = $this->accountingWorkflow
                    ->forCompany($invoice->company_id)
                    ->asUser($user->id)
                    ->onInvoiceSent($invoice);

                if ($result) {
                    Log::info('Accounting entry created for invoice (on_invoice_sent trigger)', [
                        'invoice_id' => $invoice->id,
                        'journal_id' => $result['journal_id'] ?? null
                    ]);
                } else {
                    Log::info('Accounting entry skipped for invoice (not triggered on_invoice_sent)', [
                        'invoice_id' => $invoice->id,
                        'trigger_setting' => $this->accountingWorkflow->getSalesInvoiceTrigger()
                    ]);
                }
            } catch (\Exception $accountingError) {
                // Log but don't fail the invoice send - accounting can be reconciled later
                Log::warning('Failed to create accounting entry for invoice', [
                    'invoice_id' => $invoice->id,
                    'error' => $accountingError->getMessage()
                ]);
            }

            return response()->json([
                'message' => 'Invoice sent successfully',
                'data' => $invoice
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send invoice', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to send invoice', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Record payment for invoice (unified approach using allocations).
     */
    public function recordPayment(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'nullable|string',
            'payment_date' => 'nullable|date',
            'transaction_id' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        if (strtolower((string) $request->payment_method) === 'cheque') {
            return response()->json([
                'message' => 'Cheque payments must be recorded via POST /cheques so they can be tracked as pending until they mature and are approved.',
            ], 422);
        }

        try {
            $user = $request->user();
            $invoice = Invoice::where('company_id', $user->company_id)
                ->findOrFail($id);

            $result = $this->paymentApplication->applyPayment(
                $invoice,
                $user,
                (float) $request->amount,
                $request->payment_method ?? 'manual',
                $request->transaction_id,
                $request->notes,
                $request->payment_date,
            );

            return response()->json([
                'message' => 'Payment recorded successfully',
                'data' => [
                    'invoice' => $result['invoice'],
                    'payment' => [
                        'id' => $result['payment']->id,
                        'amount' => (float) $request->amount,
                        'payment_method' => $result['payment']->payment_method,
                        'payment_date' => $result['payment']->payment_date->toDateString(),
                        'transaction_id' => $result['payment']->transaction_id,
                        'notes' => $request->notes
                    ],
                    'allocation' => [
                        'id' => $result['allocation']->id,
                        'amount_allocated' => $result['allocation']->amount_allocated,
                        'allocated_date' => $result['allocation']->allocated_date
                    ]
                ]
            ]);

        } catch (\RuntimeException $e) {
            $invoice = Invoice::where('company_id', $user->company_id)->find($id);
            return response()->json([
                'message' => $e->getMessage(),
                'invoice_total' => $invoice->total_amount ?? null,
                'amount_paid' => $invoice?->getTotalAllocatedAmount(),
                'balance_due' => $invoice ? $invoice->total_amount - $invoice->getTotalAllocatedAmount() : null,
                'attempted_payment' => $request->amount,
            ], 400);
        } catch (\Exception $e) {
            Log::error('Failed to record payment', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to record payment', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get invoice statistics.
     */
    public function getStatistics(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = $request->user();
        $startDate = $request->get('start_date', now()->startOfMonth());
        $endDate = $request->get('end_date', now()->endOfMonth());

        $stats = Invoice::where('company_id', $user->company_id)
            ->whereBetween('invoice_date', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_invoices,
                SUM(total_amount) as total_amount,
                SUM(amount_paid) as total_paid,
                SUM(balance_amount) as total_outstanding,
                COUNT(CASE WHEN status = "paid" THEN 1 END) as paid_invoices,
                COUNT(CASE WHEN status = "draft" THEN 1 END) as draft_invoices,
                COUNT(CASE WHEN status = "sent" THEN 1 END) as sent_invoices,
                COUNT(CASE WHEN due_date < NOW() AND balance_amount > 0 THEN 1 END) as overdue_invoices,
                AVG(total_amount) as average_invoice_amount
            ')
            ->first();

        return response()->json($stats);
    }

    /**
     * Get aging report for invoices.
     */
    public function getAgingReport(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = $request->user();
        $asOfDate = $request->get('as_of_date', now()->toDateString());

        $invoices = Invoice::with('customer')
            ->where('company_id', $user->company_id)
            ->where('balance_amount', '>', 0)
            ->where('invoice_date', '<=', $asOfDate)
            ->get();

        $agingBuckets = [
            'current' => ['min' => 0, 'max' => 0, 'invoices' => [], 'total' => 0],
            '1-30' => ['min' => 1, 'max' => 30, 'invoices' => [], 'total' => 0],
            '31-60' => ['min' => 31, 'max' => 60, 'invoices' => [], 'total' => 0],
            '61-90' => ['min' => 61, 'max' => 90, 'invoices' => [], 'total' => 0],
            '90+' => ['min' => 91, 'max' => 999999, 'invoices' => [], 'total' => 0],
        ];

        foreach ($invoices as $invoice) {
            $daysOverdue = now()->parse($asOfDate)->diffInDays($invoice->due_date, false);
            $daysOverdue = $daysOverdue < 0 ? abs($daysOverdue) : 0;

            foreach ($agingBuckets as $bucket => &$data) {
                if ($daysOverdue >= $data['min'] && $daysOverdue <= $data['max']) {
                    $data['invoices'][] = $invoice;
                    $data['total'] += $invoice->balance_amount;
                    break;
                }
            }
        }

        return response()->json([
            'aging_buckets' => $agingBuckets,
            'summary' => [
                'total_outstanding' => $invoices->sum('balance_amount'),
                'total_invoices' => $invoices->count(),
                'as_of_date' => $asOfDate,
            ]
        ]);
    }

    /**
     * Generate a unique invoice number for the company.
     *
     * @param string $companyId
     * @return string
     */
    protected function generateInvoiceNumber($companyId)
    {
        $prefix = 'INV-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastInvoice = DB::table('invoices')
            ->select('invoice_number')
            ->where('company_id', $companyId)
            ->where('invoice_number', 'like', $prefix . '%')
            ->orderBy('invoice_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastInvoice ? (int) substr($lastInvoice->invoice_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Generate the next Buyer's Order No. for the company - a plain,
     * zero-padded counter (001, 002, ...) that increments with every
     * invoice, independent of the underlying order's own order number.
     */
    protected function generateBuyersOrderNo($companyId)
    {
        $last = DB::table('invoices')
            ->where('company_id', $companyId)
            ->whereRaw("buyers_order_no ~ '^[0-9]+$'")
            ->orderByRaw('length(buyers_order_no) desc, buyers_order_no desc')
            ->lockForUpdate()
            ->value('buyers_order_no');

        $nextNumber = $last ? ((int) $last) + 1 : 1;
        return str_pad($nextNumber, 3, '0', STR_PAD_LEFT);
    }

    /**
     * Get invoice by order ID.
     */
    public function getByOrderId(Request $request, string $orderId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $user = $request->user();

            // Find the invoice for this order
            $invoice = Invoice::with(['customer', 'order', 'lineItems.product', 'lineItems.variant'])
                ->where('order_id', $orderId)
                ->where('company_id', $user->company_id)
                ->first();

            if (!$invoice) {
                return response()->json([
                    'message' => 'No invoice found for this order',
                    'order_id' => $orderId
                ], 404);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Invoice found',
                'data' => $invoice
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch invoice by order ID', [
                'order_id' => $orderId,
                'error' => $e->getMessage()
            ]);
            return response()->json([
                'message' => 'Failed to fetch invoice',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Map an existing payment to an invoice (unified allocation approach).
     */
    public function mapPayment(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'payment_id' => 'required|exists:payments,id',
            'apply_amount' => 'nullable|numeric|min:0.01',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $user = $request->user();
            $invoice = Invoice::where('company_id', $user->company_id)
                ->findOrFail($id);

            $payment = Payment::where('company_id', $user->company_id)
                ->findOrFail($request->payment_id);

            // Check if payment is already allocated to this invoice
            $existingAllocation = PaymentAllocation::where('payment_id', $payment->id)
                ->where('invoice_id', $invoice->id)
                ->first();

            if ($existingAllocation) {
                return response()->json([
                    'message' => 'Payment is already allocated to this invoice',
                    'existing_allocation' => $existingAllocation->amount_allocated,
                    'allocated_date' => $existingAllocation->allocated_date
                ], 400);
            }

            // Calculate available payment amount
            $totalAllocated = $payment->allocations()->sum('amount_allocated') ?? 0;
            $availableAmount = $payment->amount_paid - $totalAllocated;

            if ($availableAmount <= 0) {
                return response()->json([
                    'message' => 'Payment is already fully allocated',
                    'payment_amount' => $payment->amount_paid,
                    'total_allocated' => $totalAllocated,
                    'available_amount' => $availableAmount
                ], 400);
            }

            // Calculate current invoice balance
            $currentAmountPaid = $invoice->getTotalAllocatedAmount();
            $invoiceBalance = $invoice->total_amount - $currentAmountPaid;

            // Determine amount to apply
            $applyAmount = $request->apply_amount ?? min($availableAmount, $invoiceBalance);

            if ($applyAmount > $availableAmount) {
                return response()->json([
                    'message' => 'Apply amount exceeds available payment amount',
                    'available_amount' => $availableAmount,
                    'requested_amount' => $applyAmount
                ], 400);
            }

            if ($applyAmount > $invoiceBalance) {
                return response()->json([
                    'message' => 'Apply amount exceeds invoice balance',
                    'invoice_balance' => $invoiceBalance,
                    'requested_amount' => $applyAmount
                ], 400);
            }

            DB::beginTransaction();

            // Create payment allocation
            $allocation = PaymentAllocation::create([
                'payment_id' => $payment->id,
                'invoice_id' => $invoice->id,
                'amount_allocated' => $applyAmount,
                'allocated_date' => now(),
                'notes' => $request->notes,
            ]);

            // Update invoice amounts and status
            $newAmountPaid = $currentAmountPaid + $applyAmount;
            $newBalance = $invoice->total_amount - $newAmountPaid;
            $newStatus = $this->calculateInvoiceStatus($newAmountPaid, $invoice->total_amount, $invoice->due_date);

            $invoice->update([
                'amount_paid' => $newAmountPaid,
                'balance_amount' => $newBalance,
                'status' => $newStatus
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Payment mapped to invoice successfully',
                'data' => [
                    'invoice' => $invoice->fresh(),
                    'payment_mapping' => [
                        'payment_id' => $payment->id,
                        'allocation_id' => $allocation->id,
                        'amount_allocated' => $applyAmount,
                        'payment_date' => $payment->payment_date,
                        'payment_method' => $payment->payment_method,
                        'transaction_id' => $payment->transaction_id,
                        'allocated_date' => $allocation->allocated_date,
                        'notes' => $allocation->notes
                    ],
                    'payment_summary' => [
                        'total_amount' => $payment->amount_paid,
                        'total_allocated' => $totalAllocated + $applyAmount,
                        'remaining_amount' => $availableAmount - $applyAmount
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to map payment to invoice', [
                'invoice_id' => $id,
                'payment_id' => $request->payment_id,
                'error' => $e->getMessage()
            ]);
            return response()->json(['message' => 'Failed to map payment', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get payment history for an invoice (unified allocation approach).
     */
    public function getPaymentHistory(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $user = $request->user();
            $invoice = Invoice::where('company_id', $user->company_id)
                ->findOrFail($id);

            // Get all payment allocations for this invoice
            $payments = PaymentAllocation::where('invoice_id', $id)
                ->with([
                    'payment' => function ($query) use ($user) {
                        $query->where('company_id', $user->company_id);
                    }
                ])
                ->whereHas('payment', function ($query) use ($user) {
                    $query->where('company_id', $user->company_id);
                })
                ->orderBy('allocated_date', 'desc')
                ->get()
                ->map(function ($allocation) {
                    return [
                        'id' => $allocation->payment->id,
                        'order_id' => $allocation->payment->order_id,
                        'invoice_id' => $allocation->invoice_id,
                        'customer_id' => $allocation->payment->customer_id,
                        'company_id' => $allocation->payment->company_id,
                        'payment_method' => $allocation->payment->payment_method,
                        'transaction_id' => $allocation->payment->transaction_id,
                        'amount_paid' => $allocation->payment->amount_paid,
                        'amount_applied' => $allocation->amount_allocated,
                        // Unapplied excess still sitting on this specific Payment record
                        // (not this invoice) - e.g. the customer paid more than the
                        // invoice total in one lump sum. Refundable via
                        // POST /payments/{id}/refund-overpayment.
                        'available_to_refund' => (float) $allocation->payment->remaining_amount,
                        'status' => $allocation->payment->status,
                        'payment_date' => $allocation->payment->payment_date,
                        'applied_date' => $allocation->allocated_date,
                        'notes' => $allocation->notes,
                        'created_at' => $allocation->created_at,
                        'updated_at' => $allocation->updated_at,
                    ];
                });

            // Calculate totals from allocations
            $totalAllocated = $payments->sum('amount_applied');

            return response()->json([
                'message' => 'Payment history retrieved successfully',
                'data' => [
                    'invoice_id' => $id,
                    'invoice_number' => $invoice->invoice_number,
                    'total_amount' => $invoice->total_amount,
                    'amount_paid' => $totalAllocated,
                    'balance_amount' => $invoice->total_amount - $totalAllocated,
                    'payment_count' => $payments->count(),
                    'payments' => $payments,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get payment history', [
                'invoice_id' => $id,
                'error' => $e->getMessage()
            ]);
            return response()->json(['message' => 'Failed to get payment history', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get available amount for a payment (how much can still be allocated)
     */
    public function getPaymentAvailableAmount(Request $request, string $paymentId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $user = $request->user();
            $payment = Payment::where('company_id', $user->company_id)
                ->findOrFail($paymentId);

            // Calculate total allocated amount
            $totalAllocated = $payment->allocations()->sum('amount_allocated') ?? 0;
            $refundedAmount = $payment->refunds()->where('status', 'completed')->sum('amount') ?? 0;
            $pendingRefundAmount = $payment->refunds()->where('status', 'pending')->sum('amount') ?? 0;
            $availableAmount = $payment->amount_paid - $totalAllocated - $refundedAmount - $pendingRefundAmount;

            // Get allocation details
            $allocations = $payment->allocations()
                ->with('invoice:id,invoice_number,total_amount')
                ->get()
                ->map(function ($allocation) {
                    return [
                        'allocation_id' => $allocation->id,
                        'invoice_id' => $allocation->invoice_id,
                        'invoice_number' => $allocation->invoice->invoice_number ?? 'N/A',
                        'amount_allocated' => $allocation->amount_allocated,
                        'allocated_date' => $allocation->allocated_date,
                        'notes' => $allocation->notes
                    ];
                });

            return response()->json([
                'message' => 'Payment available amount retrieved successfully',
                'data' => [
                    'payment_id' => $paymentId,
                    'transaction_id' => $payment->transaction_id,
                    'payment_method' => $payment->payment_method,
                    'payment_date' => $payment->payment_date,
                    'total_amount' => $payment->amount_paid,
                    'allocated_amount' => $totalAllocated,
                    'refunded_amount' => $refundedAmount,
                    'pending_refund_amount' => $pendingRefundAmount,
                    'available_amount' => $availableAmount,
                    'is_fully_allocated' => $availableAmount <= 0,
                    'allocation_percentage' => $payment->amount_paid > 0 ? round(($totalAllocated / $payment->amount_paid) * 100, 2) : 0,
                    'allocations_count' => $allocations->count(),
                    'allocations' => $allocations
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get payment available amount', [
                'payment_id' => $paymentId,
                'error' => $e->getMessage()
            ]);
            return response()->json(['message' => 'Failed to get payment information', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Refund unapplied excess off a customer payment (e.g. they paid more
     * than an invoice's total in one lump sum). Every method except cheque
     * completes immediately since real money is moving now; a cheque stays
     * "pending" until approved/cleared, mirroring every other cheque flow in
     * this app, and only then reduces what's available to refund/allocate.
     */
    public function refundPaymentOverpayment(Request $request, string $paymentId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_refund_payments', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'refund_method' => 'required|string|in:bank_transfer,cash,mobile_money,cheque,other',
            'reference' => 'nullable|string|max:255',
            'reason' => 'required|string',
            'notes' => 'nullable|string',
            'refund_date' => 'nullable|date',
            'cheque_number' => 'required_if:refund_method,cheque|string|max:100',
            'bank_name' => 'required_if:refund_method,cheque|string|max:150',
            'maturity_date' => 'required_if:refund_method,cheque|date|after_or_equal:refund_date',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $payment = Payment::where('company_id', $companyId)->lockForUpdate()->findOrFail($paymentId);

            $available = (float) $payment->remaining_amount;
            $amount = (float) $request->input('amount');
            if ($amount > $available + 0.01) {
                DB::rollBack();
                return response()->json([
                    'message' => 'Refund amount (' . number_format($amount, 2) . ') exceeds the available unapplied balance (' . number_format($available, 2) . ') on this payment.',
                ], 422);
            }

            $refundDate = $request->input('refund_date', now()->toDateString());
            $isCheque = $request->input('refund_method') === 'cheque';

            $refund = PaymentRefund::create([
                'payment_id' => $payment->id,
                'company_id' => $companyId,
                'customer_id' => $payment->customer_id,
                'amount' => $amount,
                'refund_date' => $refundDate,
                'refund_method' => $request->input('refund_method'),
                'reference' => $request->input('reference'),
                'reason' => $request->input('reason'),
                'notes' => $request->input('notes'),
                'status' => $isCheque ? 'pending' : 'completed',
                'created_by' => $user->id,
            ]);

            if ($isCheque) {
                $customer = $payment->customer;
                Cheque::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'direction' => 'issued',
                    'customer_id' => $payment->customer_id,
                    'payee_name' => $customer->name ?? null,
                    'payment_refund_id' => $refund->id,
                    'cheque_number' => $request->input('cheque_number'),
                    'bank_name' => $request->input('bank_name'),
                    'amount' => $amount,
                    'issue_date' => $refundDate,
                    'maturity_date' => $request->input('maturity_date'),
                    'status' => 'pending',
                    'notes' => $request->input('notes'),
                    'created_by' => $user->id,
                ]);
            } else {
                $payment->update(['amount_refunded' => (float) $payment->amount_refunded + $amount]);
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => $isCheque
                    ? 'Refund cheque recorded - pending clearance. It will not reduce the available balance permanently until approved, and the Director/GM will be alerted a week before it matures.'
                    : 'Refund recorded successfully',
                'data' => $refund->load('cheque'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to refund payment overpayment', ['payment_id' => $paymentId, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to record refund', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Deallocate payment from an invoice
     */
    public function deallocatePayment(Request $request, string $allocationId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $user = $request->user();

            // Find the allocation
            $allocation = PaymentAllocation::with(['payment', 'invoice'])
                ->where('id', $allocationId)
                ->first();

            if (!$allocation) {
                return response()->json(['message' => 'Allocation not found'], 404);
            }

            // Verify company access
            if ($allocation->payment->company_id !== $user->company_id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            DB::beginTransaction();

            $invoice = $allocation->invoice;
            $allocationAmount = $allocation->amount_allocated;

            // Update invoice amounts
            $newAmountPaid = $invoice->amount_paid - $allocationAmount;
            $newBalance = $invoice->total_amount - $newAmountPaid;
            $newStatus = $this->calculateInvoiceStatus($newAmountPaid, $invoice->total_amount, $invoice->due_date);

            $invoice->update([
                'amount_paid' => $newAmountPaid,
                'balance_amount' => $newBalance,
                'status' => $newStatus
            ]);

            // Delete the allocation
            $allocation->delete();

            DB::commit();

            return response()->json([
                'message' => 'Payment deallocated successfully',
                'data' => [
                    'deallocated_amount' => $allocationAmount,
                    'invoice' => [
                        'id' => $invoice->id,
                        'invoice_number' => $invoice->invoice_number,
                        'new_amount_paid' => $newAmountPaid,
                        'new_balance' => $newBalance,
                        'new_status' => $newStatus
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to deallocate payment', [
                'allocation_id' => $allocationId,
                'error' => $e->getMessage()
            ]);
            return response()->json(['message' => 'Failed to deallocate payment', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get comprehensive invoice balance including both direct payments and allocations
     */
    public function getInvoiceBalance(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $user = $request->user();
            $invoice = Invoice::where('company_id', $user->company_id)
                ->findOrFail($id);

            // Get direct payments amount
            $directPaymentsAmount = Payment::where('invoice_id', $id)
                ->where('company_id', $user->company_id)
                ->sum('amount_paid');

            // Get allocated payments amount
            $allocatedPaymentsAmount = PaymentAllocation::where('invoice_id', $id)
                ->sum('amount_allocated');

            $totalPaid = $directPaymentsAmount + $allocatedPaymentsAmount;
            $balance = $invoice->total_amount - $totalPaid;

            // Check if stored amount_paid matches calculated amount
            $discrepancy = $invoice->amount_paid - $totalPaid;

            return response()->json([
                'message' => 'Invoice balance retrieved successfully',
                'data' => [
                    'invoice' => [
                        'id' => $invoice->id,
                        'invoice_number' => $invoice->invoice_number,
                        'total_amount' => $invoice->total_amount,
                        'stored_amount_paid' => $invoice->amount_paid,
                        'stored_balance' => $invoice->balance_amount,
                        'status' => $invoice->status
                    ],
                    'calculated_amounts' => [
                        'direct_payments' => $directPaymentsAmount,
                        'allocated_payments' => $allocatedPaymentsAmount,
                        'total_paid' => $totalPaid,
                        'balance' => $balance
                    ],
                    'verification' => [
                        'amounts_match' => abs($discrepancy) < 0.01,
                        'discrepancy' => $discrepancy
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get invoice balance', [
                'invoice_id' => $id,
                'error' => $e->getMessage()
            ]);
            return response()->json(['message' => 'Failed to get invoice balance', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Sync invoice amounts with actual payments (both direct and allocated)
     */
    public function syncInvoiceAmounts(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;
        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $user = $request->user();
            $invoice = Invoice::where('company_id', $user->company_id)
                ->findOrFail($id);

            DB::beginTransaction();

            // Calculate actual paid amounts
            $directPaymentsAmount = Payment::where('invoice_id', $id)
                ->where('company_id', $user->company_id)
                ->sum('amount_paid');

            $allocatedPaymentsAmount = PaymentAllocation::where('invoice_id', $id)
                ->sum('amount_allocated');

            $totalPaid = $directPaymentsAmount + $allocatedPaymentsAmount;
            $newBalance = $invoice->total_amount - $totalPaid;
            $newStatus = $this->calculateInvoiceStatus($totalPaid, $invoice->total_amount, $invoice->due_date);

            $oldAmountPaid = $invoice->amount_paid;
            $oldBalance = $invoice->balance_amount;
            $oldStatus = $invoice->status;

            // Update invoice
            $invoice->update([
                'amount_paid' => $totalPaid,
                'balance_amount' => $newBalance,
                'status' => $newStatus
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Invoice amounts synchronized successfully',
                'data' => [
                    'invoice_id' => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'changes' => [
                        'amount_paid' => [
                            'old' => $oldAmountPaid,
                            'new' => $totalPaid,
                            'difference' => $totalPaid - $oldAmountPaid
                        ],
                        'balance_amount' => [
                            'old' => $oldBalance,
                            'new' => $newBalance,
                            'difference' => $newBalance - $oldBalance
                        ],
                        'status' => [
                            'old' => $oldStatus,
                            'new' => $newStatus,
                            'changed' => $oldStatus !== $newStatus
                        ]
                    ],
                    'payment_breakdown' => [
                        'direct_payments' => $directPaymentsAmount,
                        'allocated_payments' => $allocatedPaymentsAmount,
                        'total' => $totalPaid
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to sync invoice amounts', [
                'invoice_id' => $id,
                'error' => $e->getMessage()
            ]);
            return response()->json(['message' => 'Failed to sync invoice amounts', 'error' => $e->getMessage()], 500);
        }
    }

    public function productBatchList()
    {
        $company = $this->getCompanyFromRequest();
        if (!$company) {
            return response()->json(['error' => 'Company not found'], 404);
        }

        $receiptItems = \App\Models\ProductReceiptItem::where('company_id', $company->id)
            ->with(['product', 'productReceipt'])
            ->orderByDesc('created_at')
            ->get();

        $productBatches = [];
        foreach ($receiptItems as $item) {
            $productId = $item->product_id;

            if (!isset($productBatches[$productId])) {
                $productBatches[$productId] = [
                    'product_id' => $item->product->id,
                    'product_code' => $item->product->product_code,
                    'product_name' => $item->product->name,
                    'stock_quantity' => $item->product->stock_quantity,
                    'unit_cost' => (float) $item->product->unit_cost,
                    'price' => (float) $item->product->price,
                    'batches' => [],
                ];
            }

            $productBatches[$productId]['batches'][] = [
                'batch_number' => $item->batch_number,
                'expiry_date' => $item->expiry_date,
                'manufacture_date' => $item->manufacture_date,
                'quantity' => $item->quantity,
                'receipt_number' => $item->productReceipt->product_receipt_number,
                'supplier' => $item->supplier,
            ];
        }

        return response()->json(array_values($productBatches));
    }

    private function getCompanyFromRequest()
    {
        if (auth()->check()) {
            return auth()->user()->company;
        }
        return \App\Models\Company::where('name', 'Nescopharm')
            ->where('id', '!=', 'ef6df756-29ac-4153-a4c4-cc702c7956bd')
            ->first();
    }
}
