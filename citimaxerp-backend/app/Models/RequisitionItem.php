<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RequisitionItem extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'requisition_items';


    protected $fillable = [
        'id',
        'requisition_id',
        'product_id',
        'custom_item_name',
        'variant_id',
        'quantity',
        'notes',
    ];


    public function requisition()
    {
        return $this->belongsTo(Requisition::class, 'requisition_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }
}
