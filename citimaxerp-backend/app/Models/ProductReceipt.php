<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductReceipt extends Model
{
    /**
     * Always return the short product receipt number when accessing product_receipt_number
     */
    public function getProductReceiptNumberAttribute($value)
    {
        // If product_receipt_number is like RCPT-853b296e-0074, return RCPT-0074
        if (preg_match('/^(RCPT)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    // Always include the count of product receipt items in API responses
    protected $appends = ['items_count'];

    public function getItemsCountAttribute()
    {
        return $this->productReceiptItems()->count();
    }
  
    protected $fillable = [
        'id',
        'company_id',
        'supplier_id',
        'contractor_id',
        'document_type',
        'document_url',
        'product_receipt_number',
        'reference_number',
        'received_by',
        'store_id',
        'shipping_cost',
        'logistics_cost',
        // Additional fields for enhanced receipt management
        'receipt_date',        // Date when receipt was created/processed
        'total_amount',        // Total value of the receipt
        'currency',           // Currency used
        'status',            // Receipt status (pending, confirmed, processed, etc.)
        'notes',             // General notes about the receipt
        'tracking_number',   // Delivery tracking number
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'receipt_date' => 'date',
        'total_amount' => 'decimal:2',
        'shipping_cost' => 'decimal:2',
        'logistics_cost' => 'decimal:2',
    ];

      public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function contractor()
    {
        // If you have a Contractor model, use it. Otherwise, fallback to User.
        return $this->belongsTo(User::class, 'contractor_id');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function productReceiptItems()
    {
        return $this->hasMany(ProductReceiptItem::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

}
