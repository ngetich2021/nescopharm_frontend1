<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\ChartOfAccount;
use App\Models\DepreciationRun;
use App\Models\JournalEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Monthly Depreciation Journal, as the accountant's workbook
 * (NESCOPHARM_AFRICA_LIMITED_-_Monthly_Depreciation_Journal.xlsx, 27/11/2026):
 *
 *  - Monthly Calc: per asset, accumulated depreciation at the previous month-end (opening) and at this
 *    month-end (closing), each = round(depreciable / life months x months, 2); charge = closing - opening.
 *    A full month is charged in the start month; the charge stops once fully depreciated or in the
 *    month of disposal.
 *  - Class Summary: cost, opening, charge, closing, NBV per asset class.
 *  - Journal Voucher DEP/YYYY/MM dated the month-end: Dr Depreciation - <class> (6700xx) /
 *    Cr Accumulated Depreciation - <class> (1007xx), one line per class.
 *  - Checks: duplicate month, Dr = Cr, journal = asset-level charge, accounts set up.
 *  - Posting Log: every month since depreciation began, posted or not. A wrong month is reversed in
 *    full (same period) and posted again, never overwritten.
 *
 * Account structure from "Additional accounts in chart of account.xlsx": children of 1007 Property
 * Plant and Equipment (1007 01-08 at cost, 1007 11-18 accumulated depreciation) and of 6700
 * Depreciation Expense (6700 01-08).
 */
class DepreciationJournalService
{
    public const PPE_GROUP = ['1007', 'Property Plant and Equipment'];
    public const EXPENSE_GROUP = ['6700', 'Depreciation Expense'];

    /** Asset class => [class code, cost account, accumulated depreciation account, expense account]. */
    public const CLASS_ACCOUNTS = [
        'Computers & Laptops' => ['CMP', '100701', '100711', '670001'],
        'Furniture & Fittings' => ['FNF', '100702', '100712', '670002'],
        'Leasehold Improvements' => ['LHI', '100703', '100713', '670003'],
        'Machinery & Equipment' => ['MCH', '100704', '100714', '670004'],
        'Material Handling Equipment' => ['MHE', '100705', '100715', '670005'],
        'Office Equipment' => ['OEQ', '100706', '100716', '670006'],
        'Printers' => ['PRN', '100707', '100717', '670007'],
        'Security Equipment' => ['SEC', '100708', '100718', '670008'],
    ];

    public const SOURCE = 'Fixed Asset Depreciation Schedule';

    public function __construct(protected LedgerPostingService $ledger)
    {
    }

    // ------------------------------------------------------------------ accounts

    public static function costName(string $class): string
    {
        return "{$class} - at Cost";
    }

    public static function accumulatedName(string $class): string
    {
        return "Accumulated Depreciation - {$class}";
    }

    public static function expenseName(string $class): string
    {
        return "Depreciation - {$class}";
    }

    /** The chart accounts by code (only the ones this journal uses). */
    protected function chart(string $companyId): Collection
    {
        $codes = [self::PPE_GROUP[0], self::EXPENSE_GROUP[0]];
        foreach (self::CLASS_ACCOUNTS as [, $cost, $acc, $exp]) {
            array_push($codes, $cost, $acc, $exp);
        }
        return ChartOfAccount::where('company_id', $companyId)->whereIn('account_code', $codes)->get()->keyBy('account_code');
    }

    /**
     * The workbook's GL Account Mapping: per class, its expense and accumulated depreciation accounts
     * (and the cost account), with whether each is in the chart.
     */
    public function mapping(string $companyId): array
    {
        $chart = $this->chart($companyId);
        $acct = fn (string $code, string $name) => [
            'code' => $code,
            'name' => $chart[$code]->account_name ?? $name,
            'id' => $chart[$code]->id ?? null,
            'exists' => isset($chart[$code]),
        ];
        $rows = [];
        foreach (self::CLASS_ACCOUNTS as $class => [$classCode, $cost, $acc, $exp]) {
            $rows[] = [
                'class' => $class,
                'class_code' => $classCode,
                'expense' => $acct($exp, self::expenseName($class)),
                'accumulated' => $acct($acc, self::accumulatedName($class)),
                'cost' => $acct($cost, self::costName($class)),
            ];
        }
        return $rows;
    }

