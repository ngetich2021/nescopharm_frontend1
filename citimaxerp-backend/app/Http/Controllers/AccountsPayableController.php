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
    public function index(Request $request): JsonResponse
    {

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_accounts', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view accounts payable.', 'data' => null], 403);
        }

        $query = AccountsPayable::with(['supplier']);

        // Filter by supplier
        if ($request->has('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by due date range
        if ($request->has('due_date_from') && $request->has('due_date_to')) {
            $query->whereBetween('due_date', [$request->due_date_from, $request->due_date_to]);
        }

        // Filter overdue invoices
        if ($request->has('overdue') && $request->overdue) {
            $query->where('due_date', '<', now())
                ->where('status', '!=', 'paid');
        }

        // Search by invoice number or reference
        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('invoice_number', 'ilike', '%' . $request->search . '%')
                    ->orWhere('reference', 'ilike', '%' . $request->search . '%');
            });
        }

        $payables = $query->orderBy('due_date', 'asc')
            ->paginate($request->get('per_page', 15));

        return response()->json($payables);
    }

    /**
     * Store a newly created accounts payable record.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_accounts', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to create accounts payable.', 'data' => null], 403);
        }

        $validator = Validator::make($request->all(), [
            'supplier_id' => 'required|exists:suppliers,id',
            'invoice_number' => 'required|string|max:255',
            'invoice_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:invoice_date',
            'amount' => 'required|numeric|min:0.01',
            'tax_amount' => 'nullable|numeric|min:0',
            'description' => 'nullable|string',
            'reference' => 'nullable|string|max:255',
            'payment_terms' => 'nullable|string',
            'expense_account_id' => 'required|exists:chart_of_accounts,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $payable = AccountsPayable::create([
                'supplier_id' => $request->supplier_id,
                'invoice_number' => $request->invoice_number,
                'invoice_date' => $request->invoice_date,
                'due_date' => $request->due_date,
                'amount' => $request->amount,
                'tax_amount' => $request->tax_amount ?? 0,
                'total_amount' => $request->amount + ($request->tax_amount ?? 0),
                'paid_amount' => 0,
                'remaining_amount' => $request->amount + ($request->tax_amount ?? 0),
                'description' => $request->description,
                'reference' => $request->reference,
                'payment_terms' => $request->payment_terms,
                'status' => 'pending',
                'company_id' => auth()->user()->company_id,
            ]);

            // Create journal entry for the payable
            $this->createPayableJournalEntry($payable, $request->expense_account_id);

            DB::commit();

            return response()->json([
                'message' => 'Accounts payable record created successfully',
                'data' => $payable->load('supplier')
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create payable record', 'error' => $e->getMessage()], 500);
        }
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
     * Remove the specified accounts payable record.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_accounts', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete accounts payable.', 'data' => null], 403);
        }

        try {
            $payable = AccountsPayable::findOrFail($id);

            if ($payable->paid_amount > 0) {
                return response()->json(['message' => 'Cannot delete payable with payments'], 400);
            }

            DB::beginTransaction();

            // Delete related journal entries
            $payable->journalEntries()->delete();
            $payable->delete();

            DB::commit();

            return response()->json(['message' => 'Accounts payable record deleted successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to delete payable record', 'error' => $e->getMessage()], 500);
        }
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

        $summary = AccountsPayable::whereBetween('invoice_date', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_invoices,
                SUM(total_amount) as total_amount,
                SUM(paid_amount) as total_paid,
                SUM(remaining_amount) as total_outstanding,
                COUNT(CASE WHEN status = "paid" THEN 1 END) as paid_invoices,
                COUNT(CASE WHEN status = "pending" THEN 1 END) as pending_invoices,
                COUNT(CASE WHEN due_date < NOW() AND status != "paid" THEN 1 END) as overdue_invoices,
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
