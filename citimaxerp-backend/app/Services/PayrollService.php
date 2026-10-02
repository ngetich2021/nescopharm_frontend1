<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeAllowance;
use App\Models\PayrollPayslip;
use App\Models\PayrollRun;
use App\Models\SalaryAdvance;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;


class PayrollService
{
    public function __construct(
        private readonly KenyaPayrollCalculator $calculator,
    ) {}

    // ─── 1. Create Run ──────────────────────────────────────────────────

    public function createRun(int $month, int $year, string $companyId, string $creatorId): PayrollRun
    {
        $exists = PayrollRun::where('company_id', $companyId)
            ->where('pay_month', $month)
            ->where('pay_year', $year)
            ->exists();

        if ($exists) {
            throw new \RuntimeException(
                "A payroll run already exists for {$year}-{$month} in this company."
            );
        }

        return PayrollRun::create([
            'company_id' => $companyId,
            'pay_month'  => $month,
            'pay_year'   => $year,
            'status'     => 'draft',
            'created_by' => $creatorId,
        ]);
    }

    // ─── 2. Process Run ─────────────────────────────────────────────────

    public function processRun(PayrollRun $run): void
    {
        if ($run->status !== 'draft') {
            throw new \RuntimeException(
                "Only draft payroll runs can be processed. Current status: {$run->status}"
            );
        }

        DB::transaction(function () use ($run) {
            // Re-process scenario: wipe previous payslips
            $run->payslips()->delete();

            // Unmark any salary advances that were tied to a previous processing
            SalaryAdvance::where('deducted_in_run', $run->id)
                ->update(['deducted_in_run' => null]);

            // Get the first and last day of the pay month
            $monthStart = sprintf('%04d-%02d-01', $run->pay_year, $run->pay_month);
            $monthEnd = date('Y-m-t', strtotime($monthStart));

            // Include only active employees who:
            // 1. Were hired on or before the last day of the pay month
            // 2. Were either never terminated OR terminated during this pay month
            //    (if terminated, they only get paid the month they're terminated)
            $employees = Employee::where('company_id', $run->company_id)
                ->whereRaw('is_active = true')
                ->where(function ($q) use ($monthStart, $monthEnd) {
                    $q->whereNull('hire_date')
                      ->orWhere('hire_date', '<=', $monthEnd);
                })
                ->where(function ($q) use ($monthStart, $monthEnd) {
                    $q->whereNull('termination_date')
                      ->orWhereBetween('termination_date', [$monthStart, $monthEnd]);
                })
                ->get();

            $payDate = $monthStart;

            foreach ($employees as $employee) {
                $this->processEmployee($run, $employee, $payDate, $monthStart, $monthEnd);
            }
        });
    }

