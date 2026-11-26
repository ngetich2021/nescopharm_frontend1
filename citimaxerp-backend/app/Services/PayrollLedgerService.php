<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\PayrollRun;
use App\Models\StatutoryPayment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Payroll's ledger accounts from the books - Net Salaries Payable and each statutory payable (PAYE, NSSF,
 * SHIF, Housing Levy, HELB, NITA, Other Deductions) - in the Tally layout the supplier ledger uses:
 * Opening Balance, Date, Dr/Cr and Particulars (the other side of the double entry), Vch Type, Vch No,
 * Debit, Credit, Total, Closing Balance (Cr = still owed). Plus who each account is owed to (the payees):
 * the employees for net pay and other deductions, the authority month by month for the statutory ones.
 */
class PayrollLedgerService
{
    /** key => [label, paid to, statutory item (StatutoryPayment::ITEMS) or null] */
    public const ACCOUNTS = [
        'salaries_payable' => ['Net Salaries Payable', 'Employees (net pay)', null],
        'paye_payable' => ['PAYE Payable', 'KRA - iTax (P10)', 'paye'],
        'nssf_payable' => ['NSSF Payable', 'NSSF', 'nssf'],
        'shif_payable' => ['SHIF Payable', 'Social Health Authority', 'shif'],
        'housing_levy_payable' => ['Housing Levy Payable', 'KRA - iTax', 'housing_levy'],
        'helb_payable' => ['HELB Payable', 'Higher Education Loans Board', 'helb'],
        'nita_payable' => ['NITA Payable', 'National Industrial Training Authority', 'nita'],
        'payroll_deductions_payable' => ['Other Payroll Deductions Payable', 'As per each deduction', null],
        // An asset: Dr = what staff still owe the company; payroll credits it with each loan / advance repayment.
        'staff_advances' => ['Staff Loans & Advances', 'Recovered from staff pay', null],
    ];

    public function __construct(
        protected AccountingIntegrationService $engine,
        protected StatutoryObligationService $obligations,
    ) {
    }

    /** Each payroll payable account with its balance today (Cr = owed). */
    public function accounts(string $companyId): array
    {
        $out = [];
        $seen = [];
        foreach ($this->resolve($companyId) as $key => $account) {
            if (!$account || isset($seen[$account->id])) {
                continue; // HELB/NITA can share Other Deductions when the chart has no account of their own
            }
            $seen[$account->id] = true;
            $t = DB::table('journal_entry_items as i')->join('journal_entries as e', 'e.id', '=', 'i.journal_entry_id')
                ->where('e.company_id', $companyId)->where('i.account_id', $account->id)
                ->whereIn('e.status', JournalEntry::LEDGER_STATUSES)
                ->selectRaw('COALESCE(SUM(i.debit_amount),0) d, COALESCE(SUM(i.credit_amount),0) c, COUNT(*) n')->first();
            $net = round((float) $t->c - (float) $t->d, 2);
            $out[] = [
                'key' => $key,
                'label' => self::ACCOUNTS[$key][0],
                'paid_to' => self::ACCOUNTS[$key][1],
                'account_code' => $account->account_code,
                'account_name' => $account->account_name,
                'debit' => round((float) $t->d, 2),
                'credit' => round((float) $t->c, 2),
                'entries' => (int) $t->n,
                'balance' => ['amount' => abs($net), 'side' => $net >= 0 ? 'Cr' : 'Dr'],
            ];
        }
        return $out;
    }

    /** One account: its Tally ledger for the period and who it is owed to. */
    public function account(string $companyId, string $key, ?string $dateFrom, ?string $dateTo, bool $showCorrections = false): ?array
    {
        $account = $this->resolve($companyId)[$key] ?? null;
        if (!$account) {
            return null;
        }

        return [
            'key' => $key,
            'label' => self::ACCOUNTS[$key][0],
            'paid_to' => self::ACCOUNTS[$key][1],
            'account' => "{$account->account_code} {$account->account_name}",
            'ledger' => $this->ledger($companyId, $account->id, $dateFrom, $dateTo, $showCorrections),
            'payees' => $this->payees($companyId, $key, $dateFrom, $dateTo),
        ];
    }

