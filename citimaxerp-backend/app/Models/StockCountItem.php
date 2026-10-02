<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockCountItem extends Model
{
    protected $table = 'stock_count_items';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'company_id',
        'store_id',
        'stock_count_id',
        'product_id',
        'variant_id',
        'product_name',
        'product_sku',
        'product_category',
        'unit_cost',
        'expected_quantity',
        'counted_quantity',
        'counted_by',
        'counted_at',
        'notes',
        'is_counted',
        'requires_recount',
    ];

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'store_id' => 'string',
        'stock_count_id' => 'string',
        'product_id' => 'string',
        'variant_id' => 'string',
        'unit_cost' => 'decimal:2',
        'expected_quantity' => 'integer',
        'counted_quantity' => 'integer',
        'variance_quantity' => 'integer',
        'variance_value' => 'decimal:2',
        'counted_at' => 'datetime',
        'is_counted' => 'boolean',
        'requires_recount' => 'boolean',
        'is_variance' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function stockCount()
    {
        return $this->belongsTo(StockCount::class, 'stock_count_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsCountedAttribute($value)
    {
        $this->attributes['is_counted'] = ($value === true || $value === 'true' || $value === 1 || $value === '1') ? 'true' : 'false';
    }

    public function setRequiresRecountAttribute($value)
    {
        $this->attributes['requires_recount'] = ($value === true || $value === 'true' || $value === 1 || $value === '1') ? 'true' : 'false';
    }

}
