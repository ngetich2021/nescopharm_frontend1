<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ApprovalWorkflow extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'approval_workflows';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'module_type',
        'company_id',
        'description',
        'conditions',
        'is_active',
        'priority',
        'created_by',
    ];

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'created_by' => 'string',
        'conditions' => 'array',
        'is_active' => 'boolean',
        'priority' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Workflow belongs to a company (null for system-wide workflows)
     */
    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'id');
    }

    /**
     * Workflow created by user
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

    /**
     * Mutator for is_active field to handle PostgreSQL boolean
     */
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = ($value === true || $value === 'true' || $value === 1 || $value === '1') ? 'true' : 'false';
    }

    /**
     * Workflow has many steps
     */
    public function steps()
    {
        return $this->hasMany(ApprovalWorkflowStep::class, 'workflow_id', 'id')
                    ->where('is_active', 'true')
                    ->orderBy('step_order');
    }

    /**
     * All steps (including inactive)
     */
    public function allSteps()
    {
        return $this->hasMany(ApprovalWorkflowStep::class, 'workflow_id', 'id')
                    ->orderBy('step_order');
    }

    /**
     * Workflow instances (active workflows using this template)
     */
    public function instances()
    {
        return $this->hasMany(ApprovalWorkflowInstance::class, 'workflow_id', 'id');
    }

    /**
     * Active workflow instances
     */
    public function activeInstances()
    {
        return $this->hasMany(ApprovalWorkflowInstance::class, 'workflow_id', 'id')
                    ->whereIn('status', ['pending', 'in_progress']);
    }

    /**
     * Scope for active workflows
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', 'true');
    }

    /**
     * Scope for company workflows
     */
    public function scopeForCompany($query, $companyId)
    {
        return $query->where(function ($q) use ($companyId) {
            $q->where('company_id', $companyId)
              ->orWhereNull('company_id'); // include system-wide workflows
        });
    }

    /**
     * Scope for module type
     */
    public function scopeForModule($query, $moduleType)
    {
        return $query->where('module_type', $moduleType);
    }

    /**
     * Check if workflow conditions are met for an entity
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
     * Evaluate a single condition
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
            case 'contains':
                return strpos((string) $entityValue, (string) $value) !== false;
            case 'starts_with':
                return strpos((string) $entityValue, (string) $value) === 0;
            case 'ends_with':
                return substr((string) $entityValue, -strlen((string) $value)) === (string) $value;
            default:
                return true;
        }
    }

    /**
     * Get the first applicable workflow for an entity
     */
    public static function getApplicableWorkflow($moduleType, $entity, $companyId, $context = [])
    {
        return static::active()
                     ->forCompany($companyId)
                     ->forModule($moduleType)
                     ->orderBy('priority', 'desc')
                     ->orderBy('created_at', 'asc')
                     ->get()
                     ->first(function ($workflow) use ($entity, $context) {
                         return $workflow->meetsConditions($entity, $context);
                     });
    }
}