    private function processEmployee(PayrollRun $run, Employee $employee, string $payDate, string $monthStart, string $monthEnd): void
    {
        // Calculate working days for proration if hired or terminated mid-month
        $workingDaysInMonth = $this->getWorkingDaysInMonth($monthStart, $monthEnd);
        $employeeWorkingDays = $this->getEmployeeWorkingDays($employee, $monthStart, $monthEnd);
        $prorationRatio = $workingDaysInMonth > 0 ? $employeeWorkingDays / $workingDaysInMonth : 1.0;

        $basicSalary = $this->toScale($employee->basic_salary);
        $basicSalary = bcmul($basicSalary, (string)$prorationRatio, 2);

        // ── Allowances ──────────────────────────────────────────────
        $allowances = $this->getApplicableAllowances($employee, $run->pay_month, $payDate);

        $totalTaxableAllowances    = '0.00';
        $totalNonTaxableAllowances = '0.00';
        $allowancesSnapshot        = [];

        foreach ($allowances as $allowance) {
            $amt = $this->toScale($allowance->amount);
            $allowancesSnapshot[] = [
                'id'         => $allowance->id,
                'name'       => $allowance->name,
                'amount'     => $amt,
                'frequency'  => $allowance->frequency,
                'is_taxable' => $allowance->is_taxable,
            ];

            if ($allowance->is_taxable) {
                $totalTaxableAllowances = bcadd($totalTaxableAllowances, $amt, 2);
            } else {
                $totalNonTaxableAllowances = bcadd($totalNonTaxableAllowances, $amt, 2);
            }
        }

        $totalAllowances = bcadd($totalTaxableAllowances, $totalNonTaxableAllowances, 2);

        // ── Custom deductions ───────────────────────────────────────
        $deductions = $this->getApplicableDeductions($employee, $run->pay_month, $payDate);

        $totalCustomDeductions = '0.00';
        $deductionsSnapshot    = [];

        foreach ($deductions as $deduction) {
            $amt = $this->toScale($deduction->amount);
            $deductionsSnapshot[] = [
                'id'        => $deduction->id,
                'name'      => $deduction->name,
                'amount'    => $amt,
                'frequency' => $deduction->frequency,
            ];
            $totalCustomDeductions = bcadd($totalCustomDeductions, $amt, 2);
        }

        // ── Insurance premium (from employee's statutory details) ───
        $insurancePremium = '0.00';
        $statutory = $employee->statutoryDetails;
        if ($statutory && !empty($statutory->insurance_relief_premium)) {
            $insurancePremium = $this->toScale($statutory->insurance_relief_premium);
        }

        // ── Gross pay (Kenyan law: allowances are part of gross) ────
        // Taxable allowances are added to basic salary to form gross pay
        // Non-taxable allowances (e.g. per diem) are added after tax
        $grossPay = bcadd($basicSalary, $totalTaxableAllowances, 2);

        // ── Statutory deductions via KenyaPayrollCalculator ─────────
        // Calculated on gross pay (basic + taxable allowances)
        $calc = $this->calculator->calculate($grossPay, $insurancePremium);

        // ── Salary advances ─────────────────────────────────────────
        $advances = SalaryAdvance::where('employee_id', $employee->id)
            ->where('company_id', $employee->company_id)
            ->where('status', 'approved')
            ->whereNull('deducted_in_run')
            ->get();

        $salaryAdvanceDeduction = '0.00';
        foreach ($advances as $advance) {
            $salaryAdvanceDeduction = bcadd($salaryAdvanceDeduction, $this->toScale($advance->amount), 2);
        }

        // ── Totals ──────────────────────────────────────────────────
        $statutoryDeductions = bcadd(
            bcadd($calc['paye'], $calc['nssf_employee'], 2),
            bcadd($calc['shif'], $calc['housing_levy_employee'], 2),
            2
        );

        $totalDeductions = bcadd(
            bcadd($statutoryDeductions, $totalCustomDeductions, 2),
            $salaryAdvanceDeduction,
            2
        );

        // Net pay = gross + non-taxable allowances - all deductions
        $netPay = bcsub(bcadd($grossPay, $totalNonTaxableAllowances, 2), $totalDeductions, 2);
        if (bccomp($netPay, '0.00', 2) < 0) {
            $netPay = '0.00';
        }

        // ── Create payslip ──────────────────────────────────────────
        PayrollPayslip::create([
            'payroll_run_id'          => $run->id,
            'employee_id'             => $employee->id,
            'company_id'              => $run->company_id,
            'gross_pay'               => $grossPay,
            'insurance_relief_premium' => $insurancePremium,
            'allowances_json'         => $allowancesSnapshot,
            'total_allowances'        => $totalAllowances,
            'deductions_json'         => $deductionsSnapshot,
            'total_custom_deductions' => $totalCustomDeductions,
            'nssf_tier1'              => $calc['nssf_tier1'],
            'nssf_tier2'              => $calc['nssf_tier2'],
            'nssf_employee'           => $calc['nssf_employee'],
            'nssf_employer'           => $calc['nssf_employer'],
            'taxable_pay'             => $calc['taxable_pay'],
            'paye_before_relief'      => $calc['paye_before_relief'],
            'personal_relief'         => $calc['personal_relief'],
            'insurance_relief'        => $calc['insurance_relief'],
            'paye'                    => $calc['paye'],
            'shif'                    => $calc['shif'],
            'housing_levy_employee'   => $calc['housing_levy_employee'],
            'housing_levy_employer'   => $calc['housing_levy_employer'],
            'salary_advance_deduction' => $salaryAdvanceDeduction,
            'total_deductions'        => $totalDeductions,
            'net_pay'                 => $netPay,
        ]);

        // ── Mark salary advances as deducted ────────────────────────
        if ($advances->isNotEmpty()) {
            SalaryAdvance::whereIn('id', $advances->pluck('id'))
                ->update(['deducted_in_run' => $run->id]);
        }

        // ── Mark one-time allowances as used ────────────────────────
        foreach ($allowances as $allowance) {
            if ($allowance->frequency === 'one_time') {
                $allowance->update(['is_active' => false]);
            }
        }
    }