    /**
     * One payroll month laid out as the accountant's payroll journal workbook: the payroll computation
     * per employee, the journals (JV-PAY-1 payroll run, JV-PAY-2 net salaries paid, JV-PAY-3.. each
     * statutory remittance) with a balance check, and a ledger summary of every account they touch.
     * Built from the payslips with the same rules LedgerPostingService posts by, so a month that is not
     * posted (a past "Record" month, or before payroll_posting_start) still shows what its entries are.
     */
    public function month(PayrollRun $run): array
    {
        $companyId = $run->company_id;
        $period = Carbon::create((int) $run->pay_year, (int) $run->pay_month, 1)->endOfMonth();
        $label = $period->format('F Y');
        $short = $period->format('M Y');
        $r2 = fn ($v) => round((float) $v, 2);

        // 1. Payroll computation, one row per employee.
        $slips = DB::table('payroll_payslips as p')->join('employees as e', 'e.id', '=', 'p.employee_id')
            ->where('p.payroll_run_id', $run->id)
            ->orderBy('e.employee_number')->orderBy('e.first_name')
            ->get(['p.*', 'e.employee_number', 'e.first_name', 'e.last_name', 'e.kra_pin']);
        $employees = [];
        foreach ($slips as $s) {
            $gross = $r2($s->gross_pay);
            $helb = $r2($s->helb);
            $loan = $r2(PayrollService::loanAmount(json_decode((string) $s->deductions_json, true) ?: []));
            $other = $r2((float) $s->total_custom_deductions + (float) $s->other_deductions - (float) $s->helb - $loan);
            $employerCost = $r2($gross + (float) $s->nssf_employer + (float) $s->housing_levy_employer + (float) $s->nita);
            $employees[] = [
                'employee_number' => $s->employee_number,
                'name' => trim("{$s->first_name} {$s->last_name}"),
                'kra_pin' => $s->kra_pin,
                'basic_salary' => $r2($gross - (float) $s->total_allowances),
                'allowances' => $r2($s->total_allowances),
                'gross_pay' => $gross,
                'nssf_employee' => $r2($s->nssf_employee),
                'shif' => $r2($s->shif),
                'housing_levy_employee' => $r2($s->housing_levy_employee),
                'taxable_pay' => $r2($s->taxable_pay),
                'tax_before_relief' => $r2($s->paye_before_relief),
                'personal_relief' => $r2((float) $s->personal_relief + (float) $s->insurance_relief),
                'paye' => $r2($s->paye),
                'helb' => $helb,
                'salary_advance' => $r2($s->salary_advance_deduction),
                'loan_repayment' => $loan,
                'other_deductions' => $other,
                'total_deductions' => $r2($s->total_deductions),
                'net_pay' => $r2($s->net_pay),
                'nssf_employer' => $r2($s->nssf_employer),
                'housing_levy_employer' => $r2($s->housing_levy_employer),
                'nita' => $r2($s->nita),
                'employer_cost' => $employerCost,
            ];
        }
        $sum = fn (string $f) => $r2(array_sum(array_column($employees, $f)));
        // The ledger leaves out payslips with no gross pay (a statutory minimum that was never withheld).
        $posting = array_values(array_filter($employees, fn ($e) => $e['gross_pay'] > 0));
        $t = fn (string $f) => $r2(array_sum(array_column($posting, $f)));

        // 2. Journals.
        $this->engine->setCompany($companyId);
        $accounts = [];
        $acct = function (?string $key, ?string $fallback = null, ?string $id = null) use (&$accounts, $companyId) {
            try {
                $id ??= ($key ? $this->engine->resolveAccountId($key) : null) ?: ($fallback ? $this->engine->resolveAccountId($fallback) : null);
            } catch (\Throwable $e) {
                $id = null;
            }
            if (!$id) {
                return ['name' => ucwords(str_replace('_', ' ', (string) $key)) . ' (not mapped)', 'type' => '-'];
            }
            return $accounts[$id] ??= (function () use ($id, $companyId) {
                $a = ChartOfAccount::where('company_id', $companyId)->find($id);
                return ['name' => $a ? "{$a->account_code} {$a->account_name}" : 'Unknown account', 'type' => $a ? ucfirst((string) $a->account_type) : '-'];
            })();
        };
        $line = fn (array $a, string $narration, float $debit, float $credit) => ['account' => $a['name'], 'account_type' => $a['type'], 'narration' => $narration, 'debit' => $debit, 'credit' => $credit];

        $posts = app(LedgerPostingService::class)->payrollPosts($run);
        $posted = $posts
            ? JournalEntry::where('company_id', $companyId)->where('source_type', PayrollRun::class)->where('source_id', $run->id)->where('status', 'posted')->get()
            : collect();
        $postedNo = fn (string $prefix) => $posted->first(fn ($e) => str_starts_with((string) $e->reference, $prefix))?->entry_number;
        $notPosted = $run->is_historical
            ? 'Not posted - a past "Record" month (those salaries are in the books as expenses)'
            : 'Not posted - salaries before ' . Carbon::parse($this->settingsStart($companyId) ?? $period)->format('d/m/Y') . ' were booked as expenses';

        $journals = [];
        $gross = $t('gross_pay');
        if ($gross > 0 && in_array($run->status, ['approved', 'payment_initiated', 'paid'], true)) {
            $narr = "{$short} payroll run - gross salaries, employer costs and deductions";
            $helb = $t('helb');
            $nita = $t('nita');
            $lines = array_values(array_filter([
                $line($acct('salaries_expense', 'miscellaneous_expense'), $narr, $gross, 0),
                $line($acct('nssf_employer_expense', 'salaries_expense'), $narr, $t('nssf_employer'), 0),
                $line($acct('housing_levy_employer_expense', 'salaries_expense'), $narr, $t('housing_levy_employer'), 0),
                $line($acct('nita_expense', 'salaries_expense'), $narr, $nita, 0),
                $line($acct('salaries_payable'), $narr, 0, $t('net_pay')),
                $line($acct('paye_payable'), $narr, 0, $t('paye')),
                $line($acct('nssf_payable'), $narr, 0, $r2($t('nssf_employee') + $t('nssf_employer'))),
                $line($acct('shif_payable'), $narr, 0, $t('shif')),
                $line($acct('housing_levy_payable'), $narr, 0, $r2($t('housing_levy_employee') + $t('housing_levy_employer'))),
                $line($acct('nita_payable', 'payroll_deductions_payable'), $narr, 0, $nita),
                $line($acct('helb_payable', 'payroll_deductions_payable'), $narr, 0, $helb),
                $line($acct('payroll_deductions_payable'), $narr, 0, $t('other_deductions')),
                $line($acct('staff_advances'), $narr, 0, $r2($t('salary_advance') + $t('loan_repayment'))),
            ], fn ($l) => $l['debit'] > 0 || $l['credit'] > 0));
            $journals[] = $this->journal('JV-PAY-1', $period->toDateString(), "Payroll run {$label}", $lines, $posts ? $postedNo('PAYROLL-') : null, $posts ? null : $notPosted);
        }

        if ($run->status === 'paid' && $t('net_pay') > 0) {
            $paidOn = $run->payment_date ?? $run->paid_at ?? $period;
            $from = $run->payment_account_id
                ? $acct(null, null, $run->payment_account_id)
                : ($run->payment_method ? $acct(null, null, $this->engine->resolvePaymentMethodAccountId($run->payment_method)) : ['name' => 'Bank / Cash (account not recorded)', 'type' => 'Asset']);
            $narr = "{$short} net salaries paid" . ($run->payment_reference ? " - ref {$run->payment_reference}" : '');
            $journals[] = $this->journal('JV-PAY-2', Carbon::parse($paidOn)->toDateString(), "Net salaries paid {$label}", [
                $line($acct('salaries_payable'), $narr, $t('net_pay'), 0),
                $line($from, $narr, 0, $t('net_pay')),
            ], $posts ? $postedNo('PAYOUT-') : null, $posts ? null : $notPosted);
        }

        $n = 3;
        $payments = StatutoryPayment::where('payroll_run_id', $run->id)->orderBy('payment_date')->orderBy('created_at')->get();
        foreach ($payments as $p) {
            $def = StatutoryPayment::ITEMS[$p->item] ?? null;
            if (!$def) {
                continue;
            }
            [$itemLabel, $authority, , $key, $fallback] = $def;
            $amount = $r2($p->amount);
            $narr = "{$short} {$itemLabel} paid to {$authority} - ref {$p->reference}";
            $from = $p->account_id ? $acct(null, null, $p->account_id) : $acct(null, null, $this->engine->resolvePaymentMethodAccountId($p->payment_method));
            $entryNo = $posts ? JournalEntry::where('source_type', StatutoryPayment::class)->where('source_id', $p->id)->where('status', 'posted')->value('entry_number') : null;
            $journals[] = $this->journal('JV-PAY-' . $n++, $p->payment_date?->toDateString(), "{$itemLabel} remitted to {$authority}", [
                $line($acct($key, $fallback), $narr, $amount, 0),
                $line($from, $narr, 0, $amount),
            ], $entryNo, $posts ? null : $notPosted);
        }

        // 3. Ledger summary: every account the journals touch.
        $summary = [];
        foreach ($journals as $j) {
            foreach ($j['lines'] as $l) {
                $s = &$summary[$l['account']];
                $s ??= ['account' => $l['account'], 'account_type' => $l['account_type'], 'debit' => 0.0, 'credit' => 0.0];
                $s['debit'] = $r2($s['debit'] + $l['debit']);
                $s['credit'] = $r2($s['credit'] + $l['credit']);
                unset($s);
            }
        }
        $summary = array_values(array_map(function ($s) use ($r2) {
            $net = $r2($s['debit'] - $s['credit']);
            return $s + ['net' => abs($net), 'side' => $net > 0 ? 'Dr' : ($net < 0 ? 'Cr' : 'Nil')];
        }, $summary));

        return [
            'payroll_run_id' => $run->id,
            'period_label' => $label,
            'status' => $run->status,
            'is_historical' => (bool) $run->is_historical,
            'posts_to_ledger' => $posts,
            'employees' => $employees,
            'totals' => collect(array_keys($employees[0] ?? []))
                ->reject(fn ($k) => in_array($k, ['employee_number', 'name', 'kra_pin'], true))
                ->mapWithKeys(fn ($k) => [$k => $sum($k)])->all(),
            'journals' => $journals,
            'summary' => $summary,
            'summary_totals' => ['debit' => $r2(array_sum(array_column($summary, 'debit'))), 'credit' => $r2(array_sum(array_column($summary, 'credit')))],
        ];
    }