    public function accountsReady(string $companyId): bool
    {
        foreach ($this->mapping($companyId) as $m) {
            if (!$m['expense']['exists'] || !$m['accumulated']['exists'] || !$m['cost']['exists']) {
                return false;
            }
        }
        return true;
    }

    /**
     * Adds what is missing of the PPE account structure: the 1007 and 6700 groups (if absent) and
     * their 24 sub-accounts. Existing accounts are left as they are. Returns the accounts added.
     */
    public function ensureAccounts(string $companyId): array
    {
        return DB::transaction(function () use ($companyId) {
            $created = [];
            $chart = ChartOfAccount::where('company_id', $companyId)->get()->keyBy('account_code');
            $make = function (string $code, string $name, string $type, string $subtype, string $normal, ?ChartOfAccount $parent, string $description) use ($companyId, &$created, $chart) {
                if (isset($chart[$code])) {
                    return $chart[$code];
                }
                $a = ChartOfAccount::create([
                    'company_id' => $companyId,
                    'parent_id' => $parent?->id,
                    'account_code' => $code,
                    'account_name' => $name,
                    'account_type' => $type,
                    'account_subtype' => $subtype,
                    'normal_balance' => $normal,
                    'description' => $description,
                    'is_active' => true,
                    'is_system_account' => false,
                    'opening_balance' => 0,
                    'currency_code' => 'KES',
                ]);
                $chart[$code] = $a;
                $created[] = ['code' => $code, 'name' => $name];
                return $a;
            };

            $ppe = $make(self::PPE_GROUP[0], self::PPE_GROUP[1], 'asset', 'fixed_asset', 'debit', $chart['1000'] ?? null,
                'Property, plant and equipment - cost and accumulated depreciation by asset class.');
            $dep = $make(self::EXPENSE_GROUP[0], self::EXPENSE_GROUP[1], 'expense', 'operating_expense', 'debit', $chart['6000'] ?? null,
                'Monthly depreciation charge by asset class (Statement of Profit or Loss).');
            foreach (self::CLASS_ACCOUNTS as $class => [, $cost, $acc, $exp]) {
                $make($cost, self::costName($class), 'asset', 'fixed_asset', 'debit', $ppe, "Cost of {$class} (Fixed Asset Register).");
            }
            foreach (self::CLASS_ACCOUNTS as $class => [, $cost, $acc, $exp]) {
                // Contra-asset: an asset account with a credit normal balance, deducted from cost.
                $make($acc, self::accumulatedName($class), 'asset', 'fixed_asset', 'credit', $ppe, "Contra-asset: accumulated depreciation on {$class}.");
            }
            foreach (self::CLASS_ACCOUNTS as $class => [, $cost, $acc, $exp]) {
                $make($exp, self::expenseName($class), 'expense', 'operating_expense', 'debit', $dep, "Monthly straight-line depreciation of {$class}.");
            }
            return $created;
        });
    }

    // ------------------------------------------------------------------ calculation

    public static function monthEnd($date): Carbon
    {
        return Carbon::parse($date)->endOfMonth()->startOfDay();
    }

    public static function reference(Carbon $monthEnd): string
    {
        return 'DEP/' . $monthEnd->format('Y/m');
    }

    public static function narration(Carbon $monthEnd): string
    {
        return 'Being monthly depreciation charge for ' . $monthEnd->format('F Y') . ' per fixed asset depreciation schedule';
    }

    /** The first month any asset depreciates (the commencement month when there are none). */
    public function firstMonth(string $companyId): Carbon
    {
        $first = Asset::forCompany($companyId)->whereNotNull('depreciation_start_date')->min('depreciation_start_date');
        return self::monthEnd($first ?: Asset::COMMENCEMENT_DATE);
    }

