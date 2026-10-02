<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinancialPeriod extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'company_id',
        'name',
        'period_type',
        'start_date',
        'end_date',
        'status',
        'is_current',
        'description',
        'closed_by',
        'closed_at',
        'locked_by',
        'locked_at',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'is_current' => 'boolean',
        'closed_at' => 'datetime',
        'locked_at' => 'datetime',
    ];

    /**
     * Get the company that owns this financial period.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the user who closed this period.
     */
    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    /**
     * Get the user who locked this period.
     */
    public function lockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    /**
     * Get the user who created this period.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get all budgets for this period.
     */
    public function budgets(): HasMany
    {
        return $this->hasMany(Budget::class);
    }

    /**
     * Check if period is open.
     */
    public function isOpen(): bool
    {
        return $this->status === 'open';
    }

    /**
     * Check if period is closed.
     */
    public function isClosed(): bool
    {
        return $this->status === 'closed';
    }

    /**
     * Check if period is locked.
     */
    public function isLocked(): bool
    {
        return $this->status === 'locked';
    }

    /**
     * Check if period is current.
     */
    public function isCurrent(): bool
    {
        return $this->is_current;
    }

    /**
     * Close the financial period.
     */
    public function close(User $user): void
    {
        $this->update([
            'status' => 'closed',
            'closed_by' => $user->id,
            'closed_at' => now(),
        ]);
    }

    /**
     * Lock the financial period.
     */
    public function lock(User $user): void
    {
        $this->update([
            'status' => 'locked',
            'locked_by' => $user->id,
            'locked_at' => now(),
        ]);
    }

    /**
     * Reopen the financial period.
     */
    public function reopen(): void
    {
        $this->update([
            'status' => 'open',
            'closed_by' => null,
            'closed_at' => null,
            'locked_by' => null,
            'locked_at' => null,
        ]);
    }

    /**
     * Set as current period (and unset others).
     */
    public function setAsCurrent(): void
    {
        // Unset other current periods for the same company
        static::where('company_id', $this->company_id)
              ->where('id', '!=', $this->id)
              ->update(['is_current' => false]);

        $this->update(['is_current' => true]);
    }

    /**
     * Get the number of days in this period.
     */
    public function getDaysAttribute(): int
    {
        return $this->start_date->diffInDays($this->end_date) + 1;
    }

    /**
     * Check if a date falls within this period.
     */
    public function containsDate($date): bool
    {
        $date = is_string($date) ? \Carbon\Carbon::parse($date) : $date;
        
        return $date->between($this->start_date, $this->end_date);
    }

    /**
     * Scope to get open periods.
     */
    public function scopeOpen($query)
    {
        return $query->where('status', 'open');
    }

    /**
     * Scope to get closed periods.
     */
    public function scopeClosed($query)
    {
        return $query->where('status', 'closed');
    }

    /**
     * Scope to get current period.
     */
    public function scopeCurrent($query)
    {
        return $query->where('is_current', true);
    }

    /**
     * Scope to filter by period type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('period_type', $type);
    }

    /**
     * Scope to get periods containing a specific date.
     */
    public function scopeContainingDate($query, $date)
    {
        $date = is_string($date) ? \Carbon\Carbon::parse($date) : $date;
        
        return $query->where('start_date', '<=', $date)
                    ->where('end_date', '>=', $date);
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsCurrentAttribute($value)
    {
        $this->attributes['is_current'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

}
