<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerAccountApproval extends Model
{
    protected $table = 'customer_account_approvals';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'customer_account_id',
        'approved_by',
        'approved_at',
        'status',
        'notes',
        'company_id',
        'created_by',
        'approval_type',
        'previous_credit_limit',
        'new_credit_limit',
        'previous_credit_days',
        'new_credit_days',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'json',
        'previous_credit_limit' => 'decimal:2',
        'new_credit_limit' => 'decimal:2',
        'previous_credit_days' => 'integer',
        'new_credit_days' => 'integer',
        'approved_at' => 'datetime',
    ];

    /**
     * Check if this approval is pending
     */
    public function isPending()
    {
        return $this->status === 'pending';
    }

    /**
     * Check if this approval is approved
     */
    public function isApproved()
    {
        return $this->status === 'approved';
    }

    /**
     * Check if this approval is rejected
     */
    public function isRejected()
    {
        return $this->status === 'rejected';
    }

    public function customerAccount()
    {
        return $this->belongsTo(CustomerAccount::class);
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
