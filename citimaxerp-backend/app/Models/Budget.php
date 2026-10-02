<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Budget extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'company_id',
        'financial_period_id',
        'name',
        'code',
        'description',
        'budget_type',
        'status',
        'total_amount',
        'department_id',
        'project_id',
        'approved_by',
        'approved_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'approved_at' => 'datetime',
    ];

    /**
     * Get the company that owns this budget.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the financial period for this budget.
     */
    public function financialPeriod(): BelongsTo
    {
        return $this->belongsTo(FinancialPeriod::class);
    }

    /**
     * Get the user who approved this budget.
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Get the user who created this budget.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this budget.
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Get all line items for this budget.
     */
    public function lineItems(): HasMany
    {
        return $this->hasMany(BudgetLineItem::class);
    }

    /**
     * Check if budget is approved.
     */
    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    /**
     * Check if budget is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Approve the budget.
     */
    public function approve(User $user): void
    {
        $this->update([
            'status' => 'approved',
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);
    }

    /**
     * Activate the budget.
     */
    public function activate(): void
    {
        $this->update(['status' => 'active']);
    }

    /**
     * Calculate total budgeted amount from line items.
     */
    public function calculateTotalBudgeted(): float
    {
        return $this->lineItems()->sum('budgeted_amount');
    }

    /**
     * Calculate total actual amount from line items.
     */
    public function calculateTotalActual(): float
    {
        return $this->lineItems()->sum('actual_amount');
    }

    /**
     * Calculate total variance from line items.
     */
    public function calculateTotalVariance(): float
    {
        return $this->calculateTotalActual() - $this->calculateTotalBudgeted();
    }

    /**
     * Calculate variance percentage.
     */
    public function calculateVariancePercentage(): float
    {
        $budgeted = $this->calculateTotalBudgeted();
        
        if ($budgeted == 0) {
            return 0;
        }

        return ($this->calculateTotalVariance() / $budgeted) * 100;
    }

    /**
     * Update total amount based on line items.
     */
    public function updateTotalAmount(): void
    {
        $this->update(['total_amount' => $this->calculateTotalBudgeted()]);
    }

    /**
     * Get budget utilization percentage.
     */
    public function getUtilizationPercentage(): float
    {
        $budgeted = $this->calculateTotalBudgeted();
        
        if ($budgeted == 0) {
            return 0;
        }

        return ($this->calculateTotalActual() / $budgeted) * 100;
    }

    /**
     * Check if budget is over budget.
     */
    public function isOverBudget(): bool
    {
        return $this->calculateTotalActual() > $this->calculateTotalBudgeted();
    }

    /**
     * Get remaining budget amount.
     */
    public function getRemainingAmount(): float
    {
        return $this->calculateTotalBudgeted() - $this->calculateTotalActual();
    }

    /**
     * Scope to get budgets by status.
     */
    public function scopeWithStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to filter by budget type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('budget_type', $type);
    }

    /**
     * Scope to get approved budgets.
     */
    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    /**
     * Scope to get active budgets.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
