<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class StockAdjustmentItem extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'stock_adjustment_id',
        'product_id',
        'variant_id',
        'batch_id',
        'unit_id',
        'store_id',
        'adjustment_type',
        'quantity_before',
        'quantity_adjusted',
        'quantity_after',
        'unit_cost',
        'total_cost',
        'unit_price',
        'total_value',
        'notes',
        'item_status',
        'error_message',
        'inventory_movement_id',
        'metadata',
    ];

    protected $casts = [
        'quantity_before' => 'integer',
        'quantity_adjusted' => 'integer',
        'quantity_after' => 'integer',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total_value' => 'decimal:2',
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
     * Relationships
     */
    public function stockAdjustment()
    {
        return $this->belongsTo(StockAdjustment::class);
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

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function inventoryMovement()
    {
        return $this->belongsTo(InventoryMovement::class, 'inventory_movement_id');
    }

    /**
     * Scopes
     */
    public function scopeForProduct($query, $productId)
    {
        return $query->where('product_id', $productId);
    }

    public function scopeByItemStatus($query, $status)
    {
        return $query->where('item_status', $status);
    }

    public function scopePending($query)
    {
        return $query->where('item_status', 'pending');
    }

    public function scopeApplied($query)
    {
        return $query->where('item_status', 'applied');
    }

    public function scopeFailed($query)
    {
        return $query->where('item_status', 'failed');
    }

    /**
     * Helper Methods
     */
    public function isPending()
    {
        return $this->item_status === 'pending';
    }

    public function isApplied()
    {
        return $this->item_status === 'applied';
    }

    public function isFailed()
    {
        return $this->item_status === 'failed';
    }

    public function isSkipped()
    {
        return $this->item_status === 'skipped';
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
     * Calculate financial impact for this item
     */
    public function calculateFinancialImpact()
    {
        $this->total_cost = $this->unit_cost ? ($this->quantity_adjusted * $this->unit_cost) : null;
        $this->total_value = $this->unit_price ? ($this->quantity_adjusted * $this->unit_price) : null;
        return $this;
    }

    /**
     * Mark item as applied
     */
    public function markAsApplied($inventoryMovementId = null)
    {
        $this->item_status = 'applied';
        if ($inventoryMovementId) {
            $this->inventory_movement_id = $inventoryMovementId;
        }
        $this->save();
        return $this;
    }

    /**
     * Mark item as failed
     */
    public function markAsFailed($errorMessage = null)
    {
        $this->item_status = 'failed';
        $this->error_message = $errorMessage;
        $this->save();
        return $this;
    }

    /**
     * Mark item as skipped
     */
    public function markAsSkipped($reason = null)
    {
        $this->item_status = 'skipped';
        $this->error_message = $reason;
        $this->save();
        return $this;
    }

    /**
     * Get the product name for display
     */
    public function getProductDisplayName()
    {
        $name = $this->product ? $this->product->name : 'Unknown Product';
        if ($this->variant) {
            $name .= ' - ' . $this->variant->name;
        }
        return $name;
    }
}
