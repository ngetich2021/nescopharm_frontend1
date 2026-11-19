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
        'account_id',
        'expense_number',
        'vendor_name',
        'description',
        'amount',
        'includes_vat',
        'vat_rate',
        'vat_amount',
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
        'includes_vat' => 'boolean',
        'vat_rate' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'expense_date' => 'date:Y-m-d',
        'is_recurring' => 'boolean',
        'tags' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        // Expenses made elsewhere (allowances, imports) name only a category: charge its account.
        static::saving(function (Expense $expense) {
            if (!$expense->account_id && $expense->category_id) {
                $expense->account_id = self::accountForCategory($expense->company_id, $expense->category_id);
            }
            // VAT inside the amount paid: 232,000 at 16% holds 32,000 VAT. Without it there is none.
            if ($expense->includes_vat) {
                $rate = (float) ($expense->vat_rate ?: self::DEFAULT_VAT_RATE);
                $expense->vat_rate = $rate;
                $expense->vat_amount = self::vatIn((float) $expense->amount, $rate);
            } else {
                $expense->vat_rate = null;
                $expense->vat_amount = 0;
            }
        });

        static::saved(function (Expense $expense) {
            if (!($expense->wasRecentlyCreated || $expense->wasChanged('status'))) {
                return;
            }
            $notifier = app(\App\Services\NotificationService::class);
            $amount = 'KES ' . number_format((float) $expense->amount, 2);
            $url = "/expenses/{$expense->id}";

            if ($expense->status === 'pending') {
                $creator = $expense->createdBy;
                $notifier->notifyPermission(
                    $expense->company_id,
                    ['can_approve_expenses'],
                    new \App\Notifications\SystemAlert(
                        'approval',
                        "Expense {$expense->expense_number} needs approval",
                        ($creator ? "{$creator->first_name} {$creator->last_name}" : 'Someone') . " recorded {$amount}" . ($expense->vendor_name ? " to {$expense->vendor_name}" : '') . '.',
                        $url,
                        ['type' => 'expense_pending', 'expense_id' => $expense->id],
                    ),
                    $expense->created_by,
                );
            } elseif (!$expense->wasRecentlyCreated && in_array($expense->status, ['approved', 'rejected'], true)) {
                $notifier->notifyDecision(
                    $expense->created_by,
                    "Expense {$expense->expense_number} ({$amount})",
                    $expense->status,
                    $url,
                    $expense->approved_by,
                    $expense->status === 'rejected' ? request()->input('rejection_reason') : null,
                );
            }
        });
    }

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

    public const DEFAULT_VAT_RATE = 16.0;

    /** The VAT inside a VAT-inclusive amount: 232,000 at 16% -> 32,000. */
    public static function vatIn(float $amount, float $rate = self::DEFAULT_VAT_RATE): float
    {
        return $rate > 0 ? round($amount * $rate / (100 + $rate), 2) : 0.0;
    }

    /**
     * The ledger account the expense is charged to (e.g. 6400 Transport under 6000 Expenses).
     */
    public function account()
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }

    /** The account a category posts to: its own mapping, else the company's general expense account. */
    public static function accountForCategory(?string $companyId, ?string $categoryId): ?string
    {
        if (!$companyId) {
            return null;
        }
        $base = \Illuminate\Support\Facades\DB::table('company_account_mappings')->where('company_id', $companyId)
            ->where('mapping_key', 'miscellaneous_expense')->where('is_active', true)->whereNotNull('chart_of_account_id');

        return ($categoryId ? (clone $base)->where('context_type', 'expense_category')->where('context_id', $categoryId)->value('chart_of_account_id') : null)
            ?? (clone $base)->whereNull('context_type')->value('chart_of_account_id');
    }

    /** The category that already posts to an account (the most used one), so category reports keep working. */
    public static function categoryForAccount(string $companyId, string $accountId): ?string
    {
        return \Illuminate\Support\Facades\DB::table('company_account_mappings as m')
            ->join('expense_categories as c', \Illuminate\Support\Facades\DB::raw('c.id::text'), '=', \Illuminate\Support\Facades\DB::raw('m.context_id::text'))
            ->where('m.company_id', $companyId)->where('m.mapping_key', 'miscellaneous_expense')->where('m.is_active', true)
            ->where('m.context_type', 'expense_category')->where('m.chart_of_account_id', $accountId)
            ->orderByRaw('(SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id) DESC')
            ->value('c.id');
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
            $this->attributes['is_recurring'] = ($value === true || $value === 1 || $value === '1' || $value === 'true') ? true : false;
        }
    }

    // Get boolean value as actual boolean when retrieving
    public function getIsRecurringAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

}
