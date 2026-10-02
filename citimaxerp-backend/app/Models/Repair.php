<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use Illuminate\Support\Str;

class Repair extends Model

{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'repair_number',
        'reported_by',
        'approver_id',
        'approved_at',
        'description',
        'notes',
        'status',
        'approval_status',
    ];


    protected $casts = [
        'approved_at' => 'datetime',
    ];

    // Status helpers
    public function isPending() { return $this->status === 'pending'; }
    public function isInProgress() { return $this->status === 'in_progress'; }
    public function isRepaired() { return $this->status === 'repaired'; }
    public function isCompleted() { return $this->status === 'completed'; }

    public function isApprovalPending() { return $this->approval_status === 'pending'; }
    public function isApproved() { return $this->approval_status === 'approved'; }
    public function isRejected() { return $this->approval_status === 'rejected'; }

    /**
     * Always return the short repair number when accessing repair_number
     */
    public function getRepairNumberAttribute($value)
    {
        // If repair_number is like REP-853b296e-0074, return REP-0074
        if (preg_match('/^(REP)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    public function items()
    {
        return $this->hasMany(RepairItem::class);
    }

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approver_id');
    }
    

}