<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class OrderDispatchItem extends Model
{
    use HasFactory;

    protected $table = 'order_dispatch_items';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'order_dispatch_id',
        'order_item_id',
        'product_id',
        'variant_id',
        'product_code',
        'quantity',
        'unit_id',
        'unit_quantity',
        'base_quantity',
        'packaging_breakdown',
        'batch_allocations',
        'packaging_notes',
        'delivered_quantity',
        'damaged_quantity',
        'delivery_notes',
    ];

    protected $casts = [
        'packaging_breakdown' => 'array',
        'batch_allocations' => 'array',
        'quantity' => 'integer',
        'delivered_quantity' => 'integer',
        'damaged_quantity' => 'integer',
        'unit_quantity' => 'decimal:4',
        'base_quantity' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Boot the model
     */
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
    public function orderDispatch()
    {
        return $this->belongsTo(OrderDispatch::class, 'order_dispatch_id');
    }

    public function orderItem()
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function unit()
    {
        // Unit model may not exist in all installations
        if (class_exists('App\Models\Unit')) {
            return $this->belongsTo(\App\Models\Unit::class);
        }
        return null;
    }

    /**
     * Check if item is fully delivered
     */
    public function isFullyDelivered()
    {
        return $this->delivered_quantity >= $this->quantity;
    }

    /**
     * Check if item has damages
     */
    public function hasDamages()
    {
        return $this->damaged_quantity > 0;
    }

    /**
     * Get remaining quantity to deliver
     */
    public function getRemainingQuantityAttribute()
    {
        return $this->quantity - $this->delivered_quantity;
    }
}
