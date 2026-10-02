<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRecord;
use App\Services\PayrollCalculationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class PayrollController extends Controller
{
    public function __construct(private PayrollCalculationService $payrollService)
    {
        $this->middleware('auth:sanctum');
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
    // Sequential payroll-number generator: PR-YYYYMM-0001
    // -------------------------------------------------------------------------

    protected function generatePayrollNumber(string $companyId): string
    {
        $prefix = 'PR-' . now()->format('Ym') . '-';

        $last = PayrollRecord::where('company_id', $companyId)
            ->where('payroll_number', 'like', $prefix . '%')
            ->orderByDesc('payroll_number')
            ->value('payroll_number');

        $sequence = $last
            ? ((int) substr($last, strrpos($last, '-') + 1)) + 1
            : 1;

        return $prefix . str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }

    // -------------------------------------------------------------------------
    // Shared calculation helper — used by both store() and processBulkPayroll()
    // -------------------------------------------------------------------------

    protected function buildPayrollItem(
        array $input,
        Employee $employee,
        string $companyId,
        string $payrollRecordId
    ): array {
        $basicSalary     = (float) ($input['basic_salary'] ?? 0);
        $allowances      = is_array($input['allowances'] ?? null) ? $input['allowances'] : [];
        $deductions      = is_array($input['deductions'] ?? null) ? $input['deductions'] : [];
        $overtimeDetails = !empty($input['overtime_hours']) ? [
            'hours' => (float) $input['overtime_hours'],
            'type'  => $input['overtime_type'] ?? 'regular',
        ] : null;

        $grossPay        = $this->payrollService->calculateGrossPay($basicSalary, $allowances, $overtimeDetails);
        $totalAllowances = array_sum(array_column($allowances, 'amount'));
        $overtimeAmount  = max(0.0, $grossPay - $basicSalary - $totalAllowances);

        $nssfCalc = $this->payrollService->calculateNSSF($basicSalary);
        $paye     = $this->payrollService->calculatePAYE($grossPay, $employee->statutoryDetails);
        $shif     = $this->payrollService->calculateSHIF($grossPay);

        $totalOtherDeductions = array_sum(array_column($deductions, 'amount'));
        $totalDeductions      = $paye + $nssfCalc['total'] + $shif + $totalOtherDeductions;
        $netPay               = $grossPay - $totalDeductions;

        return [
            'payroll_record_id'   => $payrollRecordId,
            'employee_id'         => $employee->id,
            'company_id'          => $companyId,
            'basic_salary'        => $basicSalary,
            'allowances'          => $totalAllowances,
            'allowance_breakdown' => $allowances ?: null,
            'overtime_amount'     => $overtimeAmount,
            'overtime_hours'      => $overtimeDetails['hours'] ?? 0,
            'gross_pay'           => $grossPay,
            'paye_amount'         => $paye,
            'nssf_amount'         => $nssfCalc['total'],
            'shif_amount'         => $shif,
            'other_deductions'    => $totalOtherDeductions,
            'deduction_breakdown' => $deductions ?: null,
            'total_deductions'    => $totalDeductions,
            'net_pay'             => $netPay,
        ];
    }

    // =========================================================================
    // CRUD
    // =========================================================================

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_payroll', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $query = PayrollRecord::with([
            'createdBy:id,first_name,last_name',
            'approvedBy:id,first_name,last_name',
        ])->where('company_id', $user->company_id);

        if ($request->filled('pay_period_start')) {
            $query->where('pay_period_start', '>=', $request->input('pay_period_start'));
        }
        if ($request->filled('pay_period_end')) {
            $query->where('pay_period_end', '<=', $request->input('pay_period_end'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('employee_id')) {
            $query->whereHas('items', fn ($q) => $q->where('employee_id', $request->input('employee_id')));
        }
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('payroll_number', 'ilike', "%{$search}%");
        }

        $perPage = min((int) $request->input('per_page', 15), 100);
        $records = $query->orderByDesc('pay_period_start')->paginate($perPage);

        return response()->json([
            'status'          => 'success',
            'message'         => 'Payroll records retrieved successfully.',
            'payroll_records' => $records->items(),
            'pagination'      => [
                'current_page' => $records->currentPage(),
                'per_page'     => $records->perPage(),
                'total'        => $records->total(),
                'last_page'    => $records->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $payrollRecord = PayrollRecord::with([
            'company:id,name,address,email',
            'items.employee:id,employee_number,first_name,last_name,position,department,kra_pin,nssf_number,shif_number,bank_name,bank_account',
            'createdBy:id,first_name,last_name',
            'approvedBy:id,first_name,last_name',
            'processedBy:id,first_name,last_name',
        ])->find($id);

        if (!$payrollRecord) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll record not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_payroll', $payrollRecord->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'status'         => 'success',
            'message'        => 'Payroll record retrieved successfully.',
            'payroll_record' => $payrollRecord,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'employee_id'       => 'required|uuid|exists:employees,id',
            'pay_period_start'  => 'required|date',
            'pay_period_end'    => 'required|date|after:pay_period_start',
            'pay_date'          => 'required|date',
            'basic_salary'      => 'required|numeric|min:0',
            'allowances'        => 'nullable|array',
            'allowances.*.type'   => 'required_with:allowances|string|max:100',
            'allowances.*.amount' => 'required_with:allowances|numeric|min:0',
            'deductions'        => 'nullable|array',
            'deductions.*.type'   => 'required_with:deductions|string|max:100',
            'deductions.*.amount' => 'required_with:deductions|numeric|min:0',
            'overtime_hours'    => 'nullable|numeric|min:0',
            'overtime_type'     => 'nullable|string|in:regular,weekend,holiday',
            'notes'             => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $user      = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_create_payroll', $companyId)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $employee = Employee::with('statutoryDetails')->find($request->input('employee_id'));
        if ($employee->company_id !== $companyId) {
            return response()->json(['status' => 'failed', 'message' => 'Employee does not belong to this company.'], 422);
        }

        // Minimum wage check — warn but don't hard-block if region/level is unrecognised
        try {
            $region     = $employee->region      ?? 'nairobi';
            $skillLevel = $employee->skill_level ?? 'unskilled';
            if (!$this->payrollService->validateMinimumWage((float) $request->input('basic_salary'), $region, $skillLevel)) {
                return response()->json(['status' => 'failed', 'message' => 'Salary is below the minimum wage for the specified region and skill level.'], 422);
            }
        } catch (\Throwable $e) {
            Log::warning('Minimum wage validation skipped: ' . $e->getMessage());
        }

        try {
            DB::beginTransaction();

            $itemData = $this->buildPayrollItem(
                $request->only(['basic_salary', 'allowances', 'deductions', 'overtime_hours', 'overtime_type']),
                $employee,
                $companyId,
                '' // placeholder — filled after record is created
            );

            $payrollRecord = PayrollRecord::create([
                'company_id'       => $companyId,
                'payroll_number'   => $this->generatePayrollNumber($companyId),
                'created_by'       => $user->id,
                'pay_period_start' => $request->input('pay_period_start'),
                'pay_period_end'   => $request->input('pay_period_end'),
                'pay_date'         => $request->input('pay_date'),
                'status'           => 'draft',
                'notes'            => $request->input('notes'),
            ]);

            $itemData['payroll_record_id'] = $payrollRecord->id;
            PayrollItem::create($itemData);
            $payrollRecord->calculateTotals();

            DB::commit();

            return response()->json([
                'status'         => 'success',
                'message'        => 'Payroll record created successfully.',
                'payroll_record' => $payrollRecord->load([
                    'company:id,name',
                    'items.employee:id,employee_number,first_name,last_name,position,department',
                ]),
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Payroll creation failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['status' => 'failed', 'message' => 'Failed to create payroll record.'], 500);
        }
    }

    /**
     * Update header-level fields on a draft payroll record.
     * Pay period, pay date, and notes may be edited while in draft status.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $payrollRecord = PayrollRecord::find($id);
        if (!$payrollRecord) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll record not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_update_payroll', $payrollRecord->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        if ($payrollRecord->status !== 'draft') {
            return response()->json(['status' => 'failed', 'message' => 'Only draft payroll records can be edited.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'pay_period_start' => 'sometimes|date',
            'pay_period_end'   => 'sometimes|date|after_or_equal:pay_period_start',
            'pay_date'         => 'sometimes|date',
            'notes'            => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $payrollRecord->update($request->only(['pay_period_start', 'pay_period_end', 'pay_date', 'notes']));

        return response()->json([
            'status'         => 'success',
            'message'        => 'Payroll record updated successfully.',
            'payroll_record' => $payrollRecord->fresh(),
        ]);
    }

    /**
     * Delete a draft payroll record and all its line items.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $payrollRecord = PayrollRecord::find($id);
        if (!$payrollRecord) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll record not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_delete_payroll', $payrollRecord->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        if ($payrollRecord->status !== 'draft') {
            return response()->json(['status' => 'failed', 'message' => 'Only draft payroll records can be deleted.'], 422);
        }

        $payrollRecord->delete();

        return response()->json(['status' => 'success', 'message' => 'Payroll record deleted successfully.']);
    }

    // =========================================================================
    // Workflow transitions
    // =========================================================================

    /** draft → approved */
    public function approve(Request $request, string $id): JsonResponse
    {
        $payrollRecord = PayrollRecord::find($id);
        if (!$payrollRecord) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll record not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_approve_payroll', $payrollRecord->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        if ($payrollRecord->status !== 'draft') {
            return response()->json(['status' => 'failed', 'message' => 'Only draft payroll records can be approved.'], 422);
        }

        $payrollRecord->update([
            'status'      => 'approved',
            'approved_at' => now(),
            'approved_by' => $request->user()->id,
        ]);

        return response()->json([
            'status'         => 'success',
            'message'        => 'Payroll record approved successfully.',
            'payroll_record' => $payrollRecord->fresh(),
        ]);
    }

    /** approved → paid */
    public function pay(Request $request, string $id): JsonResponse
    {
        $payrollRecord = PayrollRecord::find($id);
        if (!$payrollRecord) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll record not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_process_payroll', $payrollRecord->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        if ($payrollRecord->status !== 'approved') {
            return response()->json(['status' => 'failed', 'message' => 'Only approved payroll records can be marked as paid.'], 422);
        }

        $payrollRecord->update([
            'status'       => 'paid',
            'processed_at' => now(),
            'processed_by' => $request->user()->id,
        ]);

        return response()->json([
            'status'         => 'success',
            'message'        => 'Payroll marked as paid successfully.',
            'payroll_record' => $payrollRecord->fresh(),
        ]);
    }

    /** draft|approved → cancelled */
    public function cancel(Request $request, string $id): JsonResponse
    {
        $payrollRecord = PayrollRecord::find($id);
        if (!$payrollRecord) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll record not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_approve_payroll', $payrollRecord->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        if (in_array($payrollRecord->status, ['paid', 'cancelled'])) {
            return response()->json(['status' => 'failed', 'message' => 'Cannot cancel a paid or already-cancelled payroll.'], 422);
        }

        $payrollRecord->update(['status' => 'cancelled']);

        return response()->json([
            'status'         => 'success',
            'message'        => 'Payroll record cancelled.',
            'payroll_record' => $payrollRecord->fresh(),
        ]);
    }

    // =========================================================================
    // Payslip data
    // =========================================================================

    /**
     * Return structured payslip data for every line item in a payroll record.
     * The frontend uses this to render/print individual payslips.
     */
    public function payslip(Request $request, string $id): JsonResponse
    {
        $payrollRecord = PayrollRecord::with([
            'company',
            'items.employee',
            'approvedBy:id,first_name,last_name',
        ])->find($id);

        if (!$payrollRecord) {
            return response()->json(['status' => 'failed', 'message' => 'Payroll record not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_payroll', $payrollRecord->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $payslips = $payrollRecord->items->map(function ($item) use ($payrollRecord) {
            $emp = $item->employee;
            return [
                'employee' => [
                    'id'              => $emp->id,
                    'employee_number' => $emp->employee_number,
                    'full_name'       => trim(($emp->first_name ?? '') . ' ' . ($emp->last_name ?? '')),
                    'position'        => $emp->position,
                    'department'      => $emp->department,
                    'kra_pin'         => $emp->kra_pin,
                    'nssf_number'     => $emp->nssf_number,
                    'shif_number'     => $emp->shif_number,
                    'bank_name'       => $emp->bank_name,
                    'bank_account'    => $emp->bank_account,
                ],
                'payroll' => [
                    'payroll_number'   => $payrollRecord->payroll_number,
                    'pay_period_start' => $payrollRecord->pay_period_start,
                    'pay_period_end'   => $payrollRecord->pay_period_end,
                    'pay_date'         => $payrollRecord->pay_date,
                    'status'           => $payrollRecord->status,
                ],
                'earnings' => [
                    'basic_salary'        => (float) $item->basic_salary,
                    'allowances'          => (float) $item->allowances,
                    'allowance_breakdown' => $item->allowance_breakdown ?? [],
                    'overtime_amount'     => (float) $item->overtime_amount,
                    'overtime_hours'      => (float) $item->overtime_hours,
                    'gross_pay'           => (float) $item->gross_pay,
                ],
                'deductions' => [
                    'paye'      => (float) $item->paye_amount,
                    'nssf'      => (float) $item->nssf_amount,
                    'shif'      => (float) $item->shif_amount,
                    'other'     => (float) $item->other_deductions,
                    'breakdown' => $item->deduction_breakdown ?? [],
                    'total'     => (float) $item->total_deductions,
                ],
                'net_pay'     => (float) $item->net_pay,
                'company' => [
                    'name'    => $payrollRecord->company->name,
                    'address' => $payrollRecord->company->address,
                    'email'   => $payrollRecord->company->email,
                ],
                'approved_by' => $payrollRecord->approvedBy
                    ? trim(($payrollRecord->approvedBy->first_name ?? '') . ' ' . ($payrollRecord->approvedBy->last_name ?? ''))
                    : null,
            ];
        });

        return response()->json([
            'status'   => 'success',
            'message'  => 'Payslip data generated successfully.',
            'payslips' => $payslips,
        ]);
    }

    // =========================================================================
    // Bulk payroll
    // =========================================================================

    public function processBulkPayroll(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'pay_period_start'   => 'required|date',
            'pay_period_end'     => 'required|date|after:pay_period_start',
            'pay_date'           => 'required|date',
            'employee_ids'       => 'nullable|array',
            'employee_ids.*'     => 'uuid|exists:employees,id',
            'custom_data'        => 'nullable|array',
            'notes'              => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $user      = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_create_payroll', $companyId)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $empQuery = Employee::with('statutoryDetails')
            ->where('company_id', $companyId)
            ->where('is_active', true);

        if ($request->filled('employee_ids')) {
            $empQuery->whereIn('id', $request->input('employee_ids'));
        }

        $employees = $empQuery->get();

        if ($employees->isEmpty()) {
            return response()->json(['status' => 'failed', 'message' => 'No eligible active employees found.'], 422);
        }

        $customData = $request->input('custom_data', []);
        $results    = [];

        DB::beginTransaction();
        try {
            $payrollRecord = PayrollRecord::create([
                'company_id'       => $companyId,
                'payroll_number'   => $this->generatePayrollNumber($companyId),
                'created_by'       => $user->id,
                'pay_period_start' => $request->input('pay_period_start'),
                'pay_period_end'   => $request->input('pay_period_end'),
                'pay_date'         => $request->input('pay_date'),
                'status'           => 'draft',
                'notes'            => $request->input('notes'),
            ]);

            foreach ($employees as $employee) {
                $overrides = $customData[$employee->id] ?? [];

                $input = [
                    'basic_salary'  => $overrides['basic_salary']  ?? $employee->basic_salary  ?? 0,
                    'allowances'    => $overrides['allowances']    ?? (is_array($employee->allowances)  ? $employee->allowances  : []),
                    'deductions'    => $overrides['deductions']    ?? (is_array($employee->deductions)  ? $employee->deductions  : []),
                    'overtime_hours'=> $overrides['overtime_hours'] ?? null,
                    'overtime_type' => $overrides['overtime_type']  ?? 'regular',
                ];

                // Minimum wage validation
                try {
                    $region     = $overrides['region']      ?? ($employee->region      ?? 'nairobi');
                    $skillLevel = $overrides['skill_level'] ?? ($employee->skill_level ?? 'unskilled');
                    if (!$this->payrollService->validateMinimumWage((float) $input['basic_salary'], $region, $skillLevel)) {
                        $results[] = ['employee_id' => $employee->id, 'status' => 'failed', 'message' => 'Salary below minimum wage.'];
                        continue;
                    }
                } catch (\Throwable $e) {
                    Log::warning("Min wage check skipped for {$employee->id}: {$e->getMessage()}");
                }

                $itemData = $this->buildPayrollItem($input, $employee, $companyId, $payrollRecord->id);
                $item     = PayrollItem::create($itemData);

                $results[] = [
                    'employee_id'     => $employee->id,
                    'payroll_item_id' => $item->id,
                    'status'          => 'success',
                    'net_pay'         => (float) $item->net_pay,
                ];
            }

            $payrollRecord->calculateTotals();
            DB::commit();

            return response()->json([
                'status'            => 'success',
                'message'           => 'Bulk payroll processed successfully.',
                'payroll_record_id' => $payrollRecord->id,
                'payroll_record'    => $payrollRecord->fresh(),
                'results'           => $results,
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Bulk payroll error', ['error' => $e->getMessage()]);
            return response()->json([
                'status'  => 'failed',
                'message' => 'Bulk payroll processing failed.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    // =========================================================================
    // Summary / Dashboard
    // =========================================================================

    public function getCompanyPayrollSummary(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_payroll', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $companyId = $user->company_id;

        $baseQuery = DB::table('payroll_records')->where('company_id', $companyId);
        $baseItems = DB::table('payroll_items')
            ->join('payroll_records', 'payroll_items.payroll_record_id', '=', 'payroll_records.id')
            ->where('payroll_items.company_id', $companyId);

        if ($request->filled('period')) {
            $start = Carbon::parse($request->input('period'))->startOfMonth();
            $end   = Carbon::parse($request->input('period'))->endOfMonth();
            $baseQuery->whereBetween('pay_period_start', [$start, $end]);
            $baseItems->whereBetween('payroll_records.pay_period_start', [$start, $end]);
        }
        if ($request->filled('status')) {
            $baseQuery->where('status', $request->input('status'));
            $baseItems->where('payroll_records.status', $request->input('status'));
        }

        $totalRecords   = (clone $baseQuery)->count();
        $totalEmployees = (clone $baseItems)->distinct('payroll_items.employee_id')->count('payroll_items.employee_id');
        $totalGross     = (float) ((clone $baseItems)->sum('payroll_items.gross_pay') ?? 0);
        $totalNet       = (float) ((clone $baseItems)->sum('payroll_items.net_pay') ?? 0);
        $totalPaye      = (float) ((clone $baseItems)->sum('payroll_items.paye_amount') ?? 0);
        $totalNssf      = (float) ((clone $baseItems)->sum('payroll_items.nssf_amount') ?? 0);
        $totalShif      = (float) ((clone $baseItems)->sum('payroll_items.shif_amount') ?? 0);

        $statusBreakdown = DB::table('payroll_records')
            ->join('payroll_items', 'payroll_records.id', '=', 'payroll_items.payroll_record_id')
            ->where('payroll_records.company_id', $companyId)
            ->when($request->filled('period'), function ($q) use ($request) {
                $start = Carbon::parse($request->input('period'))->startOfMonth();
                $end   = Carbon::parse($request->input('period'))->endOfMonth();
                return $q->whereBetween('payroll_records.pay_period_start', [$start, $end]);
            })
            ->selectRaw('payroll_records.status, count(distinct payroll_records.id) as count, sum(payroll_items.gross_pay) as gross_pay, sum(payroll_items.net_pay) as net_pay')
            ->groupBy('payroll_records.status')
            ->get()
            ->map(fn ($r) => [
                'status'    => $r->status,
                'count'     => (int) $r->count,
                'gross_pay' => (float) ($r->gross_pay ?? 0),
                'net_pay'   => (float) ($r->net_pay ?? 0),
            ]);

        $recentPayrolls = (clone $baseQuery)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get(['id', 'payroll_number', 'pay_period_start', 'pay_period_end', 'status', 'created_at', 'employee_count']);

        return response()->json([
            'status'  => 'success',
            'message' => 'Company payroll summary retrieved successfully.',
            'summary' => [
                'total_payroll_records' => $totalRecords,
                'total_employees'       => $totalEmployees,
                'total_gross_pay'       => $totalGross,
                'total_net_pay'         => $totalNet,
                'total_deductions'      => $totalGross - $totalNet,
                'total_paye'            => $totalPaye,
                'total_nssf'            => $totalNssf,
                'total_shif'            => $totalShif,
                'status_breakdown'      => $statusBreakdown,
                'recent_payrolls'       => $recentPayrolls,
                'period_filter'         => $request->input('period'),
                'status_filter'         => $request->input('status'),
            ],
        ]);
    }
}
