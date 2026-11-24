<?php

namespace App\Services;

use App\Models\PayrollRun;
use App\Models\StatutoryPayment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * What each approved payroll month owes the statutory bodies, from its payslips:
 *   PAYE (employee) · NSSF (employee + employer) · SHIF (employee) · Housing Levy (employee + employer)
 *   · HELB (employee, where applicable) · NITA (employer, KES 50 a head)
 * with the payments made against each - Pending / Partially Paid / Fully Paid, due by the 9th of the
 * next month (HELB the 15th), overdue after.
 */
class StatutoryObligationService
{
    public function __construct(private readonly LedgerPostingService $ledger)
    {
    }

    /** The payroll months shown: approved and later, not past "record" runs, and from the posting start on. */
    public function runs(string $companyId, ?int $year = null)
    {
        $postingOn = $this->postingOn($companyId);
        return PayrollRun::where('company_id', $companyId)
            ->where(fn ($q) => $q->whereNull('is_historical')->orWhere('is_historical', false))
            ->whereIn('status', ['approved', 'payment_initiated', 'paid'])
            ->when($year, fn ($q) => $q->where('pay_year', $year))
            ->with('paymentAccount:id,account_code,account_name')
            ->orderByDesc('pay_year')->orderByDesc('pay_month')
            ->get()
            ->filter(fn (PayrollRun $r) => !$postingOn || $this->ledger->payrollPosts($r))
            ->values();
    }

    private function postingOn(string $companyId): bool
    {
        $s = \App\Models\CompanyAccountingSettings::where('company_id', $companyId)->first();
        return $s && $s->payroll_posts_to_ledger !== false && $s->accounting_integration_enabled;
    }

    public function forCompany(string $companyId, ?int $year = null): array
    {
        $runs = $this->runs($companyId, $year);
        if ($runs->isEmpty()) {
            return ['months' => [], 'totals' => ['due' => 0, 'paid' => 0, 'balance' => 0]];
        }

        $sums = $this->sums($runs->pluck('id')->all());
        $payments = StatutoryPayment::whereIn('payroll_run_id', $runs->pluck('id'))
            ->with(['account:id,account_code,account_name', 'creator:id,first_name,last_name'])
            ->orderBy('payment_date')->orderBy('created_at')->get()->groupBy(fn ($p) => $p->payroll_run_id . '|' . $p->item);

        $months = [];
        $tDue = $tPaid = 0.0;
        foreach ($runs as $run) {
            $lines = [];
            foreach (array_keys(StatutoryPayment::ITEMS) as $item) {
                $line = $this->buildLine($run, $item, $sums[$run->id] ?? [], $payments->get($run->id . '|' . $item, collect()));
                if ($item === 'helb' && $line['due'] <= 0 && $line['paid'] <= 0) {
                    continue; // HELB only where applicable
                }
                $lines[] = $line;
                $tDue += $line['due'];
                $tPaid += $line['paid'];
            }
            $due = round(array_sum(array_column($lines, 'due')), 2);
            $paid = round(array_sum(array_column($lines, 'paid')), 2);
            $months[] = [
                'payroll_run_id' => $run->id,
                'pay_month' => $run->pay_month,
                'pay_year' => $run->pay_year,
                'period_label' => Carbon::create($run->pay_year, $run->pay_month, 1)->format('F Y'),
                'run_status' => $run->status,
                'posts_to_ledger' => $this->ledger->payrollPosts($run),
                'net_salaries' => [
                    'amount' => round((float) ($sums[$run->id]['net'] ?? 0), 2),
                    'status' => $run->status === 'paid' ? 'Paid' : ($run->status === 'payment_initiated' ? 'Payment initiated' : 'Pending'),
                    'payment_date' => $run->payment_date?->toDateString(),
                    'reference' => $run->payment_reference,
                    'account' => $run->paymentAccount?->account_name,
                ],
                'lines' => $lines,
                'totals' => ['due' => $due, 'paid' => $paid, 'balance' => round($due - $paid, 2)],
            ];
        }

        return ['months' => $months, 'totals' => ['due' => round($tDue, 2), 'paid' => round($tPaid, 2), 'balance' => round($tDue - $tPaid, 2)]];
    }

    /** One item of one month (used to check a new payment against what is left). */
    public function line(PayrollRun $run, string $item): array
    {
        $sums = $this->sums([$run->id]);
        $payments = StatutoryPayment::where('payroll_run_id', $run->id)->where('item', $item)->get();
        return $this->buildLine($run, $item, $sums[$run->id] ?? [], $payments);
    }

