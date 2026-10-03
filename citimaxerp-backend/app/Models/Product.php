<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\HasProductImages;

use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Product extends Model
{
    use HasFactory, HasProductImages, HasUuids, SoftDeletes;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'store_id',
        'product_number',
        'item_number',
        'product_code',
        'name',
        'type',
        'description',
        'short_description',
        'price',
        'unit_cost',
        'shipping_cost',
        'logistics_cost',
        'margin_amount',
        'last_price',
        'stock_quantity',
        'low_stock_threshold',
        'category',
        'category_id', // Added relational category_id alongside legacy category string
        'sku',
        'barcode',
        'brand',
        'supplier',
        'supplier_id',
        'unit_of_measurement',
        'is_active',
        'is_featured',
        'is_digital',
        'is_taxable',
        'tax_rate',
        'hs_code',
        'income_account_id',
        'vat_category_id',
        'etims_item_class_code',
        'track_inventory',
        'has_packaging',
        'base_unit',
        'packaging_config',
        'weight',
        'length',
        'width',
        'height',
        'shipping_class',
        'image_url',
        'images',
        'primary_image_index',
        'has_variations',
        'tags',
        'created_at',
        'updated_at',
        'on_hand',
        'allocated',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'shipping_cost' => 'decimal:2',
        'logistics_cost' => 'decimal:2',
        'margin_amount' => 'decimal:2',
        'last_price' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'weight' => 'decimal:2',
        'length' => 'decimal:2',
        'width' => 'decimal:2',
        'height' => 'decimal:2',
        // Boolean fields - casts ensure PostgreSQL compatibility
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'is_digital' => 'boolean',
        'is_taxable' => 'boolean',
        'track_inventory' => 'boolean',
        'has_packaging' => 'boolean',
        'has_variations' => 'boolean',
        // Array/JSON fields
        'packaging_config' => 'array',
        'images' => 'array',
        'tags' => 'array',
        // Integer fields
        'on_hand' => 'integer',
        'allocated' => 'integer',
        'primary_image_index' => 'integer',
    ];

    protected $attributes = [
        'stock_quantity' => 0,
        'low_stock_threshold' => 10,
        'primary_image_index' => 0,
        'on_hand' => 0,
        'allocated' => 0,
    ];

    protected $appends = [
        'image_urls',
        'primary_image_url',
    ];

    protected static function booted(): void
    {
        static::creating(function (Product $product) {
            if (empty($product->item_number) && $product->company_id) {
                $product->item_number = (int) static::withTrashed()
                    ->where('company_id', $product->company_id)
                    ->max('item_number') + 1;
            }
        });
    }

    // Scopes for PostgreSQL boolean queries
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeFeatured($query)
    {
        return $query->whereRaw('is_featured = true');
    }

    public function scopeTaxable($query)
    {
        return $query->whereRaw('is_taxable = true');
    }

    public function scopeNonTaxable($query)
    {
        return $query->whereRaw('is_taxable = false');
    }

    public function scopeZeroRated($query)
    {
        return $query->whereRaw('is_taxable = true')->where('tax_rate', 0);
    }

    // Mutators for PostgreSQL boolean compatibility
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    public function setIsFeaturedAttribute($value)
    {
        $this->attributes['is_featured'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    public function setIsDigitalAttribute($value)
    {
        $this->attributes['is_digital'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    public function setIsTaxableAttribute($value)
    {
        $this->attributes['is_taxable'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    public function setTrackInventoryAttribute($value)
    {
        $this->attributes['track_inventory'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    public function setHasPackagingAttribute($value)
    {
        $this->attributes['has_packaging'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    public function setHasVariationsAttribute($value)
    {
        $this->attributes['has_variations'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }


    /**
     * Get the name attribute in Title Case
     */
    public function getNameAttribute($value)
    {
        return $value ? ucwords(strtolower($value)) : null;
    }

    /**
     * Set the name attribute to Title Case
     */
    public function setNameAttribute($value)
    {
        $this->attributes['name'] = $value ? ucwords(strtolower($value)) : null;
    }

    // Always return an array for images, never null
    public function getImagesAttribute($value)
    {
        // When using $casts = ['images' => 'array'], $value comes as the RAW database value (JSON string)
        // We need to decode it first, then ensure it's an array
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }

        // If already an array (shouldn't happen with casts, but just in case)
        return is_array($value) ? $value : [];
    }

    /**
     * Always return the short product number when accessing product_number
     */
    public function getProductNumberAttribute($value)
    {
        // If product_number is like PROD-853b296e-0074, return PROD-0074
        if (preg_match('/^(PROD)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    /**
     * Get all stock count items (inventory line items) for this product.
     */
    public function stockCountItems()
    {
        return $this->hasMany(\App\Models\StockCountItem::class, 'product_id');
    }

    // Always return an array for tags, never null
    public function getTagsAttribute($value)
    {
        return is_array($value) ? $value : [];
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function category()
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function incomeAccount()
    {
        return $this->belongsTo(ChartOfAccount::class, 'income_account_id');
    }

    public function vatCategory()
    {
        return $this->belongsTo(TaxRate::class, 'vat_category_id');
    }

    public function isService(): bool
    {
        return $this->type === 'service';
    }

    // Sizes read as numbers, so order them that way: Fr26 before Fr31, 2.0 before 10.
    // Labels with no digits fall to the end, alphabetically.
    public function variants()
    {
        return $this->hasMany(ProductVariant::class, 'product_id')
            ->orderByRaw('coalesce(substring(name from \'[0-9]+\.?[0-9]*\')::numeric, 999999), name');
    }

    public function priceTiers()
    {
        return $this->hasMany(ProductPriceTier::class, 'product_id')->whereNull('variant_id');
    }

    public function receiptItems()
    {
        return $this->hasMany(ProductReceiptItem::class, 'product_id');
    }

    public function variantsByStore($storeId)
    {
        return $this->hasMany(ProductVariant::class, 'product_id')->where('store_id', $storeId);
    }

    /**
     * Always return the short product number when accessing product_number
     */
    public function getReceiptNumberAttribute($value)
    {
        // If product_number is like PROD-853b296e-0074, return PROD-0074
        if (preg_match('/^(RCPT)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    /**
     * Get supplier name - returns relationship name or fallback to supplier string field
     */
    public function getSupplierNameAttribute()
    {
        // First try to get from relationship
        if ($this->supplier && $this->supplier->name) {
            return $this->supplier->name;
        }

        // Fallback to the string supplier field
        return $this->supplier ?? null;
    }

    /**
     * Get all inventory batches for this product
     */
    public function inventoryBatches()
    {
        return $this->hasMany(InventoryBatch::class, 'product_id');
    }

    /**
     * Get active inventory batches
     */
    public function activeBatches()
    {
        return $this->inventoryBatches()->active();
    }

    /**
     * Get available inventory batches (active with available quantity)
     */
    public function availableBatches()
    {
        return $this->inventoryBatches()->available();
    }

    /**
     * Get inventory movements for this product
     */
    public function inventoryMovements()
    {
        return $this->hasMany(InventoryMovement::class, 'product_id');
    }

    /**
     * Get individual serial numbers for this product
     */
    public function serialNumbers()
    {
        return $this->hasMany(InventorySerial::class, 'product_id');
    }

    /**
     * Get active/available serial numbers for this product
     */
    public function availableSerials()
    {
        return $this->serialNumbers()->where('status', 'active');
    }

    /**
     * Get sold serial numbers for this product
     */
    public function soldSerials()
    {
        return $this->serialNumbers()->where('status', 'sold');
    }

    /**
     * Get total available quantity from all batches
     */
    public function getTotalBatchAvailableQuantity()
    {
        return $this->availableBatches()->sum('quantity_available');
    }

    /**
     * Get total allocated quantity from all batches
     */
    public function getTotalBatchAllocatedQuantity()
    {
        return $this->activeBatches()->sum('quantity_allocated');
    }

    /**
     * Check if product uses batch tracking
     */
    public function usesBatchTracking()
    {
        return $this->track_inventory && $this->inventoryBatches()->exists();
    }

    /**
     * Get batches expiring within specified days
     */
    public function getExpiringBatches($days = 30)
    {
        return $this->inventoryBatches()
            ->expiringSoon($days)
            ->available()
            ->orderBy('expiry_date', 'asc');
    }

    /**
     * Get all packaging units for this product
     */
    public function packagingUnits()
    {
        return $this->hasMany(\App\Models\ProductPackagingUnit::class, 'product_id');
    }

    /**
     * Get active packaging units
     */
    public function activePackagingUnits()
    {
        return $this->packagingUnits()->active()->ordered();
    }

    /**
     * Get sellable packaging units
     */
    public function sellablePackagingUnits()
    {
        return $this->packagingUnits()->sellable()->ordered();
    }

    /**
     * Get the base packaging unit
     */
    public function basePackagingUnit()
    {
        return $this->hasOne(\App\Models\ProductPackagingUnit::class, 'product_id')
            ->where('is_base_unit', true);
    }

    /**
     * Get unit inventory records for this product
     */
    public function unitInventory()
    {
        return $this->hasMany(\App\Models\ProductUnitInventory::class, 'product_id');
    }

    /**
     * Get unit inventory for a specific store
     */
    public function unitInventoryForStore($storeId)
    {
        return $this->unitInventory()->where('store_id', $storeId);
    }

    /**
     * Get price history for this product
     */
    public function priceHistory()
    {
        return $this->hasMany(\App\Models\ProductPriceHistory::class, 'product_id')
            ->whereNull('variant_id')
            ->whereNull('packaging_unit_id')
            ->orderBy('created_at', 'desc');
    }

    /**
     * Get all price history including variants and packaging units
     */
    public function allPriceHistory()
    {
        return $this->hasMany(\App\Models\ProductPriceHistory::class, 'product_id')
            ->orderBy('created_at', 'desc');
    }

    /**
     * Check if product uses packaging system
     */
    public function usesPackaging()
    {
        return $this->has_packaging === true;
    }

    /**
     * Get FIFO batches for allocation (First In, First Out)
     */
    public function getFIFOBatches()
    {
        return $this->availableBatches()
            ->orderBy('received_date', 'asc')
            ->orderBy('expiry_date', 'asc');
    }

    /**
     * Get FEFO batches for allocation (First-Expiry, First-Out) - batches
     * with no expiry date sort last, since they're not at risk of expiring.
     */
    public function getFEFOBatches()
    {
        return $this->availableBatches()
            ->orderByRaw('expiry_date IS NULL, expiry_date ASC')
            ->orderBy('received_date', 'asc');
    }

    /**
     * Allocate and immediately consume stock using FEFO (First-Expiry,
     * First-Out) - the batch soonest to expire is drawn down first. Unlike
     * allocateStockFIFO()/InventoryBatch::allocateQuantity(), this sells
     * straight from available stock (no separate reservation step), to
     * match how orders in this app consume stock immediately at creation.
     */
    public function allocateStockFEFO($requestedQuantity, $options = [])
    {
        $allocations = [];
        $remainingQuantity = $requestedQuantity;

        $batches = $this->getFEFOBatches()->get();

        foreach ($batches as $batch) {
            if ($remainingQuantity <= 0) {
                break;
            }

            $toSellFromBatch = min($remainingQuantity, $batch->quantity_available);

            if ($toSellFromBatch > 0) {
                $sold = $batch->sellFromAvailable($toSellFromBatch, [
                    'reference_type' => $options['reference_type'] ?? null,
                    'reference_id' => $options['reference_id'] ?? null,
                    'reference_number' => $options['reference_number'] ?? null,
                ], $options['notes'] ?? null);

                if ($sold) {
                    $allocations[] = [
                        'batch_id' => $batch->id,
                        'batch_number' => $batch->batch_number,
                        'quantity' => $toSellFromBatch,
                        'expiry_date' => $batch->expiry_date?->toDateString(),
                    ];

                    $remainingQuantity -= $toSellFromBatch;
                }
            }
        }

        return [
            'success' => $remainingQuantity == 0,
            'allocated_quantity' => $requestedQuantity - $remainingQuantity,
            'remaining_quantity' => $remainingQuantity,
            'allocations' => $allocations,
        ];
    }

    /**
     * Allocate stock using FIFO method
     */
    public function allocateStockFIFO($requestedQuantity, $options = [])
    {
        $allocations = [];
        $remainingQuantity = $requestedQuantity;

        $batches = $this->getFIFOBatches()->get();

        foreach ($batches as $batch) {
            if ($remainingQuantity <= 0) {
                break;
            }

            $availableInBatch = $batch->quantity_available;
            $toAllocateFromBatch = min($remainingQuantity, $availableInBatch);

            if ($toAllocateFromBatch > 0) {
                $allocated = $batch->allocateQuantity($toAllocateFromBatch, $options['notes'] ?? null);

                if ($allocated) {
                    $allocations[] = [
                        'batch_id' => $batch->id,
                        'batch_number' => $batch->batch_number,
                        'quantity' => $toAllocateFromBatch,
                        'expiry_date' => $batch->expiry_date
                    ];

                    $remainingQuantity -= $toAllocateFromBatch;
                }
            }
        }

        return [
            'success' => $remainingQuantity == 0,
            'allocated_quantity' => $requestedQuantity - $remainingQuantity,
            'remaining_quantity' => $remainingQuantity,
            'allocations' => $allocations
        ];
    }
}
