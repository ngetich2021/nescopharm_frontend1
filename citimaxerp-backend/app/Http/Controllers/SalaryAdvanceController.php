<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\SalaryAdvance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SalaryAdvanceController extends Controller
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
        $canViewAll = $this->hasPermission($request, 'can_view_salary_advance_menu', $user->company_id);
        $canManageCompany = $this->hasPermission($request, 'can_manage_company', $user->company_id);

        if (!$canViewAll && !$canManageCompany) {
            $isApprover = Employee::where('company_id', $user->company_id)
                ->where('salary_advance_approver_id', $user->id)
                ->exists();

            if (!$isApprover) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
            }
        }

        $query = SalaryAdvance::with('employee')->where('company_id', $user->company_id);

        if (!$canViewAll && !$canManageCompany) {
            $query->whereHas('employee', fn ($q) => $q->where('salary_advance_approver_id', $user->id));
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

        $advances = $query->orderBy('created_at', 'desc')->get()->map(function ($adv) {
            return $this->formatAdvance($adv);
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Salary advances retrieved successfully.',
            'salary_advances' => $advances,
        ], 200);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_salary_advance_menu', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'employee_id'  => 'required|uuid|exists:employees,id',
            'amount'       => 'required|numeric|min:1',
            'request_date' => 'required|date',
            'reason'       => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $advance = SalaryAdvance::create([
            'company_id'   => $user->company_id,
            'employee_id'  => $request->employee_id,
            'amount'       => $request->amount,
            'request_date' => $request->request_date,
            'reason'       => $request->reason,
            'status'       => 'pending',
            'created_by'   => $user->id,
        ]);

        $advance->load('employee');

        return response()->json([
            'status' => 'success',
            'message' => 'Salary advance request created successfully.',
            'salary_advance' => $this->formatAdvance($advance),
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $advance = SalaryAdvance::with('employee')->find($id);
        if (!$advance) {
            return response()->json(['status' => 'failed', 'message' => 'Salary advance not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_salary_advance_menu', $advance->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Salary advance retrieved successfully.',
            'salary_advance' => $this->formatAdvance($advance),
        ], 200);
    }

    public function update(Request $request, $id)
    {
        $advance = SalaryAdvance::find($id);
        if (!$advance) {
            return response()->json(['status' => 'failed', 'message' => 'Salary advance not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_salary_advance_menu', $advance->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'employee_id'  => 'sometimes|uuid|exists:employees,id',
            'amount'       => 'sometimes|numeric|min:1',
            'request_date' => 'sometimes|date',
            'reason'       => 'sometimes|string',
            'status'       => 'sometimes|in:pending,approved,paid,rejected,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 422);
        }

        $updateData = $request->only(['employee_id', 'amount', 'request_date', 'reason', 'status']);

        // Same gap as LeaveController::update() had - approving/rejecting is a
        // decision for the assigned approver or GM/Director
        // (can_approve_salary_changes/can_manage_company), not just anyone
        // with menu access to this generic edit endpoint.
        if ($request->filled('status') && in_array($request->input('status'), ['approved', 'rejected']) && $request->input('status') !== $advance->status) {
            $advance->loadMissing('employee');
            $isAssignedApprover = optional($advance->employee)->salary_advance_approver_id === $request->user()->id;
            if (!$this->hasPermission($request, 'can_approve_salary_changes', $advance->company_id) && !$isAssignedApprover) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized to approve or reject this salary advance.'], 403);
            }
            $updateData['approved_by'] = $request->user()->id;
            $updateData['approved_at'] = now();
        }

        $advance->update($updateData);
        $advance->load('employee');

        return response()->json([
            'status' => 'success',
            'message' => 'Salary advance updated successfully.',
            'salary_advance' => $this->formatAdvance($advance),
        ], 200);
    }

    public function destroy(Request $request, $id)
    {
        $advance = SalaryAdvance::find($id);
        if (!$advance) {
            return response()->json(['status' => 'failed', 'message' => 'Salary advance not found.'], 404);
        }
        if (!$this->hasPermission($request, 'can_view_salary_advance_menu', $advance->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $advance->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Salary advance deleted successfully.',
        ], 200);
    }

    public function approve(Request $request, $id)
    {
        $advance = SalaryAdvance::find($id);
        if (!$advance) {
            return response()->json(['status' => 'failed', 'message' => 'Salary advance not found.'], 404);
        }
        $advance->loadMissing('employee');
        $isAssignedApprover = optional($advance->employee)->salary_advance_approver_id === $request->user()->id;

        if (!$this->hasPermission($request, 'can_approve_salary_changes', $advance->company_id) && !$isAssignedApprover) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $advance->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);
        $advance->load('employee');

        return response()->json([
            'status' => 'success',
            'message' => 'Salary advance approved successfully.',
            'salary_advance' => $this->formatAdvance($advance),
        ], 200);
    }

    private function formatAdvance(SalaryAdvance $adv): array
    {
        $employee = $adv->employee;
        return [
            'id'          => $adv->id,
            'employee_id' => $adv->employee_id,
            'employee'    => $employee ? trim($employee->first_name . ' ' . $employee->last_name) : '',
            'amount'      => $adv->amount,
            'requestDate' => $adv->request_date ? $adv->request_date->format('Y-m-d') : null,
            'reason'      => $adv->reason,
            'status'      => $adv->status,
            'created_at'  => $adv->created_at,
            'updated_at'  => $adv->updated_at,
        ];
    }
}
