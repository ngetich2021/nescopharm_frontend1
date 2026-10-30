<?php

namespace App\Http\Controllers;

use App\Models\DailyWorkReport;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\SalaryAdvance;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;
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

        $query = LeaveRequest::with(['employee', 'approvedBy'])
            ->where('company_id', $employee->company_id)
            ->where('employee_id', $employee->id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json([
            'status' => 'success',
            'leave_requests' => $query->latest()->get()->map(fn ($lr) => $lr->toApiArray()),
            'balances' => LeaveRequest::balancesFor($employee),
            'records_approver' => optional(LeaveRequest::recordsApprover($employee->company_id))->full_name,
        ]);
    }

    public function leaveStore(Request $request)
    {
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }

        $validator = Validator::make($request->all(), array_merge([
            'leave_type' => 'required|in:annual,sick,maternity,paternity,unpaid',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'required_without:reason_category|nullable|string',
        ], LeaveRequest::formRules()));

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $leaveRequest = LeaveRequest::createFor($employee, $request->all(), $request->user());

        return response()->json([
            'status' => 'success',
            'message' => $leaveRequest->is_record ? 'Leave recorded as approved.' : 'Leave request submitted successfully.',
            'leave_request' => $leaveRequest->toApiArray(),
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
     * bypass if no user literally holds the GM/Director role.
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

        $linked = Employee::where('user_id', $user->id)->first();
        if ($linked) {
            return $linked;
        }

        // Fallback guesses only consider employees not already connected to another login,
        // and connect the match so later visits use the link.
        $unlinked = fn () => Employee::where('company_id', $user->company_id)->whereNull('user_id');

        $employee = $unlinked()
            ->whereRaw('LOWER(email) = ?', [strtolower($user->email)])
            ->first();

        if ($employee) {
            $employee->update(['user_id' => $user->id]);
            return $employee;
        }

        $employee = $unlinked()
            ->whereRaw('LOWER(first_name) = ?', [strtolower($user->first_name)])
            ->whereRaw('LOWER(last_name) = ?', [strtolower($user->last_name)])
            ->first();

        if ($employee) {
            $update = ['user_id' => $user->id];
            if (empty($employee->email) && !empty($user->email)) {
                $update['email'] = $user->email;
            }
            $employee->update($update);

            return $employee;
        }

        // No matching employee: this login isn't staff (or HR hasn't linked it yet). Never make
        // one up - that added logins such as admins and the system developer as employees.
        return null;
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
