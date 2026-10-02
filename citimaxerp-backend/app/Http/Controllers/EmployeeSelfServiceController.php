<?php

namespace App\Http\Controllers;

use App\Models\DailyWorkReport;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\SalaryAdvance;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class EmployeeSelfServiceController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    public function me(Request $request)
    {
        $employee = $this->resolveEmployee($request);

        if (!$employee) {
            return response()->json([
                'status' => 'failed',
                'message' => 'No employee profile is linked to this login.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'employee' => $employee->load($this->employeeRelationships()),
        ]);
    }

    public function leaveIndex(Request $request)
    {
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }

        $query = LeaveRequest::with('employee')
            ->where('company_id', $employee->company_id)
            ->where('employee_id', $employee->id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json([
            'status' => 'success',
            'leave_requests' => $query->latest()->get()->map(fn ($lr) => $this->formatLeaveRequest($lr)),
        ]);
    }

    public function leaveStore(Request $request)
    {
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'leave_type' => 'required|in:annual,sick,maternity,paternity,unpaid',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $leaveRequest = LeaveRequest::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'leave_type' => $request->leave_type,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'reason' => $request->reason,
            'status' => 'pending',
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Leave request submitted successfully.',
            'leave_request' => $this->formatLeaveRequest($leaveRequest->load('employee')),
        ], 201);
    }

    public function salaryAdvanceIndex(Request $request)
    {
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }

        $query = SalaryAdvance::with('employee')
            ->where('company_id', $employee->company_id)
            ->where('employee_id', $employee->id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json([
            'status' => 'success',
            'salary_advances' => $query->latest()->get()->map(fn ($adv) => $this->formatAdvance($adv)),
        ]);
    }

    public function salaryAdvanceStore(Request $request)
    {
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:1',
            'request_date' => 'required|date',
            'reason' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $advance = SalaryAdvance::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'amount' => $request->amount,
            'request_date' => $request->request_date,
            'reason' => $request->reason,
            'status' => 'pending',
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Salary advance request submitted successfully.',
            'salary_advance' => $this->formatAdvance($advance->load('employee')),
        ], 201);
    }

    public function dailyReportIndex(Request $request)
    {
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }

        $query = DailyWorkReport::with(['approver', 'approvedBy'])
            ->where('company_id', $employee->company_id)
            ->where('employee_id', $employee->id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $reports = $query->orderByDesc('report_date')->get()
            ->map(fn ($r) => (new DailyWorkReportController())->formatReport($r));

        return response()->json([
            'status' => 'success',
            'daily_reports' => $reports,
        ]);
    }

    public function dailyReportStore(Request $request)
    {
        $user = $request->user()->load('role');
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'report_date' => [
                'required',
                'date',
                function ($attribute, $value, $fail) {
                    if (Carbon::parse($value)->isSunday()) {
                        $fail('Daily work reports are not required on Sundays - the reporting day is skipped.');
                    }
                },
            ],
            'designation' => 'nullable|string',
            'department' => 'nullable|string',
            'entries' => 'nullable|array',
            'entries.*.time' => 'nullable|string',
            'entries.*.activity' => 'nullable|string',
            'key_achievements' => 'nullable|string',
            'pending_work' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $alreadySubmitted = DailyWorkReport::where('employee_id', $employee->id)
            ->where('report_date', $request->report_date)
            ->exists();

        if ($alreadySubmitted) {
            return response()->json([
                'status' => 'failed',
                'message' => 'A daily work report has already been submitted for this date.',
            ], 422);
        }

        // Routing is based on the employee the report is for
        $routing = $this->resolveDailyReportApprover($employee, $user);

        // Get designation from request, employee position, or user's role
        $designation = $request->input('designation') ?: $employee->position ?: ($user->role?->name ?? null);

        $report = DailyWorkReport::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'report_date' => $request->report_date,
            'designation' => $designation,
            'department' => $request->input('department') ?: $employee->department,
            'entries' => $request->input('entries', []),
            'key_achievements' => $request->input('key_achievements'),
            'pending_work' => $request->input('pending_work'),
            'status' => $routing['auto_approve'] ? 'approved' : 'pending',
            'approver_role' => $routing['role'],
            'approver_id' => $routing['user_id'],
            'approved_by' => $routing['auto_approve'] ? $user->id : null,
            'approved_at' => $routing['auto_approve'] ? now() : null,
            'created_by' => $user->id,
        ]);
        $report->load('approver', 'approvedBy');

        $routingMessage = $routing['auto_approve']
            ? 'Your report has been self-certified as you are the Managing Director.'
            : 'Routed automatically to the GM, or the Managing Director.';

        return response()->json([
            'status' => 'success',
            'message' => 'Daily work report submitted successfully.',
            'routing_message' => $routingMessage,
            'daily_report' => (new DailyWorkReportController())->formatReport($report),
        ], 201);
    }

    public function dailyReportDestroy(Request $request, $id)
    {
        $user = $request->user();
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }

        $report = DailyWorkReport::where('id', $id)
            ->where('employee_id', $employee->id)
            ->where('company_id', $user->company_id)
            ->first();

        if (!$report) {
            return response()->json(['status' => 'failed', 'message' => 'Daily work report not found.'], 404);
        }

        $report->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Daily work report deleted successfully.',
        ], 200);
    }

    /**
     * Role-based routing for daily reports (unlike leave/salary, which use
     * a fixed per-employee approver FK): a worker's report goes to GM, a
     * GM's own report goes to the Managing Director ("Director" role).
     * Director has nobody above them in this chain, so their own report is
     * self-certified/auto-approved on submission rather than left pending
     * forever. Falls back to whoever holds the can_manage_company/system
     * bypass if no user literally holds the GM/Director role, same
     * fallback resolveDefaultApproverId() uses for leave/salary.
     */
    private function resolveDailyReportApprover(Employee $employee, User $submittingUser): array
    {
        $submitterRole = optional($submittingUser->role)->name;

        if ($submitterRole && strcasecmp($submitterRole, 'Director') === 0) {
            return ['role' => null, 'user_id' => null, 'auto_approve' => true];
        }

        $requiredRole = ($submitterRole && strcasecmp($submitterRole, 'GM') === 0) ? 'Director' : 'GM';

        $approverId = User::where('company_id', $employee->company_id)
            ->where('id', '!=', $submittingUser->id)
            ->whereRaw('is_active = true')
            ->whereHas('role', fn ($q) => $q->where('name', $requiredRole))
            ->orderBy('created_at')
            ->value('id');

        if (!$approverId) {
            $approverId = User::where('company_id', $employee->company_id)
                ->where('id', '!=', $submittingUser->id)
                ->whereRaw('is_active = true')
                ->whereHas('role.permissions', fn ($q) => $q->whereIn('key', ['can_manage_company', 'can_manage_system']))
                ->orderBy('created_at')
                ->value('id');
        }

        return ['role' => $requiredRole, 'user_id' => $approverId, 'auto_approve' => false];
    }

    private function resolveEmployee(Request $request): ?Employee
    {
        $user = $request->user();

        $employee = Employee::where('company_id', $user->company_id)
            ->whereRaw('LOWER(email) = ?', [strtolower($user->email)])
            ->first();

        if ($employee) {
            return $employee;
        }

        $employee = Employee::where('company_id', $user->company_id)
            ->whereRaw('LOWER(first_name) = ?', [strtolower($user->first_name)])
            ->whereRaw('LOWER(last_name) = ?', [strtolower($user->last_name)])
            ->first();

        if ($employee) {
            if (empty($employee->email) && !empty($user->email)) {
                $employee->update(['email' => $user->email]);
            }

            return $employee;
        }

        $payload = [
            'id' => (string) Str::uuid(),
            'company_id' => $user->company_id,
            'employee_number' => $this->generateEmployeeNumber($user->company_id),
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'hire_date' => now()->toDateString(),
            'employment_type' => 'full_time',
            'payment_frequency' => 'monthly',
            'basic_salary' => 0,
            'is_active' => true,
            'created_by' => $user->id,
            'metadata' => [
                'provisioned_from_user_id' => $user->id,
                'provisioned_from_employee_portal' => true,
            ],
        ];

        if ($this->hasEmployeeApproverColumns()) {
            $payload['leave_approver_id'] = $this->resolveDefaultApproverId($user->company_id, $user->id, 'can_approve_leave');
            $payload['salary_advance_approver_id'] = $this->resolveDefaultApproverId($user->company_id, $user->id, 'can_approve_salary_changes');
        }

        return Employee::create($payload);
    }

    private function generateEmployeeNumber(string $companyId): string
    {
        $nextNumber = Employee::where('company_id', $companyId)->count() + 1;

        do {
            $employeeNumber = 'EMP-' . str_pad((string) $nextNumber, 4, '0', STR_PAD_LEFT);
            $exists = Employee::where('company_id', $companyId)
                ->where('employee_number', $employeeNumber)
                ->exists();
            $nextNumber++;
        } while ($exists);

        return $employeeNumber;
    }

    /**
     * The oldest active user who actually holds the given approval permission
     * directly (i.e. really GM/Director, or explicitly granted approval
     * rights) - preferred over a generic company-admin account that merely
     * has the can_manage_company/can_manage_system blanket bypass, so a
     * technical super_admin/citimax_admin signup account doesn't get picked
     * ahead of the actual GM or Director. Only falls back to that bypass if
     * the company has no dedicated approver at all.
     */
    private function resolveDefaultApproverId(string $companyId, string $currentUserId, string $permissionKey): ?string
    {
        $direct = \App\Models\User::where('company_id', $companyId)
            ->where('id', '!=', $currentUserId)
            ->whereRaw('is_active = true')
            ->whereHas('role.permissions', function ($q) use ($permissionKey) {
                $q->where('key', $permissionKey);
            })
            ->orderBy('created_at')
            ->value('id');

        if ($direct) {
            return $direct;
        }

        return \App\Models\User::where('company_id', $companyId)
            ->where('id', '!=', $currentUserId)
            ->whereRaw('is_active = true')
            ->whereHas('role.permissions', function ($q) {
                $q->whereIn('key', ['can_manage_company', 'can_manage_system']);
            })
            ->orderBy('created_at')
            ->value('id');
    }

    private function hasEmployeeApproverColumns(): bool
    {
        return Schema::hasColumn('employees', 'leave_approver_id')
            && Schema::hasColumn('employees', 'salary_advance_approver_id');
    }

    private function employeeRelationships(): array
    {
        $relationships = ['statutoryDetails', 'supervisor'];

        if ($this->hasEmployeeApproverColumns()) {
            $relationships[] = 'leaveApprover';
            $relationships[] = 'salaryAdvanceApprover';
        }

        return $relationships;
    }

    private function formatLeaveRequest(LeaveRequest $lr): array
    {
        return [
            'id' => $lr->id,
            'employee_id' => $lr->employee_id,
            'employee' => $lr->employee ? trim($lr->employee->first_name . ' ' . $lr->employee->last_name) : '',
            'leaveType' => $lr->leave_type,
            'startDate' => optional($lr->start_date)->format('Y-m-d'),
            'endDate' => optional($lr->end_date)->format('Y-m-d'),
            'reason' => $lr->reason,
            'status' => $lr->status,
            'created_at' => $lr->created_at,
            'updated_at' => $lr->updated_at,
        ];
    }

    private function formatAdvance(SalaryAdvance $adv): array
    {
        return [
            'id' => $adv->id,
            'employee_id' => $adv->employee_id,
            'employee' => $adv->employee ? trim($adv->employee->first_name . ' ' . $adv->employee->last_name) : '',
            'amount' => $adv->amount,
            'requestDate' => optional($adv->request_date)->format('Y-m-d'),
            'reason' => $adv->reason,
            'status' => $adv->status,
            'created_at' => $adv->created_at,
            'updated_at' => $adv->updated_at,
        ];
    }
}