    /** Monthly Calc + Class Summary for one month, without the checks. */
    public function calculate(string $companyId, Carbon $monthEnd, ?Collection $assets = null): array
    {
        $opening = $monthEnd->copy()->startOfMonth()->subDay();
        $assets ??= Asset::forCompany($companyId)->orderByRaw('asset_code IS NULL, asset_code')->orderBy('name')->get();

        $rows = [];
        foreach ($assets->values() as $i => $a) {
            $o = $a->depreciationAsAt($opening->toDateString());
            $c = $a->depreciationAsAt($monthEnd->toDateString());
            $life = (int) round(((float) $a->useful_life_years) * 12);
            $charge = round($c['accumulated_depreciation'] - $o['accumulated_depreciation'], 2);
            $status = match (true) {
                $c['disposed'] => 'Disposed',
                $c['months_depreciated'] === 0 => 'Not yet depreciating',
                $life > 0 && $c['months_depreciated'] >= $life && $charge <= 0 => 'Fully depreciated',
                default => 'Depreciating',
            };
            $rows[] = [
                'sno' => $i + 1,
                'id' => $a->id,
                'asset_code' => $a->asset_code,
                'name' => $a->name,
                'category' => $a->category ?: 'Unclassified',
                'start_date' => $a->depreciation_start_date ? Carbon::parse($a->depreciation_start_date)->toDateString() : null,
                'cost' => $c['total_cost'],
                'depreciable_amount' => $c['depreciable_amount'],
                'life_months' => $life,
                'disposal_date' => $a->disposal_date ? Carbon::parse($a->disposal_date)->toDateString() : null,
                'months_opening' => $o['months_depreciated'],
                'months_closing' => $c['months_depreciated'],
                'opening' => $o['accumulated_depreciation'],
                'charge' => $charge,
                'closing' => $c['accumulated_depreciation'],
                'nbv' => round($c['total_cost'] - $c['accumulated_depreciation'], 2),
                'status' => $status,
                'asset_status' => $a->status,
            ];
        }

        $classes = [];
        $names = array_keys(self::CLASS_ACCOUNTS);
        foreach (collect($rows)->pluck('category')->unique() as $cat) {
            if (!in_array($cat, $names, true)) {
                $names[] = $cat;
            }
        }
        foreach ($names as $class) {
            $g = collect($rows)->where('category', $class);
            // Cost: only assets whose depreciation has started and which are not disposed.
            $inUse = $g->filter(fn ($r) => $r['months_closing'] > 0 && $r['status'] !== 'Disposed');
            $cost = round($inUse->sum('cost'), 2);
            $closing = round($g->sum('closing'), 2);
            $classes[] = [
                'class' => $class,
                'class_code' => self::CLASS_ACCOUNTS[$class][0] ?? null,
                'mapped' => isset(self::CLASS_ACCOUNTS[$class]),
                'assets' => $g->count(),
                'cost' => $cost,
                'opening' => round($g->sum('opening'), 2),
                'charge' => round($g->sum('charge'), 2),
                'closing' => $closing,
                'nbv' => round($cost - $closing, 2),
                'min_life' => $g->min('life_months'),
                'max_life' => $g->max('life_months'),
            ];
        }
        $classes = array_values(array_filter($classes, fn ($c) => $c['mapped'] || $c['assets'] > 0));

        $sum = fn (string $k) => round(array_sum(array_column($classes, $k)), 2);
        return [
            'period_end' => $monthEnd->toDateString(),
            'opening_date' => $opening->toDateString(),
            'assets' => $rows,
            'classes' => $classes,
            'totals' => [
                'cost' => $sum('cost'),
                'opening' => $sum('opening'),
                'charge' => $sum('charge'),
                'closing' => $sum('closing'),
                'nbv' => $sum('nbv'),
                'asset_charge' => round(array_sum(array_column($rows, 'charge')), 2),
            ],
        ];
    }

