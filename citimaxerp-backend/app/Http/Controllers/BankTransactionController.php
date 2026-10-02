<?php

namespace App\Http\Controllers;

use App\Models\BankTransaction;
use App\Models\BankAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BankTransactionController extends Controller
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
        if (!$this->hasPermission($request, 'can_view_bank_transactions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view bank transactions.',
            ], 403);
        }

        $query = BankTransaction::with(['bankAccount', 'company']);

        // Always default to user's company
        $companyId = $user->company_id;

        // If user has manage_all_finance permission and explicitly requests another company
        if ($this->hasPermission($request, 'can_manage_all_finance') && $request->filled('company_id')) {
            $companyId = $request->input('company_id');
        }

        $query->where('company_id', $companyId);

        // Filters
        if ($request->filled('bank_account_id')) {
            $query->where('bank_account_id', $request->input('bank_account_id'));
        }

        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->input('transaction_type'));
        }

        if ($request->filled('reconciliation_status')) {
            $query->where('reconciliation_status', $request->input('reconciliation_status'));
        }

        if ($request->filled('date_from')) {
            $query->where('transaction_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('transaction_date', '<=', $request->input('date_to'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('description', 'ilike', '%' . $search . '%')
                    ->orWhere('transaction_reference', 'ilike', '%' . $search . '%')
                    ->orWhere('bank_reference', 'ilike', '%' . $search . '%')
                    ->orWhere('payee_payer', 'ilike', '%' . $search . '%');
            });
        }

        $transactions = $query->orderBy('transaction_date', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Bank transactions retrieved successfully.',
            'transactions' => $transactions,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $transaction = BankTransaction::with(['bankAccount', 'company'])->find($id);

        if (!$transaction) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bank transaction not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $transaction->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this bank transaction.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Bank transaction retrieved successfully.',
            'transaction' => $transaction,
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'bank_account_id' => 'required|uuid|exists:bank_accounts,id',
            'transaction_reference' => 'required|string|max:255|unique:bank_transactions,transaction_reference',
            'bank_reference' => 'nullable|string|max:255',
            'transaction_type' => 'required|in:debit,credit',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:500',
            'payee_payer' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:100',
            'transaction_date' => 'required|date',
            'value_date' => 'nullable|date',
            'company_id' => 'nullable|uuid|exists:companies,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_bank_transactions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create bank transactions.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $bankAccount = BankAccount::find($request->input('bank_account_id'));
            $companyId = $request->input('company_id', $user->company_id);

            // Check if bank account belongs to the company
            if ($bankAccount->company_id !== $companyId) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Bank account does not belong to this company.',
                ], 400);
            }

            // Calculate running balance
            $lastTransaction = BankTransaction::where('bank_account_id', $bankAccount->id)
                ->orderBy('transaction_date', 'desc')
                ->orderBy('created_at', 'desc')
                ->first();

            $currentBalance = $lastTransaction ? $lastTransaction->running_balance : $bankAccount->current_balance;
            $amount = $request->input('amount');
            $transactionType = $request->input('transaction_type');

            $runningBalance = $transactionType === 'credit'
                ? $currentBalance + $amount
                : $currentBalance - $amount;

            $transaction = BankTransaction::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'bank_account_id' => $request->input('bank_account_id'),
                'transaction_reference' => $request->input('transaction_reference'),
                'bank_reference' => $request->input('bank_reference'),
                'transaction_type' => $transactionType,
                'amount' => $amount,
                'running_balance' => $runningBalance,
                'description' => $request->input('description'),
                'payee_payer' => $request->input('payee_payer'),
                'category' => $request->input('category'),
                'transaction_date' => $request->input('transaction_date'),
                'value_date' => $request->input('value_date', $request->input('transaction_date')),
                'reconciliation_status' => 'unreconciled',
            ]);

            // Update bank account balance
            $bankAccount->update(['current_balance' => $runningBalance]);

            DB::commit();

            $transaction->load(['bankAccount', 'company']);

            return response()->json([
                'status' => 'success',
                'message' => 'Bank transaction created successfully.',
                'transaction' => $transaction,
            ], 201);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error creating bank transaction', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create bank transaction.',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $transaction = BankTransaction::find($id);

        if (!$transaction) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bank transaction not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $transaction->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this bank transaction.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_update_bank_transactions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit bank transactions.',
            ], 403);
        }

        if ($transaction->reconciliation_status === 'reconciled') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot update reconciled transactions.',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'transaction_reference' => 'sometimes|required|string|max:255|unique:bank_transactions,transaction_reference,' . $id,
            'bank_reference' => 'nullable|string|max:255',
            'transaction_type' => 'sometimes|required|in:debit,credit',
            'amount' => 'sometimes|required|numeric|min:0.01',
            'description' => 'sometimes|required|string|max:500',
            'payee_payer' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:100',
            'transaction_date' => 'sometimes|required|date',
            'value_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $oldAmount = $transaction->amount;
            $oldType = $transaction->transaction_type;

            $transaction->update($request->only([
                'transaction_reference',
                'bank_reference',
                'transaction_type',
                'amount',
                'description',
                'payee_payer',
                'category',
                'transaction_date',
                'value_date'
            ]));

            // Recalculate running balances if amount or type changed
            if ($request->has('amount') || $request->has('transaction_type')) {
                $this->recalculateRunningBalances($transaction->bank_account_id, $transaction->transaction_date);
            }

            DB::commit();

            $transaction->load(['bankAccount', 'company']);

            return response()->json([
                'status' => 'success',
                'message' => 'Bank transaction updated successfully.',
                'transaction' => $transaction,
            ], 200);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error updating bank transaction', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update bank transaction.',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $transaction = BankTransaction::find($id);

        if (!$transaction) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bank transaction not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $transaction->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this bank transaction.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_delete_bank_transactions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete bank transactions.',
            ], 403);
        }

        if ($transaction->reconciliation_status === 'reconciled') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot delete reconciled transactions.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            $bankAccountId = $transaction->bank_account_id;
            $transactionDate = $transaction->transaction_date;

            $transaction->delete();

            // Recalculate running balances
            $this->recalculateRunningBalances($bankAccountId, $transactionDate);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Bank transaction deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error deleting bank transaction', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete bank transaction.',
            ], 500);
        }
    }

    public function getByBankAccount(Request $request, $bankAccountId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_bank_transactions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view bank transactions.',
            ], 403);
        }

        $bankAccount = BankAccount::find($bankAccountId);
        if (!$bankAccount) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bank account not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $bankAccount->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view transactions for this bank account.',
            ], 403);
        }

        $query = BankTransaction::where('bank_account_id', $bankAccountId);

        // Additional filters
        if ($request->filled('date_from')) {
            $query->where('transaction_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('transaction_date', '<=', $request->input('date_to'));
        }

        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->input('transaction_type'));
        }

        $transactions = $query->orderBy('transaction_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Bank transactions retrieved successfully.',
            'transactions' => $transactions,
            'bank_account' => $bankAccount,
        ], 200);
    }

    public function importFromStatement(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'bank_account_id' => 'required|uuid|exists:bank_accounts,id',
            'transactions' => 'required|array|min:1',
            'transactions.*.transaction_reference' => 'required|string',
            'transactions.*.transaction_date' => 'required|date',
            'transactions.*.description' => 'required|string',
            'transactions.*.amount' => 'required|numeric',
            'transactions.*.transaction_type' => 'required|in:debit,credit',
            'transactions.*.bank_reference' => 'nullable|string',
            'transactions.*.payee_payer' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_import_bank_transactions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to import bank transactions.',
            ], 403);
        }

        $bankAccount = BankAccount::find($request->input('bank_account_id'));
        if (!$this->hasPermission($request, "can_manage_company", $bankAccount->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to import transactions for this bank account.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $importedCount = 0;
            $skippedCount = 0;
            $errors = [];

            foreach ($request->input('transactions') as $index => $transactionData) {
                // Check if transaction already exists
                $exists = BankTransaction::where('bank_account_id', $bankAccount->id)
                    ->where('transaction_reference', $transactionData['transaction_reference'])
                    ->exists();

                if ($exists) {
                    $skippedCount++;
                    continue;
                }

                try {
                    // Calculate running balance
                    $lastTransaction = BankTransaction::where('bank_account_id', $bankAccount->id)
                        ->orderBy('transaction_date', 'desc')
                        ->orderBy('created_at', 'desc')
                        ->first();

                    $currentBalance = $lastTransaction ? $lastTransaction->running_balance : $bankAccount->current_balance;
                    $amount = $transactionData['amount'];
                    $transactionType = $transactionData['transaction_type'];

                    $runningBalance = $transactionType === 'credit'
                        ? $currentBalance + $amount
                        : $currentBalance - $amount;

                    BankTransaction::create([
                        'id' => (string) Str::uuid(),
                        'company_id' => $bankAccount->company_id,
                        'bank_account_id' => $bankAccount->id,
                        'transaction_reference' => $transactionData['transaction_reference'],
                        'bank_reference' => $transactionData['bank_reference'] ?? null,
                        'transaction_type' => $transactionType,
                        'amount' => $amount,
                        'running_balance' => $runningBalance,
                        'description' => $transactionData['description'],
                        'payee_payer' => $transactionData['payee_payer'] ?? null,
                        'transaction_date' => $transactionData['transaction_date'],
                        'value_date' => $transactionData['transaction_date'],
                        'reconciliation_status' => 'unreconciled',
                    ]);

                    $importedCount++;
                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 1) . ": " . $e->getMessage();
                }
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Bank statement imported successfully.',
                'summary' => [
                    'imported_count' => $importedCount,
                    'skipped_count' => $skippedCount,
                    'errors' => $errors,
                ],
            ], 200);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error importing bank statement', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to import bank statement.',
            ], 500);
        }
    }

    private function recalculateRunningBalances($bankAccountId, $fromDate)
    {
        $bankAccount = BankAccount::find($bankAccountId);
        $openingBalance = $bankAccount->opening_balance;

        // Get all transactions from the start to recalculate
        $transactions = BankTransaction::where('bank_account_id', $bankAccountId)
            ->orderBy('transaction_date')
            ->orderBy('created_at')
            ->get();

        $runningBalance = $openingBalance;

        foreach ($transactions as $transaction) {
            $runningBalance = $transaction->transaction_type === 'credit'
                ? $runningBalance + $transaction->amount
                : $runningBalance - $transaction->amount;

            $transaction->update(['running_balance' => $runningBalance]);
        }

        // Update bank account current balance
        $bankAccount->update(['current_balance' => $runningBalance]);
    }
}
