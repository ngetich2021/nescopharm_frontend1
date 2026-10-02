<?php

namespace App\Http\Controllers;

use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\ChartOfAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class JournalEntryController extends Controller
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

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_journal_entries')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view journal entries.',
            ], 403);
        }

        $query = JournalEntry::with(['company', 'items.chartOfAccount', 'creator']);

        // Always default to user's company
        $companyId = $user->company_id;
        
        // If user has manage_all_finance permission and explicitly requests another company
        if ($this->hasPermission($request, 'can_manage_all_finance') && $request->filled('company_id')) {
            $companyId = $request->input('company_id');
        }
        
        $query->where('company_id', $companyId);

        // Filters
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('entry_type')) {
            $query->where('entry_type', $request->input('entry_type'));
        }

        if ($request->filled('date_from')) {
            $query->where('entry_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('entry_date', '<=', $request->input('date_to'));
        }

        if ($request->filled('reference')) {
            $query->where('reference', 'ilike', '%' . $request->input('reference') . '%');
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'ilike', '%' . $search . '%')
                  ->orWhere('description', 'ilike', '%' . $search . '%')
                  ->orWhere('memo', 'ilike', '%' . $search . '%');
            });
        }

        $entries = $query->orderBy('entry_date', 'desc')
                        ->orderBy('created_at', 'desc')
                        ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Journal entries retrieved successfully.',
            'entries' => $entries,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $entry = JournalEntry::with(['company', 'items.chartOfAccount', 'creator', 'approver'])->find($id);

        if (!$entry) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Journal entry not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $entry->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this journal entry.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Journal entry retrieved successfully.',
            'entry' => $entry,
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'reference' => 'nullable|string|max:255',
            'entry_date' => 'required|date',
            'description' => 'required|string|max:1000',
            'memo' => 'nullable|string',
            'entry_type' => 'required|in:manual,system,adjusting,closing,reversing',
            'currency_code' => 'nullable|string|size:3',
            'exchange_rate' => 'nullable|numeric|min:0',
            'source_type' => 'nullable|string|max:100',
            'source_id' => 'nullable|uuid',
            'company_id' => 'nullable|uuid|exists:companies,id',
            'items' => 'required|array|min:2',
            'items.*.chart_of_account_id' => 'required|uuid|exists:chart_of_accounts,id',
            'items.*.debit_amount' => 'nullable|numeric|min:0',
            'items.*.credit_amount' => 'nullable|numeric|min:0',
            'items.*.description' => 'nullable|string|max:500',
            'items.*.memo' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_journal_entries')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create journal entries.',
            ], 403);
        }

        // Validate that debits equal credits
        $totalDebits = 0;
        $totalCredits = 0;
        $items = $request->input('items');

        foreach ($items as $item) {
            $debit = $item['debit_amount'] ?? 0;
            $credit = $item['credit_amount'] ?? 0;

            // Each line must have either debit or credit, but not both
            if (($debit > 0 && $credit > 0) || ($debit == 0 && $credit == 0)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Each journal entry item must have either a debit or credit amount, but not both.',
                ], 400);
            }

            $totalDebits += $debit;
            $totalCredits += $credit;
        }

        if (abs($totalDebits - $totalCredits) > 0.01) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Total debits must equal total credits.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            $companyId = $request->input('company_id', $user->company_id);

            // Generate reference if not provided
            $reference = $request->input('reference');
            if (!$reference) {
                $reference = 'JE-' . now()->format('Ymd') . '-' . str_pad(
                    JournalEntry::where('company_id', $companyId)
                               ->whereDate('created_at', now()->toDateString())
                               ->count() + 1,
                    4, '0', STR_PAD_LEFT
                );
            }

            $entry = JournalEntry::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'reference' => $reference,
                'entry_date' => $request->input('entry_date'),
                'description' => $request->input('description'),
                'memo' => $request->input('memo'),
                'entry_type' => $request->input('entry_type'),
                'status' => 'draft',
                'total_amount' => $totalDebits,
                'currency_code' => $request->input('currency_code', 'KES'),
                'exchange_rate' => $request->input('exchange_rate', 1.0),
                'source_type' => $request->input('source_type'),
                'source_id' => $request->input('source_id'),
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            // Create journal entry items
            foreach ($items as $itemData) {
                JournalEntryItem::create([
                    'id' => (string) Str::uuid(),
                    'journal_entry_id' => $entry->id,
                    'chart_of_account_id' => $itemData['chart_of_account_id'],
                    'debit_amount' => $itemData['debit_amount'] ?? 0,
                    'credit_amount' => $itemData['credit_amount'] ?? 0,
                    'description' => $itemData['description'] ?? null,
                    'memo' => $itemData['memo'] ?? null,
                ]);
            }

            DB::commit();

            $entry->load(['company', 'items.chartOfAccount', 'creator']);

            return response()->json([
                'status' => 'success',
                'message' => 'Journal entry created successfully.',
                'entry' => $entry,
            ], 201);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error creating journal entry', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create journal entry.',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $entry = JournalEntry::with('items')->find($id);

        if (!$entry) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Journal entry not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $entry->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this journal entry.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_update_journal_entries')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit journal entries.',
            ], 403);
        }

        if ($entry->status !== 'draft') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Only draft journal entries can be edited.',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'reference' => 'sometimes|required|string|max:255',
            'entry_date' => 'sometimes|required|date',
            'description' => 'sometimes|required|string|max:1000',
            'memo' => 'nullable|string',
            'entry_type' => 'sometimes|required|in:manual,system,adjusting,closing,reversing',
            'currency_code' => 'nullable|string|size:3',
            'exchange_rate' => 'nullable|numeric|min:0',
            'items' => 'sometimes|required|array|min:2',
            'items.*.chart_of_account_id' => 'required|uuid|exists:chart_of_accounts,id',
            'items.*.debit_amount' => 'nullable|numeric|min:0',
            'items.*.credit_amount' => 'nullable|numeric|min:0',
            'items.*.description' => 'nullable|string|max:500',
            'items.*.memo' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            // If items are provided, validate and update them
            if ($request->has('items')) {
                $items = $request->input('items');
                $totalDebits = 0;
                $totalCredits = 0;

                foreach ($items as $item) {
                    $debit = $item['debit_amount'] ?? 0;
                    $credit = $item['credit_amount'] ?? 0;

                    if (($debit > 0 && $credit > 0) || ($debit == 0 && $credit == 0)) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Each journal entry item must have either a debit or credit amount, but not both.',
                        ], 400);
                    }

                    $totalDebits += $debit;
                    $totalCredits += $credit;
                }

                if (abs($totalDebits - $totalCredits) > 0.01) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Total debits must equal total credits.',
                    ], 400);
                }

                // Delete existing items and create new ones
                $entry->items()->delete();

                foreach ($items as $itemData) {
                    JournalEntryItem::create([
                        'id' => (string) Str::uuid(),
                        'journal_entry_id' => $entry->id,
                        'chart_of_account_id' => $itemData['chart_of_account_id'],
                        'debit_amount' => $itemData['debit_amount'] ?? 0,
                        'credit_amount' => $itemData['credit_amount'] ?? 0,
                        'description' => $itemData['description'] ?? null,
                        'memo' => $itemData['memo'] ?? null,
                    ]);
                }

                $entry->total_amount = $totalDebits;
            }

            $user = $request->user();
            $entry->update(array_merge(
                $request->only([
                    'reference', 'entry_date', 'description', 'memo', 'entry_type',
                    'currency_code', 'exchange_rate'
                ]),
                ['updated_by' => $user->id]
            ));

            DB::commit();

            $entry->load(['company', 'items.chartOfAccount', 'creator']);

            return response()->json([
                'status' => 'success',
                'message' => 'Journal entry updated successfully.',
                'entry' => $entry,
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error updating journal entry', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update journal entry.',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $entry = JournalEntry::find($id);

        if (!$entry) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Journal entry not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $entry->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this journal entry.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_delete_journal_entries')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete journal entries.',
            ], 403);
        }

        if ($entry->status === 'posted') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot delete posted journal entries.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            $entry->delete();

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Journal entry deleted successfully.',
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error deleting journal entry', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete journal entry.',
            ], 500);
        }
    }

    public function post(Request $request, $id)
    {
        $entry = JournalEntry::with('items.chartOfAccount')->find($id);

        if (!$entry) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Journal entry not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $entry->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to post this journal entry.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_post_journal_entries')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to post journal entries.',
            ], 403);
        }

        if ($entry->status !== 'draft') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Only draft journal entries can be posted.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            $user = $request->user();

            // Update account balances
            foreach ($entry->items as $item) {
                $account = $item->chartOfAccount;
                $debitAmount = $item->debit_amount;
                $creditAmount = $item->credit_amount;

                // Update account balance based on account type
                if (in_array($account->account_type, ['asset', 'expense'])) {
                    // For assets and expenses, debits increase balance
                    $account->current_balance += $debitAmount - $creditAmount;
                } else {
                    // For liabilities, equity, and revenue, credits increase balance
                    $account->current_balance += $creditAmount - $debitAmount;
                }

                $account->save();
            }

            $entry->update([
                'status' => 'posted',
                'posted_by' => $user->id,
                'posted_at' => now(),
            ]);

            DB::commit();

            $entry->load(['company', 'items.chartOfAccount', 'creator']);

            return response()->json([
                'status' => 'success',
                'message' => 'Journal entry posted successfully.',
                'entry' => $entry,
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error posting journal entry', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to post journal entry.',
            ], 500);
        }
    }

    public function reverse(Request $request, $id)
    {
        $entry = JournalEntry::with('items')->find($id);

        if (!$entry) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Journal entry not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $entry->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to reverse this journal entry.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_reverse_journal_entries')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to reverse journal entries.',
            ], 403);
        }

        if ($entry->status !== 'posted') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Only posted journal entries can be reversed.',
            ], 400);
        }

        if ($entry->is_reversed) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Journal entry is already reversed.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            $user = $request->user();

            // Create reversing entry
            $reversingEntry = JournalEntry::create([
                'id' => (string) Str::uuid(),
                'company_id' => $entry->company_id,
                'reference' => 'REV-' . $entry->reference,
                'entry_date' => now()->toDateString(),
                'description' => 'Reversing entry for ' . $entry->reference,
                'memo' => 'Reversal of journal entry: ' . $entry->description,
                'entry_type' => 'reversing',
                'status' => 'posted',
                'total_amount' => $entry->total_amount,
                'currency_code' => $entry->currency_code,
                'exchange_rate' => $entry->exchange_rate,
                'source_type' => 'journal_entry',
                'source_id' => $entry->id,
                'created_by' => $user->id,
                'updated_by' => $user->id,
                'posted_by' => $user->id,
                'posted_at' => now(),
            ]);

            // Create reversing items with swapped debits and credits
            foreach ($entry->items as $item) {
                JournalEntryItem::create([
                    'id' => (string) Str::uuid(),
                    'journal_entry_id' => $reversingEntry->id,
                    'chart_of_account_id' => $item->chart_of_account_id,
                    'debit_amount' => $item->credit_amount,
                    'credit_amount' => $item->debit_amount,
                    'description' => 'Reversal: ' . $item->description,
                    'memo' => $item->memo,
                ]);

                // Update account balances
                $account = $item->chartOfAccount;
                if (in_array($account->account_type, ['asset', 'expense'])) {
                    $account->current_balance += $item->credit_amount - $item->debit_amount;
                } else {
                    $account->current_balance += $item->debit_amount - $item->credit_amount;
                }
                $account->save();
            }

            // Mark original entry as reversed
            $entry->update([
                'is_reversed' => true,
                'reversed_by' => $user->id,
                'reversed_at' => now(),
                'reversing_entry_id' => $reversingEntry->id,
            ]);

            DB::commit();

            $reversingEntry->load(['company', 'items.chartOfAccount', 'creator']);

            return response()->json([
                'status' => 'success',
                'message' => 'Journal entry reversed successfully.',
                'reversing_entry' => $reversingEntry,
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error reversing journal entry', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to reverse journal entry.',
            ], 500);
        }
    }
}
