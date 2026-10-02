<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model

{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'store_id',
        'category_id',
        'expense_number',
        'vendor_name',
        'description',
        'amount',
        'expense_date',
        'payment_method',
        'receipt_url',
        'notes',
        'is_recurring',
        'recurring_frequency',
        'tags',
        'status',
        'created_by',
        'approved_by',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'expense_date' => 'date:Y-m-d',
        'is_recurring' => 'boolean',
        'tags' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

        /**
     * Always return the short expense number when accessing expense_number
     */
    public function getExpenseNumberAttribute($value)
    {
        // If expense_number is like EXP-853b296e-0074, return EXP-0074
        if (preg_match('/^(EXP)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    /**
     * The attributes that should be appended to arrays.
     *
     * @var array
     */
    protected $appends = ['formatted_amount'];

    /**
     * Get the company that owns the expense.
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the store that the expense is associated with.
     */
    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * Get the category that the expense belongs to.
     */
    public function category()
    {
        return $this->belongsTo(ExpenseCategory::class, 'category_id');
    }

    /**
     * Get the user who created the expense.
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who approved the expense.
     */
    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Get the formatted amount.
     *
     * @return string
     */
    public function getFormattedAmountAttribute()
    {
        return number_format($this->amount, 2);
    }

    /**
     * Scope a query to only include expenses for a specific company.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $companyId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    /**
     * Scope a query to only include active expenses.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('status', '<>', 'rejected');
    }

    /**
     * Scope a query to filter by status.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  string  $status
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeWithStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsRecurringAttribute($value)
    {
        // Convert any truthy/falsy value to actual PostgreSQL boolean string
        if ($value === null) {
            $this->attributes['is_recurring'] = 'false'; // Store as string for PostgreSQL
        } else {
            $this->attributes['is_recurring'] = ($value === true || $value === 1 || $value === '1' || $value === 'true') ? 'true' : 'false';
        }
    }

    // Get boolean value as actual boolean when retrieving
    public function getIsRecurringAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

}