    private function journal(string $no, ?string $date, string $title, array $lines, ?string $entryNumber, ?string $note): array
    {
        $debit = round(array_sum(array_column($lines, 'debit')), 2);
        $credit = round(array_sum(array_column($lines, 'credit')), 2);
        return [
            'journal' => $no,
            'date' => $date,
            'title' => $title,
            'entry_number' => $entryNumber,
            'note' => $note,
            'lines' => $lines,
            'total_debit' => $debit,
            'total_credit' => $credit,
            'balanced' => abs($debit - $credit) < 0.01,
        ];
    }

    private function settingsStart(string $companyId): ?string
    {
        return \App\Models\CompanyAccountingSettings::where('company_id', $companyId)->value('payroll_posting_start');
    }

    /** @return array<string, ChartOfAccount|null> */
    protected function resolve(string $companyId): array
    {
        $this->engine->setCompany($companyId);
        $out = [];
        foreach (array_keys(self::ACCOUNTS) as $key) {
            try {
                $id = $this->engine->resolveAccountId($key)
                    ?: (in_array($key, ['helb_payable', 'nita_payable'], true) ? $this->engine->resolveAccountId('payroll_deductions_payable') : null);
            } catch (\Throwable $e) {
                $id = null;
            }
            $out[$key] = $id ? ChartOfAccount::where('company_id', $companyId)->find($id) : null;
        }
        return $out;
    }

