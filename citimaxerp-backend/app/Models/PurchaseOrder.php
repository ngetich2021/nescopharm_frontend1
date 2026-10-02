<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Company;

class PurchaseOrder extends Model
    /**
     * Always return the short purchase order number when accessing order_number
     */
{
    use HasFactory;

    public function getOrderNumberAttribute($value)
    {
        // If order_number is like PO-853b296e-0074, return PO-0074
        if (preg_match('/^(PO)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'order_number',
        'supplier_id',
        'supplier_name',
        'supplier_reference',
        'discount',
        'shipping_cost',
        'logistics_cost',
        'supplier_invoice_date',
        'tax_rate',
        'store_id',
        'exchange_rate',
        'order_date',
        'delivery_date',
        'template',
        'currency_code',
        'status',
        'approval_status',
        'approved_by',
        'comments',
        'created_by',
        'updated_by',
        'parent_id',
        'total_amount',
        'amount_paid',
        'payment_status',
    ];

    protected $casts = [
        'order_date' => 'date',
        'delivery_date' => 'date',
        'supplier_invoice_date' => 'date',
        'discount' => 'decimal:2',
        'shipping_cost' => 'decimal:2',
        'logistics_cost' => 'decimal:2',
        'exchange_rate' => 'decimal:4',
        'total_amount' => 'decimal:2',
        'amount_paid' => 'decimal:2',
    ];

    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class, 'purchase_order_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function store()
    {
        return $this->belongsTo(Store::class, 'store_id');
    }

    public function parent()
    {
        return $this->belongsTo(PurchaseOrder::class, 'parent_id');
    }

    public function product()
    {
        return $this->hasManyThrough(Product::class, PurchaseOrderItem::class, 'purchase_order_id', 'id', 'id', 'product_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function payments()
    {
        return $this->hasMany(SupplierPayment::class);
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
