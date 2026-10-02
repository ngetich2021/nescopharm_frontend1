<?php

namespace App\Http\Controllers;

use App\Models\ApprovalWorkflow;
use App\Models\ApprovalWorkflowStep;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class ApprovalWorkflowController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
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

    /**
     * Get all workflows for a company
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_workflows', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view workflows.',
            ], 403);
        }

        $moduleType = $request->input('module_type');
        $isActive = $request->input('is_active');

        $query = ApprovalWorkflow::with(['steps', 'creator'])
                                ->forCompany($user->company_id);

        if ($moduleType) {
            $query->where('module_type', $moduleType);
        }

        if ($isActive !== null) {
            $query->where('is_active', filter_var($isActive, FILTER_VALIDATE_BOOLEAN));
        }

        $workflows = $query->orderBy('priority', 'desc')
                          ->orderBy('name')
                          ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Workflows retrieved successfully.',
            'data' => $workflows,
        ]);
    }

    /**
     * Get a specific workflow
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        
        $workflow = ApprovalWorkflow::with(['steps.workflow', 'creator', 'company'])
                                   ->forCompany($user->company_id)
                                   ->find($id);

        if (!$workflow) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Workflow not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_view_workflows', $workflow->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this workflow.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Workflow retrieved successfully.',
            'data' => $workflow,
        ]);
    }

    /**
     * Create a new workflow
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_workflows', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create workflows.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'module_type' => 'required|string|in:customer_account,customer,dispatch,order,expense,requisition',
            'description' => 'nullable|string',
            'conditions' => 'nullable|array',
            'priority' => 'nullable|integer|min:0|max:100',
            'steps' => 'required|array|min:1',
            'steps.*.step_name' => 'required|string|max:255',
            'steps.*.step_order' => 'required|integer|min:1',
            'steps.*.approver_type' => 'required|string|in:role,user,hierarchy',
            'steps.*.approver_reference' => 'required|string',
            'steps.*.description' => 'nullable|string',
            'steps.*.conditions' => 'nullable|array',
            'steps.*.is_required' => 'nullable|boolean',
            'steps.*.allow_rejection' => 'nullable|boolean',
            'steps.*.timeout_hours' => 'nullable|integer|min:1',
            'steps.*.escalation_approver_reference' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            // Create workflow
            $workflow = ApprovalWorkflow::create([
                'id' => (string) Str::uuid(),
                'name' => $request->name,
                'module_type' => $request->module_type,
                'company_id' => $user->company_id,
                'description' => $request->description,
                'conditions' => $request->conditions,
                'priority' => $request->priority ?? 0,
                'created_by' => $user->id,
            ]);

            // Create workflow steps
            foreach ($request->steps as $stepData) {
                // Validate approver reference exists
                if (!$this->validateApproverReference($stepData['approver_type'], $stepData['approver_reference'], $user->company_id)) {
                    throw new \Exception("Invalid approver reference: {$stepData['approver_reference']}");
                }

                ApprovalWorkflowStep::create([
                    'id' => (string) Str::uuid(),
                    'workflow_id' => $workflow->id,
                    'step_order' => $stepData['step_order'],
                    'step_name' => $stepData['step_name'],
                    'description' => $stepData['description'] ?? null,
                    'approver_type' => $stepData['approver_type'],
                    'approver_reference' => $stepData['approver_reference'],
                    'conditions' => $stepData['conditions'] ?? null,
                    'is_required' => $stepData['is_required'] ?? true,
                    'allow_rejection' => $stepData['allow_rejection'] ?? true,
                    'timeout_hours' => $stepData['timeout_hours'] ?? null,
                    'escalation_approver_reference' => $stepData['escalation_approver_reference'] ?? null,
                ]);
            }

            DB::commit();

            // Log activity
            \App\Models\ActivityLog::logActivity(
                'workflow_created',
                "Created new workflow: {$workflow->name}",
                $user,
                ['workflow_id' => $workflow->id, 'module_type' => $workflow->module_type]
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Workflow created successfully.',
                'data' => $workflow->load('steps'),
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create workflow', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create workflow: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update a workflow
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        
        $workflow = ApprovalWorkflow::forCompany($user->company_id)->find($id);
        
        if (!$workflow) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Workflow not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_edit_workflows', $workflow->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit this workflow.',
            ], 403);
        }

        // Check if workflow has active instances
        if ($workflow->activeInstances()->exists()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot modify workflow with active instances.',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'conditions' => 'nullable|array',
            'priority' => 'nullable|integer|min:0|max:100',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $workflow->update($request->only([
                'name', 'description', 'conditions', 'priority', 'is_active'
            ]));

            // Log activity
            \App\Models\ActivityLog::logActivity(
                'workflow_updated',
                "Updated workflow: {$workflow->name}",
                $user,
                ['workflow_id' => $workflow->id]
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Workflow updated successfully.',
                'data' => $workflow->load('steps'),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to update workflow', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update workflow: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a workflow
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        
        $workflow = ApprovalWorkflow::forCompany($user->company_id)->find($id);
        
        if (!$workflow) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Workflow not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_delete_workflows', $workflow->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this workflow.',
            ], 403);
        }

        // Check if workflow has any instances
        if ($workflow->instances()->exists()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Cannot delete workflow with existing instances. Deactivate it instead.',
            ], 400);
        }

        try {
            $workflowName = $workflow->name;
            $workflow->delete();

            // Log activity
            \App\Models\ActivityLog::logActivity(
                'workflow_deleted',
                "Deleted workflow: {$workflowName}",
                $user,
                ['workflow_id' => $id]
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Workflow deleted successfully.',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to delete workflow', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete workflow: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get available approvers for workflow configuration
     */
    public function getAvailableApprovers(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_workflows', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized.',
            ], 403);
        }

        $roles = Role::where('company_id', $user->company_id)
                    ->where('is_active', 'true')
                    ->select('id', 'name', 'description')
                    ->get();

        $users = User::where('company_id', $user->company_id)
                    ->where('is_active', 'true')
                    ->with('role:id,name')
                    ->select('id', 'first_name', 'last_name', 'email', 'role_id')
                    ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Available approvers retrieved successfully.',
            'data' => [
                'roles' => $roles,
                'users' => $users,
            ],
        ]);
    }

    /**
     * Validate approver reference
     */
    private function validateApproverReference($approverType, $approverReference, $companyId)
    {
        switch ($approverType) {
            case 'role':
                return Role::where('id', $approverReference)
                          ->where('company_id', $companyId)
                          ->exists();
            case 'user':
                return User::where('id', $approverReference)
                          ->where('company_id', $companyId)
                          ->exists();
            case 'hierarchy':
                // For now, just validate it's not empty
                // Hierarchy validation would depend on your org structure implementation
                return !empty($approverReference);
            default:
                return false;
        }
    }
}