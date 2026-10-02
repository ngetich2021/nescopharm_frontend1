<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ApprovalWorkflowStepInstance extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'approval_workflow_step_instances';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'workflow_instance_id',
        'step_id',
        'assigned_to',
        'status',
        'assigned_at',
        'responded_at',
        'comments',
        'decision_metadata',
        'escalated_to',
        'escalated_at',
    ];

    protected $casts = [
        'id' => 'string',
        'workflow_instance_id' => 'string',
        'step_id' => 'string',
        'assigned_to' => 'string',
        'escalated_to' => 'string',
        'assigned_at' => 'datetime',
        'responded_at' => 'datetime',
        'escalated_at' => 'datetime',
        'decision_metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Step instance belongs to a workflow instance
     */
    public function workflowInstance()
    {
        return $this->belongsTo(ApprovalWorkflowInstance::class, 'workflow_instance_id', 'id');
    }

    /**
     * Step instance belongs to a workflow step
     */
    public function step()
    {
        return $this->belongsTo(ApprovalWorkflowStep::class, 'step_id', 'id');
    }

    /**
     * User assigned to approve this step
     */
    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_to', 'id');
    }

    /**
     * User the step was escalated to
     */
    public function escalatedUser()
    {
        return $this->belongsTo(User::class, 'escalated_to', 'id');
    }

    /**
     * Check if step instance is pending
     */
    public function isPending()
    {
        return $this->status === 'pending';
    }

    /**
     * Check if step instance is approved
     */
    public function isApproved()
    {
        return $this->status === 'approved';
    }

    /**
     * Check if step instance is rejected
     */
    public function isRejected()
    {
        return $this->status === 'rejected';
    }

    /**
     * Check if step instance is escalated
     */
    public function isEscalated()
    {
        return $this->status === 'escalated';
    }

    /**
     * Check if step is overdue for escalation
     */
    public function isOverdue()
    {
        if (!$this->step->timeout_hours || !$this->assigned_at) {
            return false;
        }

        $timeoutAt = $this->assigned_at->addHours($this->step->timeout_hours);
        return now()->isAfter($timeoutAt) && $this->isPending();
    }

    /**
     * Approve the step
     */
    public function approve($userId, $comments = null, $metadata = [])
    {
        $this->update([
            'status' => 'approved',
            'responded_at' => now(),
            'comments' => $comments,
            'decision_metadata' => $metadata,
        ]);

        // Log the approval action
        \App\Models\ActivityLog::logActivity(
            'workflow_step_approved',
            "Approved step: {$this->step->step_name}",
            User::find($userId),
            [
                'workflow_instance_id' => $this->workflow_instance_id,
                'step_id' => $this->step_id,
                'comments' => $comments,
            ]
        );

        return $this;
    }

    /**
     * Reject the step
     */
    public function reject($userId, $comments = null, $metadata = [])
    {
        $this->update([
            'status' => 'rejected',
            'responded_at' => now(),
            'comments' => $comments,
            'decision_metadata' => $metadata,
        ]);

        // Log the rejection action
        \App\Models\ActivityLog::logActivity(
            'workflow_step_rejected',
            "Rejected step: {$this->step->step_name}",
            User::find($userId),
            [
                'workflow_instance_id' => $this->workflow_instance_id,
                'step_id' => $this->step_id,
                'comments' => $comments,
            ]
        );

        return $this;
    }

    /**
     * Escalate the step
     */
    public function escalate($escalatedToUserId, $reason = null)
    {
        $this->update([
            'status' => 'escalated',
            'escalated_to' => $escalatedToUserId,
            'escalated_at' => now(),
            'comments' => $reason,
        ]);

        // Log the escalation action
        \App\Models\ActivityLog::logActivity(
            'workflow_step_escalated',
            "Escalated step: {$this->step->step_name}",
            User::find($escalatedToUserId),
            [
                'workflow_instance_id' => $this->workflow_instance_id,
                'step_id' => $this->step_id,
                'original_assignee' => $this->assigned_to,
                'reason' => $reason,
            ]
        );

        return $this;
    }

    /**
     * Skip the step (for optional steps)
     */
    public function skip($reason = null)
    {
        $this->update([
            'status' => 'skipped',
            'responded_at' => now(),
            'comments' => $reason,
        ]);

        return $this;
    }

    /**
     * Get time remaining for this step before escalation
     */
    public function getTimeRemaining()
    {
        if (!$this->step->timeout_hours || !$this->assigned_at) {
            return null;
        }

        $timeoutAt = $this->assigned_at->addHours($this->step->timeout_hours);
        $now = now();

        if ($now->isAfter($timeoutAt)) {
            return null; // Already overdue
        }

        return $timeoutAt->diff($now);
    }

    /**
     * Scope for pending steps
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope for approved steps
     */
    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    /**
     * Scope for rejected steps
     */
    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    /**
     * Scope for overdue steps
     */
    public function scopeOverdue($query)
    {
        return $query->where('status', 'pending')
                     ->whereHas('step', function ($q) {
                         $q->whereNotNull('timeout_hours');
                     })
                     ->whereNotNull('assigned_at')
                     ->whereRaw('assigned_at + INTERVAL timeout_hours HOUR < NOW()');
    }

    /**
     * Scope for steps assigned to a user
     */
    public function scopeAssignedTo($query, $userId)
    {
        return $query->where('assigned_to', $userId);
    }
}