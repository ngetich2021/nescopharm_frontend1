<?php

namespace App\Http\Controllers;

use App\Models\Budget;
use App\Models\BudgetLineItem;
use App\Models\ChartOfAccount;
use App\Models\FinancialPeriod;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class BudgetController extends Controller
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
     * Display a listing of budgets.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_budgets', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view budgets.',
            ], 403);
        }
        $query = Budget::with(['financialPeriod', 'budgetLineItems.account']);
        $query->where('company_id', $user->company_id);
        if ($request->has('financial_period_id')) {
            $query->where('financial_period_id', $request->financial_period_id);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('budget_type')) {
            $query->where('budget_type', $request->budget_type);
        }
        if ($request->has('search')) {
            $query->where('name', 'ilike', '%' . $request->search . '%');
        }
        $budgets = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));
        return response()->json($budgets);
    }

    /**
     * Store a newly created budget.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'financial_period_id' => 'required|exists:financial_periods,id',
            'budget_type' => 'required|in:annual,quarterly,monthly,project',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'line_items' => 'required|array|min:1',
            'line_items.*.account_id' => 'required|exists:chart_of_accounts,id',
            'line_items.*.budgeted_amount' => 'required|numeric|min:0',
            'line_items.*.department' => 'nullable|string',
            'line_items.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $totalBudget = collect($request->line_items)->sum('budgeted_amount');

            $budget = Budget::create([
                'name' => $request->name,
                'description' => $request->description,
                'financial_period_id' => $request->financial_period_id,
                'budget_type' => $request->budget_type,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'total_budget' => $totalBudget,
                'status' => 'draft',
                'company_id' => auth()->user()->company_id,
                'created_by' => auth()->id(),
            ]);

            // Create budget line items
            foreach ($request->line_items as $lineItem) {
                BudgetLineItem::create([
                    'budget_id' => $budget->id,
                    'account_id' => $lineItem['account_id'],
                    'budgeted_amount' => $lineItem['budgeted_amount'],
                    'department' => $lineItem['department'] ?? null,
                    'notes' => $lineItem['notes'] ?? null,
                    'company_id' => auth()->user()->company_id,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Budget created successfully',
                'data' => $budget->load(['financialPeriod', 'budgetLineItems.account'])
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create budget', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified budget.
     */
    public function show(string $id): JsonResponse
    {
        $budget = Budget::with(['financialPeriod', 'budgetLineItems.account'])
            ->findOrFail($id);

        return response()->json($budget);
    }

    /**
     * Update the specified budget.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $budget = Budget::findOrFail($id);

        if ($budget->status === 'approved') {
            return response()->json(['message' => 'Cannot update approved budget'], 400);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'budget_type' => 'sometimes|in:annual,quarterly,monthly,project',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after:start_date',
            'status' => 'sometimes|in:draft,submitted,approved,rejected',
            'line_items' => 'sometimes|array|min:1',
            'line_items.*.id' => 'sometimes|exists:budget_line_items,id',
            'line_items.*.account_id' => 'required|exists:chart_of_accounts,id',
            'line_items.*.budgeted_amount' => 'required|numeric|min:0',
            'line_items.*.department' => 'nullable|string',
            'line_items.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            // Update budget
            $budget->update($request->only([
                'name',
                'description',
                'budget_type',
                'start_date',
                'end_date',
                'status'
            ]));

            // Update line items if provided
            if ($request->has('line_items')) {
                // Delete existing line items
                $budget->budgetLineItems()->delete();

                // Create new line items
                $totalBudget = 0;
                foreach ($request->line_items as $lineItem) {
                    BudgetLineItem::create([
                        'budget_id' => $budget->id,
                        'account_id' => $lineItem['account_id'],
                        'budgeted_amount' => $lineItem['budgeted_amount'],
                        'department' => $lineItem['department'] ?? null,
                        'notes' => $lineItem['notes'] ?? null,
                        'company_id' => auth()->user()->company_id,
                    ]);
                    $totalBudget += $lineItem['budgeted_amount'];
                }

                $budget->update(['total_budget' => $totalBudget]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Budget updated successfully',
                'data' => $budget->load(['financialPeriod', 'budgetLineItems.account'])
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update budget', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified budget.
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $budget = Budget::findOrFail($id);

            if ($budget->status === 'approved') {
                return response()->json(['message' => 'Cannot delete approved budget'], 400);
            }

            DB::beginTransaction();

            // Delete budget line items first
            $budget->budgetLineItems()->delete();
            $budget->delete();

            DB::commit();

            return response()->json(['message' => 'Budget deleted successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to delete budget', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Approve a budget.
     */
    public function approve(string $id): JsonResponse
    {
        try {
            $budget = Budget::findOrFail($id);

            if ($budget->status === 'approved') {
                return response()->json(['message' => 'Budget already approved'], 400);
            }

            $budget->update([
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Budget approved successfully',
                'data' => $budget->load(['financialPeriod', 'budgetLineItems.account'])
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to approve budget', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Reject a budget.
     */
    public function reject(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'rejection_reason' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $budget = Budget::findOrFail($id);

            $budget->update([
                'status' => 'rejected',
                'rejection_reason' => $request->rejection_reason,
                'rejected_at' => now(),
                'rejected_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Budget rejected successfully',
                'data' => $budget->load(['financialPeriod', 'budgetLineItems.account'])
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to reject budget', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get budget vs actual comparison.
     */
    public function getBudgetVsActual(string $id): JsonResponse
    {
        $budget = Budget::with(['budgetLineItems.account'])->findOrFail($id);

        $comparison = [];

        foreach ($budget->budgetLineItems as $lineItem) {
            // Get actual spending for this account during budget period
            $actualAmount = DB::table('journal_entry_items')
                ->join('journal_entries', 'journal_entry_items.journal_entry_id', '=', 'journal_entries.id')
                ->where('journal_entry_items.account_id', $lineItem->account_id)
                ->whereBetween('journal_entries.transaction_date', [$budget->start_date, $budget->end_date])
                ->where('journal_entries.status', 'posted')
                ->sum(DB::raw('
                    CASE 
                        WHEN journal_entry_items.type = "debit" THEN journal_entry_items.amount
                        ELSE -journal_entry_items.amount
                    END
                '));

            $variance = $lineItem->budgeted_amount - $actualAmount;
            $variancePercent = $lineItem->budgeted_amount > 0
                ? ($variance / $lineItem->budgeted_amount) * 100
                : 0;

            $comparison[] = [
                'account' => $lineItem->account,
                'budgeted_amount' => $lineItem->budgeted_amount,
                'actual_amount' => $actualAmount,
                'variance' => $variance,
                'variance_percent' => round($variancePercent, 2),
                'department' => $lineItem->department,
                'notes' => $lineItem->notes,
            ];
        }

        return response()->json([
            'budget' => $budget,
            'comparison' => $comparison,
            'summary' => [
                'total_budgeted' => $budget->total_budget,
                'total_actual' => collect($comparison)->sum('actual_amount'),
                'total_variance' => collect($comparison)->sum('variance'),
            ]
        ]);
    }

    /**
     * Get budget summary statistics.
     */
    public function getSummary(Request $request): JsonResponse
    {
        $financialPeriodId = $request->get('financial_period_id');
        $budgetType = $request->get('budget_type');

        $query = Budget::query();

        if ($financialPeriodId) {
            $query->where('financial_period_id', $financialPeriodId);
        }

        if ($budgetType) {
            $query->where('budget_type', $budgetType);
        }

        $summary = $query->selectRaw('
                COUNT(*) as total_budgets,
                COUNT(CASE WHEN status = "approved" THEN 1 END) as approved_budgets,
                COUNT(CASE WHEN status = "draft" THEN 1 END) as draft_budgets,
                COUNT(CASE WHEN status = "submitted" THEN 1 END) as pending_budgets,
                SUM(total_budget) as total_budget_amount,
                AVG(total_budget) as average_budget_amount
            ')
            ->first();

        return response()->json($summary);
    }

    /**
     * Copy budget from previous period.
     */
    public function copyFromPrevious(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'source_budget_id' => 'required|exists:budgets,id',
            'name' => 'required|string|max:255',
            'financial_period_id' => 'required|exists:financial_periods,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'adjustment_percentage' => 'nullable|numeric',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $sourceBudget = Budget::with('budgetLineItems')->findOrFail($request->source_budget_id);
            $adjustmentFactor = 1 + (($request->adjustment_percentage ?? 0) / 100);

            $newBudget = Budget::create([
                'name' => $request->name,
                'description' => $sourceBudget->description,
                'financial_period_id' => $request->financial_period_id,
                'budget_type' => $sourceBudget->budget_type,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'total_budget' => $sourceBudget->total_budget * $adjustmentFactor,
                'status' => 'draft',
                'company_id' => auth()->user()->company_id,
                'created_by' => auth()->id(),
            ]);

            // Copy line items
            foreach ($sourceBudget->budgetLineItems as $lineItem) {
                BudgetLineItem::create([
                    'budget_id' => $newBudget->id,
                    'account_id' => $lineItem->account_id,
                    'budgeted_amount' => $lineItem->budgeted_amount * $adjustmentFactor,
                    'department' => $lineItem->department,
                    'notes' => $lineItem->notes,
                    'company_id' => auth()->user()->company_id,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Budget copied successfully',
                'data' => $newBudget->load(['financialPeriod', 'budgetLineItems.account'])
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to copy budget', 'error' => $e->getMessage()], 500);
        }
    }
}
