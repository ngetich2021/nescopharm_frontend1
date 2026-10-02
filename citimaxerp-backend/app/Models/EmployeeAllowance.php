<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAllowance extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'employee_id',
        'company_id',
        'name',
        'type',
        'amount',
        'frequency',
        'is_taxable',
        'effective_from',
        'effective_to',
        'is_active',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'is_taxable' => 'boolean',
        'is_active' => 'boolean',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    /**
     * Get the employee this allowance belongs to.
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Get the company this allowance belongs to.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Scope to only active allowances.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereRaw('is_active = true');
    }

    /**
     * Scope to only allowance-type records.
     */
    public function scopeAllowances(Builder $query): Builder
    {
        return $query->where('type', 'allowance');
    }

    /**
     * Scope to only deduction-type records.
     */
    public function scopeDeductions(Builder $query): Builder
    {
        return $query->where('type', 'deduction');
    }

    /**
     * Scope to allowances applicable on a given date.
     */
    public function scopeApplicable(Builder $query, string $date): Builder
    {
        return $query->where(function (Builder $q) use ($date) {
                $q->whereNull('effective_from')
                    ->orWhere('effective_from', '<=', $date);
            })
            ->where(function (Builder $q) use ($date) {
                $q->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $date);
            });
    }
}
