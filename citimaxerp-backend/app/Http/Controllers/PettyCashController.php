<?php

namespace App\Http\Controllers;

use App\Models\BankTransfer;
use App\Models\ChartOfAccount;
use App\Models\Expense;
use App\Models\PettyCashCount;
use App\Services\CashBookService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Expenses > Petty Cash: the Cash at Hand / Petty Cash account as its own book. Cash comes in
 * from Prime Bank withdrawals (transfers, Contra), goes out as cash expenses charged to their
 * expense accounts, and is counted physically against the books - the difference being a shortage
 * or surplus. Daily and monthly reconciliation: opening, received, spent, closing, counted.
 */
class PettyCashController extends Controller
{
    public function __construct(protected CashBookService $books)
    {
        $this->middleware('auth:sanctum');
    }

    protected function can(Request $request, array $permissions): bool
    {
        $role = $request->user()->role;
        if (!$role) {
            return false;
        }
        foreach (array_merge(['can_manage_system', 'can_manage_company'], $permissions) as $p) {
            if ($role->hasPermission($p)) {
                return true;
            }
        }
        return false;
    }

    /** The petty cash account: what the Petty Cash mapping points to, else Cash on Hand. */
    protected function cashAccount(string $companyId): ?ChartOfAccount
    {
        $mapped = fn (string $key) => DB::table('company_account_mappings')->where('company_id', $companyId)
            ->whereNull('context_type')->where('mapping_key', $key)->where('is_active', true)->value('chart_of_account_id');
        $id = $mapped('petty_cash') ?: $mapped('cash_on_hand');

        return $id ? ChartOfAccount::where('company_id', $companyId)->find($id) : null;
    }

    protected function bankAccountId(string $companyId): ?string
    {
        return DB::table('company_account_mappings')->where('company_id', $companyId)->whereNull('context_type')
            ->where('mapping_key', 'main_bank')->where('is_active', true)->value('chart_of_account_id');
    }

    public function show(Request $request)
    {
        if (!$this->can($request, ['can_view_expenses_menu', 'can_view_expenses', 'can_view_bank_accounts'])) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view petty cash.'], 403);
        }
        $companyId = $request->user()->company_id;
        $account = $this->cashAccount($companyId);
        if (!$account) {
            return response()->json(['status' => 'failed', 'message' => 'No Cash at Hand / Petty Cash account is set up. Map "Petty Cash" or "Cash on Hand" in Finance > Account Mappings.'], 422);
        }

        $from = $request->input('date_from') ?: now()->startOfMonth()->toDateString();
        $to = $request->input('date_to') ?: now()->toDateString();
        $period = $request->input('period') === 'month' ? 'month' : 'day';
        $book = $this->books->book($companyId, $account, $from, $to, $request->boolean('show_corrections'));

        // Supporting documents and categories for rows that are expenses.
        $expenseIds = collect($book['rows'])->where('source_type', Expense::class)->pluck('source_id')->filter()->unique();
        $expenses = Expense::with('category:id,name')->whereIn('id', $expenseIds)->get()->keyBy('id');
        $book['rows'] = collect($book['rows'])->map(function ($r) use ($expenses) {
            $e = $r['source_type'] === Expense::class ? $expenses->get($r['source_id']) : null;
            $r['expense_id'] = $e?->id;
            $r['category'] = $e?->category?->name;
            $r['receipt_url'] = $e?->receipt_url;
            $r['kind'] = $r['voucher_type'] === 'Contra' ? ($r['debit'] > 0 ? 'withdrawal' : 'transfer_out') : ($r['debit'] > 0 ? 'receipt' : 'expense');
            unset($r['source_type'], $r['source_id']);
            return $r;
        })->values()->all();

        $counts = PettyCashCount::with('counter:id,first_name,last_name')->where('company_id', $companyId)
            ->where('account_id', $account->id)->whereBetween('count_date', [$from, $to])
            ->orderBy('count_date')->orderBy('created_at')->get();

        $rows = collect($book['rows']);
        $received = round($rows->where('kind', 'withdrawal')->sum('debit'), 2);
        $otherIn = round($rows->where('kind', 'receipt')->sum('debit'), 2);
        $spent = round($rows->where('kind', 'expense')->sum('credit'), 2);
        $otherOut = round($rows->where('kind', 'transfer_out')->sum('credit'), 2);

