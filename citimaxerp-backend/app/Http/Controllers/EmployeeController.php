<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeStatutoryDetail;
use App\Http\Requests\CreateEmployeeRequest;
use App\Services\EmployeeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class EmployeeController extends Controller
{
    protected $employeeService;
 
    public function __construct(EmployeeService $employeeService)
    {
        $this->middleware('auth:sanctum');
        $this->employeeService = $employeeService;
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
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
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_employees', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view employees.',
            ], 403);
        }

        $query = Employee::with($this->employeeRelationships());

        // Always default to user's company
        $companyId = $user->company_id;
        
        // If user has manage_all_finance permission and explicitly requests another company
        if ($this->hasPermission($request, 'can_manage_all_finance') && $request->filled('company_id')) {
            $companyId = $request->input('company_id');
        }
        
        $query->where('company_id', $companyId);

        // Filters
        if ($request->filled('employment_type')) {
            $query->where('employment_type', $request->input('employment_type'));
        }

        if ($request->filled('is_active')) {
            $isActiveValue = $request->input('is_active');
            $bool = filter_var($isActiveValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($bool !== null) {
                $query->where('is_active', $bool);
            }
        }

        if ($request->filled('department')) {
            $query->where('department', $request->input('department'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'ilike', '%' . $search . '%')
                  ->orWhere('last_name', 'ilike', '%' . $search . '%')
                  ->orWhere('employee_number', 'ilike', '%' . $search . '%')
                  ->orWhere('email', 'ilike', '%' . $search . '%');
            });
        }

        $employees = $query->orderBy('employee_number')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Employees retrieved successfully.',
            'employees' => $employees,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $employee = Employee::with($this->employeeRelationships())->find($id);

        if (!$employee) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Employee not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_view_employees", $employee->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this employee.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Employee retrieved successfully.',
            'employee' => $employee,
        ], 200);
    }

    public function store(CreateEmployeeRequest $request)
    {

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_employees', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create employees.',
            ], 403);
        }

        try {
            $companyId = $request->input('company_id', $user->company_id);
            $employee = $this->employeeService->createEmployee(
                $request->all(), 
                $companyId,
                $user->id
            );

            if (!$employee) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Employee creation failed.',
                ], 500);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Employee created successfully.',
                'data' => [
                    'employee' => $employee->load($this->employeeRelationships())
                ]
            ], 201);

        } catch (\Exception $e) {
            Log::error('Error creating employee', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create employee: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $employee = Employee::find($id);

        if (!$employee) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Employee not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_update_employees", $employee->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this employee.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_update_employees', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit employees.',
            ], 403);
        }

        $validationRules = [
            'employee_number' => 'sometimes|nullable|string|max:50|unique:employees,employee_number,' . $id,
            'first_name' => 'sometimes|nullable|string|max:100',
            'last_name' => 'sometimes|nullable|string|max:100',
            'email' => 'sometimes|nullable|email|unique:employees,email,' . $id,
            'phone' => 'nullable|string|max:50',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'national_id' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'hire_date' => 'sometimes|nullable|date',
            'termination_date' => 'nullable|date',
            'employment_type' => 'sometimes|nullable|in:full_time,part_time,contract,intern',
            'payment_frequency' => 'sometimes|nullable|in:weekly,bi_weekly,monthly',
            'basic_salary' => 'sometimes|nullable|numeric|min:0',
            'hourly_rate' => 'nullable|numeric|min:0',
            'bank_name' => 'nullable|string|max:100',
            'bank_account' => 'nullable|string|max:50',
            'bank_branch' => 'nullable|string|max:100',
            'is_active' => 'sometimes|boolean',
            'employment_status' => 'sometimes|in:active,inactive,terminated',
            'department' => 'nullable|string|max:100',
            'position' => 'nullable|string|max:100',
            'supervisor_id' => 'nullable|uuid|exists:employees,id',
            'statutory_details' => 'nullable|array',
            'statutory_details.kra_pin' => 'nullable|string|max:20|unique:employee_statutory_details,kra_pin,' . $employee->id . ',employee_id',
            'statutory_details.nssf_number' => 'nullable|string|max:50|unique:employee_statutory_details,nssf_number,' . $employee->id . ',employee_id',
            'statutory_details.shif_number' => 'nullable|string|max:50|unique:employee_statutory_details,shif_number,' . $employee->id . ',employee_id',
            'statutory_details.has_disability' => 'sometimes|boolean',
            'statutory_details.disability_exemption_certificate' => 'nullable|string',
            'statutory_details.disability_exemption_amount' => 'nullable|numeric|min:0',
            'statutory_details.has_insurance_relief' => 'sometimes|boolean',
            'statutory_details.insurance_relief_amount' => 'nullable|numeric|min:0|max:5000',
            'allowances' => 'nullable|array',
            'deductions' => 'nullable|array',
        ];

        if ($this->hasEmployeeApproverColumns()) {
            $validationRules['leave_approver_id'] = 'nullable|uuid|exists:users,id';
            $validationRules['salary_advance_approver_id'] = 'nullable|uuid|exists:users,id';
        }

        $validator = Validator::make($request->all(), $validationRules);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        // Compensation is a decision for GM/Director (can_manage_company) or
        // can_approve_salary_changes specifically - can_update_employees alone
        // (which covers the rest of the record: name, address, status, etc.)
        // isn't enough to change what someone gets paid.
        $salaryFields = ['basic_salary', 'hourly_rate', 'payment_frequency', 'allowances', 'deductions'];
        $changingSalary = collect($salaryFields)->contains(function ($field) use ($request, $employee) {
            if (!$request->has($field)) {
                return false;
            }
            $new = $request->input($field);
            $current = $employee->{$field};
            if (is_array($new) || is_array($current)) {
                return json_encode($new) !== json_encode($current);
            }
            return (string) $new !== (string) $current;
        });

        if ($changingSalary && !$this->hasPermission($request, 'can_approve_salary_changes', $employee->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to change compensation for this employee.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $updatableFields = [
                'employee_number', 'first_name', 'last_name', 'email', 'phone',
                'date_of_birth', 'gender', 'national_id', 'address', 'city', 'state', 'postal_code',
                'hire_date', 'termination_date', 'employment_type', 'payment_frequency',
                'basic_salary', 'hourly_rate', 'bank_name', 'bank_account', 'bank_branch',
                'is_active', 'department', 'position', 'supervisor_id', 'allowances', 'deductions'
            ];

            if ($this->hasEmployeeApproverColumns()) {
                $updatableFields[] = 'leave_approver_id';
                $updatableFields[] = 'salary_advance_approver_id';
            }

            $data = $request->only($updatableFields);

            array_walk($data, function (&$value) {
                if ($value === '') {
                    $value = null;
                }
            });

            $employmentStatus = $request->input('employment_status');
            if ($employmentStatus === 'active') {
                $data['is_active'] = true;
                $data['termination_date'] = null;
            } elseif ($employmentStatus === 'inactive') {
                $data['is_active'] = false;
            } elseif ($employmentStatus === 'terminated') {
                $data['is_active'] = false;
                $data['termination_date'] = $data['termination_date'] ?? now()->toDateString();
                $metadata = $employee->metadata ?? [];
                $metadata['terminated_at'] = now()->toDateTimeString();
                $data['metadata'] = $metadata;
            }

            $employee->update($data);

            if ($request->has('statutory_details')) {
                $statutoryDetails = $request->input('statutory_details', []);
                array_walk($statutoryDetails, function (&$value) {
                    if ($value === '') {
                        $value = null;
                    }
                });

                if (count(array_filter($statutoryDetails, fn ($value) => $value !== null && $value !== false)) > 0) {
                    $this->employeeService->updateStatutoryDetails($employee, $statutoryDetails);
                }
            }

            // Sync allowances/deductions to employee_allowances table for payroll
            if ($request->has('allowances') || $request->has('deductions')) {
                \App\Models\EmployeeAllowance::where('employee_id', $employee->id)->delete();

                $items = [];
                foreach ($request->input('allowances', []) as $a) {
                    if (empty($a['name'])) continue;
                    $items[] = [
                        'id' => \Illuminate\Support\Str::uuid()->toString(),
                        'employee_id' => $employee->id,
                        'company_id' => $employee->company_id,
                        'name' => $a['name'],
                        'type' => 'allowance',
                        'amount' => $a['amount'] ?? 0,
                        'frequency' => $a['frequency'] ?? 'monthly',
                        'is_taxable' => ($a['is_taxable'] ?? true) ? 'true' : 'false',
                        'is_active' => 'true',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
                foreach ($request->input('deductions', []) as $d) {
                    if (empty($d['name'])) continue;
                    $items[] = [
                        'id' => \Illuminate\Support\Str::uuid()->toString(),
                        'employee_id' => $employee->id,
                        'company_id' => $employee->company_id,
                        'name' => $d['name'],
                        'type' => 'deduction',
                        'amount' => $d['amount'] ?? 0,
                        'frequency' => $d['frequency'] ?? 'monthly',
                        'is_taxable' => 'false',
                        'is_active' => 'true',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
                if (!empty($items)) {
                    \App\Models\EmployeeAllowance::insert($items);
                }
            }

            DB::commit();

            $employee->load($this->employeeRelationships());

            return response()->json([
                'status' => 'success',
                'message' => 'Employee updated successfully.',
                'employee' => $employee,
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error updating employee', [
                'employee_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update employee.',
            ], 500);
        }
    }

    public function terminate(Request $request, $id)
    {
        $employee = Employee::find($id);

        if (!$employee) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Employee not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_update_employees', $employee->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to terminate this employee.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'termination_date' => 'nullable|date',
            'reason' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 422);
        }

        $employee->terminate(
            $request->input('termination_date', now()->toDateString()),
            $request->input('reason')
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Employee terminated successfully.',
            'employee' => $employee->fresh($this->employeeRelationships()),
        ]);
    }

    private function hasEmployeeApproverColumns(): bool
    {
        return Schema::hasColumn('employees', 'leave_approver_id')
            && Schema::hasColumn('employees', 'salary_advance_approver_id');
    }

    private function employeeRelationships(): array
    {
        $relationships = ['company', 'statutoryDetails', 'supervisor'];

        if ($this->hasEmployeeApproverColumns()) {
            $relationships[] = 'leaveApprover';
            $relationships[] = 'salaryAdvanceApprover';
        }

        return $relationships;
    }

    public function destroy(Request $request, $id)
    {
        $employee = Employee::find($id);

        if (!$employee) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Employee not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_delete_employees", $employee->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this employee.',
            ], 403);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_employees', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete employees.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            // Check if employee has payroll items
            if ($employee->payrollItems()->count() > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot delete employee with existing payroll records.',
                ], 400);
            }

            $employee->delete();

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Employee deleted successfully.',
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error deleting employee', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete employee.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getEmploymentTypes(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_employees', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view employment types.',
            ], 403);
        }

        $employmentTypes = [
            'full_time' => 'Full Time',
            'part_time' => 'Part Time',
            'contract' => 'Contract',
            'intern' => 'Intern',
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Employment types retrieved successfully.',
            'employment_types' => $employmentTypes,
        ], 200);
    }

        public function statistics(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (!$this->hasPermission($request, 'can_view_employees', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view employee statistics.',
            ], 403);
        }

        $totalEmployees = Employee::where('company_id', $companyId)->count();
        $activeEmployees = Employee::where('company_id', $companyId)->whereRaw('is_active = true')->count();
        $inactiveEmployees = Employee::where('company_id', $companyId)->whereRaw('is_active = false')->count();

        $departments = Employee::where('company_id', $companyId)
            ->select('department')
            ->groupBy('department')
            ->pluck('department')
            ->filter()
            ->values()
            ->all();

        $byDepartment = [];
        foreach ($departments as $dept) {
            $byDepartment[$dept] = Employee::where('company_id', $companyId)->where('department', $dept)->count();
        }

        $employmentTypes = Employee::where('company_id', $companyId)
            ->select('employment_type')
            ->groupBy('employment_type')
            ->pluck('employment_type')
            ->filter()
            ->values()
            ->all();

        $byEmploymentType = [];
        foreach ($employmentTypes as $type) {
            $byEmploymentType[$type] = Employee::where('company_id', $companyId)->where('employment_type', $type)->count();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Employee statistics retrieved successfully.',
            'statistics' => [
                'total_employees' => $totalEmployees,
                'active_employees' => $activeEmployees,
                'inactive_employees' => $inactiveEmployees,
                'by_department' => $byDepartment,
                'by_employment_type' => $byEmploymentType,
            ],
        ], 200);
    }
}
