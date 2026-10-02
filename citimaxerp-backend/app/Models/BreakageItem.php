<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BreakageItem extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'breakage_items';

    protected $fillable = [
        'id',
        'breakage_id',
        'product_id',
        'variant_id',
        'quantity',
        'cause',
        'replacement_requested',
        'notes',
        'company_id',
        'image_path', // Path to uploaded image for breakage evidence
    ];

    protected $casts = [
        'replacement_requested' => 'boolean',
    ];

    // Add a mutator to ensure proper boolean handling for PostgreSQL
    public function setReplacementRequestedAttribute($value)
    {
        // Convert various representations to actual boolean
        if (is_string($value)) {
            $this->attributes['replacement_requested'] = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
        } else {
            $this->attributes['replacement_requested'] = (bool) $value;
        }
    }

    public function breakage()
    {
        return $this->belongsTo(Breakage::class, 'breakage_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }
}