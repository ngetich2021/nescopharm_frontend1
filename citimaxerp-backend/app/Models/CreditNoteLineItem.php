<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CreditNoteLineItem extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'credit_note_id',
        'product_id',
        'variant_id',
        'description',
        'quantity',
        'unit',
        'unit_price',
        'discount_amount',
        'tax_rate',
        'tax_amount',
        'line_total',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
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
            $model->calculateTotals();
        });

        static::updating(function ($model) {
            if ($model->isDirty(['quantity', 'unit_price', 'discount_amount', 'tax_rate'])) {
                $model->calculateTotals();
            }
        });
    }

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function creditNote()
    {
        return $this->belongsTo(CreditNote::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    // -------------------------------------------------------------------------
    // Helper methods
    // -------------------------------------------------------------------------

    public function calculateTotals(): void
    {
        $subtotal = $this->quantity * $this->unit_price;
        $discountedSubtotal = $subtotal - ($this->discount_amount ?? 0);
        $this->tax_amount = (string) ($discountedSubtotal * (($this->tax_rate ?? 0) / 100));
        $this->line_total = (string) ($discountedSubtotal + $this->tax_amount);
    }

    public function getSubtotalAttribute(): float
    {
        return $this->quantity * $this->unit_price;
    }

    public function getDiscountedSubtotalAttribute(): float
    {
        return $this->subtotal - ($this->discount_amount ?? 0);
    }
}
