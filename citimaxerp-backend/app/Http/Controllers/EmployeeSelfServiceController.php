<?php

namespace App\Http\Controllers;

use App\Models\DailyWorkReport;
use App\Models\DailyWorkReportDraft;
use App\Services\DailyReportRoutingService;
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

        $report = DailyWorkReport::submitFor($employee, $user, $request->only(['report_date', 'designation', 'department', 'entries', 'key_achievements', 'pending_work']));
        $report->load('approver', 'approvedBy');

        $routingMessage = $report->approver_role === null
            ? 'Your report has been self-certified as you are a Director.'
            : 'Sent to the Directors for approval.';

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

    /** The signed-in employee's server draft for ?date= (null when none). */
    public function dailyReportDraftShow(Request $request)
    {
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }
        $request->validate(['date' => 'required|date']);

        $draft = DailyWorkReportDraft::where('employee_id', $employee->id)->whereDate('report_date', $request->input('date'))->first();

        return response()->json([
            'status' => 'success',
            'draft' => $draft ? [
                'report_date' => $draft->report_date->toDateString(),
                'entries' => $draft->entries ?? [],
                'key_achievements' => $draft->key_achievements ?? '',
                'pending_work' => $draft->pending_work ?? '',
                'saved_at' => $draft->updated_at,
            ] : null,
        ]);
    }

    /** Saves the report being written, so the midnight close can forward it if it is never submitted. */
    public function dailyReportDraftSave(Request $request)
    {
        $employee = $this->resolveEmployee($request);
        if (!$employee) {
            return response()->json(['status' => 'failed', 'message' => 'No employee profile is linked to this login.'], 404);
        }
        $data = $request->validate([
            'report_date' => 'required|date',
            'entries' => 'nullable|array',
            'entries.*.time' => 'nullable|string',
            'entries.*.activity' => 'nullable|string',
            'key_achievements' => 'nullable|string',
            'pending_work' => 'nullable|string',
        ]);

        $submitted = DailyWorkReport::where('employee_id', $employee->id)->whereDate('report_date', $data['report_date'])->exists();
        if ($submitted) {
            return response()->json(['status' => 'success', 'message' => 'This day\'s report is already submitted.', 'saved' => false]);
        }

        $draft = DailyWorkReportDraft::firstOrNew(['employee_id' => $employee->id, 'report_date' => $data['report_date']]);
        $draft->fill([
            'company_id' => $employee->company_id,
            'user_id' => $request->user()->id,
            'entries' => $data['entries'] ?? [],
            'key_achievements' => $data['key_achievements'] ?? null,
            'pending_work' => $data['pending_work'] ?? null,
        ]);
        $draft->save();

        return response()->json(['status' => 'success', 'saved' => true, 'saved_at' => $draft->updated_at]);
    }

    /**
     * Everyone's portal activity, for the GM and the Directors: who has / hasn't sent the day's
     * daily report, and the latest daily reports, leave requests and salary advances.
     */
    public function staffActivity(Request $request)
    {
        $user = $request->user()->load('role');
        if (!DailyReportRoutingService::isGm($user) && !DailyReportRoutingService::isDirector($user)) {
            return response()->json(['status' => 'failed', 'message' => 'Only the GM and the Directors see staff activity.'], 403);
        }

        $companyId = $user->company_id;
        $date = $request->filled('date')
            ? Carbon::parse($request->input('date'))->toDateString()
            : now(DailyWorkReport::TIMEZONE)->toDateString();

        $reportsThatDay = DailyWorkReport::where('company_id', $companyId)->whereDate('report_date', $date)->get()->keyBy('employee_id');
        $drafts = DailyWorkReportDraft::where('company_id', $companyId)->whereDate('report_date', $date)->pluck('employee_id')->flip();
        $name = fn ($e) => trim($e->first_name . ' ' . $e->last_name);

        $expected = DailyWorkReport::expectedEmployees($companyId, $date);
        $submitted = $reportsThatDay->map(fn ($r) => [
            'employee' => $r->employee ? $name($r->employee) : '',
            'status' => $r->status,
            'auto_submitted' => (bool) $r->auto_generated,
            'submitted_at' => $r->created_at,
        ])->sortBy('employee')->values();
        $missing = $expected->reject(fn ($e) => $reportsThatDay->has($e->id))
            ->map(fn ($e) => ['employee' => $name($e), 'has_draft' => $drafts->has($e->id)])
            ->values();

        $reportController = new DailyWorkReportController();

        return response()->json([
            'status' => 'success',
            'date' => $date,
            'daily_report_status' => ['submitted' => $submitted, 'missing' => $missing],
            'daily_reports' => DailyWorkReport::with(['employee', 'approver', 'approvedBy'])
                ->where('company_id', $companyId)->orderByDesc('report_date')->orderByDesc('created_at')->limit(50)->get()
                ->map(fn ($r) => $reportController->formatReport($r)),
            'leave_requests' => LeaveRequest::with(['employee', 'approvedBy'])
                ->where('company_id', $companyId)->latest()->limit(30)->get()
                ->map(fn ($lr) => $lr->toApiArray()),
            'salary_advances' => SalaryAdvance::with('employee')
                ->where('company_id', $companyId)->latest()->limit(30)->get()
                ->map(fn ($adv) => $this->formatAdvance($adv)),
        ]);
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
