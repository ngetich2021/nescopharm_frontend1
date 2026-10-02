<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetLineItem extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'budget_id',
        'chart_of_account_id',
        'description',
        'budgeted_amount',
        'actual_amount',
        'committed_amount',
        'variance',
        'variance_percentage',
        'monthly_breakdown',
        'notes',
    ];

    protected $casts = [
        'budgeted_amount' => 'decimal:2',
        'actual_amount' => 'decimal:2',
        'committed_amount' => 'decimal:2',
        'variance' => 'decimal:2',
        'variance_percentage' => 'decimal:2',
        'monthly_breakdown' => 'array',
    ];

    /**
     * Get the budget that owns this line item.
     */
    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class);
    }

    /**
     * Get the chart of account for this line item.
     */
    public function chartOfAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class);
    }

    /**
     * Calculate variance from budgeted vs actual.
     */
    public function calculateVariance(): float
    {
        return $this->actual_amount - $this->budgeted_amount;
    }

    /**
     * Calculate variance percentage.
     */
    public function calculateVariancePercentage(): float
    {
        if ($this->budgeted_amount == 0) {
            return 0;
        }

        return ($this->calculateVariance() / $this->budgeted_amount) * 100;
    }

    /**
     * Update variance fields.
     */
    public function updateVariance(): void
    {
        $this->update([
            'variance' => $this->calculateVariance(),
            'variance_percentage' => $this->calculateVariancePercentage(),
        ]);
    }

    /**
     * Get available amount (budgeted - actual - committed).
     */
    public function getAvailableAmount(): float
    {
        return $this->budgeted_amount - $this->actual_amount - $this->committed_amount;
    }

    /**
     * Get utilization percentage.
     */
    public function getUtilizationPercentage(): float
    {
        if ($this->budgeted_amount == 0) {
            return 0;
        }

        return ($this->actual_amount / $this->budgeted_amount) * 100;
    }

    /**
     * Check if line item is over budget.
     */
    public function isOverBudget(): bool
    {
        return $this->actual_amount > $this->budgeted_amount;
    }

    /**
     * Check if line item has favorable variance.
     */
    public function hasFavorableVariance(): bool
    {
        // For expense accounts, lower actual is favorable
        // For revenue accounts, higher actual is favorable
        $accountType = $this->chartOfAccount->account_type ?? 'expense';
        
        if (in_array($accountType, ['revenue', 'income'])) {
            return $this->calculateVariance() > 0;
        } else {
            return $this->calculateVariance() < 0;
        }
    }

    /**
     * Get monthly budget for a specific month.
     */
    public function getMonthlyBudget(int $month): float
    {
        $breakdown = $this->monthly_breakdown ?? [];
        
        return $breakdown[$month] ?? 0;
    }

    /**
     * Set monthly budget for a specific month.
     */
    public function setMonthlyBudget(int $month, float $amount): void
    {
        $breakdown = $this->monthly_breakdown ?? [];
        $breakdown[$month] = $amount;
        
        $this->update(['monthly_breakdown' => $breakdown]);
    }

    /**
     * Scope to get line items that are over budget.
     */
    public function scopeOverBudget($query)
    {
        return $query->whereRaw('actual_amount > budgeted_amount');
    }

    /**
     * Scope to get line items with favorable variance.
     */
    public function scopeFavorableVariance($query)
    {
        return $query->whereRaw('actual_amount < budgeted_amount');
    }

    /**
     * Scope to get line items with unfavorable variance.
     */
    public function scopeUnfavorableVariance($query)
    {
        return $query->whereRaw('actual_amount > budgeted_amount');
    }
}