    protected function ledger(string $companyId, string $accountId, ?string $dateFrom, ?string $dateTo, bool $showCorrections): array
    {
        $base = JournalEntry::where('company_id', $companyId)
            ->whereIn('status', JournalEntry::LEDGER_STATUSES)
            ->whereIn('id', DB::table('journal_entry_items')->select('journal_entry_id')->where('account_id', $accountId));

        // An entry reversed for an edit, and its reversal, cancel out: hidden unless asked for.
        if (!$showCorrections) {
            $reversed = (clone $base)->where('status', 'reversed')->pluck('id')->all();
            $reversals = $reversed ? (clone $base)->where('source_type', JournalEntry::class)->whereIn('source_id', $reversed)->pluck('id')->all() : [];
            if ($reversed || $reversals) {
                $base->whereNotIn('id', array_merge($reversed, $reversals));
            }
        }

        $openingNet = 0.0;
        if ($dateFrom) {
            $o = JournalEntryItem::whereIn('journal_entry_id', (clone $base)->where('entry_date', '<', $dateFrom)->select('id'))
                ->where('account_id', $accountId)
                ->selectRaw('COALESCE(SUM(debit_amount),0) d, COALESCE(SUM(credit_amount),0) c')->first();
            $openingNet = round((float) $o->c - (float) $o->d, 2);
        }

        $entries = (clone $base)->with('items.account')
            ->when($dateFrom, fn ($q) => $q->where('entry_date', '>=', $dateFrom))
            ->when($dateTo, fn ($q) => $q->where('entry_date', '<=', $dateTo))
            ->orderBy('entry_date')->orderBy('created_at')->get();

        $rows = [];
        $totalDebit = $totalCredit = 0.0;
        $balance = $openingNet;
        foreach ($entries as $entry) {
            $own = $entry->items->where('account_id', $accountId);
            $debit = round((float) $own->sum('debit_amount'), 2);
            $credit = round((float) $own->sum('credit_amount'), 2);
            if ($debit < 0.005 && $credit < 0.005) {
                continue;
            }
            // Particulars: the other side of the entry, biggest first (the payroll accrual names Salaries & Wages).
            $others = $entry->items->reject(fn ($i) => $i->account_id === $accountId)
                ->sortByDesc(fn ($i) => (float) $i->debit_amount + (float) $i->credit_amount)->values();
            $main = $others->first();
            $totalDebit += $debit;
            $totalCredit += $credit;
            $balance = round($balance + $credit - $debit, 2);

            $rows[] = [
                'id' => $entry->id,
                'date' => $entry->entry_date?->toDateString(),
                'side' => $main ? ((float) $main->debit_amount > 0 ? 'Dr' : 'Cr') : ($debit >= $credit ? 'Cr' : 'Dr'),
                'particulars' => $main?->account?->account_name ?? ($entry->description ?: '-'),
                'other_accounts' => $others->skip(1)->map(fn ($i) => ((float) $i->debit_amount > 0 ? 'Dr ' : 'Cr ')
                    . $i->account?->account_name . ' ' . number_format((float) $i->debit_amount + (float) $i->credit_amount, 2))->values(),
                'voucher_type' => $this->voucherType($entry),
                'voucher_no' => $entry->reference ?: $entry->entry_number,
                'narration' => $entry->description,
                'reversed' => $entry->status === 'reversed' || ($entry->source_type === JournalEntry::class && $entry->entry_type !== 'manual'),
                'debit' => $debit,
                'credit' => $credit,
                'balance' => abs($balance),
                'balance_side' => $balance >= 0 ? 'Cr' : 'Dr',
            ];
        }

        $closing = round($openingNet + $totalCredit - $totalDebit, 2);
        return [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'opening_balance' => ['amount' => abs($openingNet), 'side' => $openingNet >= 0 ? 'Cr' : 'Dr'],
            'rows' => $rows,
            'totals' => ['debit' => round($totalDebit, 2), 'credit' => round($totalCredit, 2)],
            'closing_balance' => ['amount' => abs($closing), 'side' => $closing >= 0 ? 'Cr' : 'Dr'],
        ];
    }

