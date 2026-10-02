<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerApproval extends Model
{
    protected $table = 'customer_approvals';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'customer_id',
        'approval_type',
        'status',
        'approved_by',
        'approved_at',
        'notes',
        'company_id',
        'created_by',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
    ];

    public function isPending()
    {
        return $this->status === 'pending';
    }

    public function isApproved()
    {
        return $this->status === 'approved';
    }

    public function isRejected()
    {
        return $this->status === 'rejected';
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
