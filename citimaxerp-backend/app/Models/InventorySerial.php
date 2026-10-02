<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class InventorySerial extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'store_id',
        'product_id',
        'variant_id',
        'batch_id',
        'serial_number',
        'barcode',
        'qr_code',
        'status',
        'unit_cost',
        'unit_price',
        'received_date',
        'sold_date',
        'warranty_expiry_date',
        'purchase_reference',
        'sale_reference',
        'customer_id',
        'custom_attributes',
        'notes',
        'created_by',
        'updated_by'
    ];

    protected $casts = [
        'id' => 'string',
        'received_date' => 'date',
        'sold_date' => 'date',
        'warranty_expiry_date' => 'date',
        'unit_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'custom_attributes' => 'array',
    ];

    /**
     * Boot the model
     */
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
        return $this->belongsTo(ProductVariant::class);
    }

    public function batch()
    {
        return $this->belongsTo(InventoryBatch::class, 'batch_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Scopes
     */
    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeSold($query)
    {
        return $query->where('status', 'sold');
    }

    public function scopeAvailable($query)
    {
        return $query->whereIn('status', ['active']);
    }

    public function scopeByProduct($query, $productId)
    {
        return $query->where('product_id', $productId);
    }

    public function scopeByVariant($query, $variantId)
    {
        return $query->where('variant_id', $variantId);
    }

    public function scopeByBatch($query, $batchId)
    {
        return $query->where('batch_id', $batchId);
    }

    public function scopeWarrantyExpiring($query, $days = 30)
    {
        return $query->whereNotNull('warranty_expiry_date')
                    ->where('warranty_expiry_date', '<=', now()->addDays($days))
                    ->where('warranty_expiry_date', '>=', now());
    }

    /**
     * Business Logic Methods
     */

    /**
     * Mark serial as sold
     */
    public function markAsSold($saleReference, $customerId = null, $unitPrice = null)
    {
        $this->update([
            'status' => 'sold',
            'sold_date' => now(),
            'sale_reference' => $saleReference,
            'customer_id' => $customerId,
            'unit_price' => $unitPrice ?? $this->unit_price,
        ]);
    }

    /**
     * Mark serial as returned
     */
    public function markAsReturned($notes = null)
    {
        $this->update([
            'status' => 'returned',
            'sold_date' => null,
            'sale_reference' => null,
            'customer_id' => null,
            'notes' => $notes
        ]);
    }

    /**
     * Mark serial as damaged
     */
    public function markAsDamaged($notes = null)
    {
        $this->update([
            'status' => 'damaged',
            'notes' => $notes
        ]);
    }

    /**
     * Check if serial is available for sale
     */
    public function isAvailable()
    {
        return $this->status === 'active';
    }

    /**
     * Check if warranty is still valid
     */
    public function isUnderWarranty()
    {
        return $this->warranty_expiry_date && $this->warranty_expiry_date >= now();
    }

    /**
     * Get warranty status
     */
    public function getWarrantyStatus()
    {
        if (!$this->warranty_expiry_date) {
            return 'no_warranty';
        }
        
        if ($this->warranty_expiry_date < now()) {
            return 'expired';
        }
        
        $daysLeft = now()->diffInDays($this->warranty_expiry_date, false);
        
        if ($daysLeft <= 30) {
            return 'expiring_soon';
        }
        
        return 'active';
    }

    /**
     * Generate a unique serial number
     */
    public static function generateSerialNumber($companyId, $productId, $prefix = null)
    {
        $prefix = $prefix ?? 'SN';
        $companyPrefix = substr($companyId, 0, 6);
        $productPrefix = substr($productId, 0, 6);
        $timestamp = now()->format('ymd');
        
        // Get the next sequence number for this product
        $lastSerial = static::where('company_id', $companyId)
                           ->where('product_id', $productId)
                           ->whereDate('created_at', now())
                           ->count();
        
        $sequence = str_pad($lastSerial + 1, 4, '0', STR_PAD_LEFT);
        
        return "{$prefix}-{$companyPrefix}-{$productPrefix}-{$timestamp}-{$sequence}";
    }

    /**
     * Bulk create serial numbers
     */
    public static function bulkCreate($serials)
    {
        $createdSerials = [];
        
        foreach ($serials as $serialData) {
            // Generate serial number if not provided
            if (empty($serialData['serial_number'])) {
                $serialData['serial_number'] = static::generateSerialNumber(
                    $serialData['company_id'],
                    $serialData['product_id'],
                    $serialData['prefix'] ?? null
                );
            }
            
            $serial = static::create($serialData);
            $createdSerials[] = $serial;
        }
        
        return collect($createdSerials);
    }

    /**
     * Search by serial number across company
     */
    public static function findBySerialNumber($serialNumber, $companyId)
    {
        return static::forCompany($companyId)
                    ->where('serial_number', $serialNumber)
                    ->with(['product', 'variant', 'batch', 'store', 'customer'])
                    ->first();
    }

    /**
     * Get serial numbers for a specific batch
     */
    public static function getBatchSerials($batchId, $companyId)
    {
        return static::forCompany($companyId)
                    ->byBatch($batchId)
                    ->with(['product', 'variant'])
                    ->orderBy('serial_number')
                    ->get();
    }
}