    protected function voucherType(JournalEntry $entry): string
    {
        return match (true) {
            $entry->source_type === PayrollRun::class && str_starts_with((string) $entry->reference, 'PAYOUT-') => 'Salary Payment',
            $entry->source_type === PayrollRun::class => 'Payroll',
            $entry->source_type === StatutoryPayment::class => 'Statutory Payment',
            $entry->source_type === JournalEntry::class => $entry->entry_type === 'manual' ? 'Journal' : 'Reversal',
            default => ucwords(str_replace('_', ' ', ($entry->metadata['transaction_type'] ?? null) ?: 'Journal')),
        };
    }

    /**
     * Who the account is owed to, month by month, for the payroll months that post to the books:
     * net pay and other deductions per employee; the statutory ones per authority (due, paid, balance).
     */
    protected function payees(string $companyId, string $key, ?string $dateFrom, ?string $dateTo): array
    {
        $inPeriod = function (int $year, int $month) use ($dateFrom, $dateTo): bool {
            $end = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();
            return (!$dateFrom || $end >= $dateFrom) && (!$dateTo || $end <= Carbon::parse($dateTo)->endOfMonth()->toDateString());
        };
        $item = self::ACCOUNTS[$key][2];

        if ($item) {
            $rows = [];
            foreach ($this->obligations->forCompany($companyId)['months'] as $m) {
                if (!$inPeriod((int) $m['pay_year'], (int) $m['pay_month'])) {
                    continue;
                }
                foreach ($m['lines'] as $line) {
                    if ($line['item'] !== $item || ($line['due'] <= 0 && $line['paid'] <= 0)) {
                        continue;
                    }
                    $last = end($line['payments']) ?: null;
                    $rows[] = [
                        'payee' => $line['authority'],
                        'period' => $m['period_label'],
                        'employee_share' => $line['employee_share'],
                        'employer_share' => $line['employer_share'],
                        'amount' => $line['due'],
                        'paid' => $line['paid'],
                        'balance' => $line['balance'],
                        'status' => $line['overdue'] ? "{$line['status']} (overdue)" : $line['status'],
                        'due_date' => $line['due_date'],
                        'paid_date' => $last['payment_date'] ?? null,
                        'reference' => $last['reference'] ?? null,
                    ];
                }
            }
            return ['kind' => 'statutory', 'rows' => $rows];
        }

        // Net pay / other deductions: one row per employee per month.
        $runs = $this->obligations->runs($companyId)->filter(fn ($r) => $inPeriod((int) $r->pay_year, (int) $r->pay_month));
        // Other deductions as the payroll posts them: custom + other deductions, less HELB and company
        // loan repayments (each has its own account).
        $amount = $key === 'salaries_payable'
            ? 'COALESCE(p.net_pay,0)'
            : 'COALESCE(p.total_custom_deductions,0) + COALESCE(p.other_deductions,0) - COALESCE(p.helb,0)';
        $slips = DB::table('payroll_payslips as p')
            ->join('employees as e', 'e.id', '=', 'p.employee_id')
            ->whereIn('p.payroll_run_id', $runs->pluck('id'))->where('p.gross_pay', '>', 0)
            ->select('p.payroll_run_id', 'p.deductions_json', 'p.salary_advance_deduction as advance', 'e.employee_number', 'e.first_name', 'e.last_name')
            ->selectRaw("{$amount} AS amount")
            ->orderBy('e.employee_number')->get()->groupBy('payroll_run_id');

        $rows = [];
        foreach ($runs as $run) {
            $paid = $key === 'salaries_payable' && $run->status === 'paid';
            foreach ($slips->get($run->id, collect()) as $s) {
                $amount = round((float) $s->amount, 2);
                $loan = (float) PayrollService::loanAmount(json_decode((string) $s->deductions_json, true) ?: []);
                if ($key === 'staff_advances') {
                    $amount = round($loan + (float) $s->advance, 2); // what each employee paid back this month
                } elseif ($key !== 'salaries_payable') {
                    $amount = round($amount - $loan, 2);
                }
                if ($amount <= 0) {
                    continue;
                }
                $rows[] = [
                    'payee' => trim("{$s->first_name} {$s->last_name}"),
                    'employee_number' => $s->employee_number,
                    'period' => Carbon::create($run->pay_year, $run->pay_month, 1)->format('F Y'),
                    'amount' => $amount,
                    // A loan repayment is recovered the moment it is taken from pay.
                    'paid' => $paid || $key === 'staff_advances' ? $amount : 0.0,
                    'balance' => $paid || $key === 'staff_advances' ? 0.0 : $amount,
                    'status' => $key === 'salaries_payable'
                        ? ($paid ? 'Paid' : ($run->status === 'payment_initiated' ? 'Payment initiated' : 'Unpaid'))
                        : ($key === 'staff_advances' ? 'Recovered' : 'Owed'),
                    'paid_date' => $paid ? ($run->payment_date?->toDateString() ?? $run->paid_at?->toDateString()) : null,
                    'reference' => $paid ? $run->payment_reference : null,
                    'paid_from' => $paid ? $run->paymentAccount?->account_name : null,
                ];
            }
        }
        return ['kind' => $key === 'salaries_payable' ? 'employees' : 'deductions', 'rows' => $rows];
    }
}
