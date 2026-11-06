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
            ->where('accounts_payable.company_id', $user->company_id)
            ->select('accounts_payable.*', 'suppliers.name as supplier_name');

        if ($request->filled('supplier_id')) {
            $query->where('accounts_payable.vendor_id', $request->input('supplier_id'));
        }
        if (in_array($request->input('kind'), ['bill', 'debit_note'], true)) {
            $query->whereRaw("{$kindSql} = ?", [$request->input('kind')]);
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
