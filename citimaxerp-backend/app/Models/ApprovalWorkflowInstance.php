<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ApprovalWorkflowInstance extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'approval_workflow_instances';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'workflow_id',
        'entity_type',
        'entity_id',
        'current_step_id',
        'status',
        'initiated_by',
        'company_id',
        'started_at',
        'completed_at',
        'rejection_reason',
        'metadata',
    ];

    protected $casts = [
        'id' => 'string',
        'workflow_id' => 'string',
        'entity_id' => 'string',
        'current_step_id' => 'string',
        'initiated_by' => 'string',
        'company_id' => 'string',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Instance belongs to a workflow template
     */
    public function workflow()
    {
        return $this->belongsTo(ApprovalWorkflow::class, 'workflow_id', 'id');
    }

    /**
     * Current step being processed
     */
    public function currentStep()
    {
        return $this->belongsTo(ApprovalWorkflowStep::class, 'current_step_id', 'id');
    }

    /**
     * User who initiated the workflow
     */
    public function initiator()
    {
        return $this->belongsTo(User::class, 'initiated_by', 'id');
    }

    /**
     * Company this workflow belongs to
     */
    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'id');
    }

    /**
     * All step instances for this workflow
     */
    public function stepInstances()
    {
        return $this->hasMany(ApprovalWorkflowStepInstance::class, 'workflow_instance_id', 'id')
                    ->orderBy('created_at');
    }

    /**
     * Active/pending step instances
     */
    public function pendingStepInstances()
    {
        return $this->hasMany(ApprovalWorkflowStepInstance::class, 'workflow_instance_id', 'id')
                    ->where('status', 'pending');
    }

    /**
     * Completed step instances
     */
    public function completedStepInstances()
    {
        return $this->hasMany(ApprovalWorkflowStepInstance::class, 'workflow_instance_id', 'id')
                    ->whereIn('status', ['approved', 'rejected']);
    }

    /**
     * Get the entity being approved (polymorphic relationship)
     */
    public function entity()
    {
        switch ($this->entity_type) {
            case 'customer_account':
                return $this->belongsTo(CustomerAccount::class, 'entity_id', 'id');
            case 'customer':
                return $this->belongsTo(Customer::class, 'entity_id', 'id');
            // Add more entity types as needed
            default:
                return null;
        }
    }

    /**
     * Get the actual entity model
     */
    public function getEntityAttribute()
    {
        switch ($this->entity_type) {
            case 'customer_account':
                return CustomerAccount::find($this->entity_id);
            case 'customer':
                return Customer::find($this->entity_id);
            // Add more entity types as needed
            default:
                return null;
        }
    }

    /**
     * Check if workflow is completed (approved or rejected)
     */
    public function isCompleted()
    {
        return in_array($this->status, ['approved', 'rejected', 'cancelled']);
    }

    /**
     * Check if workflow is pending
     */
    public function isPending()
    {
        return in_array($this->status, ['pending', 'in_progress']);
    }

    /**
     * Get next step in the workflow
     */
    public function getNextStep()
    {
        if (!$this->current_step_id) {
            // Get first step
            return $this->workflow->steps()->orderBy('step_order')->first();
        }

        $currentStep = $this->currentStep;
        if (!$currentStep) {
            return null;
        }

        return $this->workflow->steps()
                    ->where('step_order', '>', $currentStep->step_order)
                    ->orderBy('step_order')
                    ->first();
    }

    /**
     * Get previous step in the workflow
     */
    public function getPreviousStep()
    {
        if (!$this->current_step_id) {
            return null;
        }

        $currentStep = $this->currentStep;
        if (!$currentStep) {
            return null;
        }

        return $this->workflow->steps()
                    ->where('step_order', '<', $currentStep->step_order)
                    ->orderBy('step_order', 'desc')
                    ->first();
    }

    /**
     * Get progress percentage
     */
    public function getProgressPercentage()
    {
        $totalSteps = $this->workflow->steps()->count();
        if ($totalSteps === 0) {
            return 0;
        }

        $completedSteps = $this->stepInstances()
                              ->whereIn('status', ['approved', 'skipped'])
                              ->count();

        return round(($completedSteps / $totalSteps) * 100, 2);
    }

    /**
     * Scope for active workflows
     */
    public function scopeActive($query)
    {
        return $query->whereIn('status', ['pending', 'in_progress']);
    }

    /**
     * Scope for completed workflows
     */
    public function scopeCompleted($query)
    {
        return $query->whereIn('status', ['approved', 'rejected', 'cancelled']);
    }

    /**
     * Scope for company workflows
     */
    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    /**
     * Scope for entity type
     */
    public function scopeForEntityType($query, $entityType)
    {
        return $query->where('entity_type', $entityType);
    }

    /**
     * Scope for specific entity
     */
    public function scopeForEntity($query, $entityType, $entityId)
    {
        return $query->where('entity_type', $entityType)
                     ->where('entity_id', $entityId);
    }
}