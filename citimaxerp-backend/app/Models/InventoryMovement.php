<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class InventoryMovement extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'store_id',
        'product_id',
        'variant_id',
        'batch_id',
        'type',
        'quantity',
        'quantity_before',
        'quantity_after',
        'reference_type',
        'reference_id',
        'reference_number',
        'unit_cost',
        'unit_price',
        'total_cost',
        'total_value',
        'movement_date',
        'created_by',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'unit_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'total_value' => 'decimal:2',
        'movement_date' => 'datetime',
        'metadata' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->movement_date)) {
                $model->movement_date = now();
            }
        });
    }

    /**
     * Relationships
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function batch()
    {
        return $this->belongsTo(InventoryBatch::class, 'batch_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scopes
     */
    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeForStore($query, $storeId)
    {
        return $query->where('store_id', $storeId);
    }

    public function scopeForProduct($query, $productId, $variantId = null)
    {
        $query = $query->where('product_id', $productId);
        
        if ($variantId) {
            $query->where('variant_id', $variantId);
        }
        
        return $query;
    }

    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function scopeInbound($query)
    {
        return $query->whereIn('type', ['receipt', 'transfer_in', 'return']);
    }

    public function scopeOutbound($query)
    {
        return $query->whereIn('type', ['sale', 'transfer_out', 'damage', 'expiry']);
    }

    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('movement_date', [$startDate, $endDate]);
    }

    public function scopeRecent($query, $days = 30)
    {
        return $query->where('movement_date', '>=', now()->subDays($days));
    }

    /**
     * Helper Methods
     */
    public function isInbound()
    {
        return in_array($this->type, ['receipt', 'transfer_in', 'return']);
    }

    public function isOutbound()
    {
        return in_array($this->type, ['sale', 'transfer_out', 'damage', 'expiry']);
    }

    public function getAbsoluteQuantity()
    {
        return abs($this->quantity);
    }

    public function getMovementDescription()
    {
        $descriptions = [
            'receipt' => 'Stock received',
            'sale' => 'Stock sold',
            'adjustment' => 'Stock adjustment',
            'transfer_out' => 'Stock transferred out',
            'transfer_in' => 'Stock transferred in',
            'return' => 'Stock returned',
            'damage' => 'Stock damaged',
            'expiry' => 'Stock expired',
            'recount' => 'Stock count adjustment'
        ];

        return $descriptions[$this->type] ?? 'Unknown movement';
    }

    /**
     * Static Methods for Creating Movements
     */
    public static function createReceipt($data)
    {
        return static::create(array_merge($data, [
            'type' => 'receipt',
            'quantity' => abs($data['quantity']), // Ensure positive for receipts
        ]));
    }

    public static function createSale($data)
    {
        return static::create(array_merge($data, [
            'type' => 'sale',
            'quantity' => -abs($data['quantity']), // Ensure negative for sales
        ]));
    }

    public static function createAdjustment($data)
    {
        return static::create(array_merge($data, [
            'type' => 'adjustment',
            // Quantity can be positive or negative for adjustments
        ]));
    }

    public static function createTransferOut($data)
    {
        return static::create(array_merge($data, [
            'type' => 'transfer_out',
            'quantity' => -abs($data['quantity']), // Ensure negative for outbound
        ]));
    }

    public static function createTransferIn($data)
    {
        return static::create(array_merge($data, [
            'type' => 'transfer_in',
            'quantity' => abs($data['quantity']), // Ensure positive for inbound
        ]));
    }

    public static function createDamage($data)
    {
        return static::create(array_merge($data, [
            'type' => 'damage',
            'quantity' => -abs($data['quantity']), // Ensure negative
        ]));
    }

    public static function createExpiry($data)
    {
        return static::create(array_merge($data, [
            'type' => 'expiry',
            'quantity' => -abs($data['quantity']), // Ensure negative
        ]));
    }

    public static function createReturn($data)
    {
        return static::create(array_merge($data, [
            'type' => 'return',
            'quantity' => abs($data['quantity']), // Ensure positive for returns
        ]));
    }
}
