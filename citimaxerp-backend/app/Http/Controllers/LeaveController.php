<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\LeaveRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LeaveController extends Controller
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

    public function index(Request $request)
    {
        $user = $request->user();
        $canViewAll = $this->hasPermission($request, 'can_view_leave_management_menu', $user->company_id);
        $canManageCompany = $this->hasPermission($request, 'can_manage_company', $user->company_id);

        if (!$canViewAll && !$canManageCompany) {
            $isApprover = Employee::where('company_id', $user->company_id)
                ->where('leave_approver_id', $user->id)
                ->exists();

            if (!$isApprover) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
            }
        }

        $query = LeaveRequest::with('employee')->where('company_id', $user->company_id);

        if (!$canViewAll && !$canManageCompany) {
            $query->whereHas('employee', fn ($q) => $q->where('leave_approver_id', $user->id));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->input('employee_id'));
        }
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereHas('employee', function ($q) use ($search) {
                $q->where('first_name', 'ilike', "%{$search}%")
                  ->orWhere('last_name', 'ilike', "%{$search}%");
            });
        }

        $leaveRequests = $query->orderBy('created_at', 'desc')->get()->map(function ($lr) {
            return $this->formatLeaveRequest($lr);
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Leave requests retrieved successfully.',
            'leave_requests' => $leaveRequests,
        ], 200);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_leave_management_menu', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|uuid|exists:employees,id',
            'leave_type'  => 'required|in:annual,sick,maternity,paternity,unpaid',
            'start_date'  => 'required|date',
            'end_date'    => 'required|date|after_or_equal:start_date',
            'reason'      => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $leaveRequest = LeaveRequest::create([
            'company_id'  => $user->company_id,
            'employee_id' => $request->employee_id,
            'leave_type'  => $request->leave_type,
            'start_date'  => $request->start_date,
            'end_date'    => $request->end_date,
            'reason'      => $request->reason,
            'status'      => 'pending',
            'created_by'  => $user->id,
        ]);

        $leaveRequest->load('employee');

        return response()->json([
            'status' => 'success',
            'message' => 'Leave request created successfully.',
            'leave_request' => $this->formatLeaveRequest($leaveRequest),
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $leaveRequest = LeaveRequest::with('employee')->find($id);
        if (!$leaveRequest) {
            return response()->json(['status' => 'failed', 'message' => 'Leave request not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_leave_management_menu', $leaveRequest->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Leave request retrieved successfully.',
            'leave_request' => $this->formatLeaveRequest($leaveRequest),
        ], 200);
    }

    public function update(Request $request, $id)
    {
        $leaveRequest = LeaveRequest::find($id);
        if (!$leaveRequest) {
            return response()->json(['status' => 'failed', 'message' => 'Leave request not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_leave_management_menu', $leaveRequest->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'employee_id' => 'sometimes|uuid|exists:employees,id',
            'leave_type'  => 'sometimes|in:annual,sick,maternity,paternity,unpaid',
            'start_date'  => 'sometimes|date',
            'end_date'    => 'sometimes|date|after_or_equal:start_date',
            'reason'      => 'sometimes|string',
            'status'      => 'sometimes|in:pending,approved,rejected,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $updateData = $request->only(['employee_id', 'leave_type', 'start_date', 'end_date', 'reason', 'status']);

        // Approving/rejecting is a decision for the assigned approver, or
        // GM/Director (can_manage_company) / can_approve_leave - unlike the
        // request's own details (dates, reason, type), which anyone with menu
        // access can already edit above. Without this, this generic update
        // endpoint let anyone with menu access silently approve/reject too,
        // bypassing the stricter dedicated approve() endpoint below entirely.
        if ($request->filled('status') && in_array($request->input('status'), ['approved', 'rejected']) && $request->input('status') !== $leaveRequest->status) {
            $leaveRequest->loadMissing('employee');
            $isAssignedApprover = optional($leaveRequest->employee)->leave_approver_id === $request->user()->id;
            if (!$this->hasPermission($request, 'can_approve_leave', $leaveRequest->company_id) && !$isAssignedApprover) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized to approve or reject this leave request.'], 403);
            }
            $updateData['approved_by'] = $request->user()->id;
            $updateData['approved_at'] = now();
        }

        $leaveRequest->update($updateData);
        $leaveRequest->load('employee');

        return response()->json([
            'status' => 'success',
            'message' => 'Leave request updated successfully.',
            'leave_request' => $this->formatLeaveRequest($leaveRequest),
        ], 200);
    }

    public function destroy(Request $request, $id)
    {
        $leaveRequest = LeaveRequest::find($id);
        if (!$leaveRequest) {
            return response()->json(['status' => 'failed', 'message' => 'Leave request not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_leave_management_menu', $leaveRequest->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $leaveRequest->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Leave request deleted successfully.',
        ], 200);
    }

    public function approve(Request $request, $id)
    {
        $leaveRequest = LeaveRequest::find($id);
        if (!$leaveRequest) {
            return response()->json(['status' => 'failed', 'message' => 'Leave request not found.'], 404);
        }
        $leaveRequest->loadMissing('employee');
        $isAssignedApprover = optional($leaveRequest->employee)->leave_approver_id === $request->user()->id;

        if (!$this->hasPermission($request, 'can_approve_leave', $leaveRequest->company_id) && !$isAssignedApprover) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $leaveRequest->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);
        $leaveRequest->load('employee');

        return response()->json([
            'status' => 'success',
            'message' => 'Leave request approved successfully.',
            'leave_request' => $this->formatLeaveRequest($leaveRequest),
        ], 200);
    }

    private function formatLeaveRequest(LeaveRequest $lr): array
    {
        $employee = $lr->employee;
        return [
            'id'          => $lr->id,
            'employee_id' => $lr->employee_id,
            'employee'    => $employee ? trim($employee->first_name . ' ' . $employee->last_name) : '',
            'leaveType'   => $lr->leave_type,
            'startDate'   => $lr->start_date ? $lr->start_date->format('Y-m-d') : null,
            'endDate'     => $lr->end_date ? $lr->end_date->format('Y-m-d') : null,
            'reason'      => $lr->reason,
            'status'      => $lr->status,
            'created_at'  => $lr->created_at,
            'updated_at'  => $lr->updated_at,
        ];
    }
}
