<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReconciliationItem extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'reconciliation_id',
        'bank_transaction_id',
        'journal_entry_id',
        'item_type',
        'description',
        'amount',
        'transaction_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'transaction_date' => 'date',
    ];

    /**
     * Get the reconciliation that owns this item.
     */
    public function reconciliation(): BelongsTo
    {
        return $this->belongsTo(BankReconciliation::class);
    }

    /**
     * Get the associated bank transaction.
     */
    public function bankTransaction(): BelongsTo
    {
        return $this->belongsTo(BankTransaction::class);
    }

    /**
     * Get the associated journal entry.
     */
    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    /**
     * Check if item is matched.
     */
    public function isMatched(): bool
    {
        return $this->status === 'matched';
    }

    /**
     * Check if item is outstanding.
     */
    public function isOutstanding(): bool
    {
        return $this->status === 'outstanding';
    }

    /**
     * Mark item as matched.
     */
    public function markAsMatched(): void
    {
        $this->update(['status' => 'matched']);
    }

    /**
     * Mark item as outstanding.
     */
    public function markAsOutstanding(): void
    {
        $this->update(['status' => 'outstanding']);
    }

    /**
     * Scope to get matched items.
     */
    public function scopeMatched($query)
    {
        return $query->where('status', 'matched');
    }

    /**
     * Scope to get unmatched items.
     */
    public function scopeUnmatched($query)
    {
        return $query->where('status', 'unmatched');
    }

    /**
     * Scope to get outstanding items.
     */
    public function scopeOutstanding($query)
    {
        return $query->where('status', 'outstanding');
    }

    /**
     * Scope to filter by item type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('item_type', $type);
    }
}
