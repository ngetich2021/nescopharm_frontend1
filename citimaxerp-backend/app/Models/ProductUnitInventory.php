<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ProductUnitInventory extends Model
{
    use HasFactory;

    protected $table = 'product_unit_inventory';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'store_id',
        'product_id',
        'variant_id',
        'unit_id',
        'quantity',
        'allocated',
        'on_hold',
        'damaged',
        'reorder_level',
        'reorder_quantity',
        'last_restocked_at',
        'last_sold_at',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'allocated' => 'integer',
        'on_hold' => 'integer',
        'damaged' => 'integer',
        'reorder_level' => 'integer',
        'reorder_quantity' => 'integer',
        'last_restocked_at' => 'datetime',
        'last_sold_at' => 'datetime',
    ];

    protected $appends = ['available'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
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

    public function unit()
    {
        return $this->belongsTo(ProductPackagingUnit::class, 'unit_id');
    }

    /**
     * Accessors
     */
    public function getAvailableAttribute()
    {
        return max(0, $this->quantity - $this->allocated);
    }

    /**
     * Scopes
     */
    public function scopeForProduct($query, $productId, $variantId = null)
    {
        $query->where('product_id', $productId);
        
        if ($variantId) {
            $query->where('variant_id', $variantId);
        }
        
        return $query;
    }

    public function scopeForStore($query, $storeId)
    {
        return $query->where('store_id', $storeId);
    }

    public function scopeForUnit($query, $unitId)
    {
        return $query->where('unit_id', $unitId);
    }

    public function scopeAvailableOnly($query)
    {
        return $query->whereRaw('quantity > allocated');
    }

    public function scopeLowStock($query)
    {
        return $query->whereNotNull('reorder_level')
                    ->whereRaw('(quantity - allocated) <= reorder_level');
    }

    /**
     * Inventory Operations
     */

    /**
     * Add inventory for this unit
     * 
     * @param int $quantity
     * @return bool
     */
    public function addInventory($quantity)
    {
        if ($quantity <= 0) {
            return false;
        }

        $this->quantity += $quantity;
        $this->last_restocked_at = now();
        return $this->save();
    }

    /**
     * Remove inventory for this unit
     * 
     * @param int $quantity
     * @return bool
     */
    public function removeInventory($quantity)
    {
        if ($quantity <= 0) {
            return false;
        }

        if ($this->available < $quantity) {
            return false; // Not enough available
        }

        $this->quantity -= $quantity;
        $this->last_sold_at = now();
        return $this->save();
    }

    /**
     * Allocate inventory for this unit
     * 
     * @param int $quantity
     * @return bool
     */
    public function allocate($quantity)
    {
        if ($quantity <= 0) {
            return false;
        }

        if ($this->available < $quantity) {
            return false; // Not enough available
        }

        $this->allocated += $quantity;
        return $this->save();
    }

    /**
     * Deallocate inventory for this unit
     * 
     * @param int $quantity
     * @return bool
     */
    public function deallocate($quantity)
    {
        if ($quantity <= 0) {
            return false;
        }

        if ($this->allocated < $quantity) {
            $quantity = $this->allocated; // Deallocate what we can
        }

        $this->allocated -= $quantity;
        return $this->save();
    }

    /**
     * Convert allocated inventory to sold (remove from both)
     * 
     * @param int $quantity
     * @return bool
     */
    public function fulfillAllocation($quantity)
    {
        if ($quantity <= 0) {
            return false;
        }

        if ($this->allocated < $quantity) {
            return false; // Can't fulfill more than allocated
        }

        $this->quantity -= $quantity;
        $this->allocated -= $quantity;
        $this->last_sold_at = now();
        return $this->save();
    }

    /**
     * Mark units as damaged
     * 
     * @param int $quantity
     * @return bool
     */
    public function markDamaged($quantity)
    {
        if ($quantity <= 0) {
            return false;
        }

        if ($this->available < $quantity) {
            return false; // Not enough available
        }

        $this->quantity -= $quantity;
        $this->damaged += $quantity;
        return $this->save();
    }

    /**
     * Put units on hold
     * 
     * @param int $quantity
     * @return bool
     */
    public function putOnHold($quantity)
    {
        if ($quantity <= 0) {
            return false;
        }

        if ($this->available < $quantity) {
            return false; // Not enough available
        }

        $this->on_hold += $quantity;
        $this->allocated += $quantity; // On hold counts as allocated
        return $this->save();
    }

    /**
     * Release units from hold
     * 
     * @param int $quantity
     * @return bool
     */
    public function releaseFromHold($quantity)
    {
        if ($quantity <= 0) {
            return false;
        }

        if ($this->on_hold < $quantity) {
            $quantity = $this->on_hold; // Release what we can
        }

        $this->on_hold -= $quantity;
        $this->allocated -= $quantity;
        return $this->save();
    }

    /**
     * Check if reorder is needed
     * 
     * @return bool
     */
    public function needsReorder()
    {
        if ($this->reorder_level === null) {
            return false;
        }

        return $this->available <= $this->reorder_level;
    }

    /**
     * Get quantity in base units
     * 
     * @return float
     */
    public function getQuantityInBaseUnits()
    {
        if (!$this->unit) {
            return 0;
        }

        return $this->unit->toBaseUnits($this->quantity);
    }

    /**
     * Get available quantity in base units
     * 
     * @return float
     */
    public function getAvailableInBaseUnits()
    {
        if (!$this->unit) {
            return 0;
        }

        return $this->unit->toBaseUnits($this->available);
    }
}
