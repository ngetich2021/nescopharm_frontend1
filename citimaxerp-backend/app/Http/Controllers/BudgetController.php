<?php

namespace App\Http\Controllers;

use App\Models\Budget;
use App\Models\BudgetLineItem;
use App\Models\ChartOfAccount;
use App\Models\FinancialPeriod;
use App\Services\LedgerBalanceService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Budgets: an amount per account for a financial period, compared with what the ledger shows
 * was actually spent (or earned) on those accounts over the same dates.
 *
 * Rewritten to match the budgets / budget_line_items tables - the previous version saved
 * columns that don't exist (start_date, total_budget...) so a budget could never be created.
 */
class BudgetController extends Controller
{
    private const TYPES = ['operating', 'capital', 'cash_flow', 'project', 'department'];

    public function __construct(protected LedgerBalanceService $ledger)
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
            return $resourceCompanyId === null || $user->company_id === $resourceCompanyId;
        }
        return $role->hasPermission($permission);
    }

    private function find(Request $request, string $id): ?Budget
    {
        return Budget::with(['financialPeriod', 'lineItems'])->where('company_id', $request->user()->company_id)->find($id);
    }

    /**
     * A budget with each line's actual from the ledger: expenses and assets as debits less
     * credits, income and liabilities the other way round.
     */
    private function present(Budget $budget, bool $withLines = true): array
    {
        $period = $budget->financialPeriod;
        $moves = $period
            ? $this->ledger->movements($budget->company_id, $period->start_date?->toDateString(), $period->end_date?->toDateString())
            : collect();
        $accounts = ChartOfAccount::whereIn('id', $budget->lineItems->pluck('chart_of_account_id'))->get()->keyBy('id');

        $lines = $budget->lineItems->map(function (BudgetLineItem $line) use ($moves, $accounts) {
            $account = $accounts->get($line->chart_of_account_id);
            $m = $moves->get($line->chart_of_account_id);
            $debit = (float) ($m->debit ?? 0);
            $credit = (float) ($m->credit ?? 0);
            $actual = in_array($account?->account_type, ['income', 'liability', 'equity'], true) ? $credit - $debit : $debit - $credit;
            $budgeted = (float) $line->budgeted_amount;
            return [
                'id' => $line->id,
                'chart_of_account_id' => $line->chart_of_account_id,
                'account_code' => $account?->account_code,
                'account_name' => $account?->account_name,
                'account_type' => $account?->account_type,
                'description' => $line->description,
                'budgeted_amount' => round($budgeted, 2),
                'actual_amount' => round($actual, 2),
                'variance' => round($budgeted - $actual, 2),
                'used_percentage' => $budgeted > 0 ? round($actual / $budgeted * 100, 1) : 0,
            ];
        })->values();

        $budgeted = round((float) $lines->sum('budgeted_amount'), 2);
        $actual = round((float) $lines->sum('actual_amount'), 2);

        return [
            'id' => $budget->id,
            'name' => $budget->name,
            'code' => $budget->code,
            'description' => $budget->description,
            'budget_type' => $budget->budget_type,
            'status' => $budget->status,
            'financial_period_id' => $budget->financial_period_id,
            'period' => $period ? [
                'id' => $period->id,
                'name' => $period->name,
                'start_date' => $period->start_date?->toDateString(),
                'end_date' => $period->end_date?->toDateString(),
            ] : null,
            'total_budgeted' => $budgeted,
            'total_actual' => $actual,
            'variance' => round($budgeted - $actual, 2),
            'used_percentage' => $budgeted > 0 ? round($actual / $budgeted * 100, 1) : 0,
            'approved_at' => $budget->approved_at,
            'created_at' => $budget->created_at,
            'line_items' => $withLines ? $lines->all() : null,
            'line_count' => $lines->count(),
        ];
    }

    public function index(Request $request): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_budgets', $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view budgets.'], 403);
        }
        $budgets = Budget::with(['financialPeriod', 'lineItems'])
            ->where('company_id', $request->user()->company_id)
            ->when($request->filled('status') && $request->input('status') !== 'all', fn ($q) => $q->where('status', $request->input('status')))
            ->when($request->filled('financial_period_id'), fn ($q) => $q->where('financial_period_id', $request->input('financial_period_id')))
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['status' => 'success', 'data' => $budgets->map(fn ($b) => $this->present($b, false))->values()]);
    }

    /** Periods to budget for and the accounts a budget line can use. */
    public function options(Request $request): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_budgets', $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        $companyId = $request->user()->company_id;

        return response()->json([
            'status' => 'success',
            'periods' => FinancialPeriod::where('company_id', $companyId)->orderByDesc('start_date')
                ->get(['id', 'name', 'start_date', 'end_date', 'status'])
                ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name, 'start_date' => $p->start_date?->toDateString(), 'end_date' => $p->end_date?->toDateString(), 'status' => $p->status]),
            'accounts' => ChartOfAccount::where('company_id', $companyId)->whereRaw('is_active = true')
                ->whereIn('account_type', ['expense', 'income', 'asset', 'liability'])
                ->orderBy('account_code')->get(['id', 'account_code', 'account_name', 'account_type']),
        ]);
    }

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'budget_type' => 'nullable|in:' . implode(',', self::TYPES),
            'financial_period_id' => 'nullable|uuid|exists:financial_periods,id',
            // A budget can name its own dates instead; a period is found or created for them.
            'start_date' => 'required_without:financial_period_id|nullable|date',
            'end_date' => 'required_without:financial_period_id|nullable|date|after:start_date',
            'line_items' => 'required|array|min:1',
            'line_items.*.chart_of_account_id' => 'required|uuid|exists:chart_of_accounts,id|distinct',
            'line_items.*.budgeted_amount' => 'required|numeric|min:0',
            'line_items.*.description' => 'nullable|string|max:255',
        ];
    }

    private function periodFor(Request $request): string
    {
        if ($request->filled('financial_period_id')) {
            return $request->input('financial_period_id');
        }
        $companyId = $request->user()->company_id;
        $start = Carbon::parse($request->input('start_date'))->toDateString();
        $end = Carbon::parse($request->input('end_date'))->toDateString();
        $existing = FinancialPeriod::where('company_id', $companyId)->whereDate('start_date', $start)->whereDate('end_date', $end)->first();
        if ($existing) {
            return $existing->id;
        }
        $months = Carbon::parse($start)->diffInMonths(Carbon::parse($end)->addDay());
        return FinancialPeriod::create([
            'company_id' => $companyId,
            'name' => $months >= 12 ? 'FY ' . Carbon::parse($start)->format('Y') : Carbon::parse($start)->format('M Y') . ' - ' . Carbon::parse($end)->format('M Y'),
            'period_type' => $months >= 12 ? 'annual' : ($months >= 6 ? 'semi_annual' : ($months >= 3 ? 'quarterly' : 'monthly')),
            'start_date' => $start,
            'end_date' => $end,
            'status' => 'open',
            'is_current' => false,
            'created_by' => $request->user()->id,
        ])->id;
    }

    private function saveLines(Budget $budget, array $lines): void
    {
        $budget->lineItems()->delete();
        foreach ($lines as $line) {
            BudgetLineItem::create([
                'budget_id' => $budget->id,
                'chart_of_account_id' => $line['chart_of_account_id'],
                'description' => $line['description'] ?? null,
                'budgeted_amount' => round((float) $line['budgeted_amount'], 2),
            ]);
        }
        $budget->update(['total_amount' => round(array_sum(array_map(fn ($l) => (float) $l['budgeted_amount'], $lines)), 2)]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_manage_budgets', $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to create budgets.'], 403);
        }
        $validator = Validator::make($request->all(), $this->rules());
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        $budget = DB::transaction(function () use ($request) {
            $budget = Budget::create([
                'company_id' => $request->user()->company_id,
                'financial_period_id' => $this->periodFor($request),
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'budget_type' => $request->input('budget_type', 'operating'),
                'status' => 'draft',
                'total_amount' => 0,
                'created_by' => $request->user()->id,
            ]);
            $this->saveLines($budget, $request->input('line_items'));
            return $budget;
        });

        return response()->json(['status' => 'success', 'message' => 'Budget created.', 'data' => $this->present($budget->fresh(['financialPeriod', 'lineItems']))], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $budget = $this->find($request, $id);
        if (!$budget) {
            return response()->json(['status' => 'failed', 'message' => 'Budget not found.'], 404);
        }
        return response()->json(['status' => 'success', 'data' => $this->present($budget)]);
    }

    // Same as show: every line's budget against its actual.
    public function getBudgetVsActual(Request $request, string $id): JsonResponse
    {
        return $this->show($request, $id);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_manage_budgets', $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to edit budgets.'], 403);
        }
        $budget = $this->find($request, $id);
        if (!$budget) {
            return response()->json(['status' => 'failed', 'message' => 'Budget not found.'], 404);
        }
        if ($budget->status !== 'draft') {
            return response()->json(['status' => 'failed', 'message' => 'Only a draft budget can be edited.'], 400);
        }
        $validator = Validator::make($request->all(), $this->rules());
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($request, $budget) {
            $budget->update([
                'financial_period_id' => $this->periodFor($request),
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'budget_type' => $request->input('budget_type', $budget->budget_type),
                'updated_by' => $request->user()->id,
            ]);
            $this->saveLines($budget, $request->input('line_items'));
        });

        return response()->json(['status' => 'success', 'message' => 'Budget updated.', 'data' => $this->present($budget->fresh(['financialPeriod', 'lineItems']))]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_manage_budgets', $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete budgets.'], 403);
        }
        $budget = $this->find($request, $id);
        if (!$budget) {
            return response()->json(['status' => 'failed', 'message' => 'Budget not found.'], 404);
        }
        if (!in_array($budget->status, ['draft', 'cancelled'], true)) {
            return response()->json(['status' => 'failed', 'message' => 'Only a draft or cancelled budget can be deleted.'], 400);
        }
        $budget->lineItems()->delete();
        $budget->delete();

        return response()->json(['status' => 'success', 'message' => 'Budget deleted.']);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_manage_budgets', $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to approve budgets.'], 403);
        }
        $budget = $this->find($request, $id);
        if (!$budget) {
            return response()->json(['status' => 'failed', 'message' => 'Budget not found.'], 404);
        }
        if ($budget->status !== 'draft') {
            return response()->json(['status' => 'failed', 'message' => 'Only a draft budget can be approved.'], 400);
        }
        $budget->update(['status' => 'approved', 'approved_by' => $request->user()->id, 'approved_at' => now()]);

        return response()->json(['status' => 'success', 'message' => 'Budget approved.', 'data' => $this->present($budget->fresh(['financialPeriod', 'lineItems']))]);
    }

    // Rejecting cancels the budget (the table has no separate "rejected" status).
    public function reject(Request $request, string $id): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_manage_budgets', $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to reject budgets.'], 403);
        }
        $budget = $this->find($request, $id);
        if (!$budget) {
            return response()->json(['status' => 'failed', 'message' => 'Budget not found.'], 404);
        }
        $budget->update(['status' => 'cancelled', 'updated_by' => $request->user()->id]);

        return response()->json(['status' => 'success', 'message' => 'Budget cancelled.']);
    }

    public function getSummary(Request $request): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_budgets', $request->user()->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view budgets.'], 403);
        }
        $budgets = Budget::with(['financialPeriod', 'lineItems'])->where('company_id', $request->user()->company_id)->get();
        $shown = $budgets->whereNotIn('status', ['cancelled'])->map(fn ($b) => $this->present($b, false));

        return response()->json(['status' => 'success', 'data' => [
            'total_budgets' => $budgets->count(),
            'by_status' => $budgets->countBy('status'),
            'total_budgeted' => round((float) $shown->sum('total_budgeted'), 2),
            'total_actual' => round((float) $shown->sum('total_actual'), 2),
        ]]);
    }
}