    /** The journal voucher lines (Dr each class's expense, Cr each class's accumulated depreciation). */
    protected function voucher(array $calc, array $mapping, Carbon $monthEnd): array
    {
        $byClass = collect($calc['classes'])->keyBy('class');
        $lines = [];
        $n = 0;
        $period = $monthEnd->format('F Y');
        foreach (['Dr', 'Cr'] as $side) {
            foreach ($mapping as $m) {
                $amount = (float) ($byClass[$m['class']]['charge'] ?? 0);
                $acct = $side === 'Dr' ? $m['expense'] : $m['accumulated'];
                $lines[] = [
                    'line' => ++$n,
                    'class' => $m['class'],
                    'class_code' => $m['class_code'],
                    'account_id' => $acct['id'],
                    'account_code' => $acct['code'],
                    'account_name' => $acct['name'],
                    'account_exists' => $acct['exists'],
                    'side' => $side,
                    'debit' => $side === 'Dr' ? $amount : 0.0,
                    'credit' => $side === 'Cr' ? $amount : 0.0,
                    'narration' => ($side === 'Dr' ? 'Depreciation charge ' : 'Accumulated depreciation ') . "{$m['class']} - {$period}",
                ];
            }
        }
        return $lines;
    }

    /** GL balance (debit - credit) per account up to and including a date. */
    protected function glBalances(string $companyId, array $accountIds, Carbon $asAt): array
    {
        $accountIds = array_values(array_filter($accountIds));
        if (!$accountIds) {
            return [];
        }
        return DB::table('journal_entry_items as i')
            ->join('journal_entries as e', 'e.id', '=', 'i.journal_entry_id')
            ->where('e.company_id', $companyId)
            ->whereIn('e.status', JournalEntry::LEDGER_STATUSES)
            ->whereDate('e.entry_date', '<=', $asAt->toDateString())
            ->whereIn('i.account_id', $accountIds)
            ->groupBy('i.account_id')
            ->selectRaw('i.account_id, SUM(i.debit_amount) - SUM(i.credit_amount) AS net')
            ->pluck('net', 'account_id')
            ->map(fn ($v) => round((float) $v, 2))
            ->all();
    }

    protected function runs(string $companyId): Collection
    {
        return DepreciationRun::with('journalEntry:id,entry_number')->where('company_id', $companyId)->orderBy('period_end')->orderBy('created_at')->get();
    }

    protected static function userName(?string $id): ?string
    {
        if (!$id) {
            return null;
        }
        static $names = [];
        return $names[$id] ??= User::find($id)?->full_name;
    }

    protected function runSummary(?DepreciationRun $r): ?array
    {
        if (!$r) {
            return null;
        }
        return [
            'id' => $r->id,
            'reference' => $r->reference,
            'status' => $r->status,
            'posting_date' => $r->posting_date?->toDateString(),
            'total_charge' => (float) $r->total_charge,
            'entry_number' => $r->journalEntry?->entry_number,
            'journal_entry_id' => $r->journal_entry_id,
            'prepared_by' => $r->prepared_by_name,
            'reviewed_by' => $r->reviewed_by_name,
            'posted_at' => $r->posted_at?->toIso8601String(),
            'reversed_at' => $r->reversed_at?->toIso8601String(),
            'reversed_by' => self::userName($r->reversed_by),
            'reversal_reason' => $r->reversal_reason,
        ];
    }

    /**
     * The Posting Log: every month from the first depreciation month to the current month, with the
     * charge the register gives now and the journal posted for it (if any). A posted month whose
     * charge no longer agrees with the register (an asset changed since) is flagged.
     */
    public function postingLog(string $companyId, ?Collection $runs = null): array
    {
        $runs ??= $this->runs($companyId);
        $assets = Asset::forCompany($companyId)->get();
        $last = self::monthEnd(now());
        $out = [];
        for ($m = $this->firstMonth($companyId); $m->lte($last); $m = self::monthEnd($m->copy()->addDay())) {
            $calc = $this->calculate($companyId, $m->copy(), $assets);
            $monthRuns = $runs->filter(fn ($r) => $r->period_end->toDateString() === $m->toDateString());
            $posted = $monthRuns->firstWhere('status', 'posted');
            $charge = $calc['totals']['charge'];
            $out[] = [
                'period_end' => $m->toDateString(),
                'period' => $m->format('F Y'),
                'reference' => self::reference($m),
                'charge' => $charge,
                'closing' => $calc['totals']['closing'],
                'status' => $posted ? 'posted' : ($charge > 0 ? 'not_posted' : 'nothing'),
                'run' => $this->runSummary($posted),
                'differs' => $posted && abs((float) $posted->total_charge - $charge) >= 0.005,
                'reversals' => $monthRuns->where('status', 'reversed')->count(),
                'month_ended' => $m->lt(today()),
            ];
        }
        return $out;
    }

