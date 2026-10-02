<?php

namespace App\Http\Controllers;

use App\Models\AccountsReceivable;
use App\Models\Customer;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\ChartOfAccount;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AccountsReceivableController extends Controller
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
     * Display a listing of accounts receivable.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_accounts_receivable', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view accounts receivable.',
            ], 403);
        }
        $query = AccountsReceivable::with(['customer']);
        $query->where('company_id', $user->company_id);
        if ($request->has('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('due_date_from') && $request->has('due_date_to')) {
            $query->whereBetween('due_date', [$request->due_date_from, $request->due_date_to]);
        }
        if ($request->has('overdue') && $request->overdue) {
            $query->where('due_date', '<', now())
                ->where('status', '!=', 'paid');
        }
        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('invoice_number', 'ilike', '%' . $request->search . '%')
                    ->orWhere('reference', 'ilike', '%' . $request->search . '%');
            });
        }
        $receivables = $query->orderBy('due_date', 'asc')
            ->paginate($request->get('per_page', 15));
        return response()->json($receivables);
    }

    /**
     * Store a newly created accounts receivable record.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:customers,id',
            'invoice_number' => 'required|string|max:255',
            'invoice_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:invoice_date',
            'amount' => 'required|numeric|min:0.01',
            'tax_amount' => 'nullable|numeric|min:0',
            'description' => 'nullable|string',
            'reference' => 'nullable|string|max:255',
            'payment_terms' => 'nullable|string',
            'revenue_account_id' => 'required|exists:chart_of_accounts,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $receivable = AccountsReceivable::create([
                'customer_id' => $request->customer_id,
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

            // Create journal entry for the receivable
            $this->createReceivableJournalEntry($receivable, $request->revenue_account_id);

            DB::commit();

            return response()->json([
                'message' => 'Accounts receivable record created successfully',
                'data' => $receivable->load('customer')
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create receivable record', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified accounts receivable record.
     */
    public function show(string $id): JsonResponse
    {
        $receivable = AccountsReceivable::with(['customer', 'journalEntries'])
            ->findOrFail($id);

        return response()->json($receivable);
    }

    /**
     * Update the specified accounts receivable record.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $receivable = AccountsReceivable::findOrFail($id);

        if ($receivable->status === 'paid') {
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

            $oldAmount = $receivable->total_amount;

            $receivable->update($request->only([
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
                $receivable->total_amount = $receivable->amount + $receivable->tax_amount;
                $receivable->remaining_amount = $receivable->total_amount - $receivable->paid_amount;
                $receivable->save();

                // Update journal entry if amount changed
                if ($receivable->total_amount != $oldAmount) {
                    $this->updateReceivableJournalEntry($receivable, $oldAmount);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Accounts receivable record updated successfully',
                'data' => $receivable->load('customer')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update receivable record', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified accounts receivable record.
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $receivable = AccountsReceivable::findOrFail($id);

            if ($receivable->paid_amount > 0) {
                return response()->json(['message' => 'Cannot delete receivable with payments'], 400);
            }

            DB::beginTransaction();

            // Delete related journal entries
            $receivable->journalEntries()->delete();
            $receivable->delete();

            DB::commit();

            return response()->json(['message' => 'Accounts receivable record deleted successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to delete receivable record', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Record a payment for accounts receivable.
     */
    public function recordPayment(Request $request, string $id): JsonResponse
    {
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
            $receivable = AccountsReceivable::findOrFail($id);

            if ($receivable->status === 'paid') {
                return response()->json(['message' => 'Invoice already paid'], 400);
            }

            if ($request->payment_amount > $receivable->remaining_amount) {
                return response()->json(['message' => 'Payment amount exceeds remaining balance'], 400);
            }

            DB::beginTransaction();

            // Update receivable record
            $receivable->paid_amount += $request->payment_amount;
            $receivable->remaining_amount -= $request->payment_amount;

            // Update status based on payment
            if ($receivable->remaining_amount <= 0) {
                $receivable->status = 'paid';
                $receivable->paid_date = $request->payment_date;
            } else {
                $receivable->status = 'partially_paid';
            }

            $receivable->save();

            // Create payment journal entry
            $this->createPaymentJournalEntry($receivable, $request->all());

            DB::commit();

            return response()->json([
                'message' => 'Payment recorded successfully',
                'data' => $receivable->load('customer')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to record payment', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Generate invoice for accounts receivable.
     */
    public function generateInvoice(string $id): JsonResponse
    {
        $receivable = AccountsReceivable::with('customer')->findOrFail($id);

        $invoiceData = [
            'invoice_number' => $receivable->invoice_number,
            'invoice_date' => $receivable->invoice_date,
            'due_date' => $receivable->due_date,
            'customer' => $receivable->customer,
            'amount' => $receivable->amount,
            'tax_amount' => $receivable->tax_amount,
            'total_amount' => $receivable->total_amount,
            'description' => $receivable->description,
            'payment_terms' => $receivable->payment_terms,
            'reference' => $receivable->reference,
        ];

        return response()->json([
            'message' => 'Invoice generated successfully',
            'invoice_data' => $invoiceData
        ]);
    }

    /**
     * Send invoice reminder to customer.
     */
    public function sendReminder(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reminder_type' => 'required|in:first,second,final',
            'message' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $receivable = AccountsReceivable::with('customer')->findOrFail($id);

            if ($receivable->status === 'paid') {
                return response()->json(['message' => 'Cannot send reminder for paid invoice'], 400);
            }

            // Update last reminder date
            $receivable->update(['last_reminder_date' => now()]);

            // Here you would integrate with your email/SMS service
            // For now, we'll just return a success response

            return response()->json([
                'message' => 'Reminder sent successfully',
                'data' => $receivable
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to send reminder', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get aging report for accounts receivable.
     */
    public function getAgingReport(Request $request): JsonResponse
    {
        $asOfDate = $request->get('as_of_date', now()->toDateString());

        $receivables = AccountsReceivable::with('customer')
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

        foreach ($receivables as $receivable) {
            $daysOverdue = now()->parse($asOfDate)->diffInDays($receivable->due_date, false);
            $daysPastDue = max(0, -$daysOverdue);

            $bucket = 'current';
            if ($daysPastDue > 90) {
                $bucket = 'over_90';
            } elseif ($daysPastDue > 60) {
                $bucket = '61_90';
            } elseif ($daysPastDue > 30) {
                $bucket = '31_60';
            }

            $agingBuckets[$bucket]['amount'] += $receivable->remaining_amount;
            $agingBuckets[$bucket]['count']++;

            $detailReport[] = [
                'receivable' => $receivable,
                'days_past_due' => $daysPastDue,
                'bucket' => $bucket,
            ];
        }

        return response()->json([
            'aging_buckets' => $agingBuckets,
            'detail_report' => $detailReport,
            'summary' => [
                'total_outstanding' => $receivables->sum('remaining_amount'),
                'total_invoices' => $receivables->count(),
                'as_of_date' => $asOfDate,
            ]
        ]);
    }

    /**
     * Get summary statistics for accounts receivable.
     */
    public function getSummary(Request $request): JsonResponse
    {
        $startDate = $request->get('start_date', now()->startOfMonth());
        $endDate = $request->get('end_date', now()->endOfMonth());

        $summary = AccountsReceivable::whereBetween('invoice_date', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_invoices,
                SUM(total_amount) as total_amount,
                SUM(paid_amount) as total_paid,
                SUM(remaining_amount) as total_outstanding,
                COUNT(CASE WHEN status = "paid" THEN 1 END) as paid_invoices,
                COUNT(CASE WHEN status = "pending" THEN 1 END) as pending_invoices,
                COUNT(CASE WHEN due_date < NOW() AND status != "paid" THEN 1 END) as overdue_invoices,
                AVG(total_amount) as average_invoice_amount,
                AVG(DATEDIFF(paid_date, invoice_date)) as average_collection_period
            ')
            ->first();

        return response()->json($summary);
    }

    /**
     * Create journal entry for new receivable.
     */
    private function createReceivableJournalEntry(AccountsReceivable $receivable, string $revenueAccountId): void
    {
        // Get accounts receivable account
        $arAccount = ChartOfAccount::where('account_code', '1200')
            ->where('company_id', auth()->user()->company_id)
            ->first();

        if (!$arAccount) {
            throw new \Exception('Accounts Receivable account not found');
        }

        $journalEntry = JournalEntry::create([
            'reference' => 'AR-' . $receivable->invoice_number,
            'description' => 'Accounts Receivable - ' . $receivable->description,
            'transaction_date' => $receivable->invoice_date,
            'total_amount' => $receivable->total_amount,
            'status' => 'posted',
            'type' => 'accounts_receivable',
            'source_id' => $receivable->id,
            'source_type' => 'App\Models\AccountsReceivable',
            'company_id' => auth()->user()->company_id,
            'created_by' => auth()->id(),
        ]);

        // Debit accounts receivable
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $arAccount->id,
            'type' => 'debit',
            'amount' => $receivable->total_amount,
            'description' => 'Invoice to ' . $receivable->customer->name,
            'company_id' => auth()->user()->company_id,
        ]);

        // Credit revenue account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $revenueAccountId,
            'type' => 'credit',
            'amount' => $receivable->amount,
            'description' => 'Revenue - ' . $receivable->description,
            'company_id' => auth()->user()->company_id,
        ]);

        // Credit tax account if tax amount exists
        if ($receivable->tax_amount > 0) {
            $taxAccount = ChartOfAccount::where('account_code', '2110')
                ->where('company_id', auth()->user()->company_id)
                ->first();

            if ($taxAccount) {
                JournalEntryItem::create([
                    'journal_entry_id' => $journalEntry->id,
                    'account_id' => $taxAccount->id,
                    'type' => 'credit',
                    'amount' => $receivable->tax_amount,
                    'description' => 'Output VAT - ' . $receivable->description,
                    'company_id' => auth()->user()->company_id,
                ]);
            }
        }
    }

    /**
     * Create journal entry for payment.
     */
    private function createPaymentJournalEntry(AccountsReceivable $receivable, array $paymentData): void
    {
        // Get accounts receivable account
        $arAccount = ChartOfAccount::where('account_code', '1200')
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
            'reference' => 'REC-' . $receivable->invoice_number . '-' . now()->format('YmdHis'),
            'description' => 'Payment for Invoice ' . $receivable->invoice_number,
            'transaction_date' => $paymentData['payment_date'],
            'total_amount' => $paymentData['payment_amount'],
            'status' => 'posted',
            'type' => 'receipt',
            'source_id' => $receivable->id,
            'source_type' => 'App\Models\AccountsReceivable',
            'company_id' => auth()->user()->company_id,
            'created_by' => auth()->id(),
        ]);

        // Debit cash/bank account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $cashAccount->id,
            'type' => 'debit',
            'amount' => $paymentData['payment_amount'],
            'description' => 'Payment from ' . $receivable->customer->name,
            'company_id' => auth()->user()->company_id,
        ]);

        // Credit accounts receivable (reduce asset)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $arAccount->id,
            'type' => 'credit',
            'amount' => $paymentData['payment_amount'],
            'description' => 'Payment via ' . $paymentData['payment_method'],
            'company_id' => auth()->user()->company_id,
        ]);
    }

    /**
     * Update receivable journal entry when amount changes.
     */
    private function updateReceivableJournalEntry(AccountsReceivable $receivable, float $oldAmount): void
    {
        // Find the original journal entry
        $journalEntry = JournalEntry::where('source_id', $receivable->id)
            ->where('source_type', 'App\Models\AccountsReceivable')
            ->where('type', 'accounts_receivable')
            ->first();

        if ($journalEntry) {
            // Delete old journal entry items
            $journalEntry->journalEntryItems()->delete();

            // Update journal entry total
            $journalEntry->update(['total_amount' => $receivable->total_amount]);

            // Recreate journal entry items with new amounts
            $revenueAccount = ChartOfAccount::where('account_type', 'revenue')
                ->where('company_id', auth()->user()->company_id)
                ->first();

            if ($revenueAccount) {
                $this->createReceivableJournalEntry($receivable, $revenueAccount->id);
            }
        }
    }
}