    private function sums(array $runIds): array
    {
        return DB::table('payroll_payslips')->whereIn('payroll_run_id', $runIds)->where('gross_pay', '>', 0)
            ->groupBy('payroll_run_id')
            ->selectRaw('payroll_run_id,
                COALESCE(SUM(paye),0) paye, COALESCE(SUM(nssf_employee),0) nssf_employee, COALESCE(SUM(nssf_employer),0) nssf_employer,
                COALESCE(SUM(shif),0) shif, COALESCE(SUM(housing_levy_employee),0) hl_employee, COALESCE(SUM(housing_levy_employer),0) hl_employer,
                COALESCE(SUM(helb),0) helb, COALESCE(SUM(nita),0) nita, COALESCE(SUM(net_pay),0) net, COUNT(*) employees')
            ->get()->mapWithKeys(fn ($r) => [$r->payroll_run_id => (array) $r])->all();
    }

    private function buildLine(PayrollRun $run, string $item, array $s, $payments): array
    {
        [$label, $authority, $dueDay] = StatutoryPayment::ITEMS[$item];
        [$employee, $employer] = match ($item) {
            'paye' => [(float) ($s['paye'] ?? 0), 0.0],
            'nssf' => [(float) ($s['nssf_employee'] ?? 0), (float) ($s['nssf_employer'] ?? 0)],
            'shif' => [(float) ($s['shif'] ?? 0), 0.0],
            'housing_levy' => [(float) ($s['hl_employee'] ?? 0), (float) ($s['hl_employer'] ?? 0)],
            'helb' => [(float) ($s['helb'] ?? 0), 0.0],
            'nita' => [0.0, (float) ($s['nita'] ?? 0)],
        };
        $due = round($employee + $employer, 2);
        $paid = round((float) $payments->sum('amount'), 2);
        $balance = round($due - $paid, 2);
        $dueDate = Carbon::create($run->pay_year, $run->pay_month, 1)->addMonthNoOverflow()->day($dueDay);
        $status = $due <= 0 ? 'Nothing due' : ($balance <= 0 ? 'Fully Paid' : ($paid > 0 ? 'Partially Paid' : 'Pending'));
        $overdue = $balance > 0 && now()->startOfDay()->gt($dueDate);

        return [
            'item' => $item,
            'label' => $label,
            'authority' => $authority,
            'period_label' => Carbon::create($run->pay_year, $run->pay_month, 1)->format('F Y'),
            'employee_share' => round($employee, 2),
            'employer_share' => round($employer, 2),
            'due' => $due,
            'paid' => $paid,
            'balance' => max(0, $balance),
            'status' => $status,
            'due_date' => $dueDate->toDateString(),
            'overdue' => $overdue,
            'days_late' => $overdue ? (int) $dueDate->diffInDays(now()->startOfDay()) : 0,
            'payments' => $payments->map(fn (StatutoryPayment $p) => [
                'id' => $p->id,
                'amount' => (float) $p->amount,
                'payment_date' => $p->payment_date?->toDateString(),
                'reference' => $p->reference,
                'payment_method' => $p->payment_method,
                'account' => $p->account?->account_name,
                'attachment_url' => $p->attachment_url,
                'notes' => $p->notes,
                'recorded_by' => $p->creator ? trim($p->creator->first_name . ' ' . $p->creator->last_name) : null,
            ])->values()->all(),
        ];
    }

    /** Every salary payment and statutory payment, newest first. */
    public function history(string $companyId, ?string $from = null, ?string $to = null): array
    {
        $rows = [];
        $runs = PayrollRun::where('company_id', $companyId)->where('status', 'paid')
            ->where(fn ($q) => $q->whereNull('is_historical')->orWhere('is_historical', false))
            ->with('paymentAccount:id,account_name')->get();
        $net = DB::table('payroll_payslips')->whereIn('payroll_run_id', $runs->pluck('id'))->groupBy('payroll_run_id')
            ->selectRaw('payroll_run_id, SUM(net_pay) net')->pluck('net', 'payroll_run_id');
        $payers = \App\Models\User::whereIn('id', $runs->pluck('paid_by')->filter()->unique())->get(['id', 'first_name', 'last_name'])->keyBy('id');
        foreach ($runs as $r) {
            $date = $r->payment_date?->toDateString() ?? $r->paid_at?->toDateString();
            $u = $payers[$r->paid_by] ?? null;
            $rows[] = [
                'type' => 'Net salaries',
                'period_label' => Carbon::create($r->pay_year, $r->pay_month, 1)->format('F Y'),
                'payment_date' => $date,
                'amount' => round((float) ($net[$r->id] ?? 0), 2),
                'account' => $r->paymentAccount?->account_name,
                'payment_method' => $r->payment_method,
                'reference' => $r->payment_reference,
                'paid_to' => 'Staff',
                'recorded_by' => $u ? trim($u->first_name . ' ' . $u->last_name) : null,
                'attachment_url' => null,
            ];
        }
        $payments = StatutoryPayment::where('company_id', $companyId)
            ->with(['payrollRun:id,pay_month,pay_year', 'account:id,account_name', 'creator:id,first_name,last_name'])->get();
        foreach ($payments as $p) {
            $rows[] = [
                'type' => $p->item_label,
                'period_label' => $p->payrollRun ? Carbon::create($p->payrollRun->pay_year, $p->payrollRun->pay_month, 1)->format('F Y') : null,
                'payment_date' => $p->payment_date?->toDateString(),
                'amount' => (float) $p->amount,
                'account' => $p->account?->account_name,
                'payment_method' => $p->payment_method,
                'reference' => $p->reference,
                'paid_to' => StatutoryPayment::ITEMS[$p->item][1] ?? null,
                'recorded_by' => $p->creator ? trim($p->creator->first_name . ' ' . $p->creator->last_name) : null,
                'attachment_url' => $p->attachment_url,
            ];
        }
        $rows = array_values(array_filter($rows, fn ($r) => (!$from || ($r['payment_date'] ?? '') >= $from) && (!$to || ($r['payment_date'] ?? '') <= $to)));
        usort($rows, fn ($a, $b) => strcmp($b['payment_date'] ?? '', $a['payment_date'] ?? ''));
        return $rows;
    }
}
