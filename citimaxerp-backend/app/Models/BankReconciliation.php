<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class BankReconciliation extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'company_id',
        'bank_account_id',
        'reconciliation_reference',
        'statement_date',
        'reconciliation_date',
        'opening_balance',
        'closing_balance',
        'statement_balance',
        'book_balance',
        'difference',
        'status',
        'notes',
        'reconciliation_summary',
        'reconciled_by',
        'reviewed_by',
        'completed_at',
        'reviewed_at',
        'created_by',
    ];

    protected $casts = [
        'statement_date' => 'date',
        'reconciliation_date' => 'date',
        'opening_balance' => 'decimal:2',
        'closing_balance' => 'decimal:2',
        'statement_balance' => 'decimal:2',
        'book_balance' => 'decimal:2',
        'difference' => 'decimal:2',
        'reconciliation_summary' => 'array',
        'completed_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    /**
     * Get the company that owns this reconciliation.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the bank account for this reconciliation.
     */
    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    /**
     * Get the user who performed the reconciliation.
     */
    public function reconciler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reconciled_by');
    }

    /**
     * Get the user who reviewed the reconciliation.
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Get the user who created this reconciliation.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get all reconciliation items.
     */
    public function items(): HasMany
    {
        return $this->hasMany(ReconciliationItem::class, 'reconciliation_id');
    }

    /**
     * Check if reconciliation is balanced.
     */
    public function isBalanced(): bool
    {
        return abs($this->difference) < 0.01; // Allow for minor rounding differences
    }

    /**
     * Calculate the reconciliation difference.
     */
    public function calculateDifference(): float
    {
        return $this->statement_balance - $this->book_balance;
    }

    /**
     * Mark reconciliation as completed.
     */
    public function complete(): void
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
            'difference' => $this->calculateDifference(),
        ]);
    }

    /**
     * Mark reconciliation as reviewed.
     */
    public function review(User $reviewer): void
    {
        $this->update([
            'status' => 'reviewed',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);
    }

    /**
     * Get reconciliation statistics.
     */
    public function getStats(): array
    {
        $items = $this->items;
        
        return [
            'total_items' => $items->count(),
            'matched_items' => $items->where('status', 'matched')->count(),
            'unmatched_items' => $items->where('status', 'unmatched')->count(),
            'outstanding_items' => $items->where('status', 'outstanding')->count(),
            'disputed_items' => $items->where('status', 'disputed')->count(),
            'match_percentage' => $items->count() > 0 
                ? round(($items->where('status', 'matched')->count() / $items->count()) * 100, 2)
                : 0,
        ];
    }

    /**
     * Scope to get reconciliations by status.
     */
    public function scopeWithStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to get completed reconciliations.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope to get reconciliations within date range.
     */
    public function scopeInDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('statement_date', [$startDate, $endDate]);
    }
}
