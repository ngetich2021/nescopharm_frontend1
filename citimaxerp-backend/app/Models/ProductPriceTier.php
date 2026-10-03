<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ProductPriceTier extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'product_id',
        'variant_id',
        'tier_name',
        'item_code',
        'price',
        'unit_of_measure',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    protected $appends = ['code'];

    // The code staff type on quotes/orders/invoices, e.g. "NSPD 001"; just "NSPD" when no item code is set.
    public function getCodeAttribute(): string
    {
        return trim($this->tier_name . ' ' . ($this->item_code ?? ''));
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
