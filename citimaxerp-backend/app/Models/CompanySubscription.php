<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Carbon\Carbon;

class CompanySubscription extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'subscription_plan_id',
        'status',
        'start_date',
        'end_date',
        'trial_end_date',
        'amount',
        'currency',
        'billing_cycle',
        'next_billing_date',
        'auto_renew',
        'cancelled_at',
        'cancellation_reason',
        'cancelled_by',
        'metadata',
    ];

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'subscription_plan_id' => 'string',
        'cancelled_by' => 'string',
        'start_date' => 'date',
        'end_date' => 'date',
        'trial_end_date' => 'date',
        'next_billing_date' => 'date',
        'amount' => 'decimal:2',
        'auto_renew' => 'boolean',
        'cancelled_at' => 'datetime',
        'metadata' => 'array',
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
     * Get the company that owns this subscription.
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the subscription plan.
     */
    public function subscriptionPlan()
    {
        return $this->belongsTo(SubscriptionPlan::class);
    }

    /**
     * Get the user who cancelled the subscription.
     */
    public function cancelledBy()
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /**
     * Get all payments for this subscription.
     */
    public function payments()
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    /**
     * Get successful payments for this subscription.
     */
    public function successfulPayments()
    {
        return $this->hasMany(SubscriptionPayment::class)->where('status', 'completed');
    }

    /**
     * Check if the subscription is active.
     */
    public function isActive()
    {
        return $this->status === 'active' && $this->end_date->isFuture();
    }

    /**
     * Check if the subscription is in trial period.
     */
    public function isInTrial()
    {
        return $this->status === 'trial' && 
               $this->trial_end_date && 
               $this->trial_end_date->isFuture();
    }

    /**
     * Check if the subscription has expired.
     */
    public function isExpired()
    {
        return $this->end_date->isPast();
    }

    /**
     * Check if the subscription is cancelled.
     */
    public function isCancelled()
    {
        return in_array($this->status, ['cancelled', 'expired']);
    }

    /**
     * Get days remaining in subscription.
     */
    public function getDaysRemainingAttribute()
    {
        if ($this->isExpired()) {
            return 0;
        }
        
        return Carbon::today()->diffInDays($this->end_date, false);
    }

    /**
     * Get days remaining in trial.
     */
    public function getTrialDaysRemainingAttribute()
    {
        if (!$this->trial_end_date || $this->trial_end_date->isPast()) {
            return 0;
        }
        
        return Carbon::today()->diffInDays($this->trial_end_date, false);
    }

    /**
     * Cancel the subscription.
     */
    public function cancel($reason = null, $cancelledBy = null)
    {
        $this->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancellation_reason' => $reason,
            'cancelled_by' => $cancelledBy,
            'auto_renew' => false,
        ]);
    }

    /**
     * Suspend the subscription.
     */
    public function suspend()
    {
        $this->update([
            'status' => 'suspended',
        ]);
    }

    /**
     * Reactivate the subscription.
     */
    public function reactivate()
    {
        $this->update([
            'status' => 'active',
        ]);
    }

    /**
     * Calculate next billing date based on billing cycle.
     */
    public function calculateNextBillingDate($fromDate = null)
    {
        $date = $fromDate ? Carbon::parse($fromDate) : Carbon::now();
        
        return match ($this->billing_cycle) {
            'monthly' => $date->addMonth(),
            'quarterly' => $date->addMonths(3),
            'semi_annual' => $date->addMonths(6),
            'annual' => $date->addYear(),
            default => $date->addMonth(),
        };
    }

    /**
     * Scope to get active subscriptions.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope to get trial subscriptions.
     */
    public function scopeTrial($query)
    {
        return $query->where('status', 'trial');
    }

    /**
     * Scope to get expired subscriptions.
     */
    public function scopeExpired($query)
    {
        return $query->where('end_date', '<', Carbon::today());
    }

    /**
     * Scope to get subscriptions expiring soon.
     */
    public function scopeExpiringSoon($query, $days = 7)
    {
        $futureDate = Carbon::today()->addDays($days);
        return $query->where('end_date', '<=', $futureDate)
                    ->where('end_date', '>=', Carbon::today());
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setAutoRenewAttribute($value)
    {
        $this->attributes['auto_renew'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

    // Scopes for PostgreSQL boolean queries
    public function scopeAutoRenewing($query)
    {
        return $query->whereRaw('auto_renew = true');
    }

}
