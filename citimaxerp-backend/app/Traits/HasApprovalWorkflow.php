<?php

namespace App\Traits;

use App\Models\ApprovalWorkflow;
use App\Models\ApprovalWorkflowInstance;
use App\Services\ApprovalWorkflowService;

trait HasApprovalWorkflow
{
    /**
     * Get the workflow instances for this model
     */
    public function workflowInstances()
    {
        return $this->hasMany(ApprovalWorkflowInstance::class, 'entity_id', 'id')
                    ->where('entity_type', $this->getEntityType());
    }

    /**
     * Get the active workflow instance for this model
     */
    public function activeWorkflowInstance()
    {
        return $this->hasOne(ApprovalWorkflowInstance::class, 'entity_id', 'id')
                    ->where('entity_type', $this->getEntityType())
                    ->whereIn('status', ['pending', 'in_progress'])
                    ->latest();
    }

    /**
     * Get the latest workflow instance for this model
     */
    public function latestWorkflowInstance()
    {
        return $this->hasOne(ApprovalWorkflowInstance::class, 'entity_id', 'id')
                    ->where('entity_type', $this->getEntityType())
                    ->latest();
    }

    /**
     * Check if model has an active workflow
     */
    public function hasActiveWorkflow()
    {
        return $this->activeWorkflowInstance()->exists();
    }

    /**
     * Get the approval status of the model
     */
    public function getApprovalStatus()
    {
        $workflowInstance = $this->activeWorkflowInstance;
        
        if (!$workflowInstance) {
            $latestInstance = $this->latestWorkflowInstance;
            return $latestInstance ? $latestInstance->status : 'draft';
        }

        return $workflowInstance->status;
    }

    /**
     * Get the current approval step
     */
    public function getCurrentApprovalStep()
    {
        $workflowInstance = $this->activeWorkflowInstance;
        return $workflowInstance ? $workflowInstance->currentStep : null;
    }

    /**
     * Get pending approvals for this model
     */
    public function getPendingApprovals()
    {
        $workflowInstance = $this->activeWorkflowInstance;
        
        if (!$workflowInstance) {
            return collect();
        }

        return $workflowInstance->pendingStepInstances;
    }

    /**
     * Check if model is approved
     */
    public function isApproved()
    {
        return $this->getApprovalStatus() === 'approved';
    }

    /**
     * Check if model is rejected
     */
    public function isRejected()
    {
        return $this->getApprovalStatus() === 'rejected';
    }

    /**
     * Check if model is pending approval
     */
    public function isPendingApproval()
    {
        return in_array($this->getApprovalStatus(), ['pending', 'in_progress']);
    }

    /**
     * Check if model is in draft status (no workflow initiated)
     */
    public function isDraft()
    {
        return $this->getApprovalStatus() === 'draft';
    }

    /**
     * Initiate approval workflow for this model
     */
    public function initiateApprovalWorkflow($initiatedBy = null, $context = [])
    {
        $workflowService = app(ApprovalWorkflowService::class);
        
        return $workflowService->initiateWorkflow(
            $this->getEntityType(),
            $this->id,
            $initiatedBy ?? auth()->id(),
            $this->company_id ?? null,
            $context
        );
    }

    /**
     * Cancel active approval workflow
     */
    public function cancelApprovalWorkflow($reason = null)
    {
        $workflowInstance = $this->activeWorkflowInstance;
        
        if (!$workflowInstance) {
            return false;
        }

        $workflowService = app(ApprovalWorkflowService::class);
        return $workflowService->cancelWorkflow($workflowInstance->id, $reason);
    }

    /**
     * Get workflow progress percentage
     */
    public function getWorkflowProgress()
    {
        $workflowInstance = $this->activeWorkflowInstance ?? $this->latestWorkflowInstance;
        return $workflowInstance ? $workflowInstance->getProgressPercentage() : 0;
    }

    /**
     * Get workflow history
     */
    public function getWorkflowHistory()
    {
        return $this->workflowInstances()
                    ->with(['stepInstances.step', 'stepInstances.assignedUser', 'workflow'])
                    ->orderBy('created_at', 'desc')
                    ->get();
    }

    /**
     * Get users who can approve current step
     */
    public function getCurrentApprovers()
    {
        $workflowInstance = $this->activeWorkflowInstance;
        
        if (!$workflowInstance) {
            return collect();
        }

        return $workflowInstance->pendingStepInstances()
                                ->with('assignedUser')
                                ->get()
                                ->pluck('assignedUser')
                                ->filter();
    }

    /**
     * Get the entity type for workflow purposes
     * Override this method in your model if needed
     */
    protected function getEntityType()
    {
        // Default implementation - convert model class name to snake_case
        $className = class_basename(get_class($this));
        return strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', $className));
    }

    /**
     * Hook called when workflow is approved
     * Override this method in your model to handle approval actions
     */
    public function onWorkflowApproved($workflowInstance)
    {
        // Default implementation - update a status field if it exists
        if (method_exists($this, 'update') && in_array('status', $this->fillable)) {
            $this->update(['status' => 'active']);
        }
    }

    /**
     * Hook called when workflow is rejected
     * Override this method in your model to handle rejection actions
     */
    public function onWorkflowRejected($workflowInstance)
    {
        // Default implementation - update a status field if it exists
        if (method_exists($this, 'update') && in_array('status', $this->fillable)) {
            $this->update(['status' => 'rejected']);
        }
    }

    /**
     * Hook called when workflow step is approved
     * Override this method in your model to handle step approval actions
     */
    public function onWorkflowStepApproved($stepInstance)
    {
        // Default implementation - can be overridden by models
    }

    /**
     * Hook called when workflow step is rejected
     * Override this method in your model to handle step rejection actions
     */
    public function onWorkflowStepRejected($stepInstance)
    {
        // Default implementation - can be overridden by models
    }

    /**
     * Scope to get models with active workflows
     */
    public function scopeWithActiveWorkflow($query)
    {
        return $query->whereHas('activeWorkflowInstance');
    }

    /**
     * Scope to get approved models
     */
    public function scopeApproved($query)
    {
        return $query->whereHas('latestWorkflowInstance', function ($q) {
            $q->where('status', 'approved');
        });
    }

    /**
     * Scope to get rejected models
     */
    public function scopeRejected($query)
    {
        return $query->whereHas('latestWorkflowInstance', function ($q) {
            $q->where('status', 'rejected');
        });
    }

    /**
     * Scope to get pending approval models
     */
    public function scopePendingApproval($query)
    {
        return $query->whereHas('activeWorkflowInstance', function ($q) {
            $q->whereIn('status', ['pending', 'in_progress']);
        });
    }

    /**
     * Scope to get draft models (no workflow initiated)
     */
    public function scopeDraft($query)
    {
        return $query->whereDoesntHave('workflowInstances');
    }

    /**
     * Boot the trait
     */
    public static function bootHasApprovalWorkflow()
    {
        // Auto-initiate workflow on create if configured
        static::created(function ($model) {
            if (method_exists($model, 'shouldAutoInitiateWorkflow') && $model->shouldAutoInitiateWorkflow()) {
                $model->initiateApprovalWorkflow();
            }
        });
    }
}