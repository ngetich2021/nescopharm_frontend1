<?php

namespace App\Http\Controllers;

use App\Models\CreditNote;
use App\Models\CreditNoteLineItem;
use App\Models\CreditNoteRefund;
use App\Models\CompanyEtimsConfig;
use App\Models\Customer;
use App\Models\InventoryBatch;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use App\Http\Traits\HandlesDatabaseErrors;
use App\Services\CreditNoteService;
use App\Services\PackagingCalculatorService;
use App\Services\TaxCompliance\EtimsCreditNoteService;
use App\Services\TaxCompliance\EtimsTaxType;

class CreditNoteController extends Controller
{
    use HandlesDatabaseErrors;

    public function __construct(
        private readonly EtimsCreditNoteService $etimsCreditNoteService,
        private readonly CreditNoteService $creditNotes,
    ) {
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

                $query = CreditNote::with(['customer', 'invoice', 'createdBy', 'refunds', 'approvals.approver'])
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

                // By the date chosen on the credit note, not the day it was keyed in.
                $creditNotes = $query->orderBy('credit_note_date', 'desc')
                    ->orderBy('created_at', 'desc')
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
        ] + $this->approverRules(true), $this->approverMessages());

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        $approverCheck = new CreditNote(['company_id' => $companyId, 'created_by' => $user->id]);
        if ($message = $this->approverProblem($approverCheck, $request->approver_ids, $user->id)) {
            return response()->json(['message' => $message], 422);
        }

        try {
            // Ensure the invoice belongs to the same company
            $invoice = Invoice::where('company_id', $companyId)
                ->findOrFail($request->invoice_id);

            DB::beginTransaction();

            $creditNote = CreditNote::create([
                'company_id' => $companyId,
                // Always the customer the invoice is on now, or the credit lands on the wrong account.
                'customer_id' => $invoice->customer_id,
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

            if ($message = $this->overCreditMessage($invoice, $creditNote)) {
                DB::rollBack();
                return response()->json(['message' => $message], 422);
            }

            // Not credited until both chosen approvers approve it.
            $this->startApprovals($creditNote, $request->approver_ids);

            DB::commit();

            return response()->json([
                'message' => 'Credit note created and sent to the 2 approvers. It is credited once both approve it.',
                'data' => $creditNote->load(['customer', 'invoice', 'lineItems', 'refunds', 'approvals.approver']),
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

                // Its approvers may open it to decide, even without access to invoices.
                $isApprover = \App\Models\CreditNoteApproval::where('credit_note_id', $id)->where('approver_id', $user->id)->exists();
                if (!$isApprover && !$this->hasPermission($request, 'can_view_invoices', $companyId)) {
                    return response()->json(['message' => 'Unauthorized'], 403);
                }

                $creditNote = CreditNote::with([
                    'customer',
                    'invoice',
                    'lineItems.product',
                    'lineItems.variant',
                    'createdBy',
                    'refunds',
                    'approvals.approver',
                ])->where('company_id', $companyId)->findOrFail($id);

                return response()->json($creditNote);
            });
        } catch (\Exception $e) {
            return $this->handleDatabaseError($e, 'fetching credit note');
        }
    }

    /**
     * A credit note as its printed document needs it: our company (letterhead, payment details - sent
     * here so no "View Company" permission is needed), the customer (business name, address, PIN), the
     * invoice it credits and its date, and each line with its unit and the batches (with expiry) the
     * returned goods went back into - else the batches the invoice sent them out of.
     */
    public function document(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_invoices', $user->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $note = CreditNote::with(['customer', 'invoice', 'lineItems', 'createdBy'])
            ->where('company_id', $user->company_id)->find($id);
        if (!$note) {
            return response()->json(['message' => 'Credit note not found.'], 404);
        }

        // Batches the returned stock went back into, per product (variant).
        $moved = InventoryMovement::where('reference_type', 'credit_note')->where('reference_id', $note->id)
            ->whereNotNull('batch_id')->get(['product_id', 'variant_id', 'batch_id', 'quantity']);
        $batchRows = InventoryBatch::whereIn('id', $moved->pluck('batch_id')->unique())->get(['id', 'batch_number', 'expiry_date'])->keyBy('id');
        $returnedBatches = $moved->groupBy(fn ($m) => $m->product_id . '|' . ($m->variant_id ?? ''))
            ->map(fn ($rows) => $rows->groupBy('batch_id')->map(fn ($r, $batchId) => [
                'batch_number' => $batchRows[$batchId]->batch_number ?? null,
                'expiry_date' => isset($batchRows[$batchId]) && $batchRows[$batchId]->expiry_date ? substr((string) $batchRows[$batchId]->expiry_date, 0, 10) : null,
                'quantity' => (float) $r->sum('quantity'),
            ])->values()->all());

        // Else the batches the invoice line carried.
        $invoiceBatches = [];
        if ($note->invoice_id) {
            foreach (\App\Models\InvoiceLineItem::where('invoice_id', $note->invoice_id)->get() as $il) {
                $key = $il->product_id . '|' . ($il->variant_id ?? '');
                $batches = $il->metadata['batches'] ?? (($il->batch_number ?? null) || ($il->expiry_date ?? null)
                    ? [['batch_number' => $il->batch_number ?? null, 'expiry_date' => $il->expiry_date ?? null, 'quantity' => null]] : []);
                $invoiceBatches[$key] = array_map(fn ($b) => [
                    'batch_number' => $b['batch_number'] ?? null,
                    'expiry_date' => !empty($b['expiry_date']) ? substr((string) $b['expiry_date'], 0, 10) : null,
                    'quantity' => null,
                ], $batches);
            }
        }

        $company = \App\Models\Company::find($note->company_id);
        $customer = $note->customer;
        $by = $note->createdBy;

        return response()->json([
            'status' => 'success',
            'data' => [
                'id' => $note->id,
                'number' => $note->credit_note_number,
                'status' => $note->status,
                'date' => $note->credit_note_date ? substr((string) $note->credit_note_date, 0, 10) : null,
                'reason' => $note->reason,
                'notes' => $note->notes,
                'invoice_number' => $note->invoice?->invoice_number,
                'invoice_date' => $note->invoice?->invoice_date ? substr((string) $note->invoice->invoice_date, 0, 10) : null,
                'prepared_by' => $by ? trim(($by->first_name ?? '') . ' ' . ($by->last_name ?? '')) ?: ($by->name ?? null) : null,
                // From the invoice it credits, as the Tally credit note prints them.
                'mode_of_payment' => $note->invoice?->mode_of_payment,
                'buyers_order_no' => $note->invoice?->buyers_order_no,
                'buyers_order_date' => $note->invoice?->buyers_order_date ? substr((string) $note->invoice->buyers_order_date, 0, 10) : null,
                'dispatch_doc_no' => $note->invoice?->dispatch_doc_no,
                'dispatched_through' => $note->invoice?->dispatched_through,
                'destination' => $note->invoice?->destination,
                'terms_of_delivery' => $note->invoice?->terms_of_delivery,
                'other_references' => $note->invoice?->other_references,
                'company' => $company ? $company->only([
                    'id', 'name', 'email', 'phone', 'address', 'city', 'state', 'country', 'postal_code', 'website',
                    'logo_url', 'letterhead_url', 'bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch',
                    'mpesa_paybill', 'mpesa_account_number',
                ]) : null,
                'customer' => $customer ? $customer->only([
                    'id', 'name', 'business_name', 'customer_type', 'address', 'city', 'state', 'country', 'postal_code',
                    'county', 'region', 'phone', 'email', 'pin_number',
                ]) : null,
                'lines' => $note->lineItems->values()->map(function ($l) use ($returnedBatches, $invoiceBatches) {
                    $key = $l->product_id . '|' . ($l->variant_id ?? '');
                    return [
                        'name' => $l->description,
                        'unit' => $l->unit ?: 'pcs',
                        'quantity' => (float) $l->quantity,
                        'unit_price' => round((float) $l->unit_price, 2),
                        'discount_amount' => round((float) $l->discount_amount, 2),
                        'tax_rate' => (float) $l->tax_rate,
                        'tax_amount' => round((float) $l->tax_amount, 2),
                        'amount' => round((float) $l->line_total, 2),
                        'batches' => $returnedBatches[$key] ?? $invoiceBatches[$key] ?? [],
                    ];
                })->all(),
                'subtotal' => round((float) $note->subtotal, 2),
                'discount_amount' => round((float) $note->discount_amount, 2),
                'tax_amount' => round((float) $note->tax_amount, 2),
                'total' => round((float) $note->total_amount, 2),
            ],
        ]);
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
        ] + $this->approverRules(false), $this->approverMessages());

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        if ($request->has('approver_ids') && ($message = $this->approverProblem($creditNote, $request->approver_ids))) {
            return response()->json(['message' => $message], 422);
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

                $invoice = Invoice::where('company_id', $companyId)->find($creditNote->invoice_id);
                if ($invoice && ($message = $this->overCreditMessage($invoice, $creditNote))) {
                    DB::rollBack();
                    return response()->json(['message' => $message], 422);
                }
            }

            // A changed credit note is approved afresh: earlier approvals were for what it said before.
            // (One from before approvals began stays outside them unless approvers are given.)
            $approverIds = $request->approver_ids ?? $creditNote->approvals()->pluck('approver_id')->all();
            $restarted = count($approverIds) === 2;
            if ($restarted) {
                $this->startApprovals($creditNote, $approverIds);
            }

            DB::commit();

            return response()->json([
                'message' => $restarted
                    ? 'Credit note updated and sent to the 2 approvers again. It is credited once both approve it.'
                    : 'Credit note updated successfully',
                'data' => $creditNote->load(['customer', 'invoice', 'lineItems', 'refunds', 'approvals.approver']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update credit note', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to update credit note', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete a credit note. An issued or applied one is unwound first (credit off its invoices,
     * returned stock back out), so it can be entered afresh. Only one KRA has signed stays.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_delete_invoices', $companyId)
            && !$this->hasPermission($request, 'can_delete_credit_notes', $companyId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $creditNote = CreditNote::where('company_id', $companyId)->findOrFail($id);

        if ($creditNote->on_live_etims) {
            return response()->json([
                'message' => 'This credit note is on eTIMS, so it cannot be deleted. Void it instead.',
            ], 400);
        }

        try {
            $this->creditNotes->delete($creditNote);

            return response()->json(['message' => 'Credit note deleted successfully']);

        } catch (\Exception $e) {
            Log::error('Failed to delete credit note', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to delete credit note', 'error' => $e->getMessage()], 500);
        }
    }

    // -------------------------------------------------------------------------
    // Approvals: the creator picks two people; both must approve (with a comment)
    // before the credit note is credited. Either rejecting stops it.
    // -------------------------------------------------------------------------

    /** People who can be picked as approvers: active users of the company other than the one asking. */
    public function approverOptions(Request $request): JsonResponse
    {
        $user = $request->user();

        $users = \App\Models\User::where('company_id', $user->company_id)
            ->where('id', '!=', $user->id)
            ->whereRaw('users.is_active = true')
            ->whereNull('terminated_at')
            ->with('role:id,name')
            ->orderBy('first_name')->orderBy('last_name')
            ->get(['id', 'first_name', 'last_name', 'email', 'role_id'])
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => trim("{$u->first_name} {$u->last_name}") ?: $u->email,
                'role' => $u->role?->name,
            ]);

        return response()->json(['data' => $users]);
    }

    /** Send (or send again, after a rejection or with other people) a draft credit note for approval. */
    public function submitForApproval(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $creditNote = CreditNote::where('company_id', $user->company_id)->findOrFail($id);

        if ($creditNote->created_by !== $user->id && !$this->hasPermission($request, 'can_update_invoices', $user->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if (!$creditNote->isDraft()) {
            return response()->json(['message' => 'Only a credit note that has not been credited yet can be sent for approval.'], 400);
        }

        $validator = Validator::make($request->all(), $this->approverRules(true), $this->approverMessages());
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }
        if ($message = $this->approverProblem($creditNote, $request->approver_ids)) {
            return response()->json(['message' => $message], 422);
        }

        DB::transaction(fn () => $this->startApprovals($creditNote, $request->approver_ids));

        return response()->json([
            'message' => 'Sent for approval. It is credited once both approvers approve it.',
            'data' => $creditNote->fresh(['customer', 'invoice', 'lineItems', 'refunds', 'approvals.approver']),
        ]);
    }

    /** An approver approves or rejects, always with a comment. The second approval credits it. */
    public function decideApproval(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $creditNote = CreditNote::where('company_id', $user->company_id)->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'decision' => 'required|in:approve,reject',
            'comment' => 'required|string|min:3|max:1000',
        ], [
            'comment.required' => 'Write a comment, e.g. "Products in good shape".',
            'comment.min' => 'Write a comment, e.g. "Products in good shape".',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        if (!$creditNote->isDraft() || $creditNote->approval_status !== 'pending') {
            return response()->json(['message' => 'This credit note is not waiting for approval.'], 400);
        }

        $approval = $creditNote->approvals()->where('approver_id', $user->id)->where('status', 'pending')->first();
        if (!$approval) {
            return response()->json(['message' => 'You are not one of the approvers still to decide on this credit note.'], 403);
        }

        $approve = $request->decision === 'approve';
        $comment = trim($request->comment);

        $complete = DB::transaction(function () use ($creditNote, $approval, $approve, $comment) {
            $approval->update([
                'status' => $approve ? 'approved' : 'rejected',
                'comment' => $comment,
                'decided_at' => now(),
            ]);
            if (!$approve) {
                $creditNote->update(['approval_status' => 'rejected']);
                return false;
            }
            $allApproved = !$creditNote->approvals()->where('status', '!=', 'approved')->exists();
            if ($allApproved) {
                $creditNote->update(['approval_status' => 'approved']);
            }
            return $allApproved;
        });

        $notifications = app(\App\Services\NotificationService::class);
        $notifications->resolve('credit_note_approval', 'approval_id', $approval->id);
        if (!$approve) {
            // Nothing left for the other approver to decide.
            foreach ($creditNote->approvals()->where('status', 'pending')->pluck('id') as $otherId) {
                $notifications->resolve('credit_note_approval', 'approval_id', $otherId);
            }
        }
        $notifications->notifyDecision(
            $creditNote->created_by,
            "Credit note {$creditNote->credit_note_number}",
            $approve ? 'approved' : 'rejected',
            "/sales/credit-notes/{$creditNote->id}",
            $user->id,
            $comment,
        );

        if (!$approve) {
            return response()->json([
                'message' => 'Rejected. The credit note will not be credited.',
                'data' => $creditNote->fresh(['customer', 'invoice', 'lineItems', 'refunds', 'approvals.approver']),
            ]);
        }

        if (!$complete) {
            return response()->json([
                'message' => 'Approved. It is credited once the other approver approves too.',
                'data' => $creditNote->fresh(['customer', 'invoice', 'lineItems', 'refunds', 'approvals.approver']),
            ]);
        }

        // Both approved: credit it now.
        $issued = $this->issueNow($creditNote->fresh(), $user);
        $body = $issued->getData(true);
        $data = $creditNote->fresh(['customer', 'invoice', 'lineItems', 'refunds', 'approvals.approver']);

        if ($issued->getStatusCode() === 200) {
            $notifications->notifyUser($creditNote->created_by, new \App\Notifications\SystemAlert(
                'approval_result',
                "Credit note {$creditNote->credit_note_number} credited",
                'Both approvers approved it, so it has been credited to the customer.',
                "/sales/credit-notes/{$creditNote->id}",
                ['type' => 'approval_result', 'decision' => 'credited'],
            ), $user->id);

            return response()->json([
                'message' => 'Approved by both. ' . ($body['message'] ?? 'Credit note issued.'),
                'data' => $data,
            ]);
        }

        return response()->json([
            'message' => 'Approved by both, but it could not be credited yet: '
                . trim(($body['message'] ?? '') . ' ' . ($body['error'] ?? ''))
                . ' Use Issue on the credit note to try again.',
            'issue_failed' => true,
            'data' => $data,
        ]);
    }

    private function approverRules(bool $required): array
    {
        return [
            'approver_ids' => ($required ? 'required' : 'sometimes') . '|array|size:2',
            'approver_ids.*' => 'required|uuid|distinct',
        ];
    }

    private function approverMessages(): array
    {
        return [
            'approver_ids.required' => 'Choose the 2 people who will approve this credit note.',
            'approver_ids.size' => 'Choose exactly 2 people to approve this credit note.',
            'approver_ids.*.distinct' => 'Choose 2 different people to approve this credit note.',
        ];
    }

    /** Why these two cannot approve this credit note, or null when they can. */
    private function approverProblem(CreditNote $creditNote, array $ids, ?string $creatorId = null): ?string
    {
        $creatorId ??= $creditNote->created_by;
        if (in_array($creatorId, $ids, true)) {
            return 'Whoever raised the credit note cannot approve it: choose 2 other people.';
        }
        $found = \App\Models\User::where('company_id', $creditNote->company_id)
            ->whereIn('id', $ids)
            ->whereRaw('users.is_active = true')
            ->whereNull('terminated_at')
            ->count();

        return $found === 2 ? null : 'Both approvers must be active users of this company.';
    }

    /** (Re)start approval with these two people: earlier decisions are cleared. Call inside a transaction. */
    private function startApprovals(CreditNote $creditNote, array $ids): void
    {
        $notifications = app(\App\Services\NotificationService::class);
        foreach ($creditNote->approvals()->pluck('id') as $oldId) {
            $notifications->resolve('credit_note_approval', 'approval_id', $oldId);
        }
        $creditNote->approvals()->delete();

        foreach (array_values($ids) as $i => $approverId) {
            $creditNote->approvals()->create([
                'approver_id' => $approverId,
                'position' => $i + 1,
                'status' => 'pending',
            ]);
        }
        $creditNote->update(['approval_status' => 'pending']);

        DB::afterCommit(fn () => $this->notifyApprovers($creditNote->fresh(['approvals', 'customer', 'invoice'])));
    }

    private function notifyApprovers(CreditNote $creditNote): void
    {
        $customer = $creditNote->customer?->business_name ?: ($creditNote->customer?->name ?: 'a customer');
        $invoice = $creditNote->invoice?->file_number ?: $creditNote->invoice?->invoice_number;
        $amount = number_format((float) $creditNote->total_amount, 2);
        $notifications = app(\App\Services\NotificationService::class);

        foreach ($creditNote->approvals->where('status', 'pending') as $approval) {
            $notifications->notifyUser($approval->approver_id, new \App\Notifications\SystemAlert(
                'approval',
                "Credit note {$creditNote->credit_note_number} needs your approval",
                "Credit note of {$creditNote->currency} {$amount} for {$customer}" . ($invoice ? " on invoice {$invoice}" : '')
                    . '. Check the goods returned, then approve or reject it with a comment (e.g. "Products in good shape"). It is credited only when both approvers approve.',
                "/sales/credit-notes/{$creditNote->id}",
                ['type' => 'credit_note_approval', 'approval_id' => $approval->id, 'credit_note_id' => $creditNote->id],
            ), $creditNote->created_by);
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

        // Credited only once both chosen approvers have approved it (each with a comment). Credit
        // notes raised before approvals began (12/11/2026, approval_status empty) issue as before.
        if ($creditNote->approval_status !== null && $creditNote->approval_status !== 'approved') {
            return response()->json([
                'message' => $creditNote->approval_status === 'rejected'
                    ? 'This credit note was rejected, so it cannot be credited. Correct it and send it for approval again.'
                    : 'This credit note cannot be credited until both approvers have approved it.',
            ], 422);
        }

        return $this->issueNow($creditNote, $user);
    }

    /**
     * Credit it: eTIMS (when live), stock back to its batches, status issued and the credit applied
     * to its invoice. Runs when the second approver approves, or from Issue to retry after a failure.
     */
    protected function issueNow(CreditNote $creditNote, $user): JsonResponse
    {
        $companyId = $creditNote->company_id;

        if ($creditNote->total_amount <= 0) {
            return response()->json(['message' => 'Credit note must have a total amount greater than zero'], 400);
        }

        // eTIMS has no say until it is confirmed Live: on Test the credit note simply issues.
        $etimsConfig = CompanyEtimsConfig::query()
            ->where('company_id', $companyId)
            ->where('country_code', 'KE')
            ->live()
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
            && ($original->etims_requested || $original->etims_status !== null)
            // An invoice from before go-live was never going to KRA, so it can't hold its credit note up.
            && !($etimsConfig->go_live_date && $original->invoice_date?->lt($etimsConfig->go_live_date))) {
            return response()->json([
                'message' => 'Cannot issue this credit note until the original invoice has completed eTIMS submission.',
                'original_etims_status' => $original->etims_status,
            ], 422);
        }

        try {
            DB::beginTransaction();

            $creditNote->loadMissing('lineItems');

            // A past sale (before go-live) never moved stock, so crediting it puts none back.
            $pastSale = $original && (
                ($original->order_id && \App\Models\Order::where('id', $original->order_id)->whereRaw('is_historical = true')->exists())
                || \App\Models\Order::isHistoricalDate($original->invoice_date)
            );
            if (!$pastSale) {
                foreach ($creditNote->lineItems as $lineItem) {
                    $this->restoreInventoryForCreditNoteLineItem($creditNote, $lineItem, $user->id);
                }
            }

            $creditNote->update([
                'status' => 'issued',
                'issued_at' => now(),
            ]);

            // An earlier refused attempt no longer applies once it has issued without eTIMS.
            if (!$etimsConfig && !in_array($creditNote->etims_status, ['submitted', 'completed'], true)) {
                $creditNote->update([
                    'etims_status' => null,
                    'etims_last_error' => null,
                    'etims_lock_state' => null,
                    'etims_lock_acquired_at' => null,
                ]);
            }

            // The credit comes off what its invoice still owes. Whatever is left (say the invoice
            // was already paid in money) stays with the customer as credit to use or refund.
            $applied = $original ? $this->creditNotes->apply($creditNote, $original) : 0;

            DB::commit();

            return response()->json([
                'message' => $applied > 0
                    ? 'Credit note issued and ' . number_format($applied, 2) . " credited to invoice {$original->invoice_number}"
                    : 'Credit note issued successfully',
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

        try {
            // Credit, not money: it goes to the invoice's amount_credited, so it shows "Credited".
            $applyAmount = $this->creditNotes->apply($creditNote, $invoice, (float) $request->get('amount', $creditNote->balance_amount));
            if ($applyAmount <= 0) {
                return response()->json(['message' => 'Nothing to apply'], 400);
            }

            return response()->json([
                'message' => 'Credit note applied successfully',
                'applied' => $applyAmount,
                'credit_note' => $creditNote->fresh(['refunds']),
                'invoice' => $invoice->fresh(),
                'customer_credit_context' => $this->getCustomerUnappliedCreditContext($companyId, $creditNote->customer_id),
            ]);

        } catch (\Exception $e) {
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

    // An invoice can't be credited for more than it billed, counting its other live credit notes.
    protected function overCreditMessage(Invoice $invoice, CreditNote $creditNote): ?string
    {
        $otherCredits = (float) CreditNote::where('invoice_id', $invoice->id)
            ->where('id', '!=', $creditNote->id)
            ->where('status', '!=', 'void')
            ->sum('total_amount');
        $available = round((float) $invoice->total_amount - $otherCredits, 2);

        if (round((float) $creditNote->total_amount, 2) <= $available) {
            return null;
        }

        return 'This credit note (' . number_format((float) $creditNote->total_amount, 2) . ') is more than is left to credit on '
            . $invoice->invoice_number . ' (' . number_format(max(0, $available), 2) . ' of ' . number_format((float) $invoice->total_amount, 2) . ').';
    }

    protected function restoreInventoryForCreditNoteLineItem(CreditNote $creditNote, CreditNoteLineItem $lineItem, string $userId): void
    {
        // Lines copied from the invoice keep its unit ("Per pack of 100's"), so stock comes back in pieces.
        $quantity = PackagingCalculatorService::piecesFor($lineItem->quantity, $lineItem->unit);

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

        // Stock is the sum of its batches, so the goods go back into the batches this invoice's
        // sale took them from (less what earlier credit notes on it already returned), and any
        // more into the soonest-expiring batch. Each batch return is its own movement.
        $reference = [
            'reference_type' => 'credit_note',
            'reference_id' => $creditNote->id,
            'reference_number' => $creditNote->credit_note_number,
        ];
        $note = "Returned on credit note {$creditNote->credit_note_number}";
        $remaining = $quantity;
        foreach ($this->batchesSoldOn($creditNote, $product->id, $variant?->id) as $batchId => $sold) {
            $batch = InventoryBatch::find($batchId);
            $back = $batch ? min($remaining, $sold, (int) $batch->quantity_sold) : 0;
            if ($back > 0 && $batch->restoreFromSale($back, $reference, $note)) {
                $remaining -= $back;
            }
            if ($remaining <= 0) {
                return;
            }
        }

        $batch = InventoryBatch::where('company_id', $creditNote->company_id)
            ->where('product_id', $product->id)
            ->when($variant, fn ($q) => $q->where('variant_id', $variant->id), fn ($q) => $q->whereNull('variant_id'))
            ->where(fn ($q) => $q->whereNull('expiry_date')->orWhere('expiry_date', '>=', now()->toDateString()))
            ->orderByRaw('expiry_date IS NULL, expiry_date ASC')
            ->orderBy('received_date')
            ->first();
        if ($batch) {
            $before = (int) $batch->quantity_available;
            $batch->quantity_available = $before + $remaining;
            $batch->quantity_sold = max(0, (int) $batch->quantity_sold - $remaining);
            $batch->save();
            $batch->updateStatus();
            $batch->movements()->create($reference + [
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'company_id' => $batch->company_id,
                'store_id' => $batch->store_id,
                'product_id' => $batch->product_id,
                'variant_id' => $batch->variant_id,
                'type' => 'return',
                'quantity' => $remaining,
                'quantity_before' => $before,
                'quantity_after' => $batch->quantity_available,
                'unit_cost' => $batch->unit_cost,
                'unit_price' => $lineItem->unit_price,
                'total_value' => $remaining * (float) $lineItem->unit_price,
                'created_by' => $userId,
                'notes' => $note,
            ]);
            return;
        }

        // No batch for this product at all: the return is recorded against the product alone.
        $quantity = $remaining;
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
            'total_value' => (float) $lineItem->quantity * (float) $lineItem->unit_price,
            'movement_date' => now(),
            'created_by' => $userId,
            'notes' => 'Inventory restored from issued credit note',
            'metadata' => [
                'credit_note_id' => $creditNote->id,
                'credit_note_line_item_id' => $lineItem->id,
            ],
        ]);
    }

    /** Batch id => pieces the invoice's sale took from it for this product, not yet credited back. */
    protected function batchesSoldOn(CreditNote $creditNote, string $productId, ?string $variantId): array
    {
        $orderId = Invoice::whereKey($creditNote->invoice_id)->value('order_id');
        if (!$orderId) {
            return [];
        }

        $sold = [];
        OrderItem::where('order_id', $orderId)
            ->where('product_id', $productId)
            ->when($variantId, fn ($q) => $q->where('variant_id', $variantId), fn ($q) => $q->whereNull('variant_id'))
            ->get()
            ->each(function (OrderItem $item) use (&$sold) {
                foreach ($item->batch_allocations ?? [] as $allocation) {
                    if (!empty($allocation['batch_id'])) {
                        $sold[$allocation['batch_id']] = ($sold[$allocation['batch_id']] ?? 0) + (int) $allocation['quantity'];
                    }
                }
            });
        if (!$sold) {
            return [];
        }

        $returned = InventoryMovement::where('reference_type', 'credit_note')
            ->whereIn('reference_id', CreditNote::where('invoice_id', $creditNote->invoice_id)->select('id'))
            ->whereIn('batch_id', array_keys($sold))
            ->groupBy('batch_id')
            ->selectRaw('batch_id, SUM(quantity) as qty')
            ->pluck('qty', 'batch_id');
        foreach ($sold as $batchId => $qty) {
            $sold[$batchId] = $qty - (int) ($returned[$batchId] ?? 0);
        }

        return array_filter($sold, fn ($qty) => $qty > 0);
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
                    ->orderBy('credit_note_date', 'desc')
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
