<?php

namespace App\Http\Controllers;

use App\Models\ApprovalWorkflowStepInstance;
use App\Models\ApprovalWorkflowInstance;
use App\Services\ApprovalWorkflowService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class ApprovalController extends Controller
{
    protected $workflowService;

    public function __construct(ApprovalWorkflowService $workflowService)
    {
        $this->middleware('auth:sanctum');
        $this->workflowService = $workflowService;
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
     * Get pending approvals for the current user
     */
    public function getPendingApprovals(Request $request)
    {
        $user = $request->user();
        
        $pendingApprovals = $this->workflowService->getUserPendingApprovals($user->id, $user->company_id);

        return response()->json([
            'status' => 'success',
            'message' => 'Pending approvals retrieved successfully.',
            'data' => $pendingApprovals,
        ]);
    }

    /**
     * Get workflow instance details
     */
    public function getWorkflowInstance(Request $request, $instanceId)
    {
        $user = $request->user();
        
        $workflowInstance = ApprovalWorkflowInstance::with([
                'workflow',
                'currentStep',
                'stepInstances.step',
                'stepInstances.assignedUser',
                'initiator',
                'entity'
            ])
            ->where('company_id', $user->company_id)
            ->find($instanceId);

        if (!$workflowInstance) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Workflow instance not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_view_approvals', $workflowInstance->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this workflow.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Workflow instance retrieved successfully.',
            'data' => $workflowInstance,
        ]);
    }

    /**
     * Approve a workflow step
     */
    public function approveStep(Request $request, $stepInstanceId)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'comments' => 'nullable|string|max:1000',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $stepInstance = $this->workflowService->approveStep(
                $stepInstanceId,
                $user->id,
                $request->input('comments'),
                $request->input('metadata', [])
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Step approved successfully.',
                'data' => $stepInstance->load(['workflowInstance', 'step']),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Reject a workflow step
     */
    public function rejectStep(Request $request, $stepInstanceId)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'comments' => 'required|string|max:1000',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $stepInstance = $this->workflowService->rejectStep(
                $stepInstanceId,
                $user->id,
                $request->input('comments'),
                $request->input('metadata', [])
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Step rejected successfully.',
                'data' => $stepInstance->load(['workflowInstance', 'step']),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Get workflow instances for an entity
     */
    public function getEntityWorkflows(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'entity_type' => 'required|string|in:customer_account,customer,dispatch,order,expense,requisition',
            'entity_id' => 'required|uuid',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $workflows = ApprovalWorkflowInstance::with([
                'workflow',
                'stepInstances.step',
                'stepInstances.assignedUser',
                'initiator'
            ])
            ->forEntity($request->entity_type, $request->entity_id)
            ->where('company_id', $user->company_id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Entity workflows retrieved successfully.',
            'data' => $workflows,
        ]);
    }

    /**
     * Cancel a workflow instance
     */
    public function cancelWorkflow(Request $request, $instanceId)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $workflowInstance = ApprovalWorkflowInstance::where('company_id', $user->company_id)
                                                   ->find($instanceId);

        if (!$workflowInstance) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Workflow instance not found.',
            ], 404);
        }

        // Check if user can cancel this workflow
        if ($workflowInstance->initiated_by !== $user->id && 
            !$this->hasPermission($request, 'can_cancel_workflows', $workflowInstance->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to cancel this workflow.',
            ], 403);
        }

        try {
            $workflowInstance = $this->workflowService->cancelWorkflow(
                $instanceId,
                $request->input('reason')
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Workflow cancelled successfully.',
                'data' => $workflowInstance,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Get workflow statistics
     */
    public function getWorkflowStatistics(Request $request)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_view_workflow_reports', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view workflow statistics.',
            ], 403);
        }

        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $statistics = $this->workflowService->getWorkflowStatistics(
            $user->company_id,
            $dateFrom,
            $dateTo
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Workflow statistics retrieved successfully.',
            'data' => $statistics,
        ]);
    }

    /**
     * Initiate workflow for an entity
     */
    public function initiateWorkflow(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'entity_type' => 'required|string|in:customer_account,customer,dispatch,order,expense,requisition',
            'entity_id' => 'required|uuid',
            'context' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $workflowInstance = $this->workflowService->initiateWorkflow(
                $request->entity_type,
                $request->entity_id,
                $user->id,
                $user->company_id,
                $request->input('context', [])
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Workflow initiated successfully.',
                'data' => $workflowInstance->load(['workflow', 'stepInstances.step']),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], 400);
        }
    }
}