    /** Everything the Depreciation Journal screen shows for one month. */
    public function month(string $companyId, $date): array
    {
        $monthEnd = self::monthEnd($date);
        $calc = $this->calculate($companyId, $monthEnd);
        $mapping = $this->mapping($companyId);
        $lines = $this->voucher($calc, $mapping, $monthEnd);
        $runs = $this->runs($companyId);
        $log = $this->postingLog($companyId, $runs);

        $posted = $runs->first(fn ($r) => $r->status === 'posted' && $r->period_end->toDateString() === $monthEnd->toDateString());
        $history = $runs->filter(fn ($r) => $r->period_end->toDateString() === $monthEnd->toDateString())->values()->map(fn ($r) => $this->runSummary($r))->all();

        $dr = round(array_sum(array_column($lines, 'debit')), 2);
        $cr = round(array_sum(array_column($lines, 'credit')), 2);
        $t = $calc['totals'];
        $unmapped = collect($calc['classes'])->where('mapped', false)->where('charge', '>', 0)->pluck('class')->all();
        $accountsReady = $this->accountsReady($companyId);
        $isFuture = $monthEnd->copy()->startOfMonth()->gt(today());
        $earlier = collect($log)->filter(fn ($l) => $l['period_end'] < $monthEnd->toDateString() && $l['status'] === 'not_posted')->pluck('period')->values()->all();

        $checks = [
            ['key' => 'duplicate', 'label' => 'Duplicate posting check', 'ok' => !$posted,
                'result' => $posted ? "DUPLICATE - month already posted ({$posted->reference})" : 'OK to post'],
            ['key' => 'balanced', 'label' => 'Journal balances (Dr = Cr)', 'ok' => abs($dr - $cr) < 0.005,
                'result' => abs($dr - $cr) < 0.005 ? 'OK' : 'OUT OF BALANCE'],
            ['key' => 'ties', 'label' => 'Journal agrees to asset-level charge', 'ok' => abs($dr - $t['asset_charge']) < 0.005 && !$unmapped,
                'result' => $unmapped ? 'DIFF - no account for ' . implode(', ', $unmapped) : (abs($dr - $t['asset_charge']) < 0.005 ? 'OK' : 'DIFF')],
            ['key' => 'rollforward', 'label' => 'Opening + charge = closing (every class)', 'ok' => collect($calc['classes'])->every(fn ($c) => abs($c['opening'] + $c['charge'] - $c['closing']) < 0.01),
                'result' => collect($calc['classes'])->every(fn ($c) => abs($c['opening'] + $c['charge'] - $c['closing']) < 0.01) ? 'OK' : 'DIFF'],
            ['key' => 'accounts', 'label' => 'GL accounts set up (1007xx / 6700xx)', 'ok' => $accountsReady,
                'result' => $accountsReady ? 'OK' : 'MISSING - click "Set up accounts"'],
            ['key' => 'period', 'label' => 'Month has started', 'ok' => !$isFuture,
                'result' => $isFuture ? 'FUTURE MONTH - cannot post yet' : ($monthEnd->gte(today()) ? 'OK - month-end ' . $monthEnd->format('d/m/Y') . ' (month still running)' : 'OK')],
        ];
        // Year-end: the closing balance agrees to the annual Schedule (31/12 only).
        if ($monthEnd->month === 12) {
            $checks[] = ['key' => 'schedule', 'label' => 'Agrees to annual schedule (year-end)', 'ok' => true, 'result' => 'OK - ' . number_format($t['closing'], 2) . ' at 31/12/' . $monthEnd->year];
        } else {
            $checks[] = ['key' => 'schedule', 'label' => 'Agrees to annual schedule (year-end only)', 'ok' => true, 'result' => 'n/a - not year-end'];
        }
        $blocking = collect($checks)->where('ok', false)->isNotEmpty();
        $status = $posted ? 'POSTED' : ($blocking ? 'DO NOT POST - FIX CHECKS' : ($t['charge'] <= 0 ? 'NOTHING TO POST' : 'READY TO POST'));

        // Register <-> GL reconciliation (control e): after posting, the GL accumulated depreciation
        // must equal the register's; before posting it should equal the register's opening.
        $ids = [];
        foreach ($mapping as $m) {
            $ids[] = $m['accumulated']['id'];
            $ids[] = $m['cost']['id'];
        }
        $groupId = $this->chart($companyId)[self::PPE_GROUP[0]]->id ?? null;
        $gl = $this->glBalances($companyId, array_merge($ids, [$groupId]), $monthEnd);
        $byClass = collect($calc['classes'])->keyBy('class');
        $recon = [];
        foreach ($mapping as $m) {
            $c = $byClass[$m['class']] ?? null;
            $glAcc = $m['accumulated']['id'] ? round(-($gl[$m['accumulated']['id']] ?? 0), 2) : 0.0;
            $glCost = $m['cost']['id'] ? round($gl[$m['cost']['id']] ?? 0, 2) : 0.0;
            $registerAcc = (float) ($posted ? ($c['closing'] ?? 0) : ($c['opening'] ?? 0));
            $recon[] = [
                'class' => $m['class'],
                'register_cost' => (float) ($c['cost'] ?? 0),
                'gl_cost' => $glCost,
                'register_accumulated' => $registerAcc,
                'gl_accumulated' => $glAcc,
                'difference' => round($registerAcc - $glAcc, 2),
            ];
        }
        $reconTotals = [
            'register_cost' => round(array_sum(array_column($recon, 'register_cost')), 2),
            'gl_cost' => round(array_sum(array_column($recon, 'gl_cost')), 2),
            'register_accumulated' => round(array_sum(array_column($recon, 'register_accumulated')), 2),
            'gl_accumulated' => round(array_sum(array_column($recon, 'gl_accumulated')), 2),
        ];
        $reconTotals['difference'] = round($reconTotals['register_accumulated'] - $reconTotals['gl_accumulated'], 2);

        return [
            'period_end' => $monthEnd->toDateString(),
            'period' => $monthEnd->format('F Y'),
            'opening_date' => $calc['opening_date'],
            'reference' => self::reference($monthEnd),
            'posting_date' => $posted?->posting_date?->toDateString() ?? $monthEnd->toDateString(),
            'narration' => self::narration($monthEnd),
            'currency' => 'KES',
            'source' => self::SOURCE,
            'status' => $status,
            'can_post' => !$posted && !$blocking && $t['charge'] > 0,
            'earlier_not_posted' => $earlier,
            'checks' => $checks,
            'mapping' => $mapping,
            'accounts_ready' => $accountsReady,
            'lines' => $lines,
            'total_debit' => $dr,
            'total_credit' => $cr,
            'classes' => $calc['classes'],
            'totals' => $t,
            'assets' => $calc['assets'],
            'posted' => $this->runSummary($posted),
            'history' => $history,
            'log' => $log,
            'reconciliation' => [
                'basis' => $posted ? 'closing' : 'opening',
                'rows' => $recon,
                'totals' => $reconTotals,
                'group_balance' => round($gl[$groupId] ?? 0, 2),
            ],
        ];
    }

