<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Services\TaxCompliance\EtimsTaxType;

class QuoteItem extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'quote_id',
        'product_id',
        'variant_id',
        'unit_id',
        'quantity',
        'unit_quantity',
        'base_quantity',
        'packaging_breakdown',
        'unit_price',
        'price_label',
        'price_unit',
        'total_price',
        'tax_type_code',
        'tax_rate',
        'company_id',
        'created_at',
        'updated_at',
    ];

    /**
     * The VAT rate is captured whenever a line is created or edited, so a
     * later change to the product's rate doesn't rewrite quotes already
     * issued. Re-saving the quote re-prices it at the current rate.
     */
    protected static function booted(): void
    {
        static::saving(function (QuoteItem $item) {
            $product = $item->product_id ? Product::with('vatCategory')->find($item->product_id) : null;
            $code = $product ? EtimsTaxType::forProduct($product) : 'D';
            $item->tax_type_code = $code;
            $item->tax_rate = EtimsTaxType::rate($code);
        });
    }

    protected $casts = [
        'id' => 'string',
        'quote_id' => 'string',
        'product_id' => 'string',
        'variant_id' => 'string',
        'unit_id' => 'string',
        'unit_quantity' => 'decimal:4',
        'base_quantity' => 'integer',
        'packaging_breakdown' => 'array',
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function quote()
    {
        return $this->belongsTo(Quote::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function packagingUnit()
    {
        return $this->belongsTo(\App\Models\ProductPackagingUnit::class, 'unit_id');
    }

    // The price-list code used (e.g. "NSPD 001"), else the product's item number.
    public function itemCode(): ?string
    {
        if ($this->price_label && preg_match('/\d/', $this->price_label)) {
            return $this->price_label;
        }
        return $this->product?->item_number !== null ? (string) $this->product?->item_number : null;
    }

    public function packSize(): string
    {
        if ($this->price_unit) {
            return $this->price_unit;
        }
        if ($this->packagingUnit) {
            return 'Per ' . strtolower($this->packagingUnit->unit_name);
        }
        return 'pcs';
    }

    /**
     * @return array{code: string, label: string, rate: float}
     */
    public function taxInfo(): array
    {
        $code = $this->tax_type_code
            ?: ($this->product ? EtimsTaxType::forProduct($this->product) : 'D');

        return ['code' => $code, 'label' => EtimsTaxType::label($code), 'rate' => EtimsTaxType::rate($code)];
    }

    public function netAmount(): float
    {
        return (float) $this->quantity * (float) $this->unit_price;
    }

    /**
     * Get display quantity with unit
     */
    public function getQuantityDisplayAttribute()
    {
        if ($this->unit_id && $this->packagingUnit) {
            return "{$this->unit_quantity} {$this->packagingUnit->unit_abbreviation}";
        }
        return (string) $this->quantity;
    }

    /**
     * Get packaging breakdown display
     */
    public function getPackagingBreakdownDisplayAttribute()
    {
        if ($this->packaging_breakdown && isset($this->packaging_breakdown['display_text'])) {
            return $this->packaging_breakdown['display_text'];
        }
        return null;
    }
}