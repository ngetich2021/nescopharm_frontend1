<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DispatchItem extends Model
{
    /**
     * Handle is_returnable boolean conversion for PostgreSQL
     */
    public function setIsReturnableAttribute($value)
    {
        if ($value === null) {
            $this->attributes['is_returnable'] = 'false';
        } else {
            $this->attributes['is_returnable'] = $value ? 'true' : 'false';
        }
    }

    /**
     * Get is_returnable as boolean when retrieving
     */
    public function getIsReturnableAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    /**
     * Handle is_returned boolean conversion for PostgreSQL
     */
    public function setIsReturnedAttribute($value)
    {
        if ($value === null) {
            $this->attributes['is_returned'] = 'false';
        } else {
            $this->attributes['is_returned'] = $value ? 'true' : 'false';
        }
    }

    /**
     * Get is_returned as boolean when retrieving
     */
    public function getIsReturnedAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }
    protected $table = 'dispatch_items';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'dispatch_id',
        'product_id',
        'variant_id',
        'batch_id',
        'quantity',
        'received_quantity',
        'notes',
        'is_returnable',
        'is_returned',
        'return_date',
        'returned_quantity',
        'return_notes',
        'reminder_status',
    ];

    protected $casts = [
        'is_returnable' => 'boolean',
        'is_returned' => 'boolean',
        'return_date' => 'date',
        'returned_quantity' => 'integer',
        'reminder_status' => 'array',
    ];

    public function dispatch()
    {
        return $this->belongsTo(Dispatch::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function batch()
    {
        return $this->belongsTo(InventoryBatch::class, 'batch_id');
    }
}