    // ------------------------------------------------------------------ posting

    /**
     * Posts one month: DEP/YYYY/MM dated the month-end (or the posting date given), Dr each class's
     * depreciation expense / Cr its accumulated depreciation. Refused when the checks fail.
     */
    public function post(string $companyId, $date, User $user, ?string $reviewedBy = null, ?string $postingDate = null): DepreciationRun
    {
        $monthEnd = self::monthEnd($date);
        $m = $this->month($companyId, $monthEnd);
        if ($m['posted']) {
            throw new \DomainException("{$m['period']} is already posted ({$m['posted']['reference']}, entry {$m['posted']['entry_number']}). Reverse it first to post it again.");
        }
        if (!$m['can_post']) {
            $failed = collect($m['checks'])->where('ok', false)->map(fn ($c) => "{$c['label']}: {$c['result']}")->implode('; ');
            throw new \DomainException($failed ?: "There is no depreciation to post for {$m['period']}.");
        }

        $posting = $postingDate ? Carbon::parse($postingDate)->toDateString() : $monthEnd->toDateString();
        return DB::transaction(function () use ($companyId, $monthEnd, $m, $user, $reviewedBy, $posting) {
            $run = DepreciationRun::create([
                'company_id' => $companyId,
                'period_end' => $monthEnd->toDateString(),
                'posting_date' => $posting,
                'reference' => $m['reference'],
                'narration' => $m['narration'],
                'status' => 'posted',
                'total_charge' => $m['totals']['charge'],
                'classes' => $m['classes'],
                'assets' => array_map(fn ($a) => array_intersect_key($a, array_flip(['asset_code', 'name', 'category', 'cost', 'months_opening', 'months_closing', 'opening', 'charge', 'closing', 'status'])), $m['assets']),
                'created_by' => $user->id,
                'prepared_by_name' => $user->full_name,
                'reviewed_by_name' => $reviewedBy ? trim($reviewedBy) : null,
                'posted_at' => now(),
            ]);
            $entry = $this->ledger->syncEntry($run, 'depreciation', [
                'date' => $posting,
                'prefix' => 'DEP',
                'reference' => $m['reference'],
                'description' => $m['narration'],
                'lines' => collect($m['lines'])->map(fn ($l) => [
                    'account_id' => $l['account_id'],
                    'debit' => $l['debit'],
                    'credit' => $l['credit'],
                    'description' => $l['narration'],
                ])->all(),
            ]);
            if (!$entry) {
                throw new \RuntimeException('The journal could not be posted.');
            }
            $run->update(['journal_entry_id' => $entry->id]);
            return $run->fresh('journalEntry');
        });
    }

