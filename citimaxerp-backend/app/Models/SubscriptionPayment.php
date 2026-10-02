<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SubscriptionPayment extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_subscription_id',
        'company_id',
        'payment_reference',
        'amount',
        'currency',
        'payment_method',
        'status',
        'payment_date',
        'period_start',
        'period_end',
        'payment_details',
        'failure_reason',
        'processed_by',
    ];

    protected $casts = [
        'id' => 'string',
        'company_subscription_id' => 'string',
        'company_id' => 'string',
        'processed_by' => 'string',
        'amount' => 'decimal:2',
        'payment_date' => 'date',
        'period_start' => 'date',
        'period_end' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    /**
     * Get the company subscription that owns this payment.
     */
    public function companySubscription()
    {
        return $this->belongsTo(CompanySubscription::class);
    }

    /**
     * Get the company that owns this payment.
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the user who processed this payment.
     */
    public function processedBy()
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    /**
     * Check if the payment is successful.
     */
    public function isSuccessful()
    {
        return $this->status === 'completed';
    }

    /**
     * Check if the payment is pending.
     */
    public function isPending()
    {
        return $this->status === 'pending';
    }

    /**
     * Check if the payment failed.
     */
    public function hasFailed()
    {
        return $this->status === 'failed';
    }

    /**
     * Mark payment as completed.
     */
    public function markAsCompleted($processedBy = null)
    {
        $this->update([
            'status' => 'completed',
            'processed_by' => $processedBy,
        ]);
    }

    /**
     * Mark payment as failed.
     */
    public function markAsFailed($reason = null)
    {
        $this->update([
            'status' => 'failed',
            'failure_reason' => $reason,
        ]);
    }

    /**
     * Get formatted amount for display.
     */
    public function getFormattedAmountAttribute()
    {
        return $this->currency . ' ' . number_format($this->amount, 2);
    }

    /**
     * Get payment method display name.
     */
    public function getPaymentMethodDisplayAttribute()
    {
        return match ($this->payment_method) {
            'mpesa' => 'M-Pesa',
            'bank_transfer' => 'Bank Transfer',
            'card' => 'Credit/Debit Card',
            'cash' => 'Cash',
            'other' => 'Other',
            default => ucfirst(str_replace('_', ' ', $this->payment_method)),
        };
    }

    /**
     * Get status display name.
     */
    public function getStatusDisplayAttribute()
    {
        return match ($this->status) {
            'pending' => 'Pending',
            'completed' => 'Completed',
            'failed' => 'Failed',
            'refunded' => 'Refunded',
            default => ucfirst($this->status),
        };
    }

    /**
     * Scope to get successful payments.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope to get pending payments.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope to get failed payments.
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    /**
     * Scope to get payments by method.
     */
    public function scopeByMethod($query, $method)
    {
        return $query->where('payment_method', $method);
    }
}
