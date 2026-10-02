<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BankAccountController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * Canonical permission logic: system admin can manage all, company admin can manage own, fallback to specific permission.
     */
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
        if (!$this->hasPermission($request, 'can_view_bank_accounts', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view bank accounts.',
            ], 403);
        }
        $query = BankAccount::with(['company', 'chartOfAccount']);
        $query->where('company_id', $user->company_id);

        // Filters
        if ($request->filled('is_active')) {
            $query->where('is_active', $request->input('is_active'));
        }

        if ($request->filled('account_type')) {
            $query->where('account_type', $request->input('account_type'));
        }

        if ($request->filled('bank_name')) {
            $query->where('bank_name', 'ilike', '%' . $request->input('bank_name') . '%');
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('account_name', 'ilike', '%' . $search . '%')
                  ->orWhere('account_number', 'ilike', '%' . $search . '%')
                  ->orWhere('bank_name', 'ilike', '%' . $search . '%');
            });
        }

        $accounts = $query->orderBy('account_name')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Bank accounts retrieved successfully.',
            'accounts' => $accounts,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $account = BankAccount::with(['company', 'chartOfAccount'])->find($id);

        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bank account not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_view_bank_accounts', $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this bank account.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Bank account retrieved successfully.',
            'account' => $account,
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'account_name' => 'required|string|max:255',
            'account_number' => 'required|string|max:255',
            'bank_name' => 'required|string|max:255',
            'bank_code' => 'nullable|string|max:20',
            'branch_name' => 'nullable|string|max:255',
            'branch_code' => 'nullable|string|max:20',
            'swift_code' => 'nullable|string|max:20',
            'iban' => 'nullable|string|max:50',
            'account_type' => 'required|in:checking,savings,money_market,certificate_of_deposit,other',
            'currency_code' => 'nullable|string|size:3',
            'current_balance' => 'nullable|numeric',
            'available_balance' => 'nullable|numeric',
            'is_active' => 'boolean',
            'allow_overdraft' => 'boolean',
            'overdraft_limit' => 'nullable|numeric|min:0',
            'description' => 'nullable|string',
            'bank_details' => 'nullable|array',
            'chart_of_account_id' => 'nullable|uuid|exists:chart_of_accounts,id',
            'company_id' => 'nullable|uuid|exists:companies,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_bank_accounts', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create bank accounts.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $account = BankAccount::create([
                'id' => (string) Str::uuid(),
                'company_id' => $request->input('company_id', $user->company_id),
                'chart_of_account_id' => $request->input('chart_of_account_id'),
                'account_name' => $request->input('account_name'),
                'account_number' => $request->input('account_number'),
                'bank_name' => $request->input('bank_name'),
                'bank_code' => $request->input('bank_code'),
                'branch_name' => $request->input('branch_name'),
                'branch_code' => $request->input('branch_code'),
                'swift_code' => $request->input('swift_code'),
                'iban' => $request->input('iban'),
                'account_type' => $request->input('account_type'),
                'currency_code' => $request->input('currency_code', 'KES'),
                'current_balance' => $request->input('current_balance', 0),
                'available_balance' => $request->input('available_balance', $request->input('current_balance', 0)),
                'is_active' => $request->input('is_active', true),
                'allow_overdraft' => $request->input('allow_overdraft', false),
                'overdraft_limit' => $request->input('overdraft_limit', 0),
                'description' => $request->input('description'),
                'bank_details' => $request->input('bank_details'),
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            DB::commit();

            $account->load(['company', 'chartOfAccount']);

            return response()->json([
                'status' => 'success',
                'message' => 'Bank account created successfully.',
                'account' => $account,
            ], 201);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error creating bank account', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create bank account.',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $account = BankAccount::find($id);

        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bank account not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_update_bank_accounts', $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this bank account.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_update_bank_accounts', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit bank accounts.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'account_name' => 'sometimes|required|string|max:255',
            'account_number' => 'sometimes|required|string|max:255',
            'bank_name' => 'sometimes|required|string|max:255',
            'bank_code' => 'nullable|string|max:20',
            'branch_name' => 'nullable|string|max:255',
            'branch_code' => 'nullable|string|max:20',
            'swift_code' => 'nullable|string|max:20',
            'iban' => 'nullable|string|max:50',
            'account_type' => 'sometimes|required|in:checking,savings,money_market,certificate_of_deposit,other',
            'currency_code' => 'nullable|string|size:3',
            'current_balance' => 'nullable|numeric',
            'available_balance' => 'nullable|numeric',
            'is_active' => 'boolean',
            'allow_overdraft' => 'boolean',
            'overdraft_limit' => 'nullable|numeric|min:0',
            'description' => 'nullable|string',
            'bank_details' => 'nullable|array',
            'chart_of_account_id' => 'nullable|uuid|exists:chart_of_accounts,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $user = $request->user();
            $account->update(array_merge(
                $request->only([
                    'account_name', 'account_number', 'bank_name', 'bank_code',
                    'branch_name', 'branch_code', 'swift_code', 'iban',
                    'account_type', 'currency_code', 'current_balance',
                    'available_balance', 'is_active', 'allow_overdraft',
                    'overdraft_limit', 'description', 'bank_details',
                    'chart_of_account_id'
                ]),
                ['updated_by' => $user->id]
            ));

            DB::commit();

            $account->load(['company', 'chartOfAccount']);

            return response()->json([
                'status' => 'success',
                'message' => 'Bank account updated successfully.',
                'account' => $account,
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error updating bank account', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update bank account.',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $account = BankAccount::find($id);

        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bank account not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_delete_bank_accounts', $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this bank account.',
            ], 403);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_bank_accounts', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete bank accounts.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            // Check if account has transactions
            if ($account->transactions()->count() > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot delete bank account with existing transactions.',
                ], 400);
            }

            $account->delete();

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Bank account deleted successfully.',
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error deleting bank account', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete bank account.',
            ], 500);
        }
    }

    public function getBalance(Request $request, $id)
    {
        $account = BankAccount::find($id);

        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bank account not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_view_bank_accounts', $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this bank account balance.',
            ], 403);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_bank_accounts', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view bank account balance.',
            ], 403);
        }

        $calculatedBalance = $account->calculateBalance();

        return response()->json([
            'status' => 'success',
            'message' => 'Bank account balance retrieved successfully.',
            'account_id' => $account->id,
            'account_name' => $account->account_name,
            'current_balance' => $account->current_balance,
            'calculated_balance' => $calculatedBalance,
            'available_balance' => $account->getAvailableBalanceAttribute(),
            'is_overdrawn' => $account->isOverdrawn(),
            'currency_code' => $account->currency_code,
        ], 200);
    }

    public function getTransactions(Request $request, $id)
    {
        $account = BankAccount::find($id);

        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Bank account not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_view_bank_transactions', $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this bank account transactions.',
            ], 403);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_bank_transactions', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view bank transactions.',
            ], 403);
        }

        $query = $account->transactions()->with('journalEntry');

        // Filters
        if ($request->filled('date_from')) {
            $query->where('transaction_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('transaction_date', '<=', $request->input('date_to'));
        }

        if ($request->filled('transaction_type')) {
            $query->where('transaction_type', $request->input('transaction_type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('is_reconciled')) {
            $query->where('is_reconciled', $request->input('is_reconciled'));
        }

        $transactions = $query->orderBy('transaction_date', 'desc')
                             ->orderBy('created_at', 'desc')
                             ->paginate(50);

        return response()->json([
            'status' => 'success',
            'message' => 'Bank transactions retrieved successfully.',
            'account' => $account->only(['id', 'account_name', 'account_number', 'bank_name']),
            'transactions' => $transactions,
        ], 200);
    }
}