    // ─── 3. Approve Run ─────────────────────────────────────────────────

    public function approveRun(PayrollRun $run, string $actorId): void
    {
        if ($run->status !== 'draft') {
            throw new \RuntimeException(
                "Only draft payroll runs can be approved. Current status: {$run->status}"
            );
        }

        if ($run->payslips()->count() === 0) {
            throw new \RuntimeException(
                'Cannot approve a payroll run with no payslips. Process the run first.'
            );
        }

        $run->update([
            'status'      => 'approved',
            'approved_by' => $actorId,
            'approved_at' => now(),
        ]);
    }

    // ─── 4. Mark Paid ───────────────────────────────────────────────────

    public function markPaid(PayrollRun $run, string $actorId): void
    {
        if ($run->status !== 'approved') {
            throw new \RuntimeException(
                "Only approved payroll runs can be marked as paid. Current status: {$run->status}"
            );
        }

        $run->update([
            'status'  => 'paid',
            'paid_by' => $actorId,
            'paid_at' => now(),
        ]);
    }

    // ─── 5. Generate Payslip PDF ────────────────────────────────────────

    public function generatePayslipPdf(PayrollPayslip $payslip)
    {
        $payslip->load(['employee', 'company', 'payrollRun']);

        $pdf = Pdf::loadView('payslips.payslip', ['payslip' => $payslip])
            ->setPaper('a4', 'portrait');

        $filename = sprintf(
            'payslip-%s-%04d-%02d.pdf',
            $payslip->employee->employee_number ?? $payslip->employee_id,
            $payslip->payrollRun->pay_year,
            $payslip->payrollRun->pay_month,
        );

        return $pdf->download($filename);
    }

    // ─── 6. Build P10 ──────────────────────────────────────────────────

