<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class InventoryBatch extends Model
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
        'batch_number',
        'lot_number',
        'serial_number',
        'quantity_received',
        'quantity_available',
        'quantity_allocated',
        'quantity_sold',
        'quantity_damaged',
        'quantity_expired',
        'manufacture_date',
        'expiry_date',
        'received_date',
        'unit_cost',
        'selling_price',
        'status',
        'supplier',
        'supplier_id',
        'purchase_order_number',
        'product_receipt_id',
        'notes',
        'custom_attributes',
    ];

    protected $casts = [
        'manufacture_date' => 'date',
        'expiry_date' => 'date',
        'received_date' => 'date',
        'unit_cost' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'custom_attributes' => 'array',
    ];

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

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function productReceipt()
    {
        return $this->belongsTo(ProductReceipt::class, 'product_receipt_id');
    }

    public function movements()
    {
        return $this->hasMany(InventoryMovement::class, 'batch_id');
    }

    public function serialNumbers()
    {
        return $this->hasMany(InventorySerial::class, 'batch_id');
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeExpired($query)
    {
        return $query->where('status', 'expired')
                    ->orWhere('expiry_date', '<', now());
    }

    public function scopeExpiringSoon($query, $days = 30)
    {
        return $query->where('status', 'active')
                    ->where('expiry_date', '<=', now()->addDays($days))
                    ->where('expiry_date', '>=', now());
    }

    public function scopeAvailable($query)
    {
        return $query->where('status', 'active')
                    ->where('quantity_available', '>', 0);
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeForStore($query, $storeId)
    {
        return $query->where('store_id', $storeId);
    }

    /**
     * Helper Methods
     */
    public function isExpired()
    {
        return $this->expiry_date && $this->expiry_date->isPast();
    }

    public function isExpiringSoon($days = 30)
    {
        if (!$this->expiry_date) {
            return false;
        }

        return $this->expiry_date->between(now(), now()->addDays($days));
    }

    public function getTotalQuantity()
    {
        return $this->quantity_available + $this->quantity_allocated;
    }

    public function canAllocate($quantity)
    {
        return $this->quantity_available >= $quantity && $this->status === 'active';
    }

    public function allocateQuantity($quantity, $notes = null)
    {
        if (!$this->canAllocate($quantity)) {
            return false;
        }

        $this->quantity_available -= $quantity;
        $this->quantity_allocated += $quantity;
        $this->save();

        // Create movement record as adjustment (allocation)
        $this->movements()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company_id,
            'store_id' => $this->store_id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'type' => 'adjustment', // Use adjustment type for allocations
            'quantity' => -$quantity,
            'quantity_before' => $this->quantity_available + $quantity,
            'quantity_after' => $this->quantity_available,
            'unit_cost' => $this->unit_cost,
            'unit_price' => $this->selling_price,
            'notes' => $notes ? "ALLOCATION: {$notes}" : 'Stock allocation',
            'metadata' => [
                'movement_subtype' => 'allocation',
                'allocated_quantity' => $quantity
            ]
        ]);

        return true;
    }

    public function deallocateQuantity($quantity, $notes = null)
    {
        if ($this->quantity_allocated < $quantity) {
            return false;
        }

        $this->quantity_allocated -= $quantity;
        $this->quantity_available += $quantity;
        $this->save();

        // Create movement record as adjustment (deallocation)
        $this->movements()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company_id,
            'store_id' => $this->store_id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'type' => 'adjustment', // Use adjustment type for deallocations
            'quantity' => $quantity,
            'quantity_before' => $this->quantity_available - $quantity,
            'quantity_after' => $this->quantity_available,
            'unit_cost' => $this->unit_cost,
            'unit_price' => $this->selling_price,
            'notes' => $notes ? "DEALLOCATION: {$notes}" : 'Stock deallocation',
            'metadata' => [
                'movement_subtype' => 'deallocation',
                'deallocated_quantity' => $quantity
            ]
        ]);

        return true;
    }

    public function sellQuantity($quantity, $unitPrice = null, $notes = null)
    {
        if ($this->quantity_allocated < $quantity) {
            return false;
        }

        $this->quantity_allocated -= $quantity;
        $this->quantity_sold += $quantity;
        $this->save();

        // Update status if sold out
        if ($this->getTotalQuantity() <= 0) {
            $this->status = 'sold_out';
            $this->save();
        }

        // Create movement record
        $this->movements()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company_id,
            'store_id' => $this->store_id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'type' => 'sale',
            'quantity' => -$quantity,
            'quantity_before' => $this->quantity_allocated + $quantity,
            'quantity_after' => $this->quantity_allocated,
            'unit_cost' => $this->unit_cost,
            'unit_price' => $unitPrice ?? $this->selling_price,
            'total_value' => $quantity * ($unitPrice ?? $this->selling_price),
            'notes' => $notes,
        ]);

        return true;
    }

    /**
     * Deduct straight from available -> sold, skipping the "allocated" hold
     * step. Orders in this system consume stock immediately at creation
     * time (there is no separate reserve-then-fulfil lifecycle), so this
     * mirrors that: a single movement, not allocate() followed by sell().
     */
    public function sellFromAvailable($quantity, array $reference = [], $notes = null)
    {
        if ($quantity <= 0 || $this->quantity_available < $quantity) {
            return false;
        }

        $before = $this->quantity_available;
        $this->quantity_available -= $quantity;
        $this->quantity_sold += $quantity;
        $this->save();
        $this->updateStatus();

        $this->movements()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company_id,
            'store_id' => $this->store_id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'type' => 'sale',
            'quantity' => -$quantity,
            'quantity_before' => $before,
            'quantity_after' => $this->quantity_available,
            'unit_cost' => $this->unit_cost,
            'unit_price' => $this->selling_price,
            'total_value' => $quantity * ($this->selling_price ?? 0),
            'reference_type' => $reference['reference_type'] ?? null,
            'reference_id' => $reference['reference_id'] ?? null,
            'reference_number' => $reference['reference_number'] ?? null,
            'notes' => $notes,
        ]);

        return true;
    }

    /**
     * Reverse a sellFromAvailable() - used when an order line that consumed
     * this batch is edited or deleted, so the batch isn't left permanently
     * short.
     */
    public function restoreFromSale($quantity, array $reference = [], $notes = null)
    {
        if ($quantity <= 0) {
            return false;
        }

        $quantity = min($quantity, $this->quantity_sold);
        if ($quantity <= 0) {
            return false;
        }

        $before = $this->quantity_available;
        $this->quantity_available += $quantity;
        $this->quantity_sold -= $quantity;
        $this->save();
        $this->updateStatus();

        $this->movements()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company_id,
            'store_id' => $this->store_id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'type' => 'return',
            'quantity' => $quantity,
            'quantity_before' => $before,
            'quantity_after' => $this->quantity_available,
            'unit_cost' => $this->unit_cost,
            'unit_price' => $this->selling_price,
            'total_value' => $quantity * ($this->selling_price ?? 0),
            'reference_type' => $reference['reference_type'] ?? null,
            'reference_id' => $reference['reference_id'] ?? null,
            'reference_number' => $reference['reference_number'] ?? null,
            'notes' => $notes ?? 'Order edited/cancelled - batch stock restored',
        ]);

        return true;
    }

    /**
     * Dispatch stock lifecycle — mirrors the on_hand -> stock_quantity
     * reserve/finalize/release/return state machine used for product/variant
     * stock, applied at the batch level: available -> allocated -> sold,
     * with release/return paths back the other way.
     */
    public function allocateForDispatch($quantity, array $reference = [], $notes = null)
    {
        if ($quantity <= 0 || $this->quantity_available < $quantity) {
            return false;
        }

        $before = $this->quantity_available;
        $this->quantity_available -= $quantity;
        $this->quantity_allocated += $quantity;
        $this->save();

        $this->movements()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company_id,
            'store_id' => $this->store_id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'type' => 'transfer_out',
            'quantity' => -$quantity,
            'quantity_before' => $before,
            'quantity_after' => $this->quantity_available,
            'unit_cost' => $this->unit_cost,
            'unit_price' => $this->selling_price,
            'reference_type' => $reference['reference_type'] ?? null,
            'reference_id' => $reference['reference_id'] ?? null,
            'reference_number' => $reference['reference_number'] ?? null,
            'notes' => $notes ?? 'Allocated for dispatch',
        ]);

        return true;
    }

    public function releaseDispatchAllocation($quantity, array $reference = [], $notes = null)
    {
        if ($quantity <= 0) {
            return false;
        }

        $quantity = min($quantity, $this->quantity_allocated);
        if ($quantity <= 0) {
            return false;
        }

        $before = $this->quantity_available;
        $this->quantity_available += $quantity;
        $this->quantity_allocated -= $quantity;
        $this->save();

        $this->movements()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company_id,
            'store_id' => $this->store_id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'type' => 'transfer_in',
            'quantity' => $quantity,
            'quantity_before' => $before,
            'quantity_after' => $this->quantity_available,
            'unit_cost' => $this->unit_cost,
            'unit_price' => $this->selling_price,
            'reference_type' => $reference['reference_type'] ?? null,
            'reference_id' => $reference['reference_id'] ?? null,
            'reference_number' => $reference['reference_number'] ?? null,
            'notes' => $notes ?? 'Dispatch allocation released',
        ]);

        return true;
    }

    public function issueForDispatch($quantity, array $reference = [], $notes = null)
    {
        if ($quantity <= 0 || $this->quantity_allocated < $quantity) {
            return false;
        }

        $before = $this->quantity_allocated;
        $this->quantity_allocated -= $quantity;
        $this->quantity_sold += $quantity;
        $this->save();
        $this->updateStatus();

        $this->movements()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company_id,
            'store_id' => $this->store_id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'type' => 'transfer_out',
            'quantity' => -$quantity,
            'quantity_before' => $before,
            'quantity_after' => $this->quantity_allocated,
            'unit_cost' => $this->unit_cost,
            'unit_price' => $this->selling_price,
            'reference_type' => $reference['reference_type'] ?? null,
            'reference_id' => $reference['reference_id'] ?? null,
            'reference_number' => $reference['reference_number'] ?? null,
            'notes' => $notes ?? 'Issued on dispatch acknowledgement',
        ]);

        return true;
    }

    public function returnFromDispatch($quantity, array $reference = [], $notes = null)
    {
        if ($quantity <= 0) {
            return false;
        }

        $quantity = min($quantity, $this->quantity_sold);
        if ($quantity <= 0) {
            return false;
        }

        $before = $this->quantity_available;
        $this->quantity_available += $quantity;
        $this->quantity_sold -= $quantity;
        $this->save();
        $this->updateStatus();

        $this->movements()->create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->company_id,
            'store_id' => $this->store_id,
            'product_id' => $this->product_id,
            'variant_id' => $this->variant_id,
            'type' => 'transfer_in',
            'quantity' => $quantity,
            'quantity_before' => $before,
            'quantity_after' => $this->quantity_available,
            'unit_cost' => $this->unit_cost,
            'unit_price' => $this->selling_price,
            'reference_type' => $reference['reference_type'] ?? null,
            'reference_id' => $reference['reference_id'] ?? null,
            'reference_number' => $reference['reference_number'] ?? null,
            'notes' => $notes ?? 'Dispatch item returned',
        ]);

        return true;
    }

    /**
     * Generate unique batch number
     */
    public static function generateBatchNumber($companyId, $productId)
    {
        $prefix = 'BATCH-' . substr($companyId, 0, 8) . '-' . substr($productId, 0, 8);
        $timestamp = now()->format('ymd-His');
        $random = strtoupper(substr(md5(uniqid()), 0, 4));
        
        return $prefix . '-' . $timestamp . '-' . $random;
    }

    /**
     * Auto-update status based on expiry and quantities
     */
    public function updateStatus()
    {
        if ($this->isExpired()) {
            $this->status = 'expired';
        } elseif ($this->getTotalQuantity() <= 0) {
            $this->status = 'sold_out';
        } elseif ($this->status !== 'active' && $this->getTotalQuantity() > 0 && !$this->isExpired()) {
            $this->status = 'active';
        }
        
        $this->save();
        return $this;
    }
}
