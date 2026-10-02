<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductReceiptItem extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'product_receipt_id',
        'product_id',
        'variant_id',
        'quantity',
        'unit_price',
        'expiry_date',
        'notes',
        'batch_number',
        'lot_number',
        'manufacture_date',
        'supplier',
        'supplier_id',
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'manufacture_date' => 'date',
        'unit_price' => 'decimal:2',
    ];

    public function productReceipt()
    {
        return $this->belongsTo(ProductReceipt::class);
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

    public function inventoryBatches()
    {
        return $this->hasMany(InventoryBatch::class, 'product_receipt_id', 'product_receipt_id')
                    ->where('product_id', $this->product_id)
                    ->where('variant_id', $this->variant_id);
    }

    public function inventorySerials()
    {
        return $this->hasMany(InventorySerial::class, 'product_id', 'product_id')
                    ->where('purchase_reference', 'like', '%' . $this->productReceipt->product_receipt_number . '%');
    }

    public function store()
    {
        return $this->belongsTo(Store::class, 'store_id');
    }
}