    public function buildP10(PayrollRun $run): array
    {
        $payslips = $run->payslips()->with('employee')->get();

        $rows = [];

        foreach ($payslips as $payslip) {
            $employee = $payslip->employee;

            $rows[] = [
                'employee_name'         => $employee->full_name,
                'kra_pin'               => $employee->kra_pin,
                'nssf_number'           => $employee->nssf_number,
                'shif_number'           => $employee->shif_number,
                'basic_salary'          => $payslip->gross_pay,
                'total_allowances'      => $payslip->total_allowances,
                'gross_pay'             => bcadd($payslip->gross_pay, $payslip->total_allowances, 2),
                'taxable_pay'           => $payslip->taxable_pay,
                'paye'                  => $payslip->paye,
                'personal_relief'       => $payslip->personal_relief,
                'insurance_relief'      => $payslip->insurance_relief,
                'nssf_employee'         => $payslip->nssf_employee,
                'nssf_employer'         => $payslip->nssf_employer,
                'shif'                  => $payslip->shif,
                'housing_levy_employee' => $payslip->housing_levy_employee,
                'housing_levy_employer' => $payslip->housing_levy_employer,
            ];
        }

        // Aggregate totals
        $totals = [
            'basic_salary'          => '0.00',
            'total_allowances'      => '0.00',
            'gross_pay'             => '0.00',
            'taxable_pay'           => '0.00',
            'paye'                  => '0.00',
            'personal_relief'       => '0.00',
            'insurance_relief'      => '0.00',
            'nssf_employee'         => '0.00',
            'nssf_employer'         => '0.00',
            'shif'                  => '0.00',
            'housing_levy_employee' => '0.00',
            'housing_levy_employer' => '0.00',
        ];

        foreach ($rows as $row) {
            foreach ($totals as $key => &$sum) {
                $sum = bcadd($sum, $row[$key] ?? '0.00', 2);
            }
            unset($sum);
        }

        return [
            'pay_month'      => $run->pay_month,
            'pay_year'       => $run->pay_year,
            'company_id'     => $run->company_id,
            'employee_count' => count($rows),
            'rows'           => $rows,
            'totals'         => $totals,
        ];
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    /**
     * Retrieve EmployeeAllowance records (type = allowance) applicable for the
     * given employee and pay month, taking frequency into account.
     *
     * @return \Illuminate\Support\Collection<int, EmployeeAllowance>
     */
    private function getApplicableAllowances(Employee $employee, int $month, string $payDate): \Illuminate\Support\Collection
    {
        $allowances = EmployeeAllowance::where('employee_id', $employee->id)
            ->active()
            ->allowances()
            ->applicable($payDate)
            ->get();

        return $allowances->filter(function (EmployeeAllowance $a) use ($month) {
            return $this->frequencyApplies($a->frequency, $month, $a);
        })->values();
    }

    /**
     * Retrieve EmployeeAllowance records (type = deduction) applicable for the
     * given employee and pay month, taking frequency into account.
     *
     * @return \Illuminate\Support\Collection<int, EmployeeAllowance>
     */
    private function getApplicableDeductions(Employee $employee, int $month, string $payDate): \Illuminate\Support\Collection
    {
        $deductions = EmployeeAllowance::where('employee_id', $employee->id)
            ->active()
            ->deductions()
            ->applicable($payDate)
            ->get();

        return $deductions->filter(function (EmployeeAllowance $d) use ($month) {
            return $this->frequencyApplies($d->frequency, $month, $d);
        })->values();
    }

    /**
     * Determine whether a record with the given frequency should be applied
     * in the specified month.
     */
    private function frequencyApplies(string $frequency, int $month, EmployeeAllowance $record): bool
    {
        return match ($frequency) {
            'monthly'   => true,
            'quarterly' => $month % 3 === 0,
            'annual'    => $month === 12,
            'one_time'  => $record->is_active,
            default     => false,
        };
    }

    /**
     * Normalise any numeric value to a bcmath-safe string with 2 decimal places.
     */
    private function toScale(mixed $value): string
    {
        return bcadd((string) ($value ?? '0'), '0', 2);
    }

    /**
     * Calculate total days in a given month (all days payable).
     */
    private function getWorkingDaysInMonth(string $monthStart, string $monthEnd): int
    {
        $start = new \DateTime($monthStart);
        $end = new \DateTime($monthEnd);
        // Days from 1st to last day of month (inclusive)
        return (int) $end->format('d');
    }

    /**
     * Calculate days employee worked (accounts for hire/termination dates, all days payable).
     * Example: Sept 15 to Sept 30 = 16 days (includes both start and end dates)
     */
    private function getEmployeeWorkingDays(Employee $employee, string $monthStart, string $monthEnd): int
    {
        $start = new \DateTime($monthStart);
        $end = new \DateTime($monthEnd);

        // Adjust start if employee was hired after month start
        if ($employee->hire_date) {
            $hireDate = new \DateTime($employee->hire_date->toDateString());
            if ($hireDate > $start) {
                $start = $hireDate;
            }
        }

        // Adjust end if employee was terminated before month end
        if ($employee->termination_date) {
            $terminationDate = new \DateTime($employee->termination_date->toDateString());
            if ($terminationDate < $end) {
                $end = $terminationDate;
            }
        }

        // Simple calculation: (end day - start day) + 1 (includes both days)
        // Example: Sept 15 to Sept 30 = (30 - 15) + 1 = 16 days
        $startDay = (int) $start->format('d');
        $endDay = (int) $end->format('d');
        return ($endDay - $startDay) + 1;
    }
}
