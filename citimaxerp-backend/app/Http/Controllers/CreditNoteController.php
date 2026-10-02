<?php

namespace App\Http\Controllers;

use App\Models\CreditNote;
use App\Models\CreditNoteLineItem;
use App\Models\CreditNoteRefund;
use App\Models\CompanyEtimsConfig;
use App\Models\Customer;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use App\Http\Traits\HandlesDatabaseErrors;
use App\Services\TaxCompliance\EtimsCreditNoteService;
use App\Services\TaxCompliance\EtimsTaxType;

class CreditNoteController extends Controller
{
    use HandlesDatabaseErrors;

    public function __construct(private readonly EtimsCreditNoteService $etimsCreditNoteService)
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, string $permission, ?string $resourceCompanyId = null): bool
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role)
            return false;
        if ($role->hasPermission('can_manage_system'))
            return true;
        if ($role->hasPermission('can_manage_company')) {
            return $resourceCompanyId === null || $user->company_id === $resourceCompanyId;
        }
        return $role->hasPermission($permission);
    }

    // -------------------------------------------------------------------------
    // CRUD
    // -------------------------------------------------------------------------

    /**
     * List credit notes for the authenticated company.
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

                $query = CreditNote::with(['customer', 'invoice', 'createdBy', 'refunds'])
                    ->where('company_id', $companyId);

                if ($request->has('invoice_id')) {
                    $query->where('invoice_id', $request->invoice_id);
                }
                if ($request->has('customer_id')) {
                    $query->where('customer_id', $request->customer_id);
                }
                if ($request->has('status')) {
                    $query->where('status', $request->status);
                }

                $creditNotes = $query->orderBy('created_at', 'desc')
                    ->paginate($request->get('per_page', 15));

                return response()->json($creditNotes);
            });
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching credit notes');
        }
    }

    /**
     * Create a new credit note linked to an invoice.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_create_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'invoice_id' => 'required|exists:invoices,id',
            'customer_id' => 'nullable|exists:customers,id',
            'credit_note_date' => 'required|date',
            'expiry_date' => 'nullable|date|after_or_equal:credit_note_date',
            'reason' => 'nullable|string',
            'currency' => 'sometimes|string|size:3',
            'notes' => 'nullable|string',
            'generate_etims_receipt' => 'sometimes|boolean',
            'line_items' => 'required|array|min:1',
            'line_items.*.product_id' => 'nullable|exists:products,id',
            'line_items.*.variant_id' => 'nullable|exists:product_variants,id',
            'line_items.*.description' => 'required|string',
            'line_items.*.quantity' => 'required|numeric|min:0.01',
            'line_items.*.unit' => 'sometimes|string',
            'line_items.*.unit_price' => 'required|numeric|min:0',
            'line_items.*.discount_amount' => 'sometimes|numeric|min:0',
            'line_items.*.tax_rate' => 'sometimes|numeric|min:0|max:100',
            'line_items.*.etims_tax_type_code' => 'sometimes|nullable|in:A,B,C,D,E',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            // Ensure the invoice belongs to the same company
            $invoice = Invoice::where('company_id', $companyId)
                ->findOrFail($request->invoice_id);

            DB::beginTransaction();

            $creditNote = CreditNote::create([
                'company_id' => $companyId,
                'customer_id' => $request->customer_id ?? $invoice->customer_id,
                'invoice_id' => $invoice->id,
                'created_by' => $user->id,
                'status' => 'draft',
                'credit_note_date' => $request->credit_note_date,
                'expiry_date' => $request->expiry_date,
                'reason' => $request->reason,
                'currency' => $request->currency ?? $invoice->currency ?? 'KES',
                'notes' => $request->notes,
                'subtotal' => 0,
                'tax_amount' => 0,
                'discount_amount' => 0,
                'total_amount' => 0,
                'amount_applied' => 0,
                'amount_refunded' => 0,
                'balance_amount' => 0,
                'etims_requested' => $request->boolean('generate_etims_receipt', true),
            ]);

            foreach ($request->line_items as $lineItemData) {
                CreditNoteLineItem::create([
                    'credit_note_id' => $creditNote->id,
                    'product_id' => $lineItemData['product_id'] ?? null,
                    'variant_id' => $lineItemData['variant_id'] ?? null,
                    'description' => $lineItemData['description'],
                    'quantity' => $lineItemData['quantity'],
                    'unit' => $lineItemData['unit'] ?? 'pcs',
                    'unit_price' => $lineItemData['unit_price'],
                    'discount_amount' => $lineItemData['discount_amount'] ?? 0,
                    'tax_rate' => $lineItemData['tax_rate'] ?? 0,
                    'metadata' => [
                        'etims_tax_type_code' => EtimsTaxType::fromInput(
                            $lineItemData['etims_tax_type_code'] ?? null,
                            $lineItemData['tax_rate'] ?? 0,
                        ),
                    ],
                ]);
            }

            // Recalculate totals from line items
            $creditNote->load('lineItems');
            $creditNote->calculateTotals();

            DB::commit();

            return response()->json([
                'message' => 'Credit note created successfully',
                'data' => $creditNote->load(['customer', 'invoice', 'lineItems', 'refunds']),
            ], 201);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            DB::rollBack();
            return response()->json(['message' => 'Invoice not found or does not belong to your company'], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create credit note', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to create credit note', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Show a single credit note.
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

                $creditNote = CreditNote::with([
                    'customer',
                    'invoice',
                    'lineItems.product',
                    'lineItems.variant',
                    'createdBy',
                    'refunds',
                ])->where('company_id', $companyId)->findOrFail($id);

                return response()->json($creditNote);
            });
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching credit note');
        }
    }

    /**
     * Update a draft credit note.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $creditNote = CreditNote::where('company_id', $companyId)->findOrFail($id);

        if (!$creditNote->isDraft()) {
            return response()->json([
                'message' => 'Only draft credit notes can be updated. Current status: ' . $creditNote->status,
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'credit_note_date' => 'sometimes|date',
            'expiry_date' => 'sometimes|nullable|date',
            'reason' => 'sometimes|nullable|string',
            'notes' => 'sometimes|nullable|string',
            'generate_etims_receipt' => 'sometimes|boolean',
            'line_items' => 'sometimes|array|min:1',
            'line_items.*.product_id' => 'nullable|exists:products,id',
            'line_items.*.variant_id' => 'nullable|exists:product_variants,id',
            'line_items.*.description' => 'required_with:line_items|string',
            'line_items.*.quantity' => 'required_with:line_items|numeric|min:0.01',
            'line_items.*.unit' => 'sometimes|string',
            'line_items.*.unit_price' => 'required_with:line_items|numeric|min:0',
            'line_items.*.discount_amount' => 'sometimes|numeric|min:0',
            'line_items.*.tax_rate' => 'sometimes|numeric|min:0|max:100',
            'line_items.*.etims_tax_type_code' => 'sometimes|nullable|in:A,B,C,D,E',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $creditNote->update($request->only([
                'credit_note_date',
                'expiry_date',
                'reason',
                'notes',
            ]));
            if ($request->has('generate_etims_receipt')) {
                $creditNote->update(['etims_requested' => $request->boolean('generate_etims_receipt')]);
            }

            if ($request->has('line_items')) {
                $creditNote->lineItems()->delete();

                foreach ($request->line_items as $lineItemData) {
                    CreditNoteLineItem::create([
                        'credit_note_id' => $creditNote->id,
                        'product_id' => $lineItemData['product_id'] ?? null,
                        'variant_id' => $lineItemData['variant_id'] ?? null,
                        'description' => $lineItemData['description'],
                        'quantity' => $lineItemData['quantity'],
                        'unit' => $lineItemData['unit'] ?? 'pcs',
                        'unit_price' => $lineItemData['unit_price'],
                        'discount_amount' => $lineItemData['discount_amount'] ?? 0,
                        'tax_rate' => $lineItemData['tax_rate'] ?? 0,
                        'metadata' => [
                            'etims_tax_type_code' => EtimsTaxType::fromInput(
                                $lineItemData['etims_tax_type_code'] ?? null,
                                $lineItemData['tax_rate'] ?? 0,
                            ),
                        ],
                    ]);
                }

                $creditNote->load('lineItems');
                $creditNote->calculateTotals();
            }

            DB::commit();

            return response()->json([
                'message' => 'Credit note updated successfully',
                'data' => $creditNote->load(['customer', 'invoice', 'lineItems', 'refunds']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update credit note', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to update credit note', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete a draft credit note.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_delete_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $creditNote = CreditNote::where('company_id', $companyId)->findOrFail($id);

        if (!$creditNote->isDraft()) {
            return response()->json([
                'message' => 'Only draft credit notes can be deleted. Current status: ' . $creditNote->status,
            ], 400);
        }

        try {
            DB::beginTransaction();
            $creditNote->lineItems()->delete();
            $creditNote->delete();
            DB::commit();

            return response()->json(['message' => 'Credit note deleted successfully']);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to delete credit note', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to delete credit note', 'error' => $e->getMessage()], 500);
        }
    }

    // -------------------------------------------------------------------------
    // Special Actions
    // -------------------------------------------------------------------------

    /**
     * Issue a draft credit note (draft → issued).
     */
    public function issueCredit(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $creditNote = CreditNote::where('company_id', $companyId)->findOrFail($id);

        if (!$creditNote->isDraft()) {
            return response()->json([
                'message' => 'Only draft credit notes can be issued. Current status: ' . $creditNote->status,
            ], 400);
        }

        if ($creditNote->total_amount <= 0) {
            return response()->json(['message' => 'Credit note must have a total amount greater than zero'], 400);
        }

        $etimsConfig = CompanyEtimsConfig::query()
            ->where('company_id', $companyId)
            ->where('country_code', 'KE')
            ->notSuperseded()
            ->whereRaw('enabled = true')
            ->first();
        $original = Invoice::where('company_id', $companyId)->find($creditNote->invoice_id);
        if ($etimsConfig && $creditNote->etims_requested && $original?->etims_status === 'completed') {
            if (! in_array($creditNote->etims_status, ['submitted', 'completed'], true)) {
                try {
                    $submission = $this->etimsCreditNoteService->submit($creditNote);
                } catch (\Throwable $e) {
                    Log::warning('eTIMS credit-note submission failed', [
                        'credit_note' => $creditNote->id,
                        'original_invoice' => $original->id,
                        'error' => $e->getMessage(),
                    ]);

                    return response()->json([
                        'message' => 'Could not raise the credit note on eTIMS.',
                        'error' => $e->getMessage(),
                    ], 422);
                }
                if (! in_array($submission->status, ['pending', 'completed'], true)) {
                    return response()->json([
                        'message' => 'Could not raise the credit note on eTIMS.',
                        'error' => $submission->errorMessage ?: 'DigiTax rejected the credit-note request.',
                        'etims_status' => $submission->status,
                    ], 422);
                }
            }
        } elseif ($etimsConfig && $creditNote->etims_requested && $original
            && ($original->etims_requested || $original->etims_status !== null)) {
            return response()->json([
                'message' => 'Cannot issue this credit note until the original invoice has completed eTIMS submission.',
                'original_etims_status' => $original->etims_status,
            ], 422);
        }

        try {
            DB::beginTransaction();

            $creditNote->loadMissing('lineItems');

            foreach ($creditNote->lineItems as $lineItem) {
                $this->restoreInventoryForCreditNoteLineItem($creditNote, $lineItem, $user->id);
            }

            $creditNote->update([
                'status' => 'issued',
                'issued_at' => now(),
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Credit note issued successfully',
                'data' => $creditNote->fresh(['customer', 'invoice', 'lineItems', 'refunds']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to issue credit note', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to issue credit note', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Apply a credit note against its linked invoice (or another invoice for the same customer).
     *
     * Reduces invoice balance_amount and the credit note's balance_amount atomically.
     */
    public function applyToInvoice(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'invoice_id' => 'required|exists:invoices,id',
            'amount' => 'sometimes|numeric|min:0.01', // optional: defaults to full remaining balance
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $creditNote = CreditNote::where('company_id', $companyId)->findOrFail($id);

        if (!$creditNote->isIssued()) {
            return response()->json([
                'message' => 'Only issued credit notes can be applied. Current status: ' . $creditNote->status,
            ], 400);
        }

        if (!$creditNote->hasRemainingCredit()) {
            return response()->json(['message' => 'This credit note has no remaining balance to apply'], 400);
        }

        $invoice = Invoice::where('company_id', $companyId)
            ->where('customer_id', $creditNote->customer_id)
            ->findOrFail($request->invoice_id);

        if ($invoice->balance_amount <= 0) {
            return response()->json([
                'message' => 'The invoice has no outstanding balance',
                'error_code' => 'INVOICE_NO_OUTSTANDING_BALANCE',
                'ui_hint' => [
                    'primary_action' => 'choose_another_invoice_or_refund',
                    'show_unapplied_credit_panel' => true,
                ],
                'customer_credit_context' => $this->getCustomerUnappliedCreditContext($companyId, $creditNote->customer_id),
            ], 400);
        }

        // Determine amount to apply
        $requestedAmount = $request->get('amount', $creditNote->balance_amount);
        $applyAmount = min(
            (float) $requestedAmount,
            (float) $creditNote->balance_amount,
            (float) $invoice->balance_amount
        );

        if ($applyAmount <= 0) {
            return response()->json(['message' => 'Nothing to apply'], 400);
        }

        try {
            DB::beginTransaction();

            // Update Invoice
            $newInvoiceAmountPaid = (float) $invoice->amount_paid + $applyAmount;
            $newInvoiceBalance = (float) $invoice->total_amount - $newInvoiceAmountPaid;
            $newInvoiceStatus = $newInvoiceBalance <= 0 ? 'paid' : $invoice->status;

            $invoice->update([
                'amount_paid' => $newInvoiceAmountPaid,
                'balance_amount' => max(0, $newInvoiceBalance),
                'status' => $newInvoiceStatus,
                'paid_at' => $newInvoiceStatus === 'paid' ? ($invoice->paid_at ?? now()) : $invoice->paid_at,
            ]);

            // Update Credit Note
            $newCreditAmountApplied = (float) $creditNote->amount_applied + $applyAmount;
            $newCreditBalance = (float) $creditNote->total_amount - $newCreditAmountApplied - (float) $creditNote->amount_refunded;
            $newCreditStatus = $newCreditBalance <= 0 ? 'applied' : 'issued';

            $creditNote->update([
                'amount_applied' => $newCreditAmountApplied,
                'balance_amount' => max(0, $newCreditBalance),
                'status' => $newCreditStatus,
                'applied_at' => $newCreditStatus === 'applied' ? now() : $creditNote->applied_at,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Credit note applied successfully',
                'applied' => $applyAmount,
                'credit_note' => $creditNote->fresh(['refunds']),
                'invoice' => $invoice->fresh(),
                'customer_credit_context' => $this->getCustomerUnappliedCreditContext($companyId, $creditNote->customer_id),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to apply credit note', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to apply credit note', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Refund a credit note balance back to the customer.
     */
    public function refundCredit(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'sometimes|numeric|min:0.01',
            'refund_reason' => 'required|string|max:255',
            'refund_method' => 'nullable|string|max:100',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'refund_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $creditNote = CreditNote::where('company_id', $companyId)->findOrFail($id);

        if (!$creditNote->isIssued()) {
            return response()->json([
                'message' => 'Only issued credit notes can be refunded. Current status: ' . $creditNote->status,
            ], 400);
        }

        if (!$creditNote->hasRemainingCredit()) {
            return response()->json(['message' => 'This credit note has no remaining balance to refund'], 400);
        }

        $requestedAmount = $request->get('amount', $creditNote->balance_amount);
        $refundAmount = min(
            (float) $requestedAmount,
            (float) $creditNote->balance_amount
        );

        if ($refundAmount <= 0) {
            return response()->json(['message' => 'Nothing to refund'], 400);
        }

        try {
            DB::beginTransaction();

            $newAmountRefunded = (float) $creditNote->amount_refunded + $refundAmount;
            $newCreditBalance = (float) $creditNote->total_amount - (float) $creditNote->amount_applied - $newAmountRefunded;
            $newCreditStatus = $newCreditBalance <= 0
                ? ((float) $creditNote->amount_applied > 0 ? 'applied' : 'refunded')
                : 'issued';

            $creditNote->update([
                'amount_refunded' => $newAmountRefunded,
                'balance_amount' => max(0, $newCreditBalance),
                'status' => $newCreditStatus,
                'refunded_at' => now(),
            ]);

            $refund = CreditNoteRefund::create([
                'credit_note_id' => $creditNote->id,
                'company_id' => $companyId,
                'customer_id' => $creditNote->customer_id,
                'invoice_id' => $creditNote->invoice_id,
                'created_by' => $user->id,
                'amount' => $refundAmount,
                'refund_date' => $request->input('refund_date', now()->toDateString()),
                'refund_method' => $request->input('refund_method'),
                'reference' => $request->input('reference'),
                'reason' => $request->input('refund_reason'),
                'notes' => $request->input('notes'),
                'metadata' => [
                    'source' => 'credit_note_refund',
                ],
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Credit note refunded successfully',
                'refunded' => $refundAmount,
                'refund' => $refund,
                'credit_note' => $creditNote->fresh(['refunds']),
                'customer_credit_context' => $this->getCustomerUnappliedCreditContext($companyId, $creditNote->customer_id),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to refund credit note', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to refund credit note', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Return unapplied credit summary and open invoices for a specific customer.
     */
    public function getCustomerUnappliedCredits(Request $request, string $customerId): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $customer = Customer::where('company_id', $companyId)->find($customerId);
        if (!$customer) {
            return response()->json(['message' => 'Customer not found or does not belong to your company'], 404);
        }

        return response()->json([
            'customer' => $customer->only(['id', 'name', 'email', 'phone', 'customer_number']),
            'context' => $this->getCustomerUnappliedCreditContext($companyId, $customerId),
        ]);
    }

    /**
     * Void a credit note (cannot be un-voided).
     */
    public function voidCredit(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_update_invoices', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $creditNote = CreditNote::where('company_id', $companyId)->findOrFail($id);

        if ($creditNote->isVoid()) {
            return response()->json(['message' => 'Credit note is already voided'], 400);
        }

        if ($creditNote->amount_applied > 0 || $creditNote->amount_refunded > 0) {
            return response()->json([
                'message' => 'Cannot void a credit note that has already been consumed (applied or refunded)',
            ], 400);
        }

        try {
            $creditNote->update([
                'status' => 'void',
                'voided_at' => now(),
            ]);

            return response()->json([
                'message' => 'Credit note voided successfully',
                'data' => $creditNote->fresh(['refunds']),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to void credit note', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to void credit note', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Build customer credit context used by API responses and UI guidance.
     */
    protected function getCustomerUnappliedCreditContext(string $companyId, string $customerId): array
    {
        $unappliedCreditNotes = CreditNote::where('company_id', $companyId)
            ->where('customer_id', $customerId)
            ->where('status', 'issued')
            ->where('balance_amount', '>', 0)
            ->orderBy('credit_note_date')
            ->get([
                'id',
                'credit_note_number',
                'invoice_id',
                'credit_note_date',
                'expiry_date',
                'currency',
                'total_amount',
                'amount_applied',
                'amount_refunded',
                'balance_amount',
            ]);

        $openInvoices = Invoice::where('company_id', $companyId)
            ->where('customer_id', $customerId)
            ->where('balance_amount', '>', 0)
            ->orderBy('due_date')
            ->get([
                'id',
                'invoice_number',
                'invoice_date',
                'due_date',
                'total_amount',
                'amount_paid',
                'balance_amount',
                'currency',
                'status',
            ]);

        $unappliedTotal = (float) $unappliedCreditNotes->sum('balance_amount');
        $openInvoiceBalance = (float) $openInvoices->sum('balance_amount');

        return [
            'unapplied_credit_total' => $unappliedTotal,
            'open_invoice_balance_total' => $openInvoiceBalance,
            'open_invoices_count' => $openInvoices->count(),
            'unapplied_credit_notes_count' => $unappliedCreditNotes->count(),
            'suggested_next_action' => $openInvoices->isNotEmpty() ? 'apply_to_open_invoice' : 'refund_credit_note',
            'open_invoices' => $openInvoices,
            'unapplied_credit_notes' => $unappliedCreditNotes,
        ];
    }

    protected function restoreInventoryForCreditNoteLineItem(CreditNote $creditNote, CreditNoteLineItem $lineItem, string $userId): void
    {
        $quantity = (int) round((float) $lineItem->quantity);

        if ($quantity <= 0 || !$lineItem->product_id) {
            return;
        }

        $product = Product::where('company_id', $creditNote->company_id)->find($lineItem->product_id);

        if (!$product || !$product->track_inventory) {
            return;
        }

        $variant = null;
        $inventoryModel = $product;

        if ($lineItem->variant_id) {
            $variant = ProductVariant::where('company_id', $creditNote->company_id)
                ->where('product_id', $product->id)
                ->find($lineItem->variant_id);

            if ($variant) {
                $inventoryModel = $variant;
            }
        }

        $quantityBefore = (int) ($inventoryModel->stock_quantity ?? 0);
        $quantityAfter = $quantityBefore + $quantity;

        $inventoryModel->update([
            'stock_quantity' => $quantityAfter,
        ]);

        InventoryMovement::create([
            'company_id' => $creditNote->company_id,
            'store_id' => $inventoryModel->store_id ?? $product->store_id,
            'product_id' => $product->id,
            'variant_id' => $variant?->id,
            'type' => 'return',
            'quantity' => $quantity,
            'quantity_before' => $quantityBefore,
            'quantity_after' => $quantityAfter,
            'reference_type' => 'credit_note',
            'reference_id' => $creditNote->id,
            'reference_number' => $creditNote->credit_note_number,
            'unit_cost' => $variant?->cost ?? $product->unit_cost,
            'unit_price' => $lineItem->unit_price,
            'total_cost' => $quantity * (float) ($variant?->cost ?? $product->unit_cost ?? 0),
            'total_value' => $quantity * (float) $lineItem->unit_price,
            'movement_date' => now(),
            'created_by' => $userId,
            'notes' => 'Inventory restored from issued credit note',
            'metadata' => [
                'credit_note_id' => $creditNote->id,
                'credit_note_line_item_id' => $lineItem->id,
            ],
        ]);
    }

    /**
     * Get all credit notes for a specific invoice.
     */
    public function getByInvoice(Request $request, string $invoiceId): JsonResponse
    {
        try {
            return $this->executeWithRetry(function () use ($request, $invoiceId) {
                $user = $request->user();
                $companyId = $user->company_id;

                if (!$this->hasPermission($request, 'can_view_invoices', $companyId)) {
                    return response()->json(['message' => 'Unauthorized'], 403);
                }

                // Verify invoice belongs to company
                $invoice = Invoice::where('company_id', $companyId)->findOrFail($invoiceId);

                $creditNotes = CreditNote::with(['lineItems', 'createdBy', 'refunds'])
                    ->where('company_id', $companyId)
                    ->where('invoice_id', $invoiceId)
                    ->orderBy('created_at', 'desc')
                    ->get();

                return response()->json([
                    'invoice' => $invoice->only(['id', 'invoice_number', 'total_amount', 'amount_paid', 'balance_amount', 'status']),
                    'credit_notes' => $creditNotes,
                    'total_credits_issued' => $creditNotes->where('status', '!=', 'void')->sum('total_amount'),
                    'total_credits_applied' => $creditNotes->sum('amount_applied'),
                    'total_credits_refunded' => $creditNotes->sum('amount_refunded'),
                    'total_credits_available' => $creditNotes->sum('balance_amount'),
                ]);
            });
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching credit notes for invoice');
        }
    }
}
