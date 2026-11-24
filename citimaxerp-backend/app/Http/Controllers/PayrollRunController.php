<?php

namespace App\Http\Controllers;

use App\Models\PayrollRun;
use App\Models\PayrollPayslip;
use App\Services\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class PayrollRunController extends Controller
{
    protected PayrollService $payrollService;

    public function __construct(PayrollService $payrollService)
    {
        $this->middleware('auth:sanctum');
        $this->payrollService = $payrollService;
    }

    // -------------------------------------------------------------------------
    // Permission helper
    // -------------------------------------------------------------------------

    protected function hasPermission(Request $request, string $permission, ?string $resourceCompanyId = null): bool
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

    // -------------------------------------------------------------------------
    // Aggregate select for payroll runs
    // -------------------------------------------------------------------------

    private function withAggregates($query)
    {
        return $query->withCount('payslips')
            ->addSelect([
                'payroll_runs.*',
                DB::raw('(SELECT SUM(gross_pay) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_gross'),
                DB::raw('(SELECT SUM(net_pay) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_net'),
                DB::raw('(SELECT SUM(paye) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_paye'),
                DB::raw('(SELECT SUM(nssf_employee) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_nssf_employee'),
                DB::raw('(SELECT SUM(nssf_employer) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_nssf_employer'),
                DB::raw('(SELECT SUM(shif) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_shif'),
                DB::raw('(SELECT SUM(housing_levy_employee) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_housing_levy'),
                DB::raw('(SELECT SUM(total_custom_deductions) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_deductions'),
                DB::raw('(SELECT SUM(salary_advance_deduction) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_advance_deductions'),
                DB::raw('(SELECT SUM(housing_levy_employer) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_housing_levy_employer'),
                DB::raw('(SELECT SUM(nita) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_nita'),
                DB::raw('(SELECT SUM(helb) FROM payroll_payslips WHERE payroll_payslips.payroll_run_id = payroll_runs.id) as total_helb'),
            ])->with('paymentAccount:id,account_code,account_name');
    }

    // -------------------------------------------------------------------------
    // GET /payroll-runs/stats
    // -------------------------------------------------------------------------

    public function stats(Request $request): JsonResponse
    {
        try {
            $companyId = $request->user()->company_id;
            $currentYear = now()->year;

            $runsThisYear = PayrollRun::where('company_id', $companyId)
                ->where('pay_year', $currentYear)
                ->count();

            $pendingApproval = PayrollRun::where('company_id', $companyId)
                ->where('status', 'draft')
                ->whereHas('payslips')
                ->count();

            $totalNetPaidThisYear = PayrollPayslip::whereHas('payrollRun', function ($q) use ($companyId, $currentYear) {
                $q->where('company_id', $companyId)
                    ->where('pay_year', $currentYear)
                    ->where('status', 'paid');
            })->sum('net_pay');

            $lastRun = PayrollRun::where('company_id', $companyId)
                ->withCount('payslips')
                ->latest()
                ->first();

            return response()->json([
                'status' => 'success',
                'message' => 'Payroll stats retrieved successfully.',
                'data' => [
                    'runs_this_year' => $runsThisYear,
                    'pending_approval' => $pendingApproval,
                    'total_net_paid_this_year' => (float) $totalNetPaidThisYear,
                    'last_run' => $lastRun,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@stats: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve payroll stats.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // GET /payroll-runs
    // -------------------------------------------------------------------------

    public function index(Request $request): JsonResponse
    {
        try {
            $companyId = $request->user()->company_id;
            $perPage = $request->input('per_page', 15);

            $runs = $this->withAggregates(
                PayrollRun::where('company_id', $companyId)
            )
                ->orderByDesc('created_at')
                ->paginate($perPage);

            return response()->json([
                'status' => 'success',
                'message' => 'Payroll runs retrieved successfully.',
                'data' => $runs,
            ]);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@index: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve payroll runs.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // POST /payroll-runs
    // -------------------------------------------------------------------------

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'pay_month' => 'required|integer|min:1|max:12',
            'pay_year' => 'required|integer|min:2000|max:' . (now()->year + 1),
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed.',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            $validated = $validator->validated();
            $run = $this->payrollService->createRun(
                (int) $validated['pay_month'],
                (int) $validated['pay_year'],
                $user->company_id,
                $user->id
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Payroll run created successfully.',
                'data' => $run,
            ], 201);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@store: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    // -------------------------------------------------------------------------
    // GET /payroll-runs/{id}
    // -------------------------------------------------------------------------

    public function show(string $id): JsonResponse
    {
        try {
            $run = $this->withAggregates(
                PayrollRun::where('id', $id)
            )->first();

            if (!$run) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Payroll run not found.',
                ], 404);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Payroll run retrieved successfully.',
                'data' => $run,
            ]);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@show: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve payroll run.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // DELETE /payroll-runs/{id}
    // -------------------------------------------------------------------------

    /**
     * Delete a payroll run in any status, with its payslips - e.g. a past payroll entered wrongly, to
     * import it again. Salary advances it deducted go back to being owed; a run that posted to the
     * ledger has its entries reversed by the ledger sync.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $run = PayrollRun::where('company_id', $request->user()->company_id)->find($id);
        if (!$run) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll run not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_delete_payroll', $run->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'You do not have permission to delete payroll runs.'], 403);
        }

        $label = date('F Y', mktime(0, 0, 0, $run->pay_month, 1, $run->pay_year));
        $count = $run->payslips()->count();
        DB::transaction(function () use ($run) {
            \App\Models\SalaryAdvance::where('deducted_in_run', $run->id)->update(['deducted_in_run' => null]);
            $run->payslips()->delete();
            $run->delete();
        });
        \App\Models\ActivityLog::logActivity('payroll_run_deleted', "Payroll {$label} deleted ({$count} payslips, was {$run->status})", $request->user(), [
            'payroll_run_id' => $run->id, 'is_historical' => $run->is_historical,
        ]);

        return response()->json(['status' => 'success', 'message' => "Payroll {$label} deleted."]);
    }

    // -------------------------------------------------------------------------
    // POST /payroll-runs/{id}/process
    // -------------------------------------------------------------------------

    public function process(Request $request, string $id): JsonResponse
    {
        try {
            $run = PayrollRun::findOrFail($id);
            if (!$this->hasPermission($request, 'can_create_payroll', $run->company_id)) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
            }
            $this->payrollService->processRun($run);

            return response()->json([
                'status' => 'success',
                'message' => 'Payroll run processed successfully.',
                'data' => $run->fresh(),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payroll run not found.',
            ], 404);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@process: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    // -------------------------------------------------------------------------
    // POST /payroll-runs/{id}/approve
    // -------------------------------------------------------------------------

    public function approve(Request $request, string $id): JsonResponse
    {
        try {
            $run = PayrollRun::findOrFail($id);
            if (!$this->hasPermission($request, 'can_approve_payroll', $run->company_id)) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
            }
            $this->payrollService->approveRun($run, $request->user()->id);

            return response()->json([
                'status' => 'success',
                'message' => 'Payroll run approved successfully.',
                'data' => $run->fresh(),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payroll run not found.',
            ], 404);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@approve: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    // -------------------------------------------------------------------------
    // POST /payroll-runs/{id}/mark-paid
    // -------------------------------------------------------------------------

    /** Bank / cash accounts a salary or statutory payment can be paid from, with balances. */
    public function paymentAccounts(Request $request): JsonResponse
    {
        $accounts = app(\App\Services\CashBookService::class)->moneyAccounts($request->user()->company_id);
        return response()->json(['status' => 'success', 'data' => $accounts]);
    }

    private function paymentRules(bool $referenceRequired): array
    {
        return [
            'account_id' => 'required|uuid',
            'payment_method' => 'required|in:bank_transfer,cheque,mpesa,cash,rtgs,eft',
            'payment_date' => 'required|date',
            'payment_reference' => ($referenceRequired ? 'required' : 'nullable') . '|string|max:120',
        ];
    }

    private function validatedPayment(Request $request, PayrollRun $run, bool $referenceRequired): array
    {
        $data = Validator::make($request->all(), $this->paymentRules($referenceRequired), [
            'account_id.required' => 'Choose the bank account (or petty cash) the salaries are paid from.',
            'payment_reference.required' => 'Enter the payment reference (bank transaction, cheque or M-Pesa code).',
        ])->validate();
        $ok = \App\Models\ChartOfAccount::where('company_id', $run->company_id)->where('id', $data['account_id'])->exists();
        if (!$ok) {
            throw \Illuminate\Validation\ValidationException::withMessages(['account_id' => 'Choose one of the company\'s bank or cash accounts.']);
        }
        return $data;
    }

    // POST /payroll-runs/{id}/initiate-payment - payment voucher prepared, no bank entry yet.
    public function initiatePayment(Request $request, string $id): JsonResponse
    {
        $run = PayrollRun::where('company_id', $request->user()->company_id)->find($id);
        if (!$run) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll run not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_process_payroll', $run->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        try {
            $data = $this->validatedPayment($request, $run, false);
            $this->payrollService->initiatePayment($run, $request->user()->id, $data);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['status' => 'failed', 'message' => collect($e->errors())->flatten()->first(), 'errors' => $e->errors()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 400);
        }
        return response()->json(['status' => 'success', 'message' => 'Payment initiated - confirm it once the money has left the bank.', 'data' => $this->withAggregates(PayrollRun::where('id', $run->id))->first()]);
    }

    // POST /payroll-runs/{id}/reopen - back to draft to correct (reverses its payroll entry).
    public function reopen(Request $request, string $id): JsonResponse
    {
        $run = PayrollRun::where('company_id', $request->user()->company_id)->find($id);
        if (!$run) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll run not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_approve_payroll', $run->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        try {
            $this->payrollService->reopenRun($run);
        } catch (\RuntimeException $e) {
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 400);
        }
        return response()->json(['status' => 'success', 'message' => 'Payroll sent back to draft.', 'data' => $run->fresh()]);
    }

    public function markPaid(Request $request, string $id): JsonResponse
    {
        try {
            $run = PayrollRun::where('company_id', $request->user()->company_id)->findOrFail($id);
            if (!$this->hasPermission($request, 'can_process_payroll', $run->company_id)) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
            }
            try {
                $data = $this->validatedPayment($request, $run, true);
            } catch (\Illuminate\Validation\ValidationException $e) {
                return response()->json(['status' => 'failed', 'message' => collect($e->errors())->flatten()->first(), 'errors' => $e->errors()], 422);
            }
            $this->payrollService->markPaid($run, $request->user()->id, $data);

            return response()->json([
                'status' => 'success',
                'message' => app(\App\Services\LedgerPostingService::class)->payrollPosts($run)
                    ? 'Salary payment confirmed and posted to ' . ($run->fresh()->paymentAccount?->account_name ?? 'the bank') . '.'
                    : 'Salary payment confirmed (this month is not posted to the ledger - salaries before it were booked as expenses).',
                'data' => $this->withAggregates(PayrollRun::where('id', $run->id))->first(),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payroll run not found.',
            ], 404);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@markPaid: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    // -------------------------------------------------------------------------
    // GET /payroll-runs/{id}/payslips
    // -------------------------------------------------------------------------

    public function payslips(Request $request, string $id): JsonResponse
    {
        try {
            $run = PayrollRun::findOrFail($id);
            $perPage = $request->input('per_page', 15);
            $search = $request->input('search');

            $query = PayrollPayslip::where('payroll_run_id', $run->id)
                ->with('employee');

            if ($search) {
                $query->whereHas('employee', function ($q) use ($search) {
                    $q->where('first_name', 'ilike', "%{$search}%")
                      ->orWhere('last_name', 'ilike', "%{$search}%")
                      ->orWhere('employee_number', 'ilike', "%{$search}%")
                      ->orWhere('department', 'ilike', "%{$search}%");
                });
            }

            $payslips = $query->paginate($perPage);

            return response()->json([
                'status' => 'success',
                'message' => 'Payslips retrieved successfully.',
                'data' => $payslips,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payroll run not found.',
            ], 404);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@payslips: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve payslips.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // GET /payroll-runs/{id}/payslips/{payslipId}/download
    // -------------------------------------------------------------------------

    public function downloadPayslip(string $runId, string $payslipId): mixed
    {
        try {
            $payslip = PayrollPayslip::where('payroll_run_id', $runId)
                ->where('id', $payslipId)
                ->firstOrFail();

            $pdf = $this->payrollService->generatePayslipPdf($payslip);

            return response()->streamDownload(function () use ($pdf) {
                echo $pdf;
            }, 'payslip-' . $payslip->id . '.pdf', [
                'Content-Type' => 'application/pdf',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payslip not found.',
            ], 404);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@downloadPayslip: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate payslip PDF.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // GET /payroll-runs/{id}/export/p10
    // -------------------------------------------------------------------------

    public function exportP10(string $id): mixed
    {
        try {
            $run = PayrollRun::findOrFail($id);
            $data = $this->payrollService->buildP10($run);

            $filename = 'P10-' . $run->pay_year . '-' . str_pad($run->pay_month, 2, '0', STR_PAD_LEFT) . '.csv';

            // Build P10 CSV directly from payslips for accurate column mapping
            $payslips = PayrollPayslip::where('payroll_run_id', $run->id)
                ->with(['employee:id,employee_number,first_name,last_name', 'employee.statutoryDetails'])
                ->get();

            $headers = [
                'Employee Name', 'KRA PIN', 'NSSF No', 'Basic Salary', 'Total Allowances',
                'Gross Pay', 'Taxable Pay', 'PAYE', 'Personal Relief', 'Insurance Relief',
                'NSSF Employee', 'NSSF Employer', 'SHIF', 'Housing Levy (Employee)', 'Housing Levy (Employer)',
            ];

            return response()->streamDownload(function () use ($headers, $payslips) {
                $out = fopen('php://output', 'w');
                fputcsv($out, $headers);

                $totals = array_fill_keys(['basic', 'allowances', 'gross', 'taxable', 'paye', 'p_relief', 'ins_relief', 'nssf_e', 'nssf_r', 'shif', 'hl_e', 'hl_r'], '0.00');

                foreach ($payslips as $p) {
                    $emp = $p->employee;
                    $gross = bcadd((string) $p->gross_pay, (string) $p->total_allowances, 2);
                    fputcsv($out, [
                        ($emp->first_name ?? '') . ' ' . ($emp->last_name ?? ''),
                        $emp->statutoryDetails?->kra_pin ?? '', $emp->statutoryDetails?->nssf_number ?? '',
                        $p->gross_pay, $p->total_allowances, $gross,
                        $p->taxable_pay, $p->paye, $p->personal_relief, $p->insurance_relief,
                        $p->nssf_employee, $p->nssf_employer, $p->shif,
                        $p->housing_levy_employee, $p->housing_levy_employer,
                    ]);
                    $totals['basic']      = bcadd($totals['basic'], (string) $p->gross_pay, 2);
                    $totals['allowances'] = bcadd($totals['allowances'], (string) $p->total_allowances, 2);
                    $totals['gross']      = bcadd($totals['gross'], $gross, 2);
                    $totals['taxable']    = bcadd($totals['taxable'], (string) $p->taxable_pay, 2);
                    $totals['paye']       = bcadd($totals['paye'], (string) $p->paye, 2);
                    $totals['p_relief']   = bcadd($totals['p_relief'], (string) $p->personal_relief, 2);
                    $totals['ins_relief'] = bcadd($totals['ins_relief'], (string) $p->insurance_relief, 2);
                    $totals['nssf_e']     = bcadd($totals['nssf_e'], (string) $p->nssf_employee, 2);
                    $totals['nssf_r']     = bcadd($totals['nssf_r'], (string) $p->nssf_employer, 2);
                    $totals['shif']       = bcadd($totals['shif'], (string) $p->shif, 2);
                    $totals['hl_e']       = bcadd($totals['hl_e'], (string) $p->housing_levy_employee, 2);
                    $totals['hl_r']       = bcadd($totals['hl_r'], (string) $p->housing_levy_employer, 2);
                }

                fputcsv($out, [
                    'TOTALS', '', '',
                    $totals['basic'], $totals['allowances'], $totals['gross'], $totals['taxable'],
                    $totals['paye'], $totals['p_relief'], $totals['ins_relief'],
                    $totals['nssf_e'], $totals['nssf_r'],
                    $totals['shif'], $totals['hl_e'], $totals['hl_r'],
                ]);
                fclose($out);
            }, $filename, [
                'Content-Type' => 'text/csv',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payroll run not found.',
            ], 404);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@exportP10: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to export P10.',
            ], 500);
        }
    }

    /**
     * Export payroll run as CSV.
     */
    public function exportCsv(string $id)
    {
        try {
            $run = PayrollRun::findOrFail($id);
            $payslips = PayrollPayslip::where('payroll_run_id', $run->id)
                ->with(['employee:id,employee_number,first_name,last_name,department,position,basic_salary', 'employee.statutoryDetails'])
                ->get();

            // Collect all unique allowance and deduction names across payslips
            $allAllowanceNames = [];
            $allDeductionNames = [];
            foreach ($payslips as $p) {
                foreach ($p->allowances_json ?? [] as $a) {
                    $name = $a['name'] ?? '';
                    if ($name && !in_array($name, $allAllowanceNames)) {
                        $allAllowanceNames[] = $name;
                    }
                }
                foreach ($p->deductions_json ?? [] as $d) {
                    $name = $d['name'] ?? '';
                    if ($name && !in_array($name, $allDeductionNames)) {
                        $allDeductionNames[] = $name;
                    }
                }
            }

            // Build headers with dynamic allowance/deduction columns
            $headers = ['Employee No', 'First Name', 'Last Name', 'Department', 'Position', 'KRA PIN', 'NSSF No', 'Basic Salary'];

            // Allowance columns
            foreach ($allAllowanceNames as $name) {
                $headers[] = 'Allow: ' . $name;
            }
            $headers[] = 'Total Allowances';
            $headers[] = 'Gross Pay';

            // Statutory
            $headers = array_merge($headers, [
                'NSSF Tier I', 'NSSF Tier II', 'NSSF Employee', 'NSSF Employer',
                'Taxable Pay', 'PAYE Before Relief', 'Personal Relief', 'Insurance Relief', 'Net PAYE',
                'SHIF', 'Housing Levy (Employee)', 'Housing Levy (Employer)',
            ]);

            // Deduction columns
            foreach ($allDeductionNames as $name) {
                $headers[] = 'Ded: ' . $name;
            }
            $headers = array_merge($headers, [
                'Total Custom Deductions', 'Salary Advance', 'Other Deductions',
                'Total Deductions', 'Net Pay',
            ]);

            $rows = [];
            foreach ($payslips as $p) {
                $emp = $p->employee;

                // Build allowance amounts map
                $allowanceAmounts = [];
                foreach ($p->allowances_json ?? [] as $a) {
                    $allowanceAmounts[$a['name'] ?? ''] = $a['amount'] ?? 0;
                }

                // Build deduction amounts map
                $deductionAmounts = [];
                foreach ($p->deductions_json ?? [] as $d) {
                    $deductionAmounts[$d['name'] ?? ''] = $d['amount'] ?? 0;
                }

                $row = [
                    $emp->employee_number ?? '',
                    $emp->first_name ?? '',
                    $emp->last_name ?? '',
                    $emp->department ?? '',
                    $emp->position ?? '',
                    $emp->statutoryDetails?->kra_pin ?? '',
                    $emp->statutoryDetails?->nssf_number ?? '',
                    $p->gross_pay,
                ];

                // Allowance values
                foreach ($allAllowanceNames as $name) {
                    $row[] = $allowanceAmounts[$name] ?? '0.00';
                }
                $row[] = $p->total_allowances;
                $row[] = bcadd((string) $p->gross_pay, (string) $p->total_allowances, 2);

                // Statutory
                $row = array_merge($row, [
                    $p->nssf_tier1, $p->nssf_tier2, $p->nssf_employee, $p->nssf_employer,
                    $p->taxable_pay, $p->paye_before_relief, $p->personal_relief, $p->insurance_relief, $p->paye,
                    $p->shif, $p->housing_levy_employee, $p->housing_levy_employer,
                ]);

                // Deduction values
                foreach ($allDeductionNames as $name) {
                    $row[] = $deductionAmounts[$name] ?? '0.00';
                }
                $row = array_merge($row, [
                    $p->total_custom_deductions, $p->salary_advance_deduction, $p->other_deductions,
                    $p->total_deductions, $p->net_pay,
                ]);

                $rows[] = $row;
            }

            $filename = sprintf('payroll-%04d-%02d.csv', $run->pay_year, $run->pay_month);

            return response()->streamDownload(function () use ($headers, $rows) {
                $out = fopen('php://output', 'w');
                fputcsv($out, $headers);
                foreach ($rows as $row) {
                    fputcsv($out, $row);
                }
                fclose($out);
            }, $filename, [
                'Content-Type' => 'text/csv',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll run not found.'], 404);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@exportCsv: ' . $e->getMessage());
            return response()->json(['status' => 'failed', 'message' => 'Failed to export CSV.'], 500);
        }
    }

    /**
     * Update a payslip's allowances/deductions and recalculate.
     * Only allowed on draft runs.
     */
    public function updatePayslip(Request $request, string $runId, string $payslipId): JsonResponse
    {
        try {
            $run = PayrollRun::where('company_id', $request->user()->company_id)
                ->findOrFail($runId);

            if (!$this->hasPermission($request, 'can_update_payroll', $run->company_id)) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
            }

            if ($run->status !== 'draft') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Payslip can only be edited on draft runs.',
                ], 400);
            }
            if ($run->is_historical) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'This is a past payroll with the figures as paid. Change them by importing the month again (Payroll History).',
                ], 400);
            }

            $payslip = PayrollPayslip::where('payroll_run_id', $runId)->findOrFail($payslipId);

            $validator = Validator::make($request->all(), [
                'allowances' => 'nullable|array',
                'allowances.*.name' => 'required|string',
                'allowances.*.amount' => 'required|numeric|min:0',
                'allowances.*.frequency' => 'nullable|string',
                'allowances.*.is_taxable' => 'nullable|boolean',
                'deductions' => 'nullable|array',
                'deductions.*.name' => 'required|string',
                'deductions.*.amount' => 'required|numeric|min:0',
                'deductions.*.frequency' => 'nullable|string',
                'other_deductions' => 'nullable|numeric|min:0',
                'other_deductions_note' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Validation failed.',
                    'message' => $validator->errors(), 'errors' => $validator->errors(),
                ], 400);
            }

            $allowances = $request->input('allowances', []);
            $deductions = $request->input('deductions', []);

            // Calculate totals — Kenyan law: taxable allowances are part of gross
            $totalTaxableAllowances = '0.00';
            $totalNonTaxableAllowances = '0.00';
            foreach ($allowances as $a) {
                $amt = number_format($a['amount'] ?? 0, 2, '.', '');
                if ($a['is_taxable'] ?? true) {
                    $totalTaxableAllowances = bcadd($totalTaxableAllowances, $amt, 2);
                } else {
                    $totalNonTaxableAllowances = bcadd($totalNonTaxableAllowances, $amt, 2);
                }
            }
            $totalAllowances = bcadd($totalTaxableAllowances, $totalNonTaxableAllowances, 2);
            $totalCustomDeductions = array_sum(array_column($deductions, 'amount'));

            // Gross = basic salary + taxable allowances
            $calculator = app(\App\Services\KenyaPayrollCalculator::class);
            // gross_pay = basic + the taxable allowances it was last calculated with: take those back out.
            $oldTaxable = collect($payslip->allowances_json ?? [])->filter(fn ($a) => $a['is_taxable'] ?? true)->sum(fn ($a) => (float) ($a['amount'] ?? 0));
            $basicSalary = number_format(max(0, (float) $payslip->gross_pay - $oldTaxable), 2, '.', '');
            $grossPay = bcadd($basicSalary, $totalTaxableAllowances, 2);
            $insurance = (string) ($payslip->insurance_relief_premium ?? '0.00');

            // Statutory deductions calculated on gross (basic + taxable allowances)
            $calc = $calculator->calculate($grossPay, $insurance, PayrollService::statutoryOptions($payslip->employee));

            $otherDed = (string) ($request->input('other_deductions', '0') ?? '0');
            $advanceDed = (string) $payslip->salary_advance_deduction;

            $statutoryDeductions = bcadd(
                bcadd($calc['nssf_employee'], $calc['paye'], 2),
                bcadd($calc['shif'], $calc['housing_levy_employee'], 2),
                2
            );

            $totalDeductions = bcadd(
                bcadd($statutoryDeductions, (string) $totalCustomDeductions, 2),
                bcadd($advanceDed, $otherDed, 2),
                2
            );

            // Net = gross + non-taxable allowances - all deductions
            $netPay = bcsub(bcadd($grossPay, $totalNonTaxableAllowances, 2), $totalDeductions, 2);
            if (bccomp($netPay, '0.00', 2) < 0) $netPay = '0.00';

            $payslip->update([
                'gross_pay' => $grossPay,
                'nita' => $calc['nita'],
                'helb' => PayrollService::helbAmount($deductions),
                'allowances_json' => $allowances,
                'total_allowances' => $totalAllowances,
                'deductions_json' => $deductions,
                'total_custom_deductions' => $totalCustomDeductions,
                'nssf_tier1' => $calc['nssf_tier1'],
                'nssf_tier2' => $calc['nssf_tier2'],
                'nssf_employee' => $calc['nssf_employee'],
                'nssf_employer' => $calc['nssf_employer'],
                'taxable_pay' => $calc['taxable_pay'],
                'paye_before_relief' => $calc['paye_before_relief'],
                'personal_relief' => $calc['personal_relief'],
                'insurance_relief' => $calc['insurance_relief'],
                'paye' => $calc['paye'],
                'shif' => $calc['shif'],
                'housing_levy_employee' => $calc['housing_levy_employee'],
                'housing_levy_employer' => $calc['housing_levy_employer'],
                'other_deductions' => $otherDed,
                'other_deductions_note' => $request->input('other_deductions_note'),
                'total_deductions' => $totalDeductions,
                'net_pay' => $netPay,
            ]);

            // Sync recurring items (non one-time) back to employee profile
            // Only ADD new recurring entries — don't remove existing ones
            $employee = $payslip->employee;
            $recurringAllowances = array_filter($allowances, fn($a) => ($a['frequency'] ?? 'one_time') !== 'one_time' && !empty($a['name']));
            $recurringDeductions = array_filter($deductions, fn($d) => ($d['frequency'] ?? 'one_time') !== 'one_time' && !empty($d['name']));

            if (!empty($recurringAllowances) || !empty($recurringDeductions)) {
                // Get existing entry names to avoid duplicates
                $existingNames = \App\Models\EmployeeAllowance::where('employee_id', $employee->id)
                    ->whereRaw('is_active = true')
                    ->pluck('name')
                    ->map(fn($n) => strtolower(trim($n)))
                    ->toArray();

                $newItems = [];
                foreach ($recurringAllowances as $a) {
                    if (in_array(strtolower(trim($a['name'])), $existingNames)) {
                        // Update existing entry's amount
                        \App\Models\EmployeeAllowance::where('employee_id', $employee->id)
                            ->whereRaw('LOWER(name) = ?', [strtolower(trim($a['name']))])
                            ->where('frequency', '!=', 'disbursed')
                            ->update([
                                'amount' => $a['amount'] ?? 0,
                                'frequency' => $a['frequency'] ?? 'monthly',
                                'is_taxable' => $a['is_taxable'] ?? true,
                                'updated_at' => now(),
                            ]);
                    } else {
                        $newItems[] = [
                            'id' => \Illuminate\Support\Str::uuid()->toString(),
                            'employee_id' => $employee->id,
                            'company_id' => $employee->company_id,
                            'name' => $a['name'],
                            'type' => 'allowance',
                            'amount' => $a['amount'] ?? 0,
                            'frequency' => $a['frequency'] ?? 'monthly',
                            'is_taxable' => $a['is_taxable'] ?? true,
                            'is_active' => true,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                }
                foreach ($recurringDeductions as $d) {
                    if (in_array(strtolower(trim($d['name'])), $existingNames)) {
                        \App\Models\EmployeeAllowance::where('employee_id', $employee->id)
                            ->whereRaw('LOWER(name) = ?', [strtolower(trim($d['name']))])
                            ->update([
                                'amount' => $d['amount'] ?? 0,
                                'frequency' => $d['frequency'] ?? 'monthly',
                                'updated_at' => now(),
                            ]);
                    } else {
                        $newItems[] = [
                            'id' => \Illuminate\Support\Str::uuid()->toString(),
                            'employee_id' => $employee->id,
                            'company_id' => $employee->company_id,
                            'name' => $d['name'],
                            'type' => 'deduction',
                            'amount' => $d['amount'] ?? 0,
                            'frequency' => $d['frequency'] ?? 'monthly',
                            'is_taxable' => false,
                            'is_active' => true,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                }
                if (!empty($newItems)) {
                    \App\Models\EmployeeAllowance::insert($newItems);
                }

                // Refresh the employee JSON columns to include all entries
                $allDbAllowances = \App\Models\EmployeeAllowance::where('employee_id', $employee->id)
                    ->where('type', 'allowance')
                    ->whereRaw('is_active = true')
                    ->get()
                    ->map(fn($a) => ['name' => $a->name, 'amount' => (float) $a->amount, 'frequency' => $a->frequency, 'is_taxable' => (bool) $a->is_taxable])
                    ->values()
                    ->toArray();

                $allDbDeductions = \App\Models\EmployeeAllowance::where('employee_id', $employee->id)
                    ->where('type', 'deduction')
                    ->whereRaw('is_active = true')
                    ->get()
                    ->map(fn($d) => ['name' => $d->name, 'amount' => (float) $d->amount, 'frequency' => $d->frequency])
                    ->values()
                    ->toArray();

                $employee->update([
                    'allowances' => $allDbAllowances,
                    'deductions' => $allDbDeductions,
                ]);
            }

            $payslip->load('employee');

            return response()->json([
                'status' => 'success',
                'message' => 'Payslip updated and recalculated.',
                'data' => $payslip,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['status' => 'failed', 'message' => 'Payslip not found.'], 404);
        } catch (\Exception $e) {
            Log::error('PayrollRunController@updatePayslip: ' . $e->getMessage());
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 500);
        }
    }
}
