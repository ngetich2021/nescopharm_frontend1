<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TaxRate extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'description',
        'rate',
        'type',
        'calculation_method',
        'calculation_rules',
        'chart_of_account_id',
        'is_active',
        'is_default',
        'effective_from',
        'effective_to',
        'jurisdiction',
        'etims_tax_type_code',
        'applicable_to',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'rate' => 'decimal:4',
        'calculation_rules' => 'array',
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'applicable_to' => 'array',
    ];

    /**
     * Get the company that owns this tax rate.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the chart of account for tax payable.
     */
    public function chartOfAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class);
    }

    /**
     * Get the user who created this tax rate.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this tax rate.
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Calculate tax amount for a given base amount.
     */
    public function calculateTax(float $baseAmount): float
    {
        switch ($this->calculation_method) {
            case 'percentage':
                return $baseAmount * $this->rate;
            
            case 'fixed_amount':
                return $this->rate;
            
            case 'tiered':
                return $this->calculateTieredTax($baseAmount);
            
            default:
                return $baseAmount * $this->rate;
        }
    }

    /**
     * Calculate tiered tax based on rules.
     */
    private function calculateTieredTax(float $baseAmount): float
    {
        $rules = $this->calculation_rules ?? [];
        $tax = 0;

        foreach ($rules as $tier) {
            $min = $tier['min'] ?? 0;
            $max = $tier['max'] ?? PHP_FLOAT_MAX;
            $rate = $tier['rate'] ?? $this->rate;

            if ($baseAmount > $min) {
                $taxableAmount = min($baseAmount, $max) - $min;
                $tax += $taxableAmount * $rate;
            }
        }

        return $tax;
    }

    /**
     * Check if tax rate is currently effective.
     */
    public function isEffective($date = null): bool
    {
        $date = $date ?? now()->toDateString();
        
        return $this->is_active && 
               $date >= $this->effective_from &&
               ($this->effective_to === null || $date <= $this->effective_to);
    }

    /**
     * Get the tax rate as a percentage.
     */
    public function getPercentageAttribute(): float
    {
        return $this->rate * 100;
    }

    /**
     * Scope to get active tax rates.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get effective tax rates for a given date.
     */
    public function scopeEffective($query, $date = null)
    {
        $date = $date ?? now()->toDateString();
        
        return $query->where('is_active', true)
                    ->where('effective_from', '<=', $date)
                    ->where(function ($q) use ($date) {
                        $q->whereNull('effective_to')
                          ->orWhere('effective_to', '>=', $date);
                    });
    }

    /**
     * Scope to filter by tax type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope to get default tax rates.
     */
    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

    public function setIsDefaultAttribute($value)
    {
        $this->attributes['is_default'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

}
