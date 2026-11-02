<?php

namespace App\Http\Controllers;

use App\Models\DailyWorkReport;
use App\Services\DailyReportRoutingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DailyWorkReportController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) return false;
        if ($role->hasPermission('can_manage_system')) return true;
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) return $user->company_id === $resourceCompanyId;
            return true;
        }
        return $role->hasPermission($permission);
    }

    /**
     * Only Directors approve or reject daily reports - any Director in the
     * report's company, so one hired later can act on older reports. The one
     * exception is the fallback approver_id given to a report when the
     * company had no Director. can_approve_daily_reports still lets a role
     * see every report, but no longer approve them.
     */
    protected function canActOnReport(Request $request, DailyWorkReport $report): bool
    {
        return self::userCanAct($request->user(), $report);
    }

    public static function userCanAct($user, DailyWorkReport $report): bool
    {
        if (!$user || $user->company_id !== $report->company_id) {
            return false;
        }

        return DailyReportRoutingService::isApproverRole(optional($user->role)->name)
            || $report->approver_id === $user->id;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $canViewAll = $this->hasPermission($request, 'can_approve_daily_reports', $user->company_id)
            || DailyReportRoutingService::isApproverRole(optional($user->role)->name);

        $query = DailyWorkReport::with(['employee', 'approver', 'approvedBy', 'createdBy.role'])
            ->where('company_id', $user->company_id);

        if (!$canViewAll) {
            $role = optional($user->role)->name;
            $query->where(function ($q) use ($user, $role) {
                $q->where('approver_id', $user->id);
                if ($role) {
                    $q->orWhere('approver_role', $role);
                }
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->input('employee_id'));
        }

        $reports = $query->orderByDesc('report_date')->get()->map(fn ($r) => $this->formatReport($r));

        return response()->json([
            'status' => 'success',
            'message' => 'Daily work reports retrieved successfully.',
            'daily_reports' => $reports,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $report = DailyWorkReport::with(['employee', 'approver', 'approvedBy'])->find($id);
        if (!$report) {
            return response()->json(['status' => 'failed', 'message' => 'Daily work report not found.'], 404);
        }
        if ($report->company_id !== $request->user()->company_id) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'status' => 'success',
            'daily_report' => $this->formatReport($report),
        ], 200);
    }

    public function approve(Request $request, $id)
    {
        $report = DailyWorkReport::with('employee')->find($id);
        if (!$report) {
            return response()->json(['status' => 'failed', 'message' => 'Daily work report not found.'], 404);
        }

        if (!$this->canActOnReport($request, $report)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'remarks' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $report->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'remarks' => $request->input('remarks'),
            'rejection_reason' => null,
        ]);
        $report->load('employee', 'approver', 'approvedBy');

        return response()->json([
            'status' => 'success',
            'message' => 'Daily work report approved successfully.',
            'daily_report' => $this->formatReport($report),
        ], 200);
    }

    public function reject(Request $request, $id)
    {
        $report = DailyWorkReport::with('employee')->find($id);
        if (!$report) {
            return response()->json(['status' => 'failed', 'message' => 'Daily work report not found.'], 404);
        }

        if (!$this->canActOnReport($request, $report)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string',
            'remarks' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $report->update([
            'status' => 'rejected',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => $request->input('reason'),
            'remarks' => $request->input('remarks'),
        ]);
        $report->load('employee', 'approver', 'approvedBy');

        return response()->json([
            'status' => 'success',
            'message' => 'Daily work report rejected.',
            'daily_report' => $this->formatReport($report),
        ], 200);
    }

    public function formatReport(DailyWorkReport $r): array
    {
        $employee = $r->employee;
        $approver = $r->approver;
        $approvedBy = $r->approvedBy;

        // Use creator's role as fallback if designation is empty
        $designation = $r->designation;
        if (!$designation && $r->createdBy && $r->createdBy->role) {
            $designation = $r->createdBy->role->name;
        }

        return [
            'id' => $r->id,
            'employee_id' => $r->employee_id,
            'employee' => $employee ? trim($employee->first_name . ' ' . $employee->last_name) : '',
            'reportDate' => optional($r->report_date)->format('Y-m-d'),
            'designation' => $designation,
            'department' => $r->department,
            'entries' => $r->entries ?? [],
            'keyAchievements' => $r->key_achievements,
            'pendingWork' => $r->pending_work,
            'remarks' => $r->remarks,
            'status' => $r->status,
            'approverRole' => $r->approver_role,
            // Whether the signed-in user may approve/reject it (Directors only).
            'canAct' => $r->status === 'pending' && self::userCanAct(auth()->user(), $r),
            'approver' => $approver ? trim($approver->first_name . ' ' . $approver->last_name) : null,
            'approvedBy' => $approvedBy ? trim($approvedBy->first_name . ' ' . $approvedBy->last_name) : null,
            'approvedAt' => $r->approved_at,
            'rejectionReason' => $r->rejection_reason,
            'created_at' => $r->created_at,
            'updated_at' => $r->updated_at,
        ];
    }
}
