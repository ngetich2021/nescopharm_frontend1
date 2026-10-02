<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class AccountsReceivable extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'customer_id',
        'invoice_number',
        'invoice_date',
        'due_date',
        'total_amount',
        'paid_amount',
        'balance_amount',
        'status',
        'description',
        'payment_terms',
        'discount_amount',
        'tax_amount',
        'currency',
        'exchange_rate',
        'order_id',
        'is_recurring',
        'recurring_frequency',
        'next_recurring_date',
        'created_by',
        'sent_at',
        'viewed_at',
        'line_items',
        'metadata',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'due_date' => 'date',
        'total_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'balance_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'exchange_rate' => 'decimal:4',
        'is_recurring' => 'boolean',
        'next_recurring_date' => 'date',
        'sent_at' => 'datetime',
        'viewed_at' => 'datetime',
        'line_items' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });

        static::updating(function ($model) {
            // Auto-update balance when paid amount changes
            if ($model->isDirty('paid_amount')) {
                $model->balance_amount = $model->total_amount - $model->paid_amount;
                
                // Update status based on payment
                if ($model->balance_amount <= 0) {
                    $model->status = 'paid';
                } elseif ($model->paid_amount > 0) {
                    $model->status = $model->due_date < now() ? 'overdue' : 'sent';
                }
            }
        });
    }

    // Relationships
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payments()
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    // Helper methods
    public function isOverdue()
    {
        return $this->due_date < now() && $this->balance_amount > 0;
    }

    public function getDaysOverdueAttribute()
    {
        if (!$this->isOverdue()) {
            return 0;
        }
        
        return now()->diffInDays($this->due_date);
    }

    public function markAsSent()
    {
        $this->update([
            'status' => 'sent',
            'sent_at' => now(),
        ]);
    }

    public function markAsViewed()
    {
        if (!$this->viewed_at) {
            $this->update([
                'status' => 'viewed',
                'viewed_at' => now(),
            ]);
        }
    }

    public function generateNextRecurring()
    {
        if (!$this->is_recurring || !$this->next_recurring_date) {
            return null;
        }

        $nextDate = $this->next_recurring_date;
        $newDueDate = clone $nextDate;

        // Calculate next due date based on payment terms
        if ($this->payment_terms) {
            $days = (int) filter_var($this->payment_terms, FILTER_SANITIZE_NUMBER_INT);
            $newDueDate->addDays($days);
        } else {
            $newDueDate->addDays(30); // Default 30 days
        }

        // Calculate next recurring date
        $nextRecurringDate = clone $nextDate;
        switch ($this->recurring_frequency) {
            case 'weekly':
                $nextRecurringDate->addWeek();
                break;
            case 'monthly':
                $nextRecurringDate->addMonth();
                break;
            case 'quarterly':
                $nextRecurringDate->addMonths(3);
                break;
            case 'yearly':
                $nextRecurringDate->addYear();
                break;
        }

        return static::create([
            'company_id' => $this->company_id,
            'customer_id' => $this->customer_id,
            'invoice_date' => $nextDate,
            'due_date' => $newDueDate,
            'total_amount' => $this->total_amount,
            'description' => $this->description,
            'payment_terms' => $this->payment_terms,
            'discount_amount' => $this->discount_amount,
            'tax_amount' => $this->tax_amount,
            'currency' => $this->currency,
            'exchange_rate' => $this->exchange_rate,
            'is_recurring' => true,
            'recurring_frequency' => $this->recurring_frequency,
            'next_recurring_date' => $nextRecurringDate,
            'created_by' => $this->created_by,
            'line_items' => $this->line_items,
            'metadata' => $this->metadata,
        ]);
    }

    // Scopes
    public function scopeOverdue($query)
    {
        return $query->where('due_date', '<', now())
                    ->where('balance_amount', '>', 0);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByCustomer($query, $customerId)
    {
        return $query->where('customer_id', $customerId);
    }

    public function scopeRecurring($query)
    {
        return $query->where('is_recurring', true);
    }

    public function scopeDueForRecurring($query)
    {
        return $query->where('is_recurring', true)
                    ->where('next_recurring_date', '<=', now());
    }

    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('invoice_date', [$startDate, $endDate]);
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsRecurringAttribute($value)
    {
        $this->attributes['is_recurring'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

}
