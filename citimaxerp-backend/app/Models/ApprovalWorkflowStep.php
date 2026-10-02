<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ApprovalWorkflowStep extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'approval_workflow_steps';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'workflow_id',
        'step_order',
        'step_name',
        'description',
        'approver_type',
        'approver_reference',
        'conditions',
        'is_required',
        'allow_rejection',
        'timeout_hours',
        'escalation_approver_reference',
        'is_active',
    ];

    protected $casts = [
        'id' => 'string',
        'workflow_id' => 'string',
        'step_order' => 'integer',
        'conditions' => 'array',
        'is_required' => 'boolean',
        'allow_rejection' => 'boolean',
        'timeout_hours' => 'integer',
        'escalation_approver_reference' => 'string',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Step belongs to a workflow
     */
    public function workflow()
    {
        return $this->belongsTo(ApprovalWorkflow::class, 'workflow_id', 'id');
    }

    /**
     * Step instances (when this step is executed)
     */
    public function instances()
    {
        return $this->hasMany(ApprovalWorkflowStepInstance::class, 'step_id', 'id');
    }

    /**
     * Get the approver for this step based on approver_type
     */
    public function getApprover($entity = null, $context = [])
    {
        switch ($this->approver_type) {
            case 'user':
                return User::find($this->approver_reference);
            
            case 'role':
                // Find users with this role in the same company
                $companyId = $context['company_id'] ?? null;
                return User::whereHas('role', function ($query) use ($companyId) {
                    $query->where('id', $this->approver_reference);
                    if ($companyId) {
                        $query->where('company_id', $companyId);
                    }
                })->where('is_active', 'true')->first();
            
            case 'hierarchy':
                // This would require implementing hierarchy logic
                // For now, return null - to be implemented based on org structure
                return null;
            
            default:
                return null;
        }
    }

    /**
     * Get escalation approver
     */
    public function getEscalationApprover($entity = null, $context = [])
    {
        if (!$this->escalation_approver_reference) {
            return null;
        }

        // Use similar logic as getApprover but for escalation
        switch ($this->approver_type) {
            case 'user':
                return User::find($this->escalation_approver_reference);
            
            case 'role':
                $companyId = $context['company_id'] ?? null;
                return User::whereHas('role', function ($query) use ($companyId) {
                    $query->where('id', $this->escalation_approver_reference);
                    if ($companyId) {
                        $query->where('company_id', $companyId);
                    }
                })->where('is_active', 'true')->first();
            
            default:
                return null;
        }
    }

    /**
     * Check if step conditions are met
     */
    public function meetsConditions($entity, $context = [])
    {
        if (empty($this->conditions)) {
            return true;
        }

        foreach ($this->conditions as $condition) {
            if (!$this->evaluateCondition($condition, $entity, $context)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Evaluate a single condition (similar to workflow conditions)
     */
    private function evaluateCondition($condition, $entity, $context)
    {
        $field = $condition['field'] ?? null;
        $operator = $condition['operator'] ?? '=';
        $value = $condition['value'] ?? null;

        if (!$field) {
            return true;
        }

        $entityValue = data_get($entity, $field) ?? data_get($context, $field);

        switch ($operator) {
            case '=':
            case '==':
                return $entityValue == $value;
            case '!=':
                return $entityValue != $value;
            case '>':
                return $entityValue > $value;
            case '>=':
                return $entityValue >= $value;
            case '<':
                return $entityValue < $value;
            case '<=':
                return $entityValue <= $value;
            case 'in':
                return in_array($entityValue, (array) $value);
            case 'not_in':
                return !in_array($entityValue, (array) $value);
            default:
                return true;
        }
    }

    /**
     * Mutator for is_active field to handle PostgreSQL boolean
     */
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = ($value === true || $value === 'true' || $value === 1 || $value === '1') ? 'true' : 'false';
    }

    /**
     * Mutator for is_required field to handle PostgreSQL boolean
     */
    public function setIsRequiredAttribute($value)
    {
        $this->attributes['is_required'] = ($value === true || $value === 'true' || $value === 1 || $value === '1') ? 'true' : 'false';
    }

    /**
     * Mutator for allow_rejection field to handle PostgreSQL boolean
     */
    public function setAllowRejectionAttribute($value)
    {
        $this->attributes['allow_rejection'] = ($value === true || $value === 'true' || $value === 1 || $value === '1') ? 'true' : 'false';
    }

    /**
     * Scope for active steps
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', 'true');
    }

    /**
     * Scope for required steps
     */
    public function scopeRequired($query)
    {
        return $query->where('is_required', 'true');
    }
}