        return response()->json(['status' => 'success', 'data' => [
            'account' => $book['account'],
            'date_from' => $from,
            'date_to' => $to,
            'period' => $period,
            'balance_now' => (float) ($this->books->moneyAccounts($companyId)->firstWhere('id', $account->id)['balance'] ?? 0),
            'summary' => [
                'opening' => $book['opening_balance']['signed'],
                'received_from_bank' => $received,
                'other_receipts' => $otherIn,
                'spent' => $spent,
                'transferred_out' => $otherOut,
                'closing' => $book['closing_balance']['signed'],
                'last_count' => $counts->last() ? $this->countRow($counts->last()) : null,
            ],
            'by_account' => $rows->where('credit', '>', 0)->groupBy(fn ($r) => $r['account'] ?? $r['particulars'])
                ->map(fn ($g, $name) => ['account' => $name, 'count' => $g->count(), 'amount' => round($g->sum('credit'), 2)])
                ->sortByDesc('amount')->values(),
            'book' => $book,
            'reconciliation' => $this->reconciliation($book, $counts, $period),
            'counts' => $counts->map(fn ($c) => $this->countRow($c))->values(),
        ]]);
    }

    /** One line per day (or month): opening, cash in from the bank, other cash in, spent, closing, and the count if one was made. */
    protected function reconciliation(array $book, $counts, string $period): array
    {
        $key = fn (string $date) => $period === 'month' ? substr($date, 0, 7) : $date;
        $lines = [];
        $running = $book['opening_balance']['signed'];
        foreach ($book['rows'] as $r) {
            $k = $key($r['date']);
            $lines[$k] ??= ['period' => $k, 'opening' => $running, 'received_from_bank' => 0.0, 'other_receipts' => 0.0, 'spent' => 0.0, 'transferred_out' => 0.0, 'entries' => 0];
            $l = &$lines[$k];
            match ($r['kind']) {
                'withdrawal' => $l['received_from_bank'] += $r['debit'],
                'receipt' => $l['other_receipts'] += $r['debit'],
                'transfer_out' => $l['transferred_out'] += $r['credit'],
                default => $l['spent'] += $r['credit'],
            };
            $l['entries']++;
            $running = $r['running'];
            $l['closing'] = $running;
            unset($l);
        }
        // A count on a day with no cash movement still gets its line.
        foreach ($counts as $c) {
            $k = $key($c->count_date->toDateString());
            if (!isset($lines[$k])) {
                $lines[$k] = ['period' => $k, 'opening' => (float) $c->system_balance, 'received_from_bank' => 0.0, 'other_receipts' => 0.0, 'spent' => 0.0, 'transferred_out' => 0.0, 'entries' => 0, 'closing' => (float) $c->system_balance];
            }
        }
        ksort($lines);
        // Carry the opening of a count-only line from the line before it.
        $prevClose = $book['opening_balance']['signed'];
        foreach ($lines as $k => &$l) {
            if ($l['entries'] === 0) {
                $l['opening'] = $l['closing'] = $prevClose;
            }
            $prevClose = $l['closing'];
            $last = $counts->filter(fn ($c) => $key($c->count_date->toDateString()) === $k)->last();
            $l['counted'] = $last ? (float) $last->counted_amount : null;
            $l['system_at_count'] = $last ? (float) $last->system_balance : null;
            $l['difference'] = $last ? (float) $last->difference : null;
            $l['status'] = !$last ? 'not_counted' : (abs((float) $last->difference) < 0.005 ? 'balanced' : ((float) $last->difference < 0 ? 'shortage' : 'surplus'));
            foreach (['opening', 'received_from_bank', 'other_receipts', 'spent', 'transferred_out', 'closing'] as $f) {
                $l[$f] = round((float) $l[$f], 2);
            }
        }
        unset($l);

        return array_values($lines);
    }

    protected function countRow(PettyCashCount $c): array
    {
        $d = (float) $c->difference;
        return [
            'id' => $c->id,
            'count_date' => $c->count_date->toDateString(),
            'counted_amount' => (float) $c->counted_amount,
            'system_balance' => (float) $c->system_balance,
            'difference' => $d,
            'status' => abs($d) < 0.005 ? 'balanced' : ($d < 0 ? 'shortage' : 'surplus'),
            'denominations' => $c->denominations,
            'notes' => $c->notes,
            'counted_by' => $c->counter ? trim("{$c->counter->first_name} {$c->counter->last_name}") : null,
            'created_at' => $c->created_at?->toIso8601String(),
        ];
    }

    /** Cash received from the bank: a Prime Bank -> Cash at Hand transfer (never an expense). */
    public function withdraw(Request $request)
    {
        if (!$this->can($request, ['can_create_expenses', 'can_create_bank_accounts'])) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to record cash received from the bank.'], 403);
        }
        $user = $request->user();
        $companyId = $user->company_id;
        $cash = $this->cashAccount($companyId);
        $allowed = $this->books->moneyAccounts($companyId)->pluck('id')->all();
        $v = Validator::make($request->all(), [
            'transfer_date' => 'required|date|before_or_equal:today',
            'from_account_id' => ['nullable', 'uuid', fn ($a, $val, $fail) => in_array($val, $allowed, true) || $fail('Choose the bank the cash was withdrawn from.')],
            'amount' => 'required|numeric|min:0.01|max:999999999',
            'charges' => 'nullable|numeric|min:0|max:999999',
            'reference' => 'nullable|string|max:255',
            'purpose' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
        ]);
        if ($v->fails()) {
            return response()->json(['status' => 'failed', 'message' => $v->errors()->first(), 'errors' => $v->errors()], 422);
        }
        $from = $request->input('from_account_id') ?: $this->bankAccountId($companyId);
        if (!$cash || !$from || $from === $cash->id) {
            return response()->json(['status' => 'failed', 'message' => 'Set up the bank (Main Bank) and Petty Cash / Cash on Hand accounts in Finance > Account Mappings first.'], 422);
        }

        $transfer = BankTransfer::record([
            'company_id' => $companyId,
            'transfer_date' => $request->input('transfer_date'),
            'from_account_id' => $from,
            'to_account_id' => $cash->id,
            'amount' => round((float) $request->input('amount'), 2),
            'charges' => round((float) $request->input('charges', 0), 2),
            'reference' => $request->input('reference'),
            'purpose' => $request->input('purpose') ?: 'Cash withdrawal to petty cash',
            'notes' => $request->input('notes'),
            'created_by' => $user->id,
        ]);

        return response()->json(['status' => 'success', 'message' => "Cash received recorded as {$transfer->transfer_number}.", 'data' => $transfer], 201);
    }

    /** A physical cash count, compared with the books' balance at the end of that day. */
    public function storeCount(Request $request)
    {
        if (!$this->can($request, ['can_create_expenses', 'can_create_bank_accounts'])) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to record a cash count.'], 403);
        }
        $v = Validator::make($request->all(), [
            'count_date' => 'required|date|before_or_equal:today',
            'counted_amount' => 'required|numeric|min:0|max:999999999',
            'denominations' => 'nullable|array',
            'denominations.*' => 'nullable|integer|min:0|max:1000000',
            'notes' => 'nullable|string|max:2000',
        ]);
        if ($v->fails()) {
            return response()->json(['status' => 'failed', 'message' => $v->errors()->first(), 'errors' => $v->errors()], 422);
        }
        $user = $request->user();
        $cash = $this->cashAccount($user->company_id);
        if (!$cash) {
            return response()->json(['status' => 'failed', 'message' => 'No Cash at Hand / Petty Cash account is set up.'], 422);
        }
        $date = Carbon::parse($request->input('count_date'))->toDateString();
        $system = $this->books->book($user->company_id, $cash, $date, $date)['closing_balance']['signed'];
        $counted = round((float) $request->input('counted_amount'), 2);

        $count = PettyCashCount::create([
            'company_id' => $user->company_id,
            'account_id' => $cash->id,
            'count_date' => $date,
            'counted_amount' => $counted,
            'system_balance' => $system,
            'difference' => round($counted - $system, 2),
            'denominations' => array_filter((array) $request->input('denominations', []), fn ($n) => (int) $n > 0) ?: null,
            'notes' => $request->input('notes'),
            'counted_by' => $user->id,
        ]);
        $row = $this->countRow($count->load('counter'));
        $msg = match ($row['status']) {
            'balanced' => 'Cash count matches the books.',
            'shortage' => 'Shortage of KES ' . number_format(abs($row['difference']), 2) . ' against the books.',
            default => 'Surplus of KES ' . number_format($row['difference'], 2) . ' against the books.',
        };

        return response()->json(['status' => 'success', 'message' => $msg, 'data' => $row], 201);
    }

    public function destroyCount(Request $request, string $id)
    {
        if (!$this->can($request, ['can_delete_expenses', 'can_delete_bank_accounts'])) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete cash counts.'], 403);
        }
        $count = PettyCashCount::where('company_id', $request->user()->company_id)->find($id);
        if (!$count) {
            return response()->json(['status' => 'failed', 'message' => 'Cash count not found.'], 404);
        }
        $count->delete();

        return response()->json(['status' => 'success', 'message' => 'Cash count deleted.']);
    }
}
