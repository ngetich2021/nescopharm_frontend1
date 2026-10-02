<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class StockAdjustment extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'store_id',
        'adjustment_number',
        // New fields for parent-child structure
        'total_items',
        'total_quantity_adjusted',
        // Legacy fields (kept for backward compatibility with single-item adjustments)
        'product_id',
        'variant_id',
        'batch_id',
        'unit_id',
        'adjustment_type',
        'reason_type',
        'quantity_before',
        'quantity_adjusted',
        'quantity_after',
        'unit_cost',
        'total_cost',
        'unit_price',
        'total_value',
        'status',
        'created_by',
        'approved_by',
        'rejected_by',
        'approved_at',
        'rejected_at',
        'reason',
        'notes',
        'rejection_reason',
        'attachments',
        'metadata',
        'inventory_movement_id',
    ];

    protected $casts = [
        'quantity_before' => 'integer',
        'quantity_adjusted' => 'integer',
        'quantity_after' => 'integer',
        'total_items' => 'integer',
        'total_quantity_adjusted' => 'integer',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total_value' => 'decimal:2',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'attachments' => 'array',
        'metadata' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    /**
     * Always return the short adjustment number when accessing adjustment_number
     * ADJ-14fafcd8-0009 becomes ADJ-0009
     */
    public function getAdjustmentNumberAttribute($value)
    {
        // If adjustment_number is like ADJ-14fafcd8-0009, return ADJ-0009
        if (preg_match('/^(ADJ)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    /**
     * Relationships
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function batch()
    {
        return $this->belongsTo(InventoryBatch::class, 'batch_id');
    }

    public function unit()
    {
        return $this->belongsTo(ProductPackagingUnit::class, 'unit_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejectedBy()
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function inventoryMovement()
    {
        return $this->belongsTo(InventoryMovement::class, 'inventory_movement_id');
    }

    /**
     * Relationship to adjustment items (parent-child structure)
     */
    public function items()
    {
        return $this->hasMany(StockAdjustmentItem::class);
    }

    /**
     * Get pending items
     */
    public function pendingItems()
    {
        return $this->hasMany(StockAdjustmentItem::class)->where('item_status', 'pending');
    }

    /**
     * Get applied items
     */
    public function appliedItems()
    {
        return $this->hasMany(StockAdjustmentItem::class)->where('item_status', 'applied');
    }

    /**
     * Get failed items
     */
    public function failedItems()
    {
        return $this->hasMany(StockAdjustmentItem::class)->where('item_status', 'failed');
    }

    /**
     * Check if this adjustment has items (bulk adjustment)
     */
    public function hasItems()
    {
        return $this->total_items > 0 || $this->items()->exists();
    }

    /**
     * Check if this is a single-item adjustment (legacy)
     */
    public function isSingleItem()
    {
        return !$this->hasItems() && $this->product_id !== null;
    }

    /**
     * Update totals from items
     */
    public function updateTotals()
    {
        $items = $this->items;
        
        $this->total_items = $items->count();
        $this->total_quantity_adjusted = $items->sum('quantity_adjusted');
        $this->total_cost = $items->sum('total_cost');
        $this->total_value = $items->sum('total_value');
        
        $this->save();
        
        return $this;
    }

    /**
     * Scopes
     */
    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeForStore($query, $storeId)
    {
        return $query->where('store_id', $storeId);
    }

    public function scopeForProduct($query, $productId)
    {
        return $query->where('product_id', $productId);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByReasonType($query, $reasonType)
    {
        return $query->where('reason_type', $reasonType);
    }

    public function scopeByAdjustmentType($query, $adjustmentType)
    {
        return $query->where('adjustment_type', $adjustmentType);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeRecent($query, $days = 30)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    /**
     * Helper Methods
     */
    public function isPending()
    {
        return $this->status === 'pending';
    }

    public function isApproved()
    {
        return $this->status === 'approved';
    }

    public function isCompleted()
    {
        return $this->status === 'completed';
    }

    public function isRejected()
    {
        return $this->status === 'rejected';
    }

    public function isDraft()
    {
        return $this->status === 'draft';
    }

    public function canBeApproved()
    {
        return in_array($this->status, ['pending', 'draft']);
    }

    public function canBeRejected()
    {
        return in_array($this->status, ['pending', 'draft']);
    }

    public function getImpactSign()
    {
        return $this->quantity_adjusted >= 0 ? '+' : '-';
    }

    public function getAbsoluteAdjustment()
    {
        return abs($this->quantity_adjusted);
    }

    /**
     * Calculate financial impact
     */
    public function calculateFinancialImpact()
    {
        $this->total_cost = $this->unit_cost ? ($this->quantity_adjusted * $this->unit_cost) : null;
        $this->total_value = $this->unit_price ? ($this->quantity_adjusted * $this->unit_price) : null;
        return $this;
    }

    /**
     * Approve the adjustment
     */
    public function approve($userId)
    {
        $this->status = 'approved';
        $this->approved_by = $userId;
        $this->approved_at = now();
        $this->save();
        
        return $this;
    }

    /**
     * Reject the adjustment
     */
    public function reject($userId, $reason = null)
    {
        $this->status = 'rejected';
        $this->rejected_by = $userId;
        $this->rejected_at = now();
        $this->rejection_reason = $reason;
        $this->save();
        
        return $this;
    }

    /**
     * Complete the adjustment (apply to inventory)
     */
    public function complete()
    {
        if (!$this->isApproved()) {
            throw new \Exception('Only approved adjustments can be completed');
        }
        
        $this->status = 'completed';
        $this->save();
        
        return $this;
    }
}
