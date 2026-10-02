<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use App\Traits\PostgresBooleanCast;

class ProductPackagingUnit extends Model
{
    use HasFactory, PostgresBooleanCast;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'product_id',
        'parent_unit_id',
        'unit_name',
        'unit_abbreviation',
        'description',
        'base_unit_quantity',
        'units_per_parent',
        'is_base_unit',
        'is_sellable',
        'is_purchasable',
        'is_active',
        'price_per_unit',
        'cost_per_unit',
        'display_order',
        'barcode',
        'weight',
        'length',
        'width',
        'height',
    ];

    protected $casts = [
        'base_unit_quantity' => 'decimal:4',
        'units_per_parent' => 'decimal:4',
        'price_per_unit' => 'decimal:2',
        'cost_per_unit' => 'decimal:2',
        'display_order' => 'integer',
        'weight' => 'decimal:2',
        'length' => 'decimal:2',
        'width' => 'decimal:2',
        'height' => 'decimal:2',
        // Boolean casts for PostgreSQL compatibility
        'is_base_unit' => 'boolean',
        'is_sellable' => 'boolean',
        'is_purchasable' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected $attributes = [
        'is_active' => true,
        'is_sellable' => true,
        'is_purchasable' => true,
        'is_base_unit' => false,
        'display_order' => 0,
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            
            // Auto-calculate base_unit_quantity from parent hierarchy
            $model->calculateBaseUnitQuantity();
        });
        
        static::updating(function ($model) {
            // Recalculate if parent or units_per_parent changed
            if ($model->isDirty(['parent_unit_id', 'units_per_parent'])) {
                $model->calculateBaseUnitQuantity();
            }
        });
        
        static::updated(function ($model) {
            // If this unit's base_unit_quantity changed, update all children
            if ($model->wasChanged('base_unit_quantity')) {
                $model->updateChildrenBaseQuantities();
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

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Parent packaging unit (e.g., Box's parent is Piece)
     */
    public function parentUnit()
    {
        return $this->belongsTo(ProductPackagingUnit::class, 'parent_unit_id');
    }

    /**
     * Child packaging units (e.g., Piece's children are Box, and Box's children are Carton)
     */
    public function childUnits()
    {
        return $this->hasMany(ProductPackagingUnit::class, 'parent_unit_id');
    }

    /**
     * Get all descendants (children, grandchildren, etc.)
     */
    public function descendants()
    {
        return $this->childUnits()->with('descendants');
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeSellable($query)
    {
        return $query->whereRaw('is_sellable = true')->whereRaw('is_active = true');
    }

    public function scopePurchasable($query)
    {
        return $query->whereRaw('is_purchasable = true')->whereRaw('is_active = true');
    }

    public function scopeBaseUnit($query)
    {
        return $query->whereRaw('is_base_unit = true');
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order', 'asc');
    }

    /**
     * Convert quantity from this unit to base units
     * 
     * @param float $quantity
     * @return float
     */
    public function toBaseUnits($quantity)
    {
        return $quantity * $this->base_unit_quantity;
    }

    /**
     * Convert quantity from base units to this unit
     * 
     * @param float $baseQuantity
     * @return float
     */
    public function fromBaseUnits($baseQuantity)
    {
        if ($this->base_unit_quantity == 0) {
            return 0;
        }
        return $baseQuantity / $this->base_unit_quantity;
    }

    /**
     * Get calculated price for this unit based on product price
     * 
     * @return float|null
     */
    public function getCalculatedPrice()
    {
        // If price is explicitly set, use it
        if ($this->price_per_unit !== null) {
            return $this->price_per_unit;
        }

        // Otherwise, calculate from product base price
        if ($this->product && $this->product->price) {
            return $this->product->price * $this->base_unit_quantity;
        }

        return null;
    }

    /**
     * Get calculated cost for this unit based on product cost
     * 
     * @return float|null
     */
    public function getCalculatedCost()
    {
        // If cost is explicitly set, use it
        if ($this->cost_per_unit !== null) {
            return $this->cost_per_unit;
        }

        // Otherwise, calculate from product base cost
        if ($this->product && $this->product->unit_cost) {
            return $this->product->unit_cost * $this->base_unit_quantity;
        }

        return null;
    }

    /**
     * Get display name with abbreviation
     * 
     * @return string
     */
    public function getDisplayNameAttribute()
    {
        return "{$this->unit_name} ({$this->unit_abbreviation})";
    }

    /**
     * Check if this unit can contain another unit
     * 
     * @param ProductPackagingUnit $otherUnit
     * @return bool
     */
    public function canContain(ProductPackagingUnit $otherUnit)
    {
        return $this->base_unit_quantity > $otherUnit->base_unit_quantity;
    }

    /**
     * Get how many of another unit this unit contains
     * 
     * @param ProductPackagingUnit $otherUnit
     * @return float
     */
    public function getQuantityOf(ProductPackagingUnit $otherUnit)
    {
        if ($otherUnit->base_unit_quantity == 0) {
            return 0;
        }
        return $this->base_unit_quantity / $otherUnit->base_unit_quantity;
    }

    /**
     * Calculate base_unit_quantity from parent hierarchy
     * 
     * @return void
     */
    protected function calculateBaseUnitQuantity()
    {
        // Base unit always has quantity of 1
        if ($this->is_base_unit) {
            $this->base_unit_quantity = 1;
            return;
        }

        // If no parent, but units_per_parent is set, assume it's relative to base
        // (backward compatibility for existing data)
        if (!$this->parent_unit_id && $this->units_per_parent) {
            $this->base_unit_quantity = $this->units_per_parent;
            return;
        }

        // Calculate from parent: this.base_qty = parent.base_qty × units_per_parent
        if ($this->parent_unit_id && $this->units_per_parent) {
            $parent = $this->parentUnit ?? ProductPackagingUnit::find($this->parent_unit_id);
            
            if ($parent) {
                $this->base_unit_quantity = $parent->base_unit_quantity * $this->units_per_parent;
            }
        }
    }

    /**
     * Update all child units' base_unit_quantity when this unit changes
     * 
     * @return void
     */
    protected function updateChildrenBaseQuantities()
    {
        $children = $this->childUnits;
        
        foreach ($children as $child) {
            $child->calculateBaseUnitQuantity();
            $child->saveQuietly(); // Save without triggering events
        }
    }

    /**
     * Get the full hierarchy path (e.g., "Pallet > Carton > Box > Piece")
     * 
     * @return string
     */
    public function getHierarchyPath()
    {
        $path = [$this->unit_name];
        $current = $this;

        while ($current->parentUnit) {
            $current = $current->parentUnit;
            array_unshift($path, $current->unit_name);
        }

        return implode(' > ', $path);
    }

    /**
     * Get hierarchy level (0 = base, 1 = first level above base, etc.)
     * 
     * @return int
     */
    public function getHierarchyLevel()
    {
        if ($this->is_base_unit) {
            return 0;
        }

        $level = 0;
        $current = $this;

        while ($current->parentUnit) {
            $level++;
            $current = $current->parentUnit;
        }

        return $level;
    }

    /**
     * Get price history for this packaging unit
     */
    public function priceHistory()
    {
        return $this->hasMany(\App\Models\ProductPriceHistory::class, 'packaging_unit_id')
                    ->orderBy('created_at', 'desc');
    }

    /**
     * Validate that parent belongs to same product
     * 
     * @return bool
     */
    public function validateParent()
    {
        if (!$this->parent_unit_id) {
            return true;
        }

        $parent = $this->parentUnit ?? ProductPackagingUnit::find($this->parent_unit_id);
        
        return $parent && $parent->product_id === $this->product_id;
    }
}
