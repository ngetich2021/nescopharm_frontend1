<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class BankAccount extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'company_id',
        'chart_of_account_id',
        'account_name',
        'account_number',
        'bank_name',
        'bank_code',
        'branch_name',
        'branch_code',
        'swift_code',
        'iban',
        'account_type',
        'currency_code',
        'current_balance',
        'available_balance',
        'is_active',
        'allow_overdraft',
        'overdraft_limit',
        'description',
        'bank_details',
        'last_reconciled_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'current_balance' => 'decimal:2',
        'available_balance' => 'decimal:2',
        'overdraft_limit' => 'decimal:2',
        'is_active' => 'boolean',
        'allow_overdraft' => 'boolean',
        'bank_details' => 'array',
        'last_reconciled_at' => 'datetime',
    ];

    /**
     * Get the company that owns the bank account.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the chart of account associated with this bank account.
     */
    public function chartOfAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class);
    }

    /**
     * Get the user who created this bank account.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this bank account.
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Get all transactions for this bank account.
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(BankTransaction::class);
    }

    /**
     * Get all reconciliations for this bank account.
     */
    public function reconciliations(): HasMany
    {
        return $this->hasMany(BankReconciliation::class);
    }

    /**
     * Calculate the balance based on transactions.
     */
    public function calculateBalance(): float
    {
        $credits = $this->transactions()
            ->where('transaction_type', 'credit')
            ->where('status', 'cleared')
            ->sum('amount');

        $debits = $this->transactions()
            ->where('transaction_type', 'debit')
            ->where('status', 'cleared')
            ->sum('amount');

        return $credits - $debits;
    }

    /**
     * Get available balance considering overdraft.
     */
    public function getAvailableBalanceAttribute(): float
    {
        $balance = $this->current_balance;
        
        if ($this->allow_overdraft) {
            return $balance + $this->overdraft_limit;
        }

        return max(0, $balance);
    }

    /**
     * Check if account is overdrawn.
     */
    public function isOverdrawn(): bool
    {
        return $this->current_balance < 0;
    }

    /**
     * Get the last reconciliation for this account.
     */
    public function lastReconciliation(): ?BankReconciliation
    {
        return $this->reconciliations()
            ->where('status', 'completed')
            ->latest('statement_date')
            ->first();
    }

    /**
     * Scope to get active bank accounts.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to filter by account type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('account_type', $type);
    }

    // Boolean mutators for PostgreSQL compatibility. PDO can bind a native PHP
    // bool as an integer, which Postgres rejects for a boolean column on insert,
    // so store the literal 'true'/'false' string instead (as elsewhere in the app).
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    public function setAllowOverdraftAttribute($value)
    {
        $this->attributes['allow_overdraft'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

}
