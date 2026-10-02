<?php

namespace App\Models;

use App\Services\TaxCompliance\EtimsTaxType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class InvoiceLineItem extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'invoice_id',
        'product_id',
        'variant_id',
        'description',
        'quantity',
        'unit',
        'batch_number',
        'expiry_date',
        'unit_price',
        'discount_amount',
        'tax_rate',
        'tax_amount',
        'line_total',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'expiry_date' => 'date',
        'unit_price' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'etims_tax_type_code',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            
            // Calculate line total and tax amount
            $model->calculateTotals();
        });

        static::updating(function ($model) {
            // Recalculate totals when relevant fields change
            if ($model->isDirty(['quantity', 'unit_price', 'discount_amount', 'tax_rate'])) {
                $model->calculateTotals();
            }
        });
    }

    // Relationships
    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    // Helper methods
    public function calculateTotals()
    {
        $subtotal = $this->quantity * $this->unit_price;
        $discountedSubtotal = $subtotal - $this->discount_amount;
        $this->tax_amount = $discountedSubtotal * ($this->tax_rate / 100);
        $this->line_total = $discountedSubtotal + $this->tax_amount;
    }

    public function itemCode(): ?string
    {
        return $this->variant?->sku ?: ($this->product?->product_code ?: $this->product?->sku);
    }

    public function unitPriceInclTax(): float
    {
        return (float) $this->unit_price * (1 + (float) $this->tax_rate / 100);
    }

    public function getSubtotalAttribute()
    {
        return $this->quantity * $this->unit_price;
    }

    public function getDiscountedSubtotalAttribute()
    {
        return $this->subtotal - $this->discount_amount;
    }

    public function getEtimsTaxTypeCodeAttribute(): string
    {
        return EtimsTaxType::fromInput(
            data_get($this->metadata, 'etims_tax_type_code'),
            $this->tax_rate,
        );
    }
}
