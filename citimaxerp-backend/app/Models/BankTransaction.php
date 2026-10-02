<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class BankTransaction extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'company_id',
        'bank_account_id',
        'transaction_reference',
        'bank_reference',
        'transaction_type',
        'amount',
        'running_balance',
        'description',
        'payee_payer',
        'category',
        'transaction_date',
        'value_date',
        'status',
        'journal_entry_id',
        'reconciliation_id',
        'is_reconciled',
        'metadata',
        'imported_by',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'running_balance' => 'decimal:2',
        'transaction_date' => 'date',
        'value_date' => 'date',
        'is_reconciled' => 'boolean',
        'metadata' => 'array',
    ];

    /**
     * Get the company that owns this transaction.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the bank account for this transaction.
     */
    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    /**
     * Get the associated journal entry.
     */
    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    /**
     * Get the user who imported this transaction.
     */
    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    /**
     * Get the user who created this transaction.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Check if transaction is a debit.
     */
    public function isDebit(): bool
    {
        return $this->transaction_type === 'debit';
    }

    /**
     * Check if transaction is a credit.
     */
    public function isCredit(): bool
    {
        return $this->transaction_type === 'credit';
    }

    /**
     * Get the signed amount (negative for debits, positive for credits).
     */
    public function getSignedAmountAttribute(): float
    {
        return $this->isCredit() ? $this->amount : -$this->amount;
    }

    /**
     * Scope to get unreconciled transactions.
     */
    public function scopeUnreconciled($query)
    {
        return $query->where('is_reconciled', false);
    }

    /**
     * Scope to get transactions by type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('transaction_type', $type);
    }

    /**
     * Scope to get transactions by status.
     */
    public function scopeWithStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to get transactions within date range.
     */
    public function scopeInDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('transaction_date', [$startDate, $endDate]);
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsReconciledAttribute($value)
    {
        $this->attributes['is_reconciled'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

}
