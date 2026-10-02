<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ProductPriceHistory extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'product_price_histories';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    // Disable updated_at since we only track creation
    const UPDATED_AT = null;

    protected $fillable = [
        'id',
        'company_id',
        'product_id',
        'variant_id',
        'packaging_unit_id',
        'receipt_item_id',
        'price_type',
        'old_value',
        'new_value',
        'change_amount',
        'change_percentage',
        'changed_by',
        'change_reason',
        'source',
        'source_reference',
        'metadata',
        'created_at',
    ];

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'product_id' => 'string',
        'variant_id' => 'string',
        'packaging_unit_id' => 'string',
        'receipt_item_id' => 'string',
        'old_value' => 'decimal:2',
        'new_value' => 'decimal:2',
        'change_amount' => 'decimal:2',
        'change_percentage' => 'decimal:2',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Price types that can be tracked
     */
    const PRICE_TYPE_SELLING_PRICE = 'selling_price';
    const PRICE_TYPE_COST = 'cost';
    const PRICE_TYPE_UNIT_COST = 'unit_cost';
    const PRICE_TYPE_LAST_PRICE = 'last_price';
    const PRICE_TYPE_UNIT_PRICE = 'unit_price';
    const PRICE_TYPE_PRICE_PER_UNIT = 'price_per_unit';
    const PRICE_TYPE_COST_PER_UNIT = 'cost_per_unit';

    /**
     * Source types for price changes
     */
    const SOURCE_MANUAL_UPDATE = 'manual_update';
    const SOURCE_RECEIPT = 'receipt';
    const SOURCE_BULK_IMPORT = 'bulk_import';
    const SOURCE_API = 'api';
    const SOURCE_SYSTEM = 'system';

    /**
     * Relationships
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function packagingUnit()
    {
        return $this->belongsTo(ProductPackagingUnit::class);
    }

    public function receiptItem()
    {
        return $this->belongsTo(ProductReceiptItem::class);
    }

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    /**
     * Scopes
     */
    public function scopeForProduct($query, $productId)
    {
        return $query->where('product_id', $productId);
    }

    public function scopeForVariant($query, $variantId)
    {
        return $query->where('variant_id', $variantId);
    }

    public function scopeForPackagingUnit($query, $packagingUnitId)
    {
        return $query->where('packaging_unit_id', $packagingUnitId);
    }

    public function scopeByPriceType($query, $priceType)
    {
        return $query->where('price_type', $priceType);
    }

    public function scopeBySource($query, $source)
    {
        return $query->where('source', $source);
    }

    public function scopeRecent($query, $days = 30)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    public function scopePriceIncreases($query)
    {
        return $query->whereRaw('new_value > old_value');
    }

    public function scopePriceDecreases($query)
    {
        return $query->whereRaw('new_value < old_value');
    }

    /**
     * Get human-readable price type label
     */
    public function getPriceTypeLabel()
    {
        $labels = [
            self::PRICE_TYPE_SELLING_PRICE => 'Selling Price',
            self::PRICE_TYPE_COST => 'Cost',
            self::PRICE_TYPE_UNIT_COST => 'Unit Cost',
            self::PRICE_TYPE_LAST_PRICE => 'Last Price',
            self::PRICE_TYPE_UNIT_PRICE => 'Unit Price',
            self::PRICE_TYPE_PRICE_PER_UNIT => 'Price Per Unit',
            self::PRICE_TYPE_COST_PER_UNIT => 'Cost Per Unit',
        ];

        return $labels[$this->price_type] ?? $this->price_type;
    }

    /**
     * Get formatted change with sign
     */
    public function getFormattedChange()
    {
        $sign = $this->change_amount >= 0 ? '+' : '';
        return $sign . number_format($this->change_amount, 2);
    }

    /**
     * Get formatted percentage change with sign
     */
    public function getFormattedPercentageChange()
    {
        if ($this->change_percentage === null) {
            return 'N/A';
        }
        $sign = $this->change_percentage >= 0 ? '+' : '';
        return $sign . number_format($this->change_percentage, 2) . '%';
    }

    /**
     * Check if price increased
     */
    public function isPriceIncrease()
    {
        return $this->change_amount > 0;
    }

    /**
     * Check if price decreased
     */
    public function isPriceDecrease()
    {
        return $this->change_amount < 0;
    }

    /**
     * Get the entity that was changed (product, variant, or packaging unit)
     */
    public function getChangedEntity()
    {
        if ($this->packaging_unit_id) {
            return $this->packagingUnit;
        }
        if ($this->variant_id) {
            return $this->variant;
        }
        if ($this->product_id) {
            return $this->product;
        }
        return null;
    }

    /**
     * Get entity type name
     */
    public function getEntityTypeName()
    {
        if ($this->packaging_unit_id) {
            return 'Packaging Unit';
        }
        if ($this->variant_id) {
            return 'Product Variant';
        }
        if ($this->product_id) {
            return 'Product';
        }
        return 'Unknown';
    }
}
