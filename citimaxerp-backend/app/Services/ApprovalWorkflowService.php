<?php

namespace App\Services;

use App\Models\ApprovalWorkflow;
use App\Models\ApprovalWorkflowInstance;
use App\Models\ApprovalWorkflowStep;
use App\Models\ApprovalWorkflowStepInstance;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ApprovalWorkflowService
{
    /**
     * Initiate a new workflow for an entity
     */
    public function initiateWorkflow($entityType, $entityId, $initiatedBy, $companyId, $context = [])
    {
        try {
            DB::beginTransaction();

            // Get the entity to pass to workflow conditions
            $entity = $this->getEntityModel($entityType, $entityId);
            if (!$entity) {
                throw new \Exception("Entity not found: {$entityType} with ID {$entityId}");
            }

            // Check if there's already an active workflow for this entity
            $existingWorkflow = ApprovalWorkflowInstance::forEntity($entityType, $entityId)
                                                        ->active()
                                                        ->first();
            
            if ($existingWorkflow) {
                throw new \Exception("An active workflow already exists for this entity");
            }

            // Find applicable workflow
            $workflow = ApprovalWorkflow::getApplicableWorkflow($entityType, $entity, $companyId, $context);
            
            if (!$workflow) {
                throw new \Exception("No applicable workflow found for {$entityType}");
            }

            // Create workflow instance
            $workflowInstance = ApprovalWorkflowInstance::create([
                'id' => (string) Str::uuid(),
                'workflow_id' => $workflow->id,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'status' => 'pending',
                'initiated_by' => $initiatedBy,
                'company_id' => $companyId,
                'started_at' => now(),
                'metadata' => $context,
            ]);

            // Start the first step
            $this->processNextStep($workflowInstance);

            DB::commit();

            // Log the workflow initiation
            \App\Models\ActivityLog::logActivity(
                'workflow_initiated',
                "Initiated workflow: {$workflow->name} for {$entityType}",
                User::find($initiatedBy),
                [
                    'workflow_id' => $workflow->id,
                    'workflow_instance_id' => $workflowInstance->id,
                    'entity_type' => $entityType,
                    'entity_id' => $entityId,
                ]
            );

            return $workflowInstance;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to initiate workflow', [
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Process the next step in a workflow
     */
    public function processNextStep($workflowInstance)
    {
        $nextStep = $workflowInstance->getNextStep();
        
        if (!$nextStep) {
            // No more steps - workflow is complete
            $this->completeWorkflow($workflowInstance, 'approved');
            return;
        }

        // Check if step conditions are met
        $entity = $workflowInstance->entity;
        $context = $workflowInstance->metadata ?? [];
        
        if (!$nextStep->meetsConditions($entity, $context)) {
            // Skip this step and move to next
            $this->skipStep($workflowInstance, $nextStep, 'Conditions not met');
            return;
        }

        // Update workflow instance current step
        $workflowInstance->update([
            'current_step_id' => $nextStep->id,
            'status' => 'in_progress',
        ]);

        // Create step instance
        $approver = $nextStep->getApprover($entity, $context);
        
        if (!$approver) {
            throw new \Exception("No approver found for step: {$nextStep->step_name}");
        }

        $stepInstance = ApprovalWorkflowStepInstance::create([
            'id' => (string) Str::uuid(),
            'workflow_instance_id' => $workflowInstance->id,
            'step_id' => $nextStep->id,
            'assigned_to' => $approver->id,
            'status' => 'pending',
            'assigned_at' => now(),
        ]);

        // TODO: Send notification to approver
        $this->notifyApprover($stepInstance);

        return $stepInstance;
    }

    /**
     * Approve a workflow step
     */
    public function approveStep($stepInstanceId, $userId, $comments = null, $metadata = [])
    {
        try {
            DB::beginTransaction();

            $stepInstance = ApprovalWorkflowStepInstance::find($stepInstanceId);
            
            if (!$stepInstance) {
                throw new \Exception("Step instance not found");
            }

            if ($stepInstance->assigned_to !== $userId && $stepInstance->escalated_to !== $userId) {
                throw new \Exception("User not authorized to approve this step");
            }

            if (!$stepInstance->isPending()) {
                throw new \Exception("Step is not pending approval");
            }

            // Approve the step
            $stepInstance->approve($userId, $comments, $metadata);

            $workflowInstance = $stepInstance->workflowInstance;

            // Call entity hook
            $entity = $workflowInstance->entity;
            if ($entity && method_exists($entity, 'onWorkflowStepApproved')) {
                $entity->onWorkflowStepApproved($stepInstance);
            }

            // Process next step
            $this->processNextStep($workflowInstance);

            DB::commit();

            return $stepInstance;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to approve step', [
                'step_instance_id' => $stepInstanceId,
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Reject a workflow step
     */
    public function rejectStep($stepInstanceId, $userId, $comments = null, $metadata = [])
    {
        try {
            DB::beginTransaction();

            $stepInstance = ApprovalWorkflowStepInstance::find($stepInstanceId);
            
            if (!$stepInstance) {
                throw new \Exception("Step instance not found");
            }

            if ($stepInstance->assigned_to !== $userId && $stepInstance->escalated_to !== $userId) {
                throw new \Exception("User not authorized to reject this step");
            }

            if (!$stepInstance->isPending()) {
                throw new \Exception("Step is not pending approval");
            }

            // Check if rejection is allowed for this step
            if (!$stepInstance->step->allow_rejection) {
                throw new \Exception("Rejection not allowed for this step");
            }

            // Reject the step
            $stepInstance->reject($userId, $comments, $metadata);

            $workflowInstance = $stepInstance->workflowInstance;

            // Call entity hook
            $entity = $workflowInstance->entity;
            if ($entity && method_exists($entity, 'onWorkflowStepRejected')) {
                $entity->onWorkflowStepRejected($stepInstance);
            }

            // Complete workflow with rejection
            $this->completeWorkflow($workflowInstance, 'rejected', $comments);

            DB::commit();

            return $stepInstance;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to reject step', [
                'step_instance_id' => $stepInstanceId,
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Skip a workflow step
     */
    protected function skipStep($workflowInstance, $step, $reason)
    {
        ApprovalWorkflowStepInstance::create([
            'id' => (string) Str::uuid(),
            'workflow_instance_id' => $workflowInstance->id,
            'step_id' => $step->id,
            'assigned_to' => $workflowInstance->initiated_by, // Assign to initiator for record
            'status' => 'skipped',
            'assigned_at' => now(),
            'responded_at' => now(),
            'comments' => $reason,
        ]);

        // Continue to next step
        $this->processNextStep($workflowInstance);
    }

    /**
     * Complete a workflow
     */
    protected function completeWorkflow($workflowInstance, $status, $reason = null)
    {
        $workflowInstance->update([
            'status' => $status,
            'current_step_id' => null,
            'completed_at' => now(),
            'rejection_reason' => $reason,
        ]);

        // Call entity hooks
        $entity = $workflowInstance->entity;
        if ($entity) {
            if ($status === 'approved' && method_exists($entity, 'onWorkflowApproved')) {
                $entity->onWorkflowApproved($workflowInstance);
            } elseif ($status === 'rejected' && method_exists($entity, 'onWorkflowRejected')) {
                $entity->onWorkflowRejected($workflowInstance);
            }
        }

        // Log completion
        \App\Models\ActivityLog::logActivity(
            'workflow_completed',
            "Workflow {$status}: {$workflowInstance->workflow->name}",
            User::find($workflowInstance->initiated_by),
            [
                'workflow_instance_id' => $workflowInstance->id,
                'status' => $status,
                'reason' => $reason,
            ]
        );
    }

    /**
     * Cancel a workflow
     */
    public function cancelWorkflow($workflowInstanceId, $reason = null)
    {
        try {
            DB::beginTransaction();

            $workflowInstance = ApprovalWorkflowInstance::find($workflowInstanceId);
            
            if (!$workflowInstance) {
                throw new \Exception("Workflow instance not found");
            }

            if ($workflowInstance->isCompleted()) {
                throw new \Exception("Cannot cancel completed workflow");
            }

            $workflowInstance->update([
                'status' => 'cancelled',
                'completed_at' => now(),
                'rejection_reason' => $reason,
            ]);

            // Cancel all pending step instances
            $workflowInstance->pendingStepInstances()->update([
                'status' => 'skipped',
                'responded_at' => now(),
                'comments' => 'Cancelled: ' . $reason,
            ]);

            DB::commit();

            return $workflowInstance;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to cancel workflow', [
                'workflow_instance_id' => $workflowInstanceId,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Escalate overdue steps
     */
    public function escalateOverdueSteps()
    {
        $overdueSteps = ApprovalWorkflowStepInstance::overdue()->get();

        foreach ($overdueSteps as $stepInstance) {
            $escalationApprover = $stepInstance->step->getEscalationApprover(
                $stepInstance->workflowInstance->entity, 
                $stepInstance->workflowInstance->metadata ?? []
            );

            if ($escalationApprover) {
                $stepInstance->escalate($escalationApprover->id, 'Automatic escalation due to timeout');
                $this->notifyApprover($stepInstance, true);
            }
        }
    }

    /**
     * Get pending approvals for a user
     */
    public function getUserPendingApprovals($userId, $companyId = null)
    {
        $query = ApprovalWorkflowStepInstance::with([
                'workflowInstance.workflow',
                'workflowInstance.entity',
                'step'
            ])
            ->where(function ($q) use ($userId) {
                $q->where('assigned_to', $userId)
                  ->orWhere('escalated_to', $userId);
            })
            ->where('status', 'pending');

        if ($companyId) {
            $query->whereHas('workflowInstance', function ($q) use ($companyId) {
                $q->where('company_id', $companyId);
            });
        }

        return $query->orderBy('assigned_at')->get();
    }

    /**
     * Get workflow statistics
     */
    public function getWorkflowStatistics($companyId = null, $dateFrom = null, $dateTo = null)
    {
        $query = ApprovalWorkflowInstance::query();

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        if ($dateFrom) {
            $query->where('created_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->where('created_at', '<=', $dateTo);
        }

        return [
            'total_workflows' => $query->count(),
            'pending_workflows' => $query->whereIn('status', ['pending', 'in_progress'])->count(),
            'approved_workflows' => $query->where('status', 'approved')->count(),
            'rejected_workflows' => $query->where('status', 'rejected')->count(),
            'cancelled_workflows' => $query->where('status', 'cancelled')->count(),
            'average_completion_time' => $query->whereNotNull('completed_at')
                                              ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, started_at, completed_at)) as avg_hours')
                                              ->first()
                                              ->avg_hours ?? 0,
        ];
    }

    /**
     * Get entity model instance
     */
    protected function getEntityModel($entityType, $entityId)
    {
        switch ($entityType) {
            case 'customer_account':
                return \App\Models\CustomerAccount::find($entityId);
            case 'customer':
                return \App\Models\Customer::find($entityId);
            case 'order_dispatch':
                return \App\Models\OrderDispatch::find($entityId);
            case 'dispatch':
                return \App\Models\Dispatch::find($entityId);
            // Add more entity types as needed
            default:
                return null;
        }
    }

    /**
     * Send notification to approver
     * TODO: Implement actual notification logic
     */
    protected function notifyApprover($stepInstance, $isEscalation = false)
    {
        // This would integrate with your notification system
        // For now, just log the notification
        Log::info('Approval notification sent', [
            'step_instance_id' => $stepInstance->id,
            'assigned_to' => $stepInstance->assigned_to,
            'escalated_to' => $stepInstance->escalated_to,
            'is_escalation' => $isEscalation,
        ]);
    }
}