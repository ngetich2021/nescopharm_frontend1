<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Requisition extends Model

{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'requisitions';


    protected $fillable = [
        'id',
        'requisition_number',
        'company_id',
        'requester_id',
        'approval_status',
        'status',
        'approver_id',
        'dispatch_id',
        'notes',
    ];

    /**
     * Always return the short requisition number when accessing requisition_number
     */
    public function getRequisitionNumberAttribute($value)
    {
        // If requisition_number is like REQ-853b296e-0074, return REQ-0074
        if (preg_match('/^(REQ)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }
    
    // Relationships
    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }


    public function items()
    {
        return $this->hasMany(RequisitionItem::class, 'requisition_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}
