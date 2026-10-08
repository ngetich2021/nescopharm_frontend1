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
        if (array_key_exists('product_receipt_items_count', $this->attributes)) {
            return (int) $this->attributes['product_receipt_items_count'];
        }
        if ($this->relationLoaded('productReceiptItems')) {
            return $this->productReceiptItems->count();
        }
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
        'ppb_permit',
        'idf',
        'railway_levy',
        'transport_cost',
        'clearing_agency_fee',
        'other_clearing_cost',
        'certificate_of_conformity',
        'sgs_listing_approval',
        'vat_on_clearing',
        'vat_on_product',
        'import_duty',
        'excise_duty',
        'fob_price',
        // Additional fields for enhanced receipt management
        'receipt_date',
        'total_amount',
        'currency',
        'status',
        'notes',
        'tracking_number',
        'purchase_order_id',
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'receipt_date' => 'date',
        'total_amount' => 'decimal:2',
        'shipping_cost' => 'decimal:2',
        'logistics_cost' => 'decimal:2',
        'ppb_permit' => 'decimal:2',
        'idf' => 'decimal:2',
        'railway_levy' => 'decimal:2',
        'transport_cost' => 'decimal:2',
        'clearing_agency_fee' => 'decimal:2',
        'other_clearing_cost' => 'decimal:2',
        'certificate_of_conformity' => 'decimal:2',
        'sgs_listing_approval' => 'decimal:2',
        'vat_on_clearing' => 'decimal:2',
        'vat_on_product' => 'decimal:2',
        'import_duty' => 'decimal:2',
        'excise_duty' => 'decimal:2',
        'fob_price' => 'decimal:2',
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

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
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
