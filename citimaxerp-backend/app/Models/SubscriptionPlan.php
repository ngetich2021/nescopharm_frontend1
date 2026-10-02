<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SubscriptionPlan extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'slug',
        'description',
        'price',
        'currency',
        'billing_cycle',
        'max_users',
        'max_companies',
        'is_active',
        'is_popular',
        'features',
        'limitations',
        'trial_days',
    ];

    protected $casts = [
        'id' => 'string',
        'price' => 'decimal:2',
        'max_users' => 'integer',
        'max_companies' => 'integer',
        'is_active' => 'boolean',
        'is_popular' => 'boolean',
        'features' => 'array',
        'limitations' => 'array',
        'trial_days' => 'integer',
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
     * Get all company subscriptions for this plan.
     */
    public function companySubscriptions()
    {
        return $this->hasMany(CompanySubscription::class);
    }

    /**
     * Get active company subscriptions for this plan.
     */
    public function activeSubscriptions()
    {
        return $this->hasMany(CompanySubscription::class)->where('status', 'active');
    }

    /**
     * Get the price formatted for display.
     */
    public function getFormattedPriceAttribute()
    {
        return $this->currency . ' ' . number_format($this->price, 2);
    }

    /**
     * Check if the plan has unlimited users.
     */
    public function hasUnlimitedUsers()
    {
        return is_null($this->max_users);
    }

    /**
     * Get the billing cycle display name.
     */
    public function getBillingCycleDisplayAttribute()
    {
        return match ($this->billing_cycle) {
            'monthly' => 'Monthly',
            'quarterly' => 'Quarterly',
            'semi_annual' => 'Semi-Annual',
            'annual' => 'Annual',
            default => ucfirst($this->billing_cycle),
        };
    }

    /**
     * Scope to get only active plans.
     */
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    /**
     * Scope to get popular plans.
     */
    public function scopePopular($query)
    {
        return $query->whereRaw('is_popular = true');
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

    public function setIsPopularAttribute($value)
    {
        $this->attributes['is_popular'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

}
