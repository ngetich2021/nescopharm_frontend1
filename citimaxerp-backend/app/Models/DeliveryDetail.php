<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryDetail extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'customer_id',
        'order_id',
        'delivery_location_id',
        'delivery_method',
        'tracking_number',
        'estimated_delivery_date',
        'actual_delivery_date',
        'delivery_status',
        'delivery_instructions',
        'company_id',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'estimated_delivery_date' => 'date',
        'actual_delivery_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function deliveryLocation()
    {
        return $this->belongsTo(DeliveryLocation::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}