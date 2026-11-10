<?php

namespace App\Http\Controllers;

use App\Models\AccountsPayable;
use App\Models\Supplier;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\ChartOfAccount;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AccountsPayableController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
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
     * Display a listing of accounts payable.
     */
    /**
     * Supplier invoices (bills) and debit notes, newest first, for Suppliers > Supplier Invoices.
     * Each row carries its supplier, what is paid and still owed, and the supplier payments that paid it.
     * kind = bill | debit_note; status = paid | part_paid | unpaid (bills only); per_page = number or "all".
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $allowed = collect(['can_view_accounts', 'can_view_accounts_payable', 'can_view_payments'])
            ->contains(fn ($p) => $this->hasPermission($request, $p, $user->company_id));
        if (!$allowed) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view supplier invoices.', 'data' => null], 403);
        }

        $kindSql = "coalesce(accounts_payable.metadata::jsonb->>'kind', 'bill')";
        $query = AccountsPayable::query()
            ->leftJoin('suppliers', 'suppliers.id', '=', 'accounts_payable.vendor_id')
            ->leftJoin('users as recorder', 'recorder.id', '=', 'accounts_payable.created_by')
            ->where('accounts_payable.company_id', $user->company_id)
            ->select('accounts_payable.*', 'suppliers.name as supplier_name',
                DB::raw("trim(coalesce(recorder.first_name, '') || ' ' || coalesce(recorder.last_name, '')) as recorded_by_name"));

        if ($request->filled('supplier_id')) {
            $query->where('accounts_payable.vendor_id', $request->input('supplier_id'));
        }
        if (in_array($request->input('kind'), ['bill', 'debit_note'], true)) {
            $query->whereRaw("{$kindSql} = ?", [$request->input('kind')]);
        }
        // Suppliers > Debit Notes: only those raised here for returned goods (SDEB/0001 on); ones brought
        // across from Tally stay in the books and under Supplier Invoices > Debit notes.
        if ($request->boolean('returns_only')) {
            $query->whereRaw("coalesce(accounts_payable.metadata::jsonb->>'returns', '') = 'true'");
        }
        $status = $request->input('status');
        if ($status === 'paid') {
            $query->where('accounts_payable.balance_amount', '<=', 0);
        } elseif ($status === 'part_paid') {
            $query->where('accounts_payable.balance_amount', '>', 0)->where('accounts_payable.paid_amount', '>', 0);
        } elseif ($status === 'unpaid') {
            $query->where('accounts_payable.balance_amount', '>', 0)->where('accounts_payable.paid_amount', '<=', 0);
        }
        if ($request->filled('search')) {
            $term = '%' . trim($request->input('search')) . '%';
            $query->where(fn ($q) => $q->where('accounts_payable.invoice_number', 'ilike', $term)
                ->orWhere('accounts_payable.vendor_invoice_number', 'ilike', $term)
                ->orWhere('accounts_payable.description', 'ilike', $term)
                ->orWhere('suppliers.name', 'ilike', $term)
                // A payment's number or reference finds the invoices it paid.
                ->orWhereExists(fn ($e) => $e->from('supplier_payment_allocations as a')
                    ->join('supplier_payments as p', 'p.id', '=', 'a.supplier_payment_id')
                    ->whereColumn('a.invoice_id', 'accounts_payable.id')->where('a.invoice_type', 'bill')
                    ->where(fn ($w) => $w->where('p.payment_number', 'ilike', $term)->orWhere('p.transaction_reference', 'ilike', $term))));
        }

        // Owed on bills matching the filters (debit notes reduce it), for the tab's summary line.
        $totalsQuery = clone $query;
        $totalsQuery->getQuery()->columns = null;
        $totals = $totalsQuery->selectRaw("count(*) as n,
            coalesce(sum(case when {$kindSql} = 'debit_note' then 0 else accounts_payable.total_amount end), 0) as billed,
            coalesce(sum(case when {$kindSql} = 'debit_note' then 0 else accounts_payable.paid_amount end), 0) as paid,
            coalesce(sum(case when {$kindSql} = 'debit_note' then 0 else accounts_payable.balance_amount end), 0) as owed,
            coalesce(sum(case when {$kindSql} = 'debit_note' then accounts_payable.total_amount else 0 end), 0) as debit_notes")->first();

        $perPage = $request->input('per_page') === 'all' ? max((int) $totals->n, 1) : (int) $request->input('per_page', 20);
        $bills = $query->orderBy('accounts_payable.invoice_date', 'desc')->orderBy('accounts_payable.invoice_number', 'desc')
            ->paginate(max(1, min($perPage, 10000)));

        $payments = DB::table('supplier_payment_allocations as a')
            ->join('supplier_payments as p', 'p.id', '=', 'a.supplier_payment_id')
            ->where('a.invoice_type', 'bill')->whereIn('a.invoice_id', $bills->getCollection()->pluck('id'))
            ->orderBy('p.payment_date')
            ->get(['a.invoice_id', 'a.amount', 'a.applied_at', 'p.id', 'p.payment_number', 'p.transaction_reference', 'p.payment_date', 'p.payment_method', 'p.status'])
            ->groupBy('invoice_id');

        $bills->getCollection()->transform(function (AccountsPayable $b) use ($payments) {
            $meta = $b->metadata ?? [];
            $total = round((float) $b->total_amount, 2);
            $paid = round((float) $b->paid_amount, 2);
            $balance = round((float) $b->balance_amount, 2);
            return [
                'id' => $b->id,
                'kind' => $meta['kind'] ?? 'bill',
                'invoice_number' => $b->invoice_number,
                'supplier_invoice_number' => $b->vendor_invoice_number,
                'supplier_id' => $b->vendor_id,
                'supplier_name' => $b->supplier_name,
                // Who recorded it, and when (an import is recorded under the person who ran it).
                'recorded_by' => $b->recorded_by_name ?: null,
                'recorded_at' => $b->created_at?->toDateTimeString(),
                'invoice_date' => $b->invoice_date?->toDateString(),
                'due_date' => $b->due_date?->toDateString(),
                'description' => $b->description,
                'total' => $total,
                'paid' => $paid,
                'balance' => $balance,
                'status' => ($meta['kind'] ?? 'bill') === 'debit_note' ? 'debit_note' : ($balance <= 0 ? 'paid' : ($paid > 0 ? 'part_paid' : 'unpaid')),
                'source' => $meta['source'] ?? null,
                // Raised by goods received: it follows its receipt, so it is not edited or deleted here.
                'from_receipt' => ($meta['ledger'] ?? null) === 'receipt',
                'tax_amount' => round((float) $b->tax_amount, 2),
                'account_code' => $meta['debit_account_code'] ?? null,
                // A debit note for goods sent back from a receipt: its item lines and the receipt.
                'lines' => !empty($meta['returns']) ? array_values($b->line_items ?? []) : [],
                'returns_receipt_number' => $meta['returns_receipt_number'] ?? null,
                'reason' => $meta['reason'] ?? null,
                // On a bill: what debit notes for returned goods took off it.
                'debited' => round((float) ($meta['debited'] ?? 0), 2),
                'payments' => ($payments->get($b->id) ?? collect())->map(fn ($p) => [
                    'id' => $p->id,
                    'payment_number' => $p->payment_number,
                    'reference' => $p->transaction_reference,
                    'date' => substr((string) $p->payment_date, 0, 10),
                    'method' => $p->payment_method,
                    'status' => $p->status,
                    'amount' => round((float) $p->amount, 2),
                    'applied' => (bool) $p->applied_at,
                ])->values(),
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $bills->items(),
            'pagination' => [
                'total' => $bills->total(), 'per_page' => $bills->perPage(), 'current_page' => $bills->currentPage(),
                'last_page' => $bills->lastPage(), 'from' => $bills->firstItem() ?? 0, 'to' => $bills->lastItem() ?? 0,
            ],
            'totals' => ['billed' => round((float) $totals->billed, 2), 'paid' => round((float) $totals->paid, 2), 'owed' => round((float) $totals->owed, 2), 'debit_notes' => round((float) $totals->debit_notes, 2)],
        ]);
    }

    /**
     * Record a supplier invoice typed in (services, rent, a bill not from goods received). It posts on
     * its own: DR the chosen account (Inventory when none is chosen) / CR Payables, and is numbered
     * on from the PUR- series. Goods received raise their own invoice (SupplierBillService).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $allowed = collect(['can_create_accounts', 'can_create_payments'])->contains(fn ($p) => $this->hasPermission($request, $p, $user->company_id));
        if (!$allowed) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to record supplier invoices.', 'data' => null], 403);
        }

        $validator = Validator::make($request->all(), [
            'supplier_id' => 'required|uuid|exists:suppliers,id',
            'supplier_invoice_number' => 'nullable|string|max:255',
            'invoice_date' => 'required|date',
            'due_date' => 'nullable|date|after_or_equal:invoice_date',
            'amount' => 'required|numeric|min:0.01',
            'tax_amount' => 'nullable|numeric|min:0',
            'description' => 'nullable|string|max:1000',
            'account_code' => 'nullable|string|max:50',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        if (!\App\Models\Supplier::where('company_id', $user->company_id)->whereKey($request->input('supplier_id'))->exists()) {
            return response()->json(['message' => 'Supplier not found.'], 422);
        }
        $theirs = trim((string) $request->input('supplier_invoice_number'));
        if ($theirs !== '') {
            $dup = AccountsPayable::where('company_id', $user->company_id)->where('vendor_id', $request->input('supplier_id'))
                ->whereRaw('lower(vendor_invoice_number) = ?', [mb_strtolower($theirs)])->value('invoice_number');
            if ($dup) {
                return response()->json(['message' => "This supplier's invoice {$theirs} is already recorded as {$dup}."], 422);
            }
        }
        if ($request->filled('account_code') && !ChartOfAccount::where('company_id', $user->company_id)->where('account_code', $request->input('account_code'))->exists()) {
            return response()->json(['message' => 'No account with code ' . $request->input('account_code') . ' in the chart of accounts.'], 422);
        }

        $bill = DB::transaction(fn () => app(\App\Services\SupplierBillService::class)->record($user->company_id, [
            'supplier_id' => $request->input('supplier_id'),
            'supplier_invoice_number' => $theirs !== '' ? $theirs : null,
            'invoice_date' => $request->input('invoice_date'),
            'due_date' => $request->input('due_date'),
            'amount' => $request->input('amount'),
            'tax_amount' => $request->input('tax_amount'),
            'description' => $request->input('description'),
            'account_code' => $request->input('account_code'),
        ], $user->id));

        return response()->json(['status' => 'success', 'message' => "Supplier invoice {$bill->invoice_number} recorded.", 'data' => $bill], 201);
    }

    /**
     * A debit note for returned goods (SDEB/0001) as its printed document needs it: the supplier's
     * name, address and KRA PIN, the goods-received note and its date, and each line with its batch,
     * expiry and unit (pcs, box ...).
     */
    public function debitNote(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $allowed = collect(['can_view_accounts', 'can_view_accounts_payable', 'can_view_payments'])
            ->contains(fn ($p) => $this->hasPermission($request, $p, $user->company_id));
        if (!$allowed) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view debit notes.', 'data' => null], 403);
        }

        $note = AccountsPayable::where('company_id', $user->company_id)->find($id);
        $meta = $note?->metadata ?? [];
        if (!$note || ($meta['kind'] ?? 'bill') !== 'debit_note') {
            return response()->json(['status' => 'failed', 'message' => 'Debit note not found.', 'data' => null], 404);
        }

        $supplier = $note->vendor_id ? Supplier::find($note->vendor_id) : null;
        $receipt = !empty($meta['returns_receipt_id']) ? \App\Models\ProductReceipt::find($meta['returns_receipt_id']) : null;
        $lines = array_values($note->line_items ?? []);
        $units = \App\Models\Product::whereIn('id', collect($lines)->pluck('product_id')->filter()->unique())
            ->pluck('unit_of_measurement', 'id');
        $recorder = $note->created_by ? DB::table('users')->where('id', $note->created_by)->first(['first_name', 'last_name']) : null;

        // The company's letterhead and payment details come with the note (as an invoice carries its
        // company), so anyone who may see debit notes prints them in full without "View Company".
        $company = \App\Models\Company::find($note->company_id);

        return response()->json([
            'status' => 'success',
            'data' => [
                'id' => $note->id,
                'company_id' => $note->company_id,
                'company' => $company ? $company->only([
                    'id', 'name', 'email', 'phone', 'address', 'city', 'state', 'country', 'postal_code', 'website',
                    'logo_url', 'letterhead_url', 'bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch',
                    'mpesa_paybill', 'mpesa_account_number',
                ]) : null,
                'number' => $note->invoice_number,
                'date' => $note->invoice_date?->toDateString(),
                'supplier_reference' => $note->vendor_invoice_number,
                'reason' => $meta['reason'] ?? null,
                'receipt_number' => $meta['returns_receipt_number'] ?? null,
                // The supplier's own invoice / delivery note no. the goods came in on (Original Invoice No.).
                'receipt_reference' => $receipt?->reference_number,
                // The receipt's own date when it has one, else the day it was entered.
                'receipt_date' => ($receipt?->receipt_date ?? $receipt?->created_at)?->toDateString(),
                'supplier' => $supplier ? [
                    'name' => $supplier->name,
                    'address' => $supplier->address,
                    'phone' => $supplier->phone,
                    'email' => $supplier->email,
                    'contact_person' => $supplier->contact_person,
                    'kra_pin' => $supplier->tax_information,
                ] : null,
                'lines' => array_map(fn ($l) => [
                    'name' => $l['name'] ?? 'Item',
                    'batch_number' => $l['batch_number'] ?? null,
                    'expiry_date' => $l['expiry_date'] ?? null,
                    'unit' => (!empty($l['product_id']) ? $units->get($l['product_id']) : null) ?: 'pcs',
                    'quantity' => (float) ($l['quantity'] ?? 0),
                    'unit_price' => round((float) ($l['unit_price'] ?? 0), 2),
                    'amount' => round((float) ($l['amount'] ?? 0), 2),
                ], $lines),
                'goods' => round((float) $note->total_amount - (float) $note->tax_amount, 2),
                'tax_amount' => round((float) $note->tax_amount, 2),
                'total' => round((float) $note->total_amount, 2),
                'recorded_by' => $recorder ? trim("{$recorder->first_name} {$recorder->last_name}") : null,
            ],
        ]);
    }

    /** Who may edit a debit note for returned goods: "Edit Debit Notes" (GM, Director, Accountant to start). */
    public const EDIT_DEBIT_NOTES = 'can_edit_debit_notes';

    private function returnsNote(Request $request, string $id): ?AccountsPayable
    {
        $note = AccountsPayable::where('company_id', $request->user()->company_id)->find($id);

        return $note && !empty(($note->metadata ?? [])['returns']) ? $note : null;
    }

    /** The receipt's lines for editing a debit note: this note's quantities count as not yet returned. */
    public function debitNoteEditLines(Request $request, string $id): JsonResponse
    {
        if (!$this->hasPermission($request, self::EDIT_DEBIT_NOTES, $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Only the GM, a Director or an Accountant (Edit Debit Notes) can edit debit notes.'], 403);
        }
        $note = $this->returnsNote($request, $id);
        $service = app(\App\Services\SupplierDebitNoteService::class);
        $receipt = $note ? $service->receiptOf($note) : null;
        if (!$note || !$receipt) {
            return response()->json(['status' => 'failed', 'message' => 'Debit note or its goods receipt not found.'], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'receipt_number' => $receipt->product_receipt_number,
                'reference_number' => $receipt->reference_number,
                'supplier_id' => $receipt->supplier_id,
                'supplier_name' => $receipt->supplier_id ? Supplier::whereKey($receipt->supplier_id)->value('name') : null,
                'vat_rate' => $receipt->purchase_order_id ? (float) (\App\Models\PurchaseOrder::whereKey($receipt->purchase_order_id)->value('tax_rate') ?? 0) : 0.0,
                'next_number' => $note->invoice_number,
                'lines' => $service->returnableLines($receipt, $note),
                'debit_notes' => \App\Services\SupplierDebitNoteService::forReceipt($receipt->id)->whereKeyNot($note->id)->orderBy('created_at')
                    ->get(['id', 'invoice_number', 'invoice_date', 'total_amount'])
                    ->map(fn ($n) => ['id' => $n->id, 'number' => $n->invoice_number, 'date' => $n->invoice_date?->toDateString(), 'total' => round((float) $n->total_amount, 2)]),
                'note' => [
                    'date' => $note->invoice_date?->toDateString(),
                    'reason' => ($note->metadata ?? [])['reason'] ?? null,
                    'supplier_reference' => $note->vendor_invoice_number,
                ],
            ],
        ]);
    }

    /** Edit a debit note for returned goods: date, reason, supplier's credit note no. and quantities. */
    public function updateDebitNote(Request $request, string $id): JsonResponse
    {
        if (!$this->hasPermission($request, self::EDIT_DEBIT_NOTES, $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Only the GM, a Director or an Accountant (Edit Debit Notes) can edit debit notes.'], 403);
        }
        $note = $this->returnsNote($request, $id);
        if (!$note) {
            return response()->json(['status' => 'failed', 'message' => 'Debit note not found.'], 404);
        }
        $validator = Validator::make($request->all(), [
            'date' => 'required|date',
            'reason' => 'required|string|max:1000',
            'supplier_reference' => 'nullable|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.receipt_item_id' => 'required|string',
            'items.*.quantity' => 'required|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        try {
            $note = app(\App\Services\SupplierDebitNoteService::class)->update($note, $request->input('items'), [
                'date' => $request->input('date'),
                'reason' => $request->input('reason'),
                'supplier_reference' => $request->input('supplier_reference'),
            ], $request->user()->id);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => "Debit note {$note->invoice_number} updated: the stock, the receipt's invoice and the books follow the new quantities.",
            'data' => ['id' => $note->id, 'invoice_number' => $note->invoice_number, 'total' => round((float) $note->total_amount, 2)],
        ]);
    }

    /**
     * Display the specified accounts payable record.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_accounts', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view accounts payable.', 'data' => null], 403);
        }

        $payable = AccountsPayable::with(['supplier', 'journalEntries'])
            ->findOrFail($id);

        return response()->json($payable);
    }

    /**
     * Update the specified accounts payable record.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_accounts', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to update accounts payable.', 'data' => null], 403);
        }

        $payable = AccountsPayable::findOrFail($id);

        if ($payable->status === 'paid') {
            return response()->json(['message' => 'Cannot update paid invoice'], 400);
        }

        $validator = Validator::make($request->all(), [
            'invoice_number' => 'sometimes|string|max:255',
            'invoice_date' => 'sometimes|date',
            'due_date' => 'sometimes|date|after_or_equal:invoice_date',
            'amount' => 'sometimes|numeric|min:0.01',
            'tax_amount' => 'nullable|numeric|min:0',
            'description' => 'nullable|string',
            'reference' => 'nullable|string|max:255',
            'payment_terms' => 'nullable|string',
            'status' => 'sometimes|in:pending,partially_paid,paid,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $oldAmount = $payable->total_amount;

            $payable->update($request->only([
                'invoice_number',
                'invoice_date',
                'due_date',
                'amount',
                'tax_amount',
                'description',
                'reference',
                'payment_terms',
                'status'
            ]));

            // Recalculate total and remaining amounts if amount or tax changed
            if ($request->has('amount') || $request->has('tax_amount')) {
                $payable->total_amount = $payable->amount + $payable->tax_amount;
                $payable->remaining_amount = $payable->total_amount - $payable->paid_amount;
                $payable->save();

                // Update journal entry if amount changed
                if ($payable->total_amount != $oldAmount) {
                    $this->updatePayableJournalEntry($payable, $oldAmount);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Accounts payable record updated successfully',
                'data' => $payable->load('supplier')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update payable record', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete a supplier invoice nothing has been paid on. One raised by goods received goes with its
     * receipt (edit or delete the receipt instead).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $allowed = collect(['can_delete_accounts', 'can_create_payments'])->contains(fn ($p) => $this->hasPermission($request, $p, $user->company_id));
        if (!$allowed) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete supplier invoices.', 'data' => null], 403);
        }

        $bill = AccountsPayable::where('company_id', $user->company_id)->find($id);
        if (!$bill) {
            return response()->json(['message' => 'Supplier invoice not found.'], 404);
        }
        if (($bill->metadata['ledger'] ?? null) === 'receipt') {
            return response()->json(['message' => "{$bill->invoice_number} comes from goods received; edit or delete that receipt instead."], 422);
        }
        if ((float) $bill->paid_amount > 0.005
            || \App\Models\SupplierPaymentAllocation::where('invoice_type', 'bill')->where('invoice_id', $bill->id)->exists()) {
            return response()->json(['message' => "{$bill->invoice_number} has payments on it and cannot be deleted."], 422);
        }

        // A debit note for returned goods puts the stock back and the receipt's invoice is owed again.
        if (!empty($bill->metadata['returns'])) {
            app(\App\Services\SupplierDebitNoteService::class)->delete($bill);
            return response()->json(['status' => 'success', 'message' => "Debit note {$bill->invoice_number} deleted: its stock is back and the supplier is owed again."]);
        }

        // Its journal entry is removed by LedgerSyncObserver.
        $bill->delete();

        return response()->json(['status' => 'success', 'message' => "Supplier invoice {$bill->invoice_number} deleted."]);
    }

    /**
     * Record a payment for accounts payable.
     */
    public function recordPayment(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_record_accounts', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to record accounts payable.', 'data' => null], 403);
        }

        $validator = Validator::make($request->all(), [
            'payment_amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'payment_method' => 'required|string',
            'bank_account_id' => 'nullable|exists:bank_accounts,id',
            'reference' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $payable = AccountsPayable::findOrFail($id);

            if ($payable->status === 'paid') {
                return response()->json(['message' => 'Invoice already paid'], 400);
            }

            if ($request->payment_amount > $payable->remaining_amount) {
                return response()->json(['message' => 'Payment amount exceeds remaining balance'], 400);
            }

            DB::beginTransaction();

            // Update payable record
            $payable->paid_amount += $request->payment_amount;
            $payable->remaining_amount -= $request->payment_amount;

            // Update status based on payment
            if ($payable->remaining_amount <= 0) {
                $payable->status = 'paid';
                $payable->paid_date = $request->payment_date;
            } else {
                $payable->status = 'partially_paid';
            }

            $payable->save();

            // Create payment journal entry
            $this->createPaymentJournalEntry($payable, $request->all());

            DB::commit();

            return response()->json([
                'message' => 'Payment recorded successfully',
                'data' => $payable->load('supplier')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to record payment', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get aging report for accounts payable.
     */
    public function getAgingReport(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_accounts_reports', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view accounts payable reports.', 'data' => null], 403);
        }


        $asOfDate = $request->get('as_of_date', now()->toDateString());

        $payables = AccountsPayable::with('supplier')
            ->where('status', '!=', 'paid')
            ->where('invoice_date', '<=', $asOfDate)
            ->get();

        $agingBuckets = [
            'current' => ['min' => 0, 'max' => 30, 'amount' => 0, 'count' => 0],
            '31_60' => ['min' => 31, 'max' => 60, 'amount' => 0, 'count' => 0],
            '61_90' => ['min' => 61, 'max' => 90, 'amount' => 0, 'count' => 0],
            'over_90' => ['min' => 91, 'max' => null, 'amount' => 0, 'count' => 0],
        ];

        $detailReport = [];

        foreach ($payables as $payable) {
            $daysOverdue = now()->parse($asOfDate)->diffInDays($payable->due_date, false);
            $daysPastDue = max(0, -$daysOverdue);

            $bucket = 'current';
            if ($daysPastDue > 90) {
                $bucket = 'over_90';
            } elseif ($daysPastDue > 60) {
                $bucket = '61_90';
            } elseif ($daysPastDue > 30) {
                $bucket = '31_60';
            }

            $agingBuckets[$bucket]['amount'] += $payable->remaining_amount;
            $agingBuckets[$bucket]['count']++;

            $detailReport[] = [
                'payable' => $payable,
                'days_past_due' => $daysPastDue,
                'bucket' => $bucket,
            ];
        }

        return response()->json([
            'aging_buckets' => $agingBuckets,
            'detail_report' => $detailReport,
            'summary' => [
                'total_outstanding' => $payables->sum('remaining_amount'),
                'total_invoices' => $payables->count(),
                'as_of_date' => $asOfDate,
            ]
        ]);
    }

    /**
     * Get summary statistics for accounts payable.
     */
    public function getSummary(Request $request): JsonResponse
    {
        $startDate = $request->get('start_date', now()->startOfMonth());
        $endDate = $request->get('end_date', now()->endOfMonth());

        $summary = AccountsPayable::where('company_id', $request->user()->company_id)->whereBetween('invoice_date', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_invoices,
                SUM(total_amount) as total_amount,
                SUM(paid_amount) as total_paid,
                SUM(balance_amount) as total_outstanding,
                COUNT(CASE WHEN status = \'paid\' THEN 1 END) as paid_invoices,
                COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_invoices,
                COUNT(CASE WHEN due_date < NOW() AND status != \'paid\' THEN 1 END) as overdue_invoices,
                AVG(total_amount) as average_invoice_amount
            ')
            ->first();

        return response()->json($summary);
    }

    /**
     * Create journal entry for new payable.
     */
    private function createPayableJournalEntry(AccountsPayable $payable, string $expenseAccountId): void
    {
        // Get accounts payable account
        $apAccount = ChartOfAccount::where('account_code', '2001')
            ->where('company_id', auth()->user()->company_id)
            ->first();

        if (!$apAccount) {
            throw new \Exception('Accounts Payable account not found');
        }

        $journalEntry = JournalEntry::create([
            'reference' => 'AP-' . $payable->invoice_number,
            'description' => 'Accounts Payable - ' . $payable->description,
            'transaction_date' => $payable->invoice_date,
            'total_amount' => $payable->total_amount,
            'status' => 'posted',
            'type' => 'accounts_payable',
            'source_id' => $payable->id,
            'source_type' => 'App\Models\AccountsPayable',
            'company_id' => auth()->user()->company_id,
            'created_by' => auth()->id(),
        ]);

        // Debit expense account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $expenseAccountId,
            'type' => 'debit',
            'amount' => $payable->amount,
            'description' => 'Expense - ' . $payable->description,
            'company_id' => auth()->user()->company_id,
        ]);

        // Debit tax account if tax amount exists
        if ($payable->tax_amount > 0) {
            $taxAccount = ChartOfAccount::where('account_code', '1210')
                ->where('company_id', auth()->user()->company_id)
                ->first();

            if ($taxAccount) {
                JournalEntryItem::create([
                    'journal_entry_id' => $journalEntry->id,
                    'account_id' => $taxAccount->id,
                    'type' => 'debit',
                    'amount' => $payable->tax_amount,
                    'description' => 'Input VAT - ' . $payable->description,
                    'company_id' => auth()->user()->company_id,
                ]);
            }
        }

        // Credit accounts payable
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $apAccount->id,
            'type' => 'credit',
            'amount' => $payable->total_amount,
            'description' => 'Accounts Payable - ' . $payable->supplier->name,
            'company_id' => auth()->user()->company_id,
        ]);
    }

    /**
     * Create journal entry for payment.
     */
    private function createPaymentJournalEntry(AccountsPayable $payable, array $paymentData): void
    {
        // Get accounts payable account
        $apAccount = ChartOfAccount::where('account_code', '2001')
            ->where('company_id', auth()->user()->company_id)
            ->first();

        // Get cash/bank account
        $cashAccount = null;
        if (isset($paymentData['bank_account_id'])) {
            $cashAccount = ChartOfAccount::where('source_id', $paymentData['bank_account_id'])
                ->where('source_type', 'bank_account')
                ->where('company_id', auth()->user()->company_id)
                ->first();
        }

        if (!$cashAccount) {
            $cashAccount = ChartOfAccount::where('account_code', '1001')
                ->where('company_id', auth()->user()->company_id)
                ->first();
        }

        $journalEntry = JournalEntry::create([
            'reference' => 'PAY-' . $payable->invoice_number . '-' . now()->format('YmdHis'),
            'description' => 'Payment for Invoice ' . $payable->invoice_number,
            'transaction_date' => $paymentData['payment_date'],
            'total_amount' => $paymentData['payment_amount'],
            'status' => 'posted',
            'type' => 'payment',
            'source_id' => $payable->id,
            'source_type' => 'App\Models\AccountsPayable',
            'company_id' => auth()->user()->company_id,
            'created_by' => auth()->id(),
        ]);

        // Debit accounts payable (reduce liability)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $apAccount->id,
            'type' => 'debit',
            'amount' => $paymentData['payment_amount'],
            'description' => 'Payment to ' . $payable->supplier->name,
            'company_id' => auth()->user()->company_id,
        ]);

        // Credit cash/bank account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $cashAccount->id,
            'type' => 'credit',
            'amount' => $paymentData['payment_amount'],
            'description' => 'Payment via ' . $paymentData['payment_method'],
            'company_id' => auth()->user()->company_id,
        ]);
    }

    /**
     * Update payable journal entry when amount changes.
     */
    private function updatePayableJournalEntry(AccountsPayable $payable, float $oldAmount): void
    {
        // Find the original journal entry
        $journalEntry = JournalEntry::where('source_id', $payable->id)
            ->where('source_type', 'App\Models\AccountsPayable')
            ->where('type', 'accounts_payable')
            ->first();

        if ($journalEntry) {
            // Delete old journal entry items
            $journalEntry->journalEntryItems()->delete();

            // Update journal entry total
            $journalEntry->update(['total_amount' => $payable->total_amount]);

            // Recreate journal entry items with new amounts
            $expenseAccount = ChartOfAccount::where('account_type', 'expense')
                ->where('company_id', auth()->user()->company_id)
                ->first();

            if ($expenseAccount) {
                $this->createPayableJournalEntry($payable, $expenseAccount->id);
            }
        }
    }
}