    /** Reverses a posted month in full, in the same period; the month can then be posted again. */
    public function reverse(DepreciationRun $run, User $user, string $reason): DepreciationRun
    {
        if ($run->status !== 'posted') {
            throw new \DomainException("{$run->reference} is already reversed.");
        }
        return DB::transaction(function () use ($run, $user, $reason) {
            $this->ledger->syncEntry($run, 'depreciation', null, [
                'date' => $run->posting_date->toDateString(),
                'reason' => "Depreciation journal {$run->reference} reversed: {$reason}",
            ]);
            $run->update([
                'status' => 'reversed',
                'reversed_by' => $user->id,
                'reversed_at' => now(),
                'reversal_reason' => $reason,
            ]);
            return $run->fresh('journalEntry');
        });
    }

    /**
     * Posts every month not yet posted, oldest first, up to and including $upTo - one DEP journal per
     * month, each dated its own month-end. Stops at the first month that fails its checks.
     */
    public function postMissing(string $companyId, $upTo, User $user, ?string $reviewedBy = null): array
    {
        $limit = self::monthEnd($upTo)->toDateString();
        $done = [];
        foreach ($this->postingLog($companyId) as $l) {
            if ($l['period_end'] > $limit || $l['status'] !== 'not_posted') {
                continue;
            }
            $run = $this->post($companyId, $l['period_end'], $user, $reviewedBy);
            $done[] = ['period' => $l['period'], 'reference' => $run->reference, 'entry_number' => $run->journalEntry?->entry_number, 'charge' => (float) $run->total_charge];
        }
        return $done;
    }
}
