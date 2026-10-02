<?php

namespace App\Http\Controllers;

use App\Models\BankReconciliation;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\ReconciliationItem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class BankReconciliationController extends Controller
{
    /**
     * Canonical multi-tenant permission check: system admin, company admin, or specific permission.
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
  public function __construct()
    {
        $this->middleware('auth:sanctum');
    }


    /**
     * Display a listing of bank reconciliations.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_bank_reconciliation', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view bank reconciliations.'], 403);
        }
        $query = BankReconciliation::with(['bankAccount', 'reconciliationItems']);
        $companyId = $user->company_id;
        if ($this->hasPermission($request, 'can_manage_system') && $request->filled('company_id')) {
            $companyId = $request->input('company_id');
        }
        $query->where('company_id', $companyId);
        if ($request->has('bank_account_id')) {
            $query->where('bank_account_id', $request->bank_account_id);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('reconciliation_date', [$request->start_date, $request->end_date]);
        }
        $reconciliations = $query->orderBy('reconciliation_date', 'desc')
                                ->paginate($request->get('per_page', 15));
        return response()->json($reconciliations);
    }

    /**
     * Store a newly created bank reconciliation.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, "can_manage_company", $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to create bank reconciliation.'], 403);
        }
        $validator = Validator::make($request->all(), [
            'bank_account_id' => 'required|exists:bank_accounts,id',
            'reconciliation_date' => 'required|date',
            'statement_balance' => 'required|numeric',
            'book_balance' => 'required|numeric',
            'notes' => 'nullable|string',
            'transactions' => 'array',
            'transactions.*.transaction_id' => 'required|exists:bank_transactions,id',
            'transactions.*.reconciled_amount' => 'required|numeric',
            'transactions.*.is_cleared' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $reconciliation = BankReconciliation::create([
                'bank_account_id' => $request->bank_account_id,
                'reconciliation_date' => $request->reconciliation_date,
                'statement_balance' => $request->statement_balance,
                'book_balance' => $request->book_balance,
                'difference' => $request->statement_balance - $request->book_balance,
                'status' => 'draft',
                'notes' => $request->notes,
                'company_id' => auth()->user()->company_id,
            ]);

            // Add reconciliation items
            if ($request->has('transactions')) {
                foreach ($request->transactions as $transaction) {
                    ReconciliationItem::create([
                        'reconciliation_id' => $reconciliation->id,
                        'transaction_id' => $transaction['transaction_id'],
                        'reconciled_amount' => $transaction['reconciled_amount'],
                        'is_cleared' => $transaction['is_cleared'] ?? false,
                        'company_id' => auth()->user()->company_id,
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Bank reconciliation created successfully',
                'data' => $reconciliation->load(['bankAccount', 'reconciliationItems'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create reconciliation', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified bank reconciliation.
     */
    public function show(string $id): JsonResponse
    {
        $reconciliation = BankReconciliation::with(['bankAccount', 'reconciliationItems.transaction'])
                                          ->findOrFail($id);
        $user = request()->user();
        if (!$this->canManageCompany(request(), $reconciliation->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view this reconciliation.'], 403);
        }
        return response()->json($reconciliation);
    }

    /**
     * Update the specified bank reconciliation.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $reconciliation = BankReconciliation::findOrFail($id);
        $user = $request->user();
        if (!$this->hasPermission($request, "can_manage_company", $reconciliation->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to update this reconciliation.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'statement_balance' => 'sometimes|numeric',
            'book_balance' => 'sometimes|numeric',
            'status' => 'sometimes|in:draft,completed,cancelled',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $reconciliation->update($request->only([
                'statement_balance', 'book_balance', 'status', 'notes'
            ]));

            // Recalculate difference
            if ($request->has('statement_balance') || $request->has('book_balance')) {
                $reconciliation->difference = $reconciliation->statement_balance - $reconciliation->book_balance;
                $reconciliation->save();
            }

            DB::commit();

            return response()->json([
                'message' => 'Bank reconciliation updated successfully',
                'data' => $reconciliation->load(['bankAccount', 'reconciliationItems'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update reconciliation', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified bank reconciliation.
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $reconciliation = BankReconciliation::findOrFail($id);
            $user = request()->user();
            if (!$this->canManageCompany(request(), $reconciliation->company_id)) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete this reconciliation.'], 403);
            }
            if ($reconciliation->status === 'completed') {
                return response()->json(['message' => 'Cannot delete completed reconciliation'], 400);
            }
            DB::beginTransaction();
            $reconciliation->reconciliationItems()->delete();
            $reconciliation->delete();
            DB::commit();
            return response()->json(['message' => 'Bank reconciliation deleted successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to delete reconciliation', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get unreconciled transactions for a bank account.
     */
    public function getUnreconciledTransactions(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'bank_account_id' => 'required|exists:bank_accounts,id',
            'end_date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $transactions = BankTransaction::where('bank_account_id', $request->bank_account_id)
            ->where('transaction_date', '<=', $request->end_date)
            ->whereDoesntHave('reconciliationItems', function ($query) {
                $query->whereHas('reconciliation', function ($q) {
                    $q->where('status', 'completed');
                });
            })
            ->orderBy('transaction_date', 'desc')
            ->get();

        return response()->json($transactions);
    }

    /**
     * Complete a bank reconciliation.
     */
    public function complete(string $id): JsonResponse
    {
        try {
            $reconciliation = BankReconciliation::findOrFail($id);

            if ($reconciliation->status === 'completed') {
                return response()->json(['message' => 'Reconciliation already completed'], 400);
            }

            DB::beginTransaction();

            $reconciliation->update([
                'status' => 'completed',
                'completed_at' => now(),
                'completed_by' => auth()->id(),
            ]);

            // Mark all reconciliation items as cleared
            $reconciliation->reconciliationItems()->update(['is_cleared' => true]);

            DB::commit();

            return response()->json([
                'message' => 'Bank reconciliation completed successfully',
                'data' => $reconciliation->load(['bankAccount', 'reconciliationItems'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to complete reconciliation', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get reconciliation summary statistics.
     */
    public function getSummary(Request $request): JsonResponse
    {
        $bankAccountId = $request->get('bank_account_id');
        $startDate = $request->get('start_date', now()->startOfMonth());
        $endDate = $request->get('end_date', now()->endOfMonth());

        $query = BankReconciliation::query();

        if ($bankAccountId) {
            $query->where('bank_account_id', $bankAccountId);
        }

        $summary = $query->whereBetween('reconciliation_date', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_reconciliations,
                COUNT(CASE WHEN status = "completed" THEN 1 END) as completed_reconciliations,
                COUNT(CASE WHEN status = "draft" THEN 1 END) as draft_reconciliations,
                SUM(ABS(difference)) as total_differences,
                AVG(ABS(difference)) as average_difference
            ')
            ->first();

        return response()->json($summary);
    }
}
