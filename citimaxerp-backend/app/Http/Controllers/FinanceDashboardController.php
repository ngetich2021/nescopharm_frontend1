<?php

namespace App\Http\Controllers;

use App\Models\ChartOfAccount;
use App\Models\CompanyAccountingSettings;
use App\Models\CompanyAccountMapping;
use App\Models\JournalEntry;
use App\Services\LedgerBalanceService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinanceDashboardController extends Controller
{
    public function __construct(protected LedgerBalanceService $balances)
    {
        $this->middleware('auth:sanctum');
    }

    protected function canView(Request $request): bool
    {
        $role = $request->user()->role;
        if (!$role) {
            return false;
        }
        foreach (['can_manage_system', 'can_manage_company', 'can_view_finance_menu', 'can_view_financial_reports', 'can_view_chart_of_accounts'] as $permission) {
            if ($role->hasPermission($permission)) {
                return true;
            }
        }
        return false;
    }

    public function summary(Request $request)
    {
        if (!$this->canView($request)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view finance summary.'], 403);
        }

        $companyId = $request->user()->company_id;
        $today = now()->toDateString();

        $accounts = ChartOfAccount::where('company_id', $companyId)->get();
        $balances = $this->balances->balances($companyId, $today, $accounts);
        $byType = $accounts->groupBy('account_type');
        $total = fn (string $type, string $side) => $this->balances->signedTotal($byType->get($type, collect()), $balances, $side);

        $assets = $total('asset', 'debit');
        $liabilities = $total('liability', 'credit');
        $equityAccounts = $total('equity', 'credit');
        $incomeAllTime = $total('income', 'credit');
        $expenseAllTime = $total('expense', 'debit');

        // Year to date P&L, honouring the company's financial year start.
        $startMonth = (int) (CompanyAccountingSettings::where('company_id', $companyId)->value('financial_year_start_month') ?: 1);
        $yearStart = Carbon::create(now()->year, $startMonth, 1);
        if ($yearStart->isFuture()) {
            $yearStart->subYear();
        }
        $ytd = $this->balances->movements($companyId, $yearStart->toDateString(), $today);
        $ytdTotal = function (string $type, string $side) use ($byType, $ytd) {
            // Net movement across every account of the type; contra accounts
            // (e.g. Sales Returns under income) naturally reduce the total.
            return round($byType->get($type, collect())->sum(function ($account) use ($ytd, $side) {
                $m = $ytd->get($account->id);
                $debit = (float) ($m->debit ?? 0);
                $credit = (float) ($m->credit ?? 0);
                return $side === 'credit' ? $credit - $debit : $debit - $credit;
            }), 2);
        };
        $revenueYtd = $ytdTotal('income', 'credit');
        $expensesYtd = $ytdTotal('expense', 'debit');

        $mappedTotal = function (array $keys) use ($companyId, $balances) {
            $ids = CompanyAccountMapping::where('company_id', $companyId)
                ->whereIn('mapping_key', $keys)
                ->whereNull('context_type')
                ->pluck('chart_of_account_id')
                ->filter()
                ->unique();
            return round($ids->sum(fn ($id) => (float) ($balances->get($id) ?? 0)), 2);
        };

        $entryTotals = DB::table('journal_entry_items as i')
            ->join('journal_entries as e', 'e.id', '=', 'i.journal_entry_id')
            ->where('e.company_id', $companyId)
            ->whereIn('e.status', JournalEntry::LEDGER_STATUSES)
            ->selectRaw('COALESCE(SUM(i.debit_amount),0) d, COALESCE(SUM(i.credit_amount),0) c')
            ->first();

        return response()->json([
            'status' => 'success',
            'data' => [
                'as_of' => $today,
                'total_assets' => $assets,
                'total_liabilities' => $liabilities,
                'total_equity' => round($equityAccounts + $incomeAllTime - $expenseAllTime, 2),
                'retained_earnings_to_date' => round($incomeAllTime - $expenseAllTime, 2),
                'cash_and_bank' => $mappedTotal(['cash_on_hand', 'petty_cash', 'main_bank', 'mpesa_float']),
                'accounts_receivable' => $mappedTotal(['accounts_receivable', 'trade_receivables']),
                'accounts_payable' => $mappedTotal(['accounts_payable', 'trade_payables']),
                'vat_payable' => $mappedTotal(['vat_payable']),
                'financial_year_start' => $yearStart->toDateString(),
                'revenue_ytd' => $revenueYtd,
                'expenses_ytd' => $expensesYtd,
                'net_income_ytd' => round($revenueYtd - $expensesYtd, 2),
                'draft_entries' => JournalEntry::where('company_id', $companyId)->where('status', 'draft')->count(),
                'posted_entries' => JournalEntry::where('company_id', $companyId)->where('status', 'posted')->count(),
                'books_balanced' => abs((float) $entryTotals->d - (float) $entryTotals->c) < 0.01,
                'monthly' => $this->monthlyTrend($companyId),
                'recent_entries' => JournalEntry::where('company_id', $companyId)
                    ->orderByDesc('created_at')
                    ->limit(8)
                    ->get(['id', 'entry_number', 'entry_date', 'reference', 'description', 'total_debit', 'status', 'source_type']),
            ],
        ]);
    }

    /**
     * Revenue and expenses per month for the last 12 months.
     */
    protected function monthlyTrend(string $companyId): array
    {
        $start = now()->startOfMonth()->subMonths(11);

        $rows = DB::table('journal_entry_items as i')
            ->join('journal_entries as e', 'e.id', '=', 'i.journal_entry_id')
            ->join('chart_of_accounts as a', 'a.id', '=', 'i.account_id')
            ->where('e.company_id', $companyId)
            ->whereIn('e.status', JournalEntry::LEDGER_STATUSES)
            ->whereIn('a.account_type', ['income', 'expense'])
            ->where('e.entry_date', '>=', $start->toDateString())
            ->groupByRaw("to_char(e.entry_date, 'YYYY-MM'), a.account_type")
            ->selectRaw("to_char(e.entry_date, 'YYYY-MM') as month, a.account_type, SUM(i.debit_amount) as d, SUM(i.credit_amount) as c")
            ->get();

        $months = [];
        for ($m = $start->copy(); $m <= now(); $m->addMonth()) {
            $months[$m->format('Y-m')] = ['month' => $m->format('Y-m'), 'label' => $m->format('M Y'), 'revenue' => 0.0, 'expenses' => 0.0];
        }
        foreach ($rows as $row) {
            if (!isset($months[$row->month])) {
                continue;
            }
            if ($row->account_type === 'income') {
                $months[$row->month]['revenue'] = round((float) $row->c - (float) $row->d, 2);
            } else {
                $months[$row->month]['expenses'] = round((float) $row->d - (float) $row->c, 2);
            }
        }

        return array_values($months);
    }
}
