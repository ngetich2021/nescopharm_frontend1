<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasProductImages;

class ProductVariant extends Model
{
    use HasProductImages;
    
    protected $table = 'product_variants';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'product_id',
        'company_id',
        'store_id',
        'name',
        'sku',
        'price',
        'cost',
        'stock_quantity',
        'attributes',
        'is_active',
        'options',
        'images',
        'image_url',
        'on_hand',
        'allocated',
    ];

    protected $casts = [
        'id' => 'string',
        'product_id' => 'string',
        'company_id' => 'string',
        'store_id' => 'string',
        'price' => 'decimal:2',
        'cost' => 'decimal:2',
        'stock_quantity' => 'integer',
        'attributes' => 'array',
        // is_active handled by mutator, not cast
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'options' => 'array',
        'images' => 'array',
        'on_hand' => 'integer',
        'allocated' => 'integer',
    ];

    protected $appends = [
        'image_urls',
        'primary_image_url',
        'display_name',
    ];

    // Trailing size list in an item name, e.g. "Fr26,28,31" or "2.0,2.5,3".
    private const SIZE_LIST = '/\s*[A-Za-z]*\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)+\s*$/';

    /**
     * The item name for one size: the size list in the item's name is replaced by the size,
     * so "Endobronchial Tubes Left Fr26,28,31" with size Fr26 reads "Endobronchial Tubes Left Fr26".
     */
    public static function sizedName(?string $productName, ?string $size): string
    {
        $productName = trim((string) $productName);
        $size = trim((string) $size);
        if ($size === '') {
            return $productName;
        }
        $base = trim(preg_replace(self::SIZE_LIST, '', $productName));
        return trim(($base !== '' ? $base : $productName) . ' ' . $size);
    }

    public function getDisplayNameAttribute(): string
    {
        $productName = $this->relationLoaded('product')
            ? $this->product?->name
            : Product::whereKey($this->product_id)->value('name');
        return self::sizedName($productName, $this->name);
    }

    // Boolean mutator for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        // Convert to boolean first
        $boolValue = ($value === true || $value === 1 || $value === '1' || $value === 'true' || $value === 'TRUE');
        // Store as string 'true' or 'false' for PostgreSQL
        $this->attributes['is_active'] = $boolValue ? 'true' : 'false';
    }

    // Get boolean value as actual boolean when retrieving
    public function getIsActiveAttribute($value)
    {
        return (bool) $value;
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function priceTiers()
    {
        return $this->hasMany(ProductPriceTier::class, 'variant_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * Get all inventory batches for this variant
     */
    public function inventoryBatches()
    {
        return $this->hasMany(InventoryBatch::class, 'variant_id');
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
     * Get inventory movements for this variant
     */
    public function inventoryMovements()
    {
        return $this->hasMany(InventoryMovement::class, 'variant_id');
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
     * Check if variant uses batch tracking
     */
    public function usesBatchTracking()
    {
        return $this->inventoryBatches()->exists();
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
     * Get price history for this variant
     */
    public function priceHistory()
    {
        return $this->hasMany(\App\Models\ProductPriceHistory::class, 'variant_id')
                    ->orderBy('created_at', 'desc');
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
     * First-Out) - see Product::allocateStockFEFO() for the reasoning
     * behind selling straight from available stock.
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
}