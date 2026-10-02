<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class AccountsPayable extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'vendor_id',
        'invoice_number',
        'vendor_invoice_number',
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
        'purchase_order_id',
        'created_by',
        'approved_by',
        'approved_at',
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
        'approved_at' => 'datetime',
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
                    $model->status = $model->due_date < now() ? 'overdue' : 'pending';
                }
            }
        });
    }

    // Relationships
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Supplier::class, 'vendor_id');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
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

    public function approve()
    {
        if ($this->status === 'approved') {
            throw new \Exception('Invoice is already approved');
        }

        $this->update([
            'status' => 'approved',
            'approved_by' => auth()->id(),
            'approved_at' => now(),
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

    public function scopeByVendor($query, $vendorId)
    {
        return $query->where('vendor_id', $vendorId);
    }

    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('invoice_date', [$startDate, $endDate]);
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }
}
