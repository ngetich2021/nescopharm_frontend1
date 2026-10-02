<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Dispatch extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'dispatch_number',
        'from_store_id',
        'to_entity',
        'to_user_id',
        'type',
        'notes',
        'acknowledged_by',
        'returned_by',
        'created_by',
    ];

    // Ensure proper casting for PostgreSQL dates
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Removed is_returnable and is_returned logic; now handled per item

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function fromStore()
    {
        return $this->belongsTo(Store::class, 'from_store_id');
    }

    public function toUser()
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function acknowledgedBy()
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

       public function dispatchItems()
    {
        return $this->hasMany(\App\Models\DispatchItem::class);
    }

    public function variant()
    {
        return $this->belongsTo(\App\Models\ProductVariant::class, 'variant_id');
    }

    /**
     * Always return the short dispatch number when accessing dispatch_number
     */
    public function getDispatchNumberAttribute($value)
    {
        // If dispatch_number is like DSP-853b296e-0074, return DSP-0074
        if (preg_match('/^(DSP)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }


}
