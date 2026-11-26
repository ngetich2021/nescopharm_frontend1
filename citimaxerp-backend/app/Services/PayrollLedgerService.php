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
        // Other deductions as the payroll posts them: custom + other deductions, less HELB (its own account).
        $amount = $key === 'salaries_payable'
            ? 'COALESCE(p.net_pay,0)'
            : 'COALESCE(p.total_custom_deductions,0) + COALESCE(p.other_deductions,0) - COALESCE(p.helb,0)';
        $slips = DB::table('payroll_payslips as p')
            ->join('employees as e', 'e.id', '=', 'p.employee_id')
            ->whereIn('p.payroll_run_id', $runs->pluck('id'))->where('p.gross_pay', '>', 0)
            ->select('p.payroll_run_id', 'e.employee_number', 'e.first_name', 'e.last_name')
            ->selectRaw("{$amount} AS amount")
            ->orderBy('e.employee_number')->get()->groupBy('payroll_run_id');

        $rows = [];
        foreach ($runs as $run) {
            $paid = $key === 'salaries_payable' && $run->status === 'paid';
            foreach ($slips->get($run->id, collect()) as $s) {
                $amount = round((float) $s->amount, 2);
                if ($amount <= 0) {
                    continue;
                }
                $rows[] = [
                    'payee' => trim("{$s->first_name} {$s->last_name}"),
                    'employee_number' => $s->employee_number,
                    'period' => Carbon::create($run->pay_year, $run->pay_month, 1)->format('F Y'),
                    'amount' => $amount,
                    'paid' => $paid ? $amount : 0.0,
                    'balance' => $paid ? 0.0 : $amount,
                    'status' => $key === 'salaries_payable'
                        ? ($paid ? 'Paid' : ($run->status === 'payment_initiated' ? 'Payment initiated' : 'Unpaid'))
                        : 'Owed',
                    'paid_date' => $paid ? ($run->payment_date?->toDateString() ?? $run->paid_at?->toDateString()) : null,
                    'reference' => $paid ? $run->payment_reference : null,
                    'paid_from' => $paid ? $run->paymentAccount?->account_name : null,
                ];
            }
        }
        return ['kind' => $key === 'salaries_payable' ? 'employees' : 'deductions', 'rows' => $rows];
    }